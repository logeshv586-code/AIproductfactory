import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const REPO_URL = 'https://github.com/Egonex-AI/Understand-Anything.git'
// Pin the upstream source used by this integration so every developer and CI
// machine gets the same skill behavior. Update intentionally with --update.
const DEFAULT_REF = '32944829e7a63a9fa9c55d811d7f98a9530c6a6a'
const TOOLS_DIR = path.join(ROOT, '.tools')
const CHECKOUT = path.join(TOOLS_DIR, 'understand-anything')
const SKILLS_SOURCE = path.join(CHECKOUT, 'understand-anything-plugin', 'skills')
const AGENT_SKILLS = path.join(ROOT, '.agents', 'skills')
const STATE_FILE = path.join(ROOT, '.understand-anything.local.json')

const args = new Set(process.argv.slice(2))
const statusOnly = args.has('--status')
const update = args.has('--update')

function run(command, commandArgs, options = {}) {
  return execFileSync(command, commandArgs, {
    cwd: ROOT,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: options.capture ? 'utf8' : undefined,
    ...options,
  })
}

function commandExists(command) {
  try {
    const probe = process.platform === 'win32' ? 'where' : 'which'
    execFileSync(probe, [command], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function safeReadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function gitOutput(cwd, gitArgs) {
  return execFileSync('git', gitArgs, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function removeGeneratedLink(target) {
  if (!fs.existsSync(target) && !fs.lstatSync(path.dirname(target), { throwIfNoEntry: false })) return
  try {
    const stat = fs.lstatSync(target)
    if (stat.isSymbolicLink()) fs.unlinkSync(target)
    else if (process.platform === 'win32') fs.rmSync(target, { recursive: true, force: true })
  } catch {
    // A missing/stale target is safe to recreate below.
  }
}

function linkDirectory(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true })
  removeGeneratedLink(target)
  try {
    fs.symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir')
  } catch (error) {
    throw new Error(`Could not create the project-local skill link ${target}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function listSkills() {
  if (!fs.existsSync(SKILLS_SOURCE)) {
    throw new Error(`Understand Anything skills were not found at ${SKILLS_SOURCE}`)
  }
  return fs.readdirSync(SKILLS_SOURCE, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(SKILLS_SOURCE, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort()
}

function printStatus() {
  const state = safeReadJson(STATE_FILE)
  const installed = fs.existsSync(path.join(AGENT_SKILLS, 'understand', 'SKILL.md'))
  const checkoutExists = fs.existsSync(path.join(CHECKOUT, '.git'))
  let commit = ''
  if (checkoutExists && commandExists('git')) {
    try { commit = gitOutput(CHECKOUT, ['rev-parse', 'HEAD']) } catch { commit = '' }
  }

  console.log('Understand Anything — AI Product Factory local integration')
  console.log(`  checkout: ${checkoutExists ? CHECKOUT : 'not installed'}`)
  console.log(`  commit:   ${commit || state?.commit || 'unknown'}`)
  console.log(`  skills:   ${installed ? AGENT_SKILLS : 'not linked'}`)
  console.log(`  mode:     project-local (no global plugin installation required)`)
}

if (statusOnly) {
  printStatus()
  process.exit(0)
}

if (!commandExists('git')) {
  console.error('Git is required to install Understand Anything locally.')
  process.exit(1)
}

fs.mkdirSync(TOOLS_DIR, { recursive: true })

if (!fs.existsSync(path.join(CHECKOUT, '.git'))) {
  console.log(`→ Cloning Understand Anything into ${path.relative(ROOT, CHECKOUT)}`)
  run('git', ['clone', '--filter=blob:none', '--no-checkout', REPO_URL, CHECKOUT])
}

let targetRef = DEFAULT_REF
if (update) {
  console.log('→ Fetching the latest Understand Anything main branch')
  run('git', ['-C', CHECKOUT, 'fetch', '--depth=1', 'origin', 'main'])
  targetRef = gitOutput(CHECKOUT, ['rev-parse', 'FETCH_HEAD'])
} else {
  console.log(`→ Fetching pinned Understand Anything revision ${DEFAULT_REF.slice(0, 12)}`)
  run('git', ['-C', CHECKOUT, 'fetch', '--depth=1', 'origin', DEFAULT_REF])
}

run('git', ['-C', CHECKOUT, 'checkout', '--detach', targetRef])
const installedCommit = gitOutput(CHECKOUT, ['rev-parse', 'HEAD'])

const skills = listSkills()
fs.mkdirSync(AGENT_SKILLS, { recursive: true })
console.log(`→ Linking ${skills.length} Understand Anything skills into .agents/skills`)
for (const skill of skills) {
  const source = path.join(SKILLS_SOURCE, skill)
  const target = path.join(AGENT_SKILLS, skill)
  linkDirectory(source, target)
  console.log(`  ✓ ${skill}`)
}

const state = {
  name: 'understand-anything',
  source: 'Egonex-AI/Understand-Anything',
  repository: REPO_URL,
  commit: installedCommit,
  installedAt: new Date().toISOString(),
  installMode: 'project-local-symlink',
  skills,
  dataDirectory: '.ua',
  note: 'The plugin understands codebases/knowledge bases. AI Product Factory user-intent understanding remains handled by the Factory intent and recommendation pipeline.',
}
fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`)

console.log('\n✓ Understand Anything is installed locally for this repository.')
console.log('  Codex/compatible agents: invoke $understand (or ask to use the understand skill).')
console.log('  Claude Code: /understand')
console.log('  Output: .ua/knowledge-graph.json')
console.log('  Run npm run understand:status to verify the local integration.')
if (update) console.log(`  Updated/pinned revision: ${installedCommit}`)
