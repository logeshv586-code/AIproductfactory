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
const PLUGIN_ROOT = path.join(CHECKOUT, 'understand-anything-plugin')
const SKILLS_SOURCE = path.join(PLUGIN_ROOT, 'skills')
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

function listSkills() {
  if (!fs.existsSync(SKILLS_SOURCE)) {
    throw new Error(`Understand Anything skills were not found at ${SKILLS_SOURCE}`)
  }
  return fs.readdirSync(SKILLS_SOURCE, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(SKILLS_SOURCE, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort()
}

function upstreamDescription(skill) {
  try {
    const source = fs.readFileSync(path.join(SKILLS_SOURCE, skill, 'SKILL.md'), 'utf8')
    const match = source.match(/^description:\s*(.+)$/m)
    return match?.[1]?.trim() || `Use Understand Anything's ${skill} workflow with project-local codebase context.`
  } catch {
    return `Use Understand Anything's ${skill} workflow with project-local codebase context.`
  }
}

function writeSkillAdapter(skill) {
  const targetDir = path.join(AGENT_SKILLS, skill)
  fs.rmSync(targetDir, { recursive: true, force: true })
  fs.mkdirSync(targetDir, { recursive: true })

  const description = upstreamDescription(skill).replace(/\r?\n/g, ' ')
  const wrapper = `---\nname: ${skill}\ndescription: ${description}\n---\n\n# Project-local Understand Anything adapter\n\nThis repository keeps Understand Anything local under \`.tools/understand-anything\`. Do not look for or require a global plugin installation.\n\nBefore following the upstream skill, resolve the project and plugin roots:\n\n\`\`\`bash\nPROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)\nexport CLAUDE_PLUGIN_ROOT="$PROJECT_ROOT/.tools/understand-anything/understand-anything-plugin"\nUPSTREAM_SKILL="$CLAUDE_PLUGIN_ROOT/skills/${skill}/SKILL.md"\n\`\`\`\n\nRead \`$UPSTREAM_SKILL\` in full and follow it as the authoritative workflow for this skill. Keep \`CLAUDE_PLUGIN_ROOT\` set for shell commands so upstream scripts resolve the local plugin checkout correctly.\n\nIf the checkout is missing, tell the user to run \`npm run understand:install\` from the AI Product Factory repository root.\n`
  fs.writeFileSync(path.join(targetDir, 'SKILL.md'), wrapper)
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
  console.log(`  skills:   ${installed ? AGENT_SKILLS : 'not installed'}`)
  console.log('  mode:     project-local adapters (no global plugin installation required)')
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
console.log(`→ Creating ${skills.length} project-local Understand Anything skill adapters in .agents/skills`)
for (const skill of skills) {
  writeSkillAdapter(skill)
  console.log(`  ✓ ${skill}`)
}

const state = {
  name: 'understand-anything',
  source: 'Egonex-AI/Understand-Anything',
  repository: REPO_URL,
  commit: installedCommit,
  installedAt: new Date().toISOString(),
  installMode: 'project-local-adapters',
  pluginRoot: path.relative(ROOT, PLUGIN_ROOT),
  skills,
  dataDirectory: '.ua',
  note: 'Understand Anything supplies codebase/knowledge-base context. Customer natural-language intent is handled separately by the AI Product Factory intent and recommendation pipeline.',
}
fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`)

console.log('\n✓ Understand Anything is installed locally for this repository.')
console.log('  Codex/compatible agents: invoke $understand (or ask to use the understand skill).')
console.log('  Claude Code native marketplace users can still use /understand; this project-local setup does not require it.')
console.log('  Output: .ua/knowledge-graph.json')
console.log('  Run npm run understand:status to verify the local integration.')
if (update) console.log(`  Updated/pinned revision: ${installedCommit}`)
