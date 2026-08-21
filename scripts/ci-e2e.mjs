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
  if (!response.ok) {
    throw new Error(`${path} failed (${response.status}): ${JSON.stringify(data).slice(0, 1600)}`)
  }
  return data
}

async function post(path, body, { useSession = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (useSession && runtimeSessionId) headers['X-LLM-Session'] = runtimeSessionId
  const data = await request(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (data?.success === false) {
    throw new Error(`${path} returned success=false: ${JSON.stringify(data).slice(0, 1600)}`)
  }
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
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--virtual-time-budget=8000',
      '--dump-dom',
      url,
    ], {
      encoding: 'utf8',
      timeout: 30000,
      maxBuffer: 12 * 1024 * 1024,
    })

    if (result.status === 0 && result.stdout?.includes('<html')) return result.stdout
    attempts.push(`${binary}: ${result.error?.code || result.status || 'failed'}`)
  }

  throw new Error(`Could not launch a headless Chromium browser for hydration-aware UI verification (${attempts.join(', ')})`)
}

async function optionalRealProviderSmoke() {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim()
  if (!apiKey) {
    console.log('[e2e] real OpenAI smoke skipped — OPENAI_API_KEY Actions secret is not configured')
    return
  }

  const model = (process.env.OPENAI_SMOKE_MODEL || 'gpt-5-mini').trim()
  console.log(`[e2e] real OpenAI smoke: ${model}`)
  const configured = await post('/api/factory/llm/configure', {
    provider: 'openai',
    apiKey,
    model,
  }, { useSession: false })
  assert(configured.sessionId, 'real OpenAI smoke did not create a runtime session')
  assert(configured.provider === 'openai', 'real OpenAI smoke returned the wrong provider')
  assert(configured.model === model, 'real OpenAI smoke returned the wrong model')

  await request('/api/factory/llm/configure', {
    method: 'DELETE',
    headers: { 'X-LLM-Session': configured.sessionId },
  })
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

console.log('[e2e] 1/10 homepage routes customers to premium Studio')
const root = await fetch(BASE, { redirect: 'manual' })
assert([307, 308].includes(root.status), `/ returned ${root.status}; expected a redirect to /studio`)
const location = root.headers.get('location') || ''
assert(location.endsWith('/studio'), `/ redirected to ${location || 'nowhere'} instead of /studio`)

console.log('[e2e] 2/10 hydrated customer-first AI setup')
const hydratedHtml = renderHydratedDom('/studio')
assert(hydratedHtml.includes('Connect an AI'), 'hydrated /studio did not render customer-first AI onboarding')
assert(hydratedHtml.includes('DeepSeek'), 'hydrated /studio did not render DeepSeek provider card')
assert(hydratedHtml.includes('OpenAI'), 'hydrated /studio did not render OpenAI provider card')
assert(hydratedHtml.includes('Anthropic'), 'hydrated /studio did not render Anthropic provider card')
assert(hydratedHtml.includes('Google Gemini'), 'hydrated /studio did not render Gemini provider card')
assert(hydratedHtml.includes('NVIDIA NIM'), 'hydrated /studio did not render NVIDIA provider card')
assert(hydratedHtml.includes('Test AI & open Product Studio'), 'hydrated /studio did not render the AI validation action')
assert(hydratedHtml.includes('Advanced model settings'), 'model ID is not hidden behind the advanced-settings affordance')

console.log('[e2e] 3/10 local runtime model session')
const localModel = await post('/api/factory/llm/configure', {
  provider: 'local',
  apiKey: '',
  model: 'local-deterministic',
}, { useSession: false })
assert(localModel.sessionId, 'local runtime model configuration returned no sessionId')
assert(localModel.provider === 'local', 'local runtime model configuration returned the wrong provider')
runtimeSessionId = localModel.sessionId

console.log('[e2e] 4/10 strategize')
const strategize = await post('/api/factory/pi/strategize', { idea })
assert(strategize.run_id, 'strategize did not return run_id')
assert(strategize.graph && typeof strategize.graph === 'object', 'strategize did not return graph')
assert(Array.isArray(strategize.strategies) && strategize.strategies.length > 0, 'strategize returned no strategies')

const repoNames = Array.isArray(strategize.graph?.repos)
  ? strategize.graph.repos.map((repo) => repo?.full_name).filter(Boolean).slice(0, 8)
  : []
console.log(`[e2e] discovered ${repoNames.length} graph repo candidates`)

console.log('[e2e] 5/10 capability-aware live research')
const liveResearch = await post('/api/factory/research/live', {
  idea,
  repos: repoNames,
  graph: strategize.graph,
})
assert(Array.isArray(liveResearch.sourceCatalog), 'live research did not return source catalog')
assert(Array.isArray(liveResearch.signals), 'live research did not return signals array')
assert(liveResearch.profile && Array.isArray(liveResearch.profile.intentTerms), 'live research did not return an intent/research profile')
assert(typeof liveResearch.summary?.rejectedSignalCount === 'number', 'live research did not report rejected-signal count')
assert(liveResearch.signals.every((signal) => typeof signal.relevance === 'number'), 'live evidence is missing relevance scores')
assert(liveResearch.signals.filter((signal) => signal.source === 'arXiv').every((signal) => signal.relevance >= 0.72), 'low-relevance arXiv evidence leaked through the research gate')

console.log('[e2e] 6/10 Manager V10 customer brief + ranked plans')
const manager = await post('/api/factory/manager', {
  idea,
  runId: strategize.run_id,
  graph: strategize.graph,
  liveResearch,
  customerContext,
})
assert(manager.report, 'manager did not return report')
assert(manager.report.version === '10.0', `expected Manager V10, got ${manager.report.version}`)
assert(manager.report.customerBrief?.goal, 'manager customer brief is missing')
assert(manager.report.recommendationQuality?.targetRelevance === 90, 'manager relevance target is missing')
assert(Array.isArray(manager.report.repoExplainers), 'manager repo explainers missing')
assert(Array.isArray(manager.report.compositionSuggestions), 'manager composition suggestions missing')
assert(manager.report.compositionSuggestions.length > 0, 'manager produced no buildable composition')
assert(manager.report.compositionSuggestions.every((plan) => typeof plan.capabilityCoverage === 'number'), 'plans are missing capability coverage')
assert(manager.report.compositionSuggestions.every((plan) => typeof plan.domainRelevance === 'number'), 'plans are missing domain relevance')
const initialComposition = manager.report.compositionSuggestions[0]
assert(initialComposition.effort === 'Balanced', `balanced customer priority did not put the Balanced plan first (got ${initialComposition.effort})`)

const strategyId = manager.report.recommendedStrategy?.id || strategize.strategies[0]?.id
assert(strategyId, 'no strategy available for approval')

console.log('[e2e] 7/10 approve + architecture')
const approved = await post('/api/factory/pi/approve', {
  runId: strategize.run_id,
  strategyId,
})
assert(approved.graph && typeof approved.graph === 'object', 'approve did not return final graph')

console.log('[e2e] 8/10 final Manager V10 refresh preserves selected plan')
const finalManager = await post('/api/factory/manager', {
  idea,
  runId: strategize.run_id,
  graph: approved.graph,
  liveResearch,
  customerContext,
  selectedCompositionId: initialComposition.id,
})
const composition = finalManager.report?.compositionSuggestions?.[0]
assert(composition, 'approved manager report has no composition')
assert(composition.id === initialComposition.id, 'manager refresh did not preserve the explicitly selected composition')
assert(Array.isArray(composition.repos) && composition.repos.length >= 1 && composition.repos.length <= 5, 'composition must contain 1-5 bounded repos')
assert(composition.repos.every((repo) => repo.fullName && repo.url), 'composition contains an invalid repository descriptor')
assert(finalManager.report.idePrompt.includes(composition.customerTitle), 'developer handoff is not aligned to the preserved selected plan')

console.log(`[e2e] 9/10 approved composition build: ${composition.repos.map((repo) => repo.fullName).join(' + ')}`)
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

assert(build.verification?.approvedRepoLock === true, 'approved repository lock did not pass')
assert(build.verification?.productGenerated === true, 'Python pipeline generated no product')
assert(build.verification?.capabilityGraphBuilt === true, 'Python pipeline built no capability graph')
assert(build.verification?.starterBlueprintGenerated === true, 'starter blueprint was not generated')
assert(build.verification?.architectureGenerated === true, 'architecture was not generated')
assert(build.verification?.pipelineCompleted === true, 'Python pipeline did not reach COMPLETE')
assert(build.pipelineVerified === true, `pipeline verification incomplete: ${JSON.stringify(build.verification)}`)

console.log('[e2e] 10/10 cleanup + optional real provider smoke')
await request('/api/factory/llm/configure', {
  method: 'DELETE',
  headers: { 'X-LLM-Session': runtimeSessionId },
})
runtimeSessionId = ''

await optionalRealProviderSmoke()

console.log('[e2e] PASS — customer-first Studio + filtered research + priority-aware Manager V10 + approved repo lock completed')
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
