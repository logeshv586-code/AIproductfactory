/**
 * Verification harness for the new domain-aware repo selection.
 *
 * Run with:
 *   bunx tsx scratch_verify_intent.ts
 *   # or:  npx tsx scratch_verify_intent.ts
 *
 * No network calls — uses synthetic GitHub-shaped data.
 */
import {
  classifyIntent,
  rankByIntent,
  isGenericCollection,
  type ScorableRepo,
} from './src/lib/factory/core/intent-classifier'

const IDEA = 'RPA automation using AI to build autonomous agents'

// 1. Classify
const intent = classifyIntent(IDEA)
console.log('=== INTENT ===')
console.log('tags        :', intent.tags)
console.log('confidence  :', intent.confidence.toFixed(2))
console.log('queries     :')
intent.queries.forEach(q => console.log('  •', q))
console.log('keywords    :', intent.positiveKeywords.slice(0, 12).join(', '), '…')
console.log()

// Sanity assertions
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('❌ ASSERT FAIL:', msg)
    process.exitCode = 1
  } else {
    console.log('✅', msg)
  }
}

assert(intent.tags.includes('rpa'), 'intent contains "rpa"')
assert(intent.tags.includes('agents'), 'intent contains "agents"')
assert(intent.confidence >= 0.6, 'confidence is high (≥0.6)')
assert(intent.queries.some(q => /agent/i.test(q)), 'queries include an agent-specific query')
assert(intent.queries.some(q => /(rpa|automation)/i.test(q)), 'queries include an RPA/automation query')
console.log()

// 2. Score against a synthetic candidate set that mixes the OLD bad output
//    with the kind of repos we WANT to win.
const candidates: ScorableRepo[] = [
  // ── OLD bad output (should all rank near bottom or get excluded) ──
  { fullName: 'donnemartin/system-design-primer', stars: 344900, description: 'Learn how to design large-scale systems. Prep for the system design interview. Includes Anki flashcards.', topics: ['interview', 'system-design'] },
  { fullName: 'vinta/awesome-python', stars: 294600, description: 'An opinionated list of Python frameworks, libraries, tools, and resources', topics: ['awesome', 'awesome-list', 'python'] },
  { fullName: 'practical-tutorials/project-based-learning', stars: 264200, description: 'Curated list of project-based tutorials', topics: ['tutorial'] },
  { fullName: 'TheAlgorithms/Python', stars: 220300, description: 'All Algorithms implemented in Python', topics: ['algorithm', 'python'] },
  { fullName: 'tensorflow/tensorflow', stars: 194900, description: 'An Open Source Machine Learning Framework for Everyone', topics: ['machine-learning', 'deep-learning'] },

  // ── What we WANT to surface ──
  { fullName: 'langchain-ai/langchain', stars: 90000, description: 'Build context-aware reasoning applications and autonomous agents', topics: ['llm', 'agent', 'langchain'] },
  { fullName: 'langchain-ai/langgraph', stars: 8000, description: 'Build resilient language agents as graphs', topics: ['agent', 'llm-agent'] },
  { fullName: 'joaomdmoura/crewAI', stars: 25000, description: 'Framework for orchestrating role-playing, autonomous AI agents', topics: ['agent', 'multi-agent', 'crewai'] },
  { fullName: 'microsoft/autogen', stars: 30000, description: 'A programming framework for agentic AI', topics: ['agent', 'autogen', 'agentic'] },
  { fullName: 'microsoft/playwright', stars: 65000, description: 'Browser automation framework for reliable end-to-end testing', topics: ['browser-automation', 'playwright'] },
  { fullName: 'puppeteer/puppeteer', stars: 88000, description: 'JavaScript API for Chrome and headless browser automation', topics: ['browser-automation', 'puppeteer'] },
  { fullName: 'temporalio/temporal', stars: 11000, description: 'Workflow-as-code orchestration engine', topics: ['workflow', 'orchestration', 'temporal'] },
  { fullName: 'apache/airflow', stars: 36000, description: 'Programmatic workflow authoring, scheduling, and monitoring', topics: ['workflow', 'airflow', 'dag'] },
  { fullName: 'n8n-io/n8n', stars: 50000, description: 'Workflow automation tool that lets you connect anything to everything', topics: ['workflow', 'automation', 'n8n'] },
  { fullName: 'robocorp/robocorp', stars: 800, description: 'Open-source RPA framework for Python', topics: ['rpa', 'automation'] },
]

const ranked = rankByIntent(candidates, intent, { hardExcludeGeneric: true, topK: 10 })

console.log('=== TOP 10 (after hard-exclude + domain-aware scoring) ===')
ranked.forEach((r, i) => {
  console.log(`${String(i + 1).padStart(2)}. ${r.score.toFixed(2).padStart(7)}  ${r.fullName}  (★${r.stars})`)
})
console.log()

// Excluded list
const excluded = candidates.filter(
  c => !ranked.find(r => r.fullName === c.fullName)
)
console.log('=== EXCLUDED ===')
excluded.forEach(e => {
  const generic = isGenericCollection(e.fullName, e.description, e.topics)
  console.log('   ', e.fullName, generic ? '(generic collection)' : '')
})
console.log()

// 3. Hard assertions: the OLD bad picks must NOT be in the top 5
const top5 = ranked.slice(0, 5).map(r => r.fullName)
const badRepos = [
  'donnemartin/system-design-primer',
  'vinta/awesome-python',
  'practical-tutorials/project-based-learning',
  'TheAlgorithms/Python',
]
for (const bad of badRepos) {
  assert(!top5.includes(bad), `"${bad}" is NOT in top 5`)
}

const goodRepos = ['langchain-ai/langchain', 'microsoft/autogen', 'joaomdmoura/crewAI', 'n8n-io/n8n']
const goodInTop10 = goodRepos.filter(g => ranked.find(r => r.fullName === g)).length
assert(goodInTop10 >= 3, `at least 3 agent/automation frameworks in top 10 (got ${goodInTop10})`)

// Ensure stars-only winner (tensorflow at 194k) does NOT lead
assert(top5[0] !== 'tensorflow/tensorflow', '"tensorflow/tensorflow" does NOT win top spot on stars alone')

console.log()
console.log(process.exitCode ? '❌ Verification FAILED' : '✅ Verification PASSED')
