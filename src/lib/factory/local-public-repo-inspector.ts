import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type LocalPublicRepoSnapshot = {
  fullName: string
  repoDir: string
  repoUrl: string
  defaultBranch: string
  headSha: string
  files: string[]
  readmePath: string | null
  readme: string
  cacheHit: boolean
  cloned: boolean
  warning?: string
}

const CACHE_TTL_MS = 12 * 60 * 60 * 1000
const MAX_TREE_BYTES = 10 * 1024 * 1024
const MAX_FILE_BYTES = 2 * 1024 * 1024

function cacheRoot() {
  return process.env.FACTORY_RESEARCH_CACHE_DIR?.trim() || path.join(os.tmpdir(), 'ai-product-factory-public-repos')
}

function safeRepoDir(fullName: string) {
  return fullName.toLowerCase().replace(/[^a-z0-9._-]+/g, '--').slice(0, 160)
}

async function runGit(args: string[], cwd?: string, timeout = 20_000) {
  const result = await execFileAsync('git', args, {
    cwd,
    timeout,
    maxBuffer: MAX_TREE_BYTES,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  })
  return String(result.stdout || '').trim()
}

async function gitAvailable() {
  try {
    await runGit(['--version'], undefined, 4_000)
    return true
  } catch {
    return false
  }
}

async function isFresh(repoDir: string) {
  try {
    const metadata = await stat(path.join(repoDir, '.factory-index.json'))
    return Date.now() - metadata.mtimeMs < CACHE_TTL_MS
  } catch {
    return false
  }
}

async function clonePublicRepo(fullName: string, repoDir: string, preferredBranch?: string) {
  const repoUrl = `https://github.com/${fullName}.git`
  await rm(repoDir, { recursive: true, force: true })
  await mkdir(path.dirname(repoDir), { recursive: true })

  const common = ['clone', '--depth=1', '--filter=blob:none', '--no-checkout', '--single-branch']
  try {
    const branchArgs = preferredBranch ? ['--branch', preferredBranch] : []
    await runGit([...common, ...branchArgs, repoUrl, repoDir], undefined, 24_000)
  } catch {
    await rm(repoDir, { recursive: true, force: true })
    await runGit([...common, repoUrl, repoDir], undefined, 24_000)
  }
}

async function readAtHead(repoDir: string, relativePath: string, limit: number) {
  try {
    const result = await execFileAsync('git', ['show', `HEAD:${relativePath}`], {
      cwd: repoDir,
      timeout: 8_000,
      maxBuffer: MAX_FILE_BYTES,
      encoding: 'utf8',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    return String(result.stdout || '').slice(0, limit)
  } catch {
    return ''
  }
}

function selectReadme(files: string[]) {
  return files
    .filter((file) => /(^|\/)readme(?:\.[a-z0-9]+)?$/i.test(file))
    .sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length)[0] || null
}

export async function inspectPublicRepositoryLocally(fullName: string, preferredBranch?: string): Promise<LocalPublicRepoSnapshot | null> {
  if (process.env.FACTORY_TOKENLESS_LOCAL_CLONE === '0') return null
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)) return null
  if (!(await gitAvailable())) return null

  const root = cacheRoot()
  const repoDir = path.join(root, safeRepoDir(fullName))
  const fresh = await isFresh(repoDir)
  let cloned = false

  try {
    if (!fresh) {
      await clonePublicRepo(fullName, repoDir, preferredBranch)
      cloned = true
    }

    const headSha = await runGit(['rev-parse', 'HEAD'], repoDir, 5_000)
    const branch = (await runGit(['branch', '--show-current'], repoDir, 5_000)) || preferredBranch || 'main'
    const tree = await runGit(['ls-tree', '-r', '--name-only', 'HEAD'], repoDir, 12_000)
    const files = tree.split('\n').map((item) => item.trim()).filter(Boolean).slice(0, 12_000)
    const readmePath = selectReadme(files)
    const readme = readmePath ? await readAtHead(repoDir, readmePath, 60_000) : ''

    await writeFile(path.join(repoDir, '.factory-index.json'), JSON.stringify({
      fullName,
      headSha,
      branch,
      filesSeen: files.length,
      indexedAt: new Date().toISOString(),
    }, null, 2), 'utf8')

    return {
      fullName,
      repoDir,
      repoUrl: `https://github.com/${fullName}`,
      defaultBranch: branch,
      headSha,
      files,
      readmePath,
      readme,
      cacheHit: fresh,
      cloned,
    }
  } catch (error) {
    return {
      fullName,
      repoDir,
      repoUrl: `https://github.com/${fullName}`,
      defaultBranch: preferredBranch || 'main',
      headSha: '',
      files: [],
      readmePath: null,
      readme: '',
      cacheHit: false,
      cloned,
      warning: error instanceof Error ? error.message : 'Local public-repository inspection failed',
    }
  }
}

export async function readPublicRepoFiles(snapshot: LocalPublicRepoSnapshot, paths: string[], perFileLimit = 22_000) {
  const unique = [...new Set(paths)].slice(0, 10)
  return Promise.all(unique.map(async (filePath) => ({
    path: filePath,
    content: await readAtHead(snapshot.repoDir, filePath, perFileLimit),
  })))
}
