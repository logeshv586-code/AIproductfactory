import { spawnSync } from 'node:child_process'

const BASE = process.env.FACTORY_BASE_URL || 'http://127.0.0.1:3000'
let runtimeSessionId = ''

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, options)
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${JSON.stringify(data).slice(0, 1600)}`)
  return data
}

async function post(path, body, { useSession = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (useSession && runtimeSessionId) headers['X-LLM-Session'] = runtimeSessionId
  const data = await request(path, { method: 'POST', headers, body: JSON.stringify(body) })
  if (data?.success === false) throw new Error(`${path} returned success=false: ${JSON.stringify(data).slice(0, 1600)}`)
  return data
}

function renderHydratedDom(path) {
  const url = `${BASE}${path}`
  const candidates = [
    process.env.CHROME_BIN,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ].filter(Boolean)
  const attempts = []

  for (const binary of candidates) {
    const result = spawnSync(binary, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
      '--virtual-time-budget=8000', '--dump-dom', url,
    ], { encoding: 'utf8', timeout: 30000, maxBuffer: 12 * 1024 * 1024 })
    if (result.status === 0 && result.stdout?.includes('<html')) return result.stdout
    attempts.push(`${binary}: ${result.error?.code || result.status || 'failed'}`)
  }
  throw new Error(`Could not launch a headless Chromium browser (${attempts.join(', ')})`)
}

async function optionalRealProviderSmoke() {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) {
    console.log('[e2e] real OpenAI smoke skipped — OPENAI_API_KEY is not configured')
    return
  }
  const model = (process.env.OPENAI_SMOKE_MODEL || 'gpt-5-mini').trim()
  const configured = await post('/api/factory/llm/configure', { provider: 'openai', apiKey, model }, { useSession: false })
  assert(configured.sessionId, 'real OpenAI smoke did not create a session')
  assert(configured.provider === 'openai', 'real OpenAI smoke returned wrong provider')
  assert(configured.model === model, 'real OpenAI smoke returned wrong model')
  await request('/api/factory/llm/configure', { method: 'DELETE', headers: { 'X-LLM-Session': configured.sessionId } })
  console.log('[e2e] real OpenAI smoke passed')
}

const idea = 'Build an AI developer research assistant that discovers open-source repositories, explains how to combine them, verifies the composition and produces a runnable product plan.'
const customerContext = {
  audience: 'Product teams and software engineers',
  priority: 'balanced',
  platform: 'Web app',
  privacy: 'Standard secure cloud',
  budget: 'Balance cost and quality',
}

console.log('[e2e] 1/10 route + premium customer onboarding')
const root = await fetch(BASE, { redirect: 'manual' })
assert([307, 308].includes(root.status), `/ returned ${root.status}; expected redirect`)
assert((root.headers.get('location') || '').endsWith('/studio'), 'homepage did not redirect to /studio')
const hydratedHtml = renderHydratedDom('/studio')
for (const expected of ['Connect an AI', 'DeepSeek', 'OpenAI', 'Anthropic', 'Google Gemini', 'NVIDIA NIM', 'Test AI', 'Advanced model settings']) {
  assert(hydratedHtml.includes(expected), `hydrated /studio missing: ${expected}`)
}

console.log('[e2e] 2/10 local runtime session')
const localModel = await post('/api/factory/llm/configure', { provider: 'local', apiKey: '', model: 'local-deterministic' }, { useSession: false })
assert(localModel.sessionId, 'local runtime session missing')
assert(localModel.provider === 'local', 'local runtime provider mismatch')
runtimeSessionId = localModel.sessionId

console.log('[e2e] 3/10 product intelligence')
const strategize = await post('/api/factory/pi/strategize', { idea })
assert(strategize.run_id, 'strategize run_id missing')
assert(strategize.graph && typeof strategize.graph === 'object', 'strategize graph missing')
assert(Array.isArray(strategize.strategies) && strategize.strategies.length > 0, 'strategize returned no strategies')
const repoNames = Array.isArray(strategize.graph?.repos) ? strategize.graph.repos.map((repo) => repo?.full_name).filter(Boolean).slice(0, 8) : []

console.log('[e2e] 4/10 capability-aware live research')
const liveResearch = await post('/api/factory/research/live', { idea, repos: repoNames, graph: strategize.graph })
assert(Array.isArray(liveResearch.sourceCatalog), 'source catalog missing')
assert(Array.isArray(liveResearch.signals), 'research signals missing')
assert(liveResearch.profile && Array.isArray(liveResearch.profile.intentTerms), 'intent/research profile missing')
assert(typeof liveResearch.summary?.rejectedSignalCount === 'number', 'rejected-signal count missing')
assert(liveResearch.signals.every((signal) => typeof signal.relevance === 'number'), 'research relevance score missing')
assert(liveResearch.signals.filter((signal) => signal.source === 'arXiv').every((signal) => signal.relevance >= 0.72), 'low-relevance arXiv result leaked through')

console.log('[e2e] 5/10 customer-first Manager V10')
const manager = await post('/api/factory/manager', {
  idea, runId: strategize.run_id, graph: strategize.graph, liveResearch, customerContext,
})
assert(manager.report?.version === '10.0', `expected Manager V10, got ${manager.report?.version}`)
assert(manager.report.customerBrief?.goal, 'customer brief missing')
assert(manager.report.recommendationQuality?.targetRelevance === 90, '90% relevance target missing')
assert(Array.isArray(manager.report.compositionSuggestions) && manager.report.compositionSuggestions.length > 0, 'no ranked product plans')
assert(manager.report.compositionSuggestions.every((plan) => typeof plan.capabilityCoverage === 'number'), 'capability coverage missing')
assert(manager.report.compositionSuggestions.every((plan) => typeof plan.domainRelevance === 'number'), 'domain relevance missing')
const initialComposition = manager.report.compositionSuggestions[0]
assert(initialComposition.effort === 'Balanced', `balanced priority did not select Balanced plan first (${initialComposition.effort})`)

console.log('[e2e] 6/10 approval + architecture')
const strategyId = manager.report.recommendedStrategy?.id || strategize.strategies[0]?.id
assert(strategyId, 'no strategy available for approval')
const approved = await post('/api/factory/pi/approve', { runId: strategize.run_id, strategyId })
assert(approved.graph && typeof approved.graph === 'object', 'approval did not return final graph')

console.log('[e2e] 7/10 selected-plan preservation')
const finalManager = await post('/api/factory/manager', {
  idea,
  runId: strategize.run_id,
  graph: approved.graph,
  liveResearch,
  customerContext,
  selectedCompositionId: initialComposition.id,
})
const composition = finalManager.report?.compositionSuggestions?.[0]
assert(composition, 'final manager produced no composition')
assert(composition.id === initialComposition.id, 'explicitly selected plan was not preserved')
assert(Array.isArray(composition.repos) && composition.repos.length >= 1 && composition.repos.length <= 5, 'composition repo count is outside 1-5')
assert(composition.repos.every((repo) => repo.fullName && repo.url), 'composition has invalid repository descriptor')
assert(finalManager.report.idePrompt.includes(composition.customerTitle), 'developer handoff is not aligned to selected plan')

console.log('[e2e] 8/10 approved source-locked build')
const build = await post('/api/factory/build/approved', {
  idea,
  runId: strategize.run_id,
  strategyId,
  selectedRepos: composition.repos.map((repo) => ({
    fullName: repo.fullName,
    url: repo.url,
    description: repo.description,
    language: repo.language,
    license: repo.license,
    healthScore: repo.healthScore,
    capabilities: repo.capabilities,
    whySelected: repo.whySelected,
    integrationMode: repo.integrationMode,
  })),
})
assert(build.verification?.approvedRepoLock === true, 'approved repository lock failed')
assert(build.verification?.productGenerated === true, 'product generation failed')
assert(build.verification?.capabilityGraphBuilt === true, 'capability graph generation failed')
assert(build.verification?.starterBlueprintGenerated === true, 'starter blueprint generation failed')
assert(build.verification?.architectureGenerated === true, 'architecture generation failed')
assert(build.verification?.pipelineCompleted === true, 'pipeline did not reach COMPLETE')
assert(build.pipelineVerified === true, `pipeline verification incomplete: ${JSON.stringify(build.verification)}`)

console.log('[e2e] 9/10 session cleanup')
await request('/api/factory/llm/configure', { method: 'DELETE', headers: { 'X-LLM-Session': runtimeSessionId } })
runtimeSessionId = ''

console.log('[e2e] 10/10 optional paid-provider smoke')
await optionalRealProviderSmoke()

console.log('[e2e] PASS — Studio + intent + filtered research + Manager V10 + approval + locked build')
console.log(JSON.stringify({
  runId: strategize.run_id,
  strategyId,
  liveSignals: liveResearch.summary?.signalCount || 0,
  rejectedSignals: liveResearch.summary?.rejectedSignalCount || 0,
  githubCandidates: liveResearch.summary?.githubCandidates || 0,
  recommendationQuality: manager.report.recommendationQuality?.score || 0,
  selectedPlan: composition.customerTitle,
  selectedRepos: build.selectedRepos?.map((repo) => repo.name) || [],
  buildId: build.buildId,
}, null, 2))
