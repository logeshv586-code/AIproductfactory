const BASE = process.env.FACTORY_BASE_URL || 'http://127.0.0.1:3000'

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

async function post(path, body) {
  const data = await request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (data?.success === false) {
    throw new Error(`${path} returned success=false: ${JSON.stringify(data).slice(0, 1600)}`)
  }
  return data
}

const idea = 'Build an AI developer research assistant that discovers open-source repositories, explains how to combine them, verifies the composition and produces a runnable product plan.'

console.log('[e2e] 1/7 studio page')
const studio = await fetch(`${BASE}/studio`)
assert(studio.ok, `/studio returned ${studio.status}`)
const html = await studio.text()
assert(html.includes('AI Product Factory'), '/studio did not render the Product Factory UI')

console.log('[e2e] 2/7 strategize')
const strategize = await post('/api/factory/pi/strategize', { idea })
assert(strategize.run_id, 'strategize did not return run_id')
assert(strategize.graph && typeof strategize.graph === 'object', 'strategize did not return graph')
assert(Array.isArray(strategize.strategies) && strategize.strategies.length > 0, 'strategize returned no strategies')

const repoNames = Array.isArray(strategize.graph?.repos)
  ? strategize.graph.repos.map((repo) => repo?.full_name).filter(Boolean).slice(0, 8)
  : []
console.log(`[e2e] discovered ${repoNames.length} repo candidates`)

console.log('[e2e] 3/7 live research')
const liveResearch = await post('/api/factory/research/live', { idea, repos: repoNames })
assert(Array.isArray(liveResearch.sourceCatalog), 'live research did not return source catalog')
assert(Array.isArray(liveResearch.signals), 'live research did not return signals array')

console.log('[e2e] 4/7 final manager')
const manager = await post('/api/factory/manager', {
  idea,
  runId: strategize.run_id,
  graph: strategize.graph,
  liveResearch,
})
assert(manager.report, 'manager did not return report')
assert(Array.isArray(manager.report.repoExplainers), 'manager repo explainers missing')
assert(Array.isArray(manager.report.compositionSuggestions), 'manager composition suggestions missing')
assert(manager.report.compositionSuggestions.length > 0, 'manager produced no buildable composition')

const strategyId = manager.report.recommendedStrategy?.id || strategize.strategies[0]?.id
assert(strategyId, 'no strategy available for approval')

console.log('[e2e] 5/7 approve + architecture')
const approved = await post('/api/factory/pi/approve', {
  runId: strategize.run_id,
  strategyId,
})
assert(approved.graph && typeof approved.graph === 'object', 'approve did not return final graph')

console.log('[e2e] 6/7 final manager refresh')
const finalManager = await post('/api/factory/manager', {
  idea,
  runId: strategize.run_id,
  graph: approved.graph,
  liveResearch,
})
const composition = finalManager.report?.compositionSuggestions?.[0]
assert(composition, 'approved manager report has no composition')
assert(Array.isArray(composition.repos) && composition.repos.length >= 1 && composition.repos.length <= 3, 'composition must contain 1-3 repos')

console.log(`[e2e] 7/7 approved composition build: ${composition.repos.map((repo) => repo.fullName).join(' + ')}`)
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

console.log('[e2e] PASS — full Product Factory HTTP flow completed with approved repo lock')
console.log(JSON.stringify({
  runId: strategize.run_id,
  strategyId,
  liveSignals: liveResearch.summary?.signalCount || 0,
  sourcesWithResults: liveResearch.summary?.sourcesWithResults || 0,
  selectedRepos: build.selectedRepos?.map((repo) => repo.name) || [],
  buildId: build.buildId,
}, null, 2))
