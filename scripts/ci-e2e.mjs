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

// Positive source-proof fixture: these are known, runnable computer-use products.
// They are seeds only. Deep Research must still inspect and independently qualify them.
const idea = 'Build a Windows computer-use agent that uses screenshots and vision to understand the screen and autonomously clicks, types, scrolls and completes multi-step desktop tasks.'
const knownComputerUseSeeds = ['microsoft/UFO', 'bytedance/UI-TARS-desktop']
const customerContext = {
  audience: 'Non-technical Windows users',
  priority: 'balanced',
  platform: 'Desktop app',
  privacy: 'Local-first / offline where possible',
  budget: 'Balance cost and quality',
}

console.log('[e2e] 1/12 route + premium customer onboarding')
const root = await fetch(BASE, { redirect: 'manual' })
assert([307, 308].includes(root.status), `/ returned ${root.status}; expected redirect`)
assert((root.headers.get('location') || '').endsWith('/studio'), 'homepage did not redirect to /studio')
const hydratedHtml = renderHydratedDom('/studio')
for (const expected of ['Use cloud AI', 'DeepSeek', 'OpenAI', 'Anthropic', 'Google Gemini', 'NVIDIA NIM', 'Ollama', 'LM Studio', 'Offline test mode', 'Test AI', 'Advanced model settings']) {
  assert(hydratedHtml.includes(expected), `hydrated /studio missing: ${expected}`)
}

console.log('[e2e] 2/12 local runtime session')
const localModel = await post('/api/factory/llm/configure', { provider: 'local', apiKey: '', model: 'local-deterministic' }, { useSession: false })
assert(localModel.sessionId, 'local runtime session missing')
assert(localModel.provider === 'local', 'local runtime provider mismatch')
assert(localModel.localExecution === true, 'local runtime should be marked as local execution')
runtimeSessionId = localModel.sessionId

console.log('[e2e] 3/12 product intelligence')
const strategize = await post('/api/factory/pi/strategize', { idea })
assert(strategize.run_id, 'strategize run_id missing')
assert(strategize.graph && typeof strategize.graph === 'object', 'strategize graph missing')
assert(Array.isArray(strategize.strategies) && strategize.strategies.length > 0, 'strategize returned no strategies')
const graphSeeds = Array.isArray(strategize.graph?.repos)
  ? strategize.graph.repos.map((repo) => repo?.full_name).filter(Boolean)
  : []
const repoNames = [...new Set([...knownComputerUseSeeds, ...graphSeeds])].slice(0, 8)

console.log('[e2e] 4/12 code-aware live research')
const liveResearch = await post('/api/factory/research/live', { idea, repos: repoNames, graph: strategize.graph })
assert(liveResearch.engineVersion === '12.0', `expected Deep Research V12, got ${liveResearch.engineVersion}`)
assert(Array.isArray(liveResearch.sourceCatalog), 'source catalog missing')
assert(Array.isArray(liveResearch.signals), 'research signals missing')
assert(liveResearch.profile && Array.isArray(liveResearch.profile.intentTerms), 'intent/research profile missing')
assert(typeof liveResearch.summary?.rejectedSignalCount === 'number', 'rejected-signal count missing')
assert(typeof liveResearch.summary?.repositoriesInspected === 'number', 'deep-inspection count missing')
assert(typeof liveResearch.summary?.researchCompleteness === 'number', 'research completeness missing')
assert(liveResearch.signals.every((signal) => typeof signal.relevance === 'number'), 'research relevance score missing')
assert(liveResearch.signals.filter((signal) => signal.source === 'arXiv').every((signal) => signal.relevance >= 0.78), 'low-relevance arXiv result leaked through')
const computerUseRepos = liveResearch.signals.filter((signal) => signal.kind === 'github-repository')
assert(computerUseRepos.length >= 2, `positive computer-use fixture returned only ${computerUseRepos.length} source-qualified repository candidate(s)`)
for (const signal of computerUseRepos) {
  assert(signal.inspection?.inspected === true, `GitHub repo was not deeply inspected: ${signal.title}`)
  assert(Array.isArray(signal.inspection?.specializedCapabilities) && signal.inspection.specializedCapabilities.length > 0, `GitHub repo lacks direct specialized capability proof: ${signal.title}`)
  assert(Array.isArray(signal.inspection?.sourceLinks) && signal.inspection.sourceLinks.length >= 1, `GitHub repo missing source proof links: ${signal.title}`)
  assert(signal.inspection?.sourceLinks?.some((link) => link.kind === 'readme'), `GitHub repo missing README proof: ${signal.title}`)
}
const positiveNames = new Set(computerUseRepos.map((signal) => String(signal.repository?.fullName || signal.title).toLowerCase()))
assert(positiveNames.has('microsoft/ufo'), 'microsoft/UFO did not pass deep source-proof qualification')
assert(positiveNames.has('bytedance/ui-tars-desktop'), 'bytedance/UI-TARS-desktop did not pass deep source-proof qualification')

console.log('[e2e] 5/12 strict customer-first Manager V12')
const manager = await post('/api/factory/manager', {
  idea, runId: strategize.run_id, graph: strategize.graph, liveResearch, customerContext,
})
assert(manager.report?.version === '10.0', `base report compatibility changed unexpectedly: ${manager.report?.version}`)
assert(manager.report?.engineVersion === '12.0', `expected Manager V12, got ${manager.report?.engineVersion}`)
assert(manager.report.customerBrief?.goal, 'customer brief missing')
assert(manager.report.recommendationQuality?.targetRelevance === 90, '90% relevance target missing')
assert(manager.report.researchProof?.gateTarget === 90, 'strict research gate missing')
assert(manager.report.recommendationQuality.repositoriesQualified <= manager.report.sourceIntelligence.githubCandidates, 'qualified-repo count exceeded source-qualified GitHub candidates')
assert(Array.isArray(manager.report.compositionSuggestions) && manager.report.compositionSuggestions.length > 0, 'no source-qualified product plan was produced for the computer-use positive fixture')
assert(manager.report.compositionSuggestions.every((plan) => typeof plan.capabilityCoverage === 'number'), 'capability coverage missing')
assert(manager.report.compositionSuggestions.every((plan) => typeof plan.domainRelevance === 'number'), 'domain relevance missing')
assert(manager.report.recommendationQuality.score >= 90, `positive fixture recommendation quality stayed below 90% (${manager.report.recommendationQuality.score}%)`)
assert(manager.report.researchProof.gatePassed === true, 'positive fixture did not open the strict V12 research gate')
const initialComposition = manager.report.compositionSuggestions[0]
assert(initialComposition.effort === 'Balanced', `balanced priority did not select Balanced plan first (${initialComposition.effort})`)

console.log('[e2e] 6/12 approval + architecture')
const strategyId = manager.report.recommendedStrategy?.id || strategize.strategies[0]?.id
assert(strategyId, 'no strategy available for approval')
const approved = await post('/api/factory/pi/approve', { runId: strategize.run_id, strategyId })
assert(approved.graph && typeof approved.graph === 'object', 'approval did not return final graph')

console.log('[e2e] 7/12 selected-plan preservation')
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
assert(Array.isArray(composition.repos) && composition.repos.length >= 1 && composition.repos.length <= 3, 'composition repo count is outside build API limit 1-3')
assert(composition.repos.every((repo) => repo.fullName && repo.url), 'composition has invalid repository descriptor')
assert(composition.repos.every((repo) => computerUseRepos.some((signal) => String(signal.repository?.fullName || '').toLowerCase() === repo.fullName.toLowerCase())), 'selected plan includes a repository that did not pass deep research')
assert(finalManager.report.idePrompt.includes(composition.customerTitle), 'developer handoff is not aligned to selected plan')

console.log('[e2e] 8/12 approved source-locked build')
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

console.log('[e2e] 9/12 office + desktop automation false-positive guard')
const officeIdea = 'Create one AI application that automates PowerPoint, Excel, Word and arbitrary Windows desktop applications through vision and screen understanding, executes multi-step tasks autonomously, learns reusable skills from successful runs, and improves those skills over time with evaluation and rollback.'
const officeStrategy = await post('/api/factory/pi/strategize', { idea: officeIdea })
const officeGraphSeeds = Array.isArray(officeStrategy.graph?.repos)
  ? officeStrategy.graph.repos.map((repo) => repo?.full_name).filter(Boolean)
  : []
const officeSeeds = [...new Set([...knownComputerUseSeeds, ...officeGraphSeeds])].slice(0, 8)
const officeResearch = await post('/api/factory/research/live', { idea: officeIdea, repos: officeSeeds, graph: officeStrategy.graph })
assert(officeResearch.engineVersion === '12.0', 'office fixture did not use Deep Research V12')
const officeRepos = officeResearch.signals.filter((signal) => signal.kind === 'github-repository')
assert(officeRepos.length > 0, 'office/desktop fixture returned no source-qualified GitHub candidates')
const forbidden = new Set([
  'dylanpicart/excel_api_access',
  'ivan-borovets/fastapi-clean-example',
  'drmingler/docling-api',
  'taishi-i/awesome-chatgpt-repositories',
])
for (const repo of officeRepos) {
  assert(!forbidden.has(String(repo.repository?.fullName || repo.title).toLowerCase()), `known false-positive repository leaked into office automation research: ${repo.title}`)
  assert(repo.inspection?.inspected === true, `office candidate lacks inspection: ${repo.title}`)
  assert(repo.inspection?.sourceLinks?.some((link) => link.kind === 'readme'), `office candidate lacks README proof: ${repo.title}`)
  assert(repo.inspection?.sourceLinks?.some((link) => link.kind === 'source-file') || repo.inspection?.depth === 'readme', `office candidate lacks source-level proof: ${repo.title}`)
}
const officeCapabilityProof = new Set(officeRepos.flatMap((repo) => repo.inspection?.specializedCapabilities || []))
assert(officeCapabilityProof.has('Desktop computer control'), 'office fixture did not find direct desktop-control evidence')
assert(officeCapabilityProof.has('Vision screen understanding'), 'office fixture did not find direct vision/screen evidence')
const officeManager = await post('/api/factory/manager', {
  idea: officeIdea,
  runId: officeStrategy.run_id,
  graph: officeStrategy.graph,
  liveResearch: officeResearch,
  customerContext: { ...customerContext, audience: 'Non-technical office workers', priority: 'scale', platform: 'Desktop app', privacy: 'Local-first / offline where possible' },
})
assert(officeManager.report.engineVersion === '12.0', 'office fixture did not use Manager V12')
assert(officeManager.report.recommendationQuality.repositoriesQualified <= officeResearch.summary.githubCandidates, 'office manager reintroduced repositories that did not pass deep GitHub research')
assert(officeManager.report.repoExplainers.every((repo) => officeRepos.some((signal) => String(signal.repository?.fullName || '').toLowerCase() === repo.fullName.toLowerCase())), 'manager qualified a repository with no deep-research source proof')
if (officeManager.report.recommendationQuality.score < 90) {
  assert(officeManager.report.managerVerdict.decision === 'RESEARCH_MORE', 'office fixture below 90% must remain locked rather than fabricating confidence')
  assert(officeManager.report.researchProof.gatePassed === false, 'office fixture below 90% incorrectly opened the research gate')
}

console.log('[e2e] 10/12 source-link transparency contract')
assert(Array.isArray(officeResearch.sourceLinks) && officeResearch.sourceLinks.length > 0, 'research response did not expose clickable source links')
assert(Array.isArray(officeManager.report.researchProof?.sourceLinks), 'manager report did not preserve source links')
assert(officeManager.report.researchProof.sourceLinks.every((link) => /^https:\/\/github\.com\//.test(link.url)), 'non-GitHub URL leaked into repository source-proof list')
assert(officeManager.report.sourceIntelligence.githubCandidates === officeManager.report.recommendationQuality.repositoriesQualified, 'GitHub candidate and qualified-repository counters diverged again')

console.log('[e2e] 11/12 session cleanup')
await request('/api/factory/llm/configure', { method: 'DELETE', headers: { 'X-LLM-Session': runtimeSessionId } })
runtimeSessionId = ''

console.log('[e2e] 12/12 optional paid-provider smoke')
await optionalRealProviderSmoke()

console.log('[e2e] PASS — Studio + local providers + Deep Research V12 + strict source proof + Manager V12 + locked build flow')
console.log(JSON.stringify({
  runId: strategize.run_id,
  strategyId,
  liveSignals: liveResearch.summary?.signalCount || 0,
  rejectedSignals: liveResearch.summary?.rejectedSignalCount || 0,
  githubCandidates: liveResearch.summary?.githubCandidates || 0,
  recommendationQuality: manager.report.recommendationQuality?.score || 0,
  selectedPlan: composition.customerTitle,
  selectedRepos: build.selectedRepos?.map((repo) => repo.name) || [],
  officeGithubCandidates: officeResearch.summary?.githubCandidates || 0,
  officeQualifiedRepos: officeManager.report.recommendationQuality.repositoriesQualified || 0,
  officeRecommendationQuality: officeManager.report.recommendationQuality.score || 0,
  officeResearchGatePassed: Boolean(officeManager.report.researchProof?.gatePassed),
  buildId: build.buildId,
}, null, 2))