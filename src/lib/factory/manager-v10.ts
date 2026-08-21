import {
  createFactoryManagerV8Report,
  type CompositionSuggestion,
  type FactoryManagerV8Input,
  type FactoryManagerV8Report,
  type LiveResearch,
  type RepoExplainer,
} from '@/lib/factory/manager-v8'

export type CustomerContext = {
  audience?: string
  priority?: 'speed' | 'balanced' | 'scale' | string
  platform?: string
  privacy?: string
  budget?: string
}

type ExtendedSignal = NonNullable<LiveResearch['signals']>[number] & {
  capabilities?: string[]
  repository?: {
    fullName?: string
    description?: string
    language?: string
    license?: string
    stars?: number
    forks?: number
    updatedAt?: string
    archived?: boolean
    topics?: string[]
  }
}

type ExtendedResearch = LiveResearch & {
  profile?: {
    intentTerms?: string[]
    capabilities?: string[]
    domain?: string
  }
  summary?: LiveResearch['summary'] & {
    relevantSignalCount?: number
    rejectedSignalCount?: number
    githubCandidates?: number
    averageRelevance?: number
    confidenceBand?: string
  }
}

export type RankedRepo = RepoExplainer & {
  recommendationScore: number
  productRelevance: number
  capabilityCoverage: number
  maintenanceScore: number
  licenseScore: number
  evidenceStrength: number
  recommendationSource: 'product-graph' | 'live-github'
}

export type CustomerComposition = CompositionSuggestion & {
  customerTitle: string
  bestFor: string
  confidence: number
  capabilityCoverage: number
  domainRelevance: number
  maintenanceScore: number
  licenseScore: number
  integrationComplexity: 'Low' | 'Medium' | 'High'
  effort: 'Fastest' | 'Balanced' | 'Most robust'
  customerBenefits: string[]
  missingCapabilities: string[]
  technicalSummary: string
}

export type FactoryManagerV10Input = FactoryManagerV8Input & {
  customerContext?: CustomerContext | null
}

export type FactoryManagerV10Report = Omit<
  FactoryManagerV8Report,
  'version' | 'repoExplainers' | 'compositionSuggestions' | 'sourceIntelligence' | 'managerVerdict'
> & {
  version: '10.0'
  repoExplainers: RankedRepo[]
  compositionSuggestions: CustomerComposition[]
  managerVerdict: FactoryManagerV8Report['managerVerdict']
  customerBrief: {
    goal: string
    audience: string
    priority: string
    platform: string
    privacy: string
    budget: string
    capabilities: string[]
    successOutcome: string
  }
  recommendationQuality: {
    targetRelevance: number
    score: number
    band: 'High' | 'Medium' | 'Needs more evidence'
    relevantSignals: number
    rejectedSignals: number
    repositoriesConsidered: number
    repositoriesQualified: number
    explanation: string
  }
  sourceIntelligence: FactoryManagerV8Report['sourceIntelligence'] & {
    rejectedSignalCount: number
    averageRelevance: number
    githubCandidates: number
  }
}

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'also', 'another', 'because', 'before', 'being', 'build', 'building',
  'create', 'customer', 'customers', 'does', 'from', 'have', 'into', 'make', 'making', 'more', 'most', 'only',
  'other', 'product', 'products', 'should', 'some', 'that', 'their', 'them', 'then', 'there', 'these', 'they',
  'this', 'through', 'using', 'want', 'with', 'within', 'without', 'would', 'your', 'application', 'software',
])

const GENERIC_FOUNDATION_TERMS = new Set([
  'framework', 'starter', 'template', 'boilerplate', 'library', 'toolkit', 'database', 'authentication', 'auth',
  'search', 'engine', 'monitoring', 'observability', 'queue', 'workflow', 'orchestration', 'frontend', 'backend',
  'api', 'react', 'nextjs', 'next', 'fastapi', 'django', 'nestjs', 'postgres', 'postgresql', 'redis', 'supabase',
])

const SYNONYM_GROUPS: Record<string, string[]> = {
  sales: ['crm', 'lead', 'leads', 'prospect', 'prospecting', 'outreach', 'pipeline', 'contact', 'email', 'enrichment'],
  shopping: ['ecommerce', 'commerce', 'price', 'pricing', 'catalog', 'merchant', 'seller', 'retail', 'comparison'],
  video: ['media', 'generation', 'diffusion', 'animation', 'render', 'image', 'multimodal'],
  document: ['pdf', 'ocr', 'document', 'docx', 'pptx', 'markdown', 'extraction', 'parser'],
  support: ['ticket', 'helpdesk', 'chat', 'customer-service', 'knowledge', 'faq'],
  finance: ['invoice', 'accounting', 'payment', 'billing', 'expense', 'reconciliation'],
  recruiting: ['job', 'candidate', 'resume', 'hiring', 'ats', 'recruitment'],
  automation: ['workflow', 'agent', 'task', 'trigger', 'approval', 'integration', 'orchestration'],
  ai: ['llm', 'agent', 'rag', 'embedding', 'model', 'inference', 'prompt'],
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function list<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function stem(value: string) {
  let token = value.toLowerCase().replace(/[^a-z0-9+#.-]/g, '')
  if (token.length > 6 && token.endsWith('ing')) token = token.slice(0, -3)
  else if (token.length > 5 && token.endsWith('ed')) token = token.slice(0, -2)
  else if (token.length > 5 && token.endsWith('es')) token = token.slice(0, -2)
  else if (token.length > 4 && token.endsWith('s')) token = token.slice(0, -1)
  return token
}

function tokens(value: string) {
  return [...new Set((value.toLowerCase().match(/[a-z0-9+#.-]{3,}/g) || [])
    .map(stem)
    .filter((token) => token && !STOP_WORDS.has(token)))]
}

function expandedTokens(value: string) {
  const base = new Set(tokens(value))
  for (const [anchor, values] of Object.entries(SYNONYM_GROUPS)) {
    const group = [anchor, ...values].map(stem)
    if (group.some((term) => base.has(term))) group.forEach((term) => base.add(term))
  }
  return [...base]
}

function normalizedPhrase(value: string) {
  return tokens(value).join(' ')
}

function requiredCapabilities(graph: Record<string, any>, live?: ExtendedResearch | null) {
  const output: string[] = []
  const push = (value: unknown) => {
    const item = text(value)
    if (item && !output.some((existing) => normalizedPhrase(existing) === normalizedPhrase(item))) output.push(item)
  }

  for (const capability of list<Record<string, any>>(graph?.capabilities?.capabilities)) push(capability.name || capability.title)
  for (const mapping of list<Record<string, any>>(graph?.capability_mappings)) push(mapping.capability_name || mapping.capability_id)
  for (const capability of list<string>(live?.profile?.capabilities)) push(capability)
  return output.slice(0, 14)
}

function tokenOverlap(wanted: string[], value: string) {
  if (!wanted.length) return 0
  const corpus = new Set(tokens(value))
  let hits = 0
  for (const term of wanted) {
    if (corpus.has(stem(term))) hits += 1
  }
  return clamp((hits / Math.min(Math.max(wanted.length, 1), 12)) * 100)
}

function capabilityMatchScore(capability: string, value: string) {
  const capTokens = tokens(capability)
  if (!capTokens.length) return 0
  const corpus = new Set(tokens(value))
  const hits = capTokens.filter((token) => corpus.has(token)).length
  return hits / capTokens.length
}

function coverageForRepo(repo: RepoExplainer, capabilities: string[]) {
  if (!capabilities.length) return 60
  const corpus = `${repo.fullName} ${repo.description} ${repo.capabilities.join(' ')} ${repo.whatItCanDo.join(' ')}`
  const matches = capabilities.filter((capability) => capabilityMatchScore(capability, corpus) >= 0.5)
  return clamp((matches.length / capabilities.length) * 100)
}

function licenseSafety(license: string) {
  const value = license.toLowerCase()
  if (['mit', 'apache-2.0', 'apache 2.0', 'bsd-2-clause', 'bsd-3-clause', 'isc', 'mpl-2.0'].includes(value)) return 100
  if (['gpl-2.0', 'gpl-3.0', 'agpl-3.0', 'agpl'].includes(value)) return 58
  if (!value || ['none', 'unknown', 'noassertion', 'other', 'non-standard'].includes(value)) return 30
  return 72
}

function signalRepository(signal: ExtendedSignal): RepoExplainer | null {
  if (signal.kind !== 'github-repository') return null
  const repository = signal.repository || {}
  const fullName = text(repository.fullName) || text(signal.title)
  if (!fullName || !fullName.includes('/')) return null
  const capabilities = list<string>(signal.capabilities).filter(Boolean)
  const license = text(repository.license) || 'unknown'
  const language = text(repository.language) || 'Unknown'
  const health = clamp(numberValue(signal.metrics?.healthScore, 70))
  const safeLicense = licenseSafety(license)
  const integrationMode: RepoExplainer['integrationMode'] = safeLicense < 45
    ? 'reference-reimplementation'
    : 'dependency-adapter'

  return {
    fullName,
    url: signal.url || `https://github.com/${fullName}`,
    description: text(repository.description) || text(signal.summary) || 'Open-source candidate discovered by live product research.',
    language,
    license,
    healthScore: Math.round(health),
    capabilities,
    whatItCanDo: capabilities.length
      ? capabilities.map((capability) => `Accelerates ${capability}.`)
      : ['Provides reusable implementation relevant to the requested product.'],
    whySelected: [
      `${Math.round(clamp(numberValue(signal.relevance, 0.5) * 100))}% live product relevance`,
      `${Math.round(health)}% repository health signal`,
      ...(text(signal.summary) ? [text(signal.summary).slice(0, 180)] : []),
    ],
    strengths: [
      repository.stars ? `${repository.stars.toLocaleString()} GitHub stars` : 'Discovered through capability-specific GitHub research',
      repository.updatedAt ? `Recent activity checked: ${repository.updatedAt.slice(0, 10)}` : 'Repository activity included in ranking',
    ],
    weaknesses: [
      ...(repository.archived ? ['Repository is archived and should not be selected for a new build.'] : []),
      ...(safeLicense < 45 ? ['License metadata requires manual review before source reuse.'] : []),
    ],
    integrationMode,
    integrationExplanation: integrationMode === 'reference-reimplementation'
      ? 'Use as implementation reference only until license obligations are verified.'
      : 'Pin a version and isolate the dependency behind a product-owned adapter.',
    exactCombinationRole: capabilities.length
      ? `${fullName} is a replaceable implementation candidate for ${capabilities.slice(0, 3).join(', ')}.`
      : `${fullName} is a replaceable implementation component selected by live evidence.`,
    validationSteps: [
      `Inspect ${signal.url || `https://github.com/${fullName}`} README, examples and current APIs.`,
      `Verify the ${license} license and required attribution.`,
      'Pin a commit or release before implementation.',
      'Run a clean install and contract test before composition.',
    ],
    evidence: {
      source: signal.source,
      relevance: signal.relevance,
      metrics: signal.metrics || {},
      updatedAt: repository.updatedAt,
      topics: repository.topics || [],
    },
  }
}

function liveSignalForRepo(signals: ExtendedSignal[], fullName: string) {
  return signals.find((signal) => {
    const signalName = text(signal.repository?.fullName) || text(signal.title)
    return signal.kind === 'github-repository' && signalName.toLowerCase() === fullName.toLowerCase()
  })
}

function isGeneralFoundation(repo: RepoExplainer) {
  const corpus = new Set(tokens(`${repo.fullName} ${repo.description}`))
  const hits = [...GENERIC_FOUNDATION_TERMS].filter((term) => corpus.has(stem(term))).length
  return hits >= 2 || /framework|starter|template|toolkit|database|search engine|monitoring|observability|authentication/i.test(repo.description)
}

function rankRepositories(base: FactoryManagerV8Report, input: FactoryManagerV10Input, live: ExtendedResearch | null) {
  const graph = input.graph || {}
  const capabilities = requiredCapabilities(graph, live)
  const signals = list<ExtendedSignal>(live?.signals)
  const wanted = expandedTokens(`${input.idea || base.idea} ${capabilities.join(' ')}`)
  const discovered = signals.map(signalRepository).filter((repo): repo is RepoExplainer => Boolean(repo))
  const byName = new Map<string, { repo: RepoExplainer; source: 'product-graph' | 'live-github' }>()

  for (const repo of base.repoExplainers) byName.set(repo.fullName.toLowerCase(), { repo, source: 'product-graph' })
  for (const repo of discovered) {
    const key = repo.fullName.toLowerCase()
    if (!byName.has(key)) byName.set(key, { repo, source: 'live-github' })
  }

  const ranked = [...byName.values()].map(({ repo, source }): RankedRepo => {
    const matchingSignal = liveSignalForRepo(signals, repo.fullName)
    const corpus = `${repo.fullName} ${repo.description} ${repo.capabilities.join(' ')} ${repo.whySelected.join(' ')}`
    const lexical = tokenOverlap(wanted, corpus)
    const liveRelevance = matchingSignal ? clamp(numberValue(matchingSignal.relevance, 0) * 100) : 0
    const productRelevance = Math.round(Math.max(lexical, liveRelevance))
    const capabilityCoverage = Math.round(coverageForRepo(repo, capabilities))
    const maintenanceScore = Math.round(clamp(numberValue(matchingSignal?.metrics?.activityScore, repo.healthScore)))
    const licenseScore = Math.round(licenseSafety(repo.license))
    const evidenceStrength = Math.round(clamp(
      (matchingSignal ? 72 : 48) +
      (repo.whySelected.length >= 2 ? 8 : 0) +
      (repo.description.length > 40 ? 8 : 0) +
      (repo.license && repo.license !== 'unknown' ? 8 : 0),
    ))
    let recommendationScore = (
      productRelevance * 0.50 +
      capabilityCoverage * 0.25 +
      repo.healthScore * 0.12 +
      licenseScore * 0.08 +
      evidenceStrength * 0.05
    )

    if (repo.weaknesses.some((item) => /archived/i.test(item))) recommendationScore -= 35
    if (productRelevance < 24 && capabilityCoverage < 20 && !isGeneralFoundation(repo)) recommendationScore -= 22
    if (isGeneralFoundation(repo) && capabilityCoverage >= 20) recommendationScore += 4

    return {
      ...repo,
      recommendationScore: Math.round(clamp(recommendationScore)),
      productRelevance,
      capabilityCoverage,
      maintenanceScore,
      licenseScore,
      evidenceStrength,
      recommendationSource: source,
    }
  }).sort((a, b) => b.recommendationScore - a.recommendationScore || b.productRelevance - a.productRelevance)

  const qualified = ranked.filter((repo) =>
    repo.recommendationScore >= 58 ||
    (repo.productRelevance >= 55 && repo.capabilityCoverage >= 15) ||
    (isGeneralFoundation(repo) && repo.recommendationScore >= 52 && repo.capabilityCoverage >= 20),
  )

  return {
    capabilities,
    ranked,
    qualified: (qualified.length >= 3 ? qualified : ranked.slice(0, Math.min(12, ranked.length))).slice(0, 18),
  }
}

function coveredCapabilities(repos: RankedRepo[], capabilities: string[]) {
  return capabilities.filter((capability) => repos.some((repo) => {
    const corpus = `${repo.fullName} ${repo.description} ${repo.capabilities.join(' ')}`
    return capabilityMatchScore(capability, corpus) >= 0.5
  }))
}

function chooseRepos(pool: RankedRepo[], capabilities: string[], maxRepos: number, mode: 'fast' | 'balanced' | 'scale') {
  const chosen: RankedRepo[] = []
  const remaining = [...pool]
  const covered = new Set<string>()

  while (remaining.length && chosen.length < maxRepos) {
    let bestIndex = 0
    let bestValue = -Infinity

    remaining.forEach((repo, index) => {
      const newCaps = capabilities.filter((capability) => {
        if (covered.has(capability)) return false
        const corpus = `${repo.fullName} ${repo.description} ${repo.capabilities.join(' ')}`
        return capabilityMatchScore(capability, corpus) >= 0.5
      })
      const newCoverage = capabilities.length ? (newCaps.length / capabilities.length) * 100 : repo.capabilityCoverage
      const languagePenalty = chosen.length && chosen.some((item) => item.language !== repo.language && item.language !== 'Unknown' && repo.language !== 'Unknown') ? 5 : 0
      const modeBonus = mode === 'fast'
        ? (100 - Math.max(0, repo.weaknesses.length * 12)) * 0.08
        : mode === 'scale'
          ? repo.maintenanceScore * 0.12 + repo.licenseScore * 0.08
          : repo.evidenceStrength * 0.08
      const value = repo.recommendationScore * 0.54 + newCoverage * 0.38 + modeBonus - languagePenalty
      if (value > bestValue) {
        bestValue = value
        bestIndex = index
      }
    })

    const [winner] = remaining.splice(bestIndex, 1)
    if (!winner) break
    if (chosen.length && mode === 'fast' && bestValue < 42) break
    chosen.push(winner)
    for (const capability of coveredCapabilities([winner], capabilities)) covered.add(capability)
    if (capabilities.length && covered.size / capabilities.length >= (mode === 'fast' ? 0.58 : mode === 'balanced' ? 0.78 : 0.9)) break
  }

  if (!chosen.length && pool[0]) chosen.push(pool[0])
  return chosen
}

function compositionSignature(repos: RankedRepo[]) {
  return repos.map((repo) => repo.fullName.toLowerCase()).sort().join('|')
}

function makeCustomerComposition(
  id: string,
  customerTitle: string,
  bestFor: string,
  type: CompositionSuggestion['type'],
  repos: RankedRepo[],
  capabilities: string[],
  idea: string,
  effort: CustomerComposition['effort'],
): CustomerComposition | null {
  if (!repos.length) return null
  const covered = coveredCapabilities(repos, capabilities)
  const missing = capabilities.filter((capability) => !covered.includes(capability))
  const capabilityCoverage = capabilities.length ? Math.round((covered.length / capabilities.length) * 100) : Math.round(repos.reduce((sum, repo) => sum + repo.capabilityCoverage, 0) / repos.length)
  const domainRelevance = Math.round(repos.reduce((sum, repo) => sum + repo.productRelevance, 0) / repos.length)
  const maintenanceScore = Math.round(repos.reduce((sum, repo) => sum + repo.maintenanceScore, 0) / repos.length)
  const licenseScore = Math.round(repos.reduce((sum, repo) => sum + repo.licenseScore, 0) / repos.length)
  const evidence = Math.round(repos.reduce((sum, repo) => sum + repo.evidenceStrength, 0) / repos.length)
  const runtimeCount = new Set(repos.map((repo) => repo.language).filter((language) => language && language !== 'Unknown')).size
  const complexityPenalty = Math.max(0, repos.length - 1) * 4 + Math.max(0, runtimeCount - 1) * 5
  const fit = Math.round(clamp(
    capabilityCoverage * 0.40 +
    domainRelevance * 0.30 +
    maintenanceScore * 0.12 +
    licenseScore * 0.10 +
    evidence * 0.08 -
    complexityPenalty,
    20,
    97,
  ))
  const confidence = Math.round(clamp(
    fit * 0.52 +
    evidence * 0.26 +
    Math.min(100, repos.length * 18 + covered.length * 8) * 0.22,
    25,
    96,
  ))
  const integrationComplexity: CustomerComposition['integrationComplexity'] = repos.length <= 1 && runtimeCount <= 1
    ? 'Low'
    : repos.length <= 3 && runtimeCount <= 2
      ? 'Medium'
      : 'High'

  const customerBenefits = [
    capabilityCoverage >= 80 ? 'Covers most of the product capabilities with reusable, inspectable components.' : 'Keeps reusable components focused while leaving product-specific behavior in your own code.',
    domainRelevance >= 75 ? 'Strong match to the actual problem you described.' : 'Uses general foundations only where they clearly support the requested workflow.',
    licenseScore >= 80 ? 'Mostly reuse-friendly licensing based on current metadata.' : 'License review is explicitly required before code reuse or redistribution.',
    maintenanceScore >= 70 ? 'Prefers actively maintained components to reduce long-term maintenance risk.' : 'Includes replaceable adapters so weaker upstream projects can be swapped later.',
  ]

  const reposText = repos.map((repo) => `${repo.fullName} (${repo.capabilities.slice(0, 2).join(', ') || 'specialized component'})`).join('; ')
  const technicalSummary = `Compose ${reposText}. Keep every external project behind a typed adapter/service boundary and implement missing product behavior in the Product Factory codebase.`

  return {
    id,
    title: customerTitle,
    customerTitle,
    bestFor,
    type,
    repos,
    overlapWithRecommended: 0,
    estimatedFit: fit,
    confidence,
    capabilityCoverage,
    domainRelevance,
    maintenanceScore,
    licenseScore,
    integrationComplexity,
    effort,
    customerBenefits,
    missingCapabilities: missing,
    whyThisCombination: [
      `${capabilityCoverage}% of identified capabilities are covered by the selected reusable components.`,
      `${domainRelevance}% average product/domain relevance across the selected repositories.`,
      `${maintenanceScore}% maintenance signal and ${licenseScore}% license-safety signal.`,
      missing.length ? `${missing.length} capability area(s) stay product-owned instead of forcing an unrelated repository.` : 'No major capability gap was detected in the current evidence.',
    ],
    combinationPattern: runtimeCount > 1 ? 'service federation + typed adapters' : 'modular dependency composition + product-owned adapters',
    dataFlow: [
      'User request enters one product-owned workflow/API.',
      ...repos.map((repo) => `The ${repo.fullName} adapter handles ${repo.capabilities.slice(0, 2).join(' + ') || 'its validated capability'}.`),
      'The orchestration layer normalizes outputs into one internal schema and applies business rules.',
      'Authentication, approvals, persistence, telemetry and failure handling remain product-owned.',
      'The user receives one consistent product experience, not a bundle of open-source projects.',
    ],
    resultingProduct: `${idea || 'The requested product'} is delivered as one coherent application. Open-source components accelerate only the capabilities they actually match; the workflow, UX, data model, approvals and differentiating intelligence remain product-owned.`,
    customCodeNeeded: [
      'Product-owned workflow, domain model and typed contracts',
      'Authentication, authorization, secrets and tenant boundaries',
      'Unified customer UI/API and normalized persistence',
      ...missing.slice(0, 6).map((capability) => `${capability} — custom implementation or a later verified adapter`),
      'Observability, cost metering, retries, timeouts and deployment configuration',
    ],
    buildSteps: [
      'Pin the exact source versions and verify current README/API documentation.',
      'Confirm licenses and add third-party notices before any source reuse.',
      'Run each selected component independently and record a contract test.',
      'Implement the smallest end-to-end customer workflow using typed adapters.',
      'Add authentication, validation, retries, timeouts, caching and failure isolation.',
      'Run lint, typecheck, unit, contract, integration, end-to-end, security and production-build gates.',
    ],
    risks: [
      ...repos.flatMap((repo) => repo.weaknesses.slice(0, 1)),
      ...(missing.length ? [`${missing.length} capability area(s) still require product-owned implementation.`] : []),
      ...(integrationComplexity === 'High' ? ['The selected plan spans several components/runtimes; deployment and observability need extra care.'] : []),
    ].slice(0, 8),
    validationGates: [
      'Relevance gate: every selected repository must prove a direct capability match.',
      'Source gate: URL, pinned commit/version and current documentation are verified.',
      'License gate: reuse obligations are compatible with the delivery model.',
      'Build gate: clean install and production build pass from a fresh checkout.',
      'Contract gate: every adapter passes success, timeout and upstream-change tests.',
      'Outcome gate: the requested end-user workflow succeeds against realistic fixtures.',
      'Security gate: dependency, secret, auth and permission checks pass.',
    ],
    technicalSummary,
  }
}

function buildCompositions(pool: RankedRepo[], capabilities: string[], idea: string) {
  const balanced = chooseRepos(pool, capabilities, 4, 'balanced')
  const fast = chooseRepos(pool, capabilities, 2, 'fast')
  const used = new Set([...balanced, ...fast].map((repo) => repo.fullName.toLowerCase()))
  const scalePool = [...pool].sort((a, b) =>
    (b.recommendationScore * 0.55 + b.maintenanceScore * 0.25 + b.licenseScore * 0.20) -
    (a.recommendationScore * 0.55 + a.maintenanceScore * 0.25 + a.licenseScore * 0.20),
  )
  let scale = chooseRepos(scalePool, capabilities, 5, 'scale')
  if (compositionSignature(scale) === compositionSignature(balanced)) {
    const alternate = pool.find((repo) => !used.has(repo.fullName.toLowerCase()))
    if (alternate && scale.length < 5) scale = [...scale, alternate]
  }

  const candidates = [
    makeCustomerComposition('option-a', 'Best balance', 'Most people — strong capability coverage without unnecessary complexity.', 'recommended', balanced, capabilities, idea, 'Balanced'),
    makeCustomerComposition('option-b', 'Fastest launch', 'MVPs, internal tools and teams that value speed and simpler maintenance.', 'two-repo-fusion', fast, capabilities, idea, 'Fastest'),
    makeCustomerComposition('option-c', 'Built to scale', 'Products that need stronger governance, replaceability and long-term operations.', 'alternative-stack', scale, capabilities, idea, 'Most robust'),
  ].filter((item): item is CustomerComposition => Boolean(item))

  const unique: CustomerComposition[] = []
  const signatures = new Set<string>()
  for (const item of candidates) {
    const signature = compositionSignature(item.repos as RankedRepo[])
    if (signatures.has(signature)) continue
    signatures.add(signature)
    unique.push(item)
  }

  // If the evidence is narrow, preserve three distinct choices by varying the
  // qualified pool rather than padding with an unrelated repository.
  for (const repo of pool) {
    if (unique.length >= 3) break
    const item = makeCustomerComposition(
      `option-${unique.length + 1}`,
      unique.length === 0 ? 'Best available plan' : 'Focused alternative',
      'A narrower plan using a different verified foundation.',
      unique.length === 0 ? 'recommended' : 'alternative-stack',
      [repo], capabilities, idea,
      unique.length === 0 ? 'Balanced' : 'Fastest',
    )
    if (!item) continue
    const signature = compositionSignature(item.repos as RankedRepo[])
    if (!signatures.has(signature)) {
      signatures.add(signature)
      unique.push(item)
    }
  }

  return unique.slice(0, 3)
}

function buildCustomerBrief(input: FactoryManagerV10Input, base: FactoryManagerV8Report, capabilities: string[]) {
  const context = input.customerContext || {}
  const goal = text(input.idea) || base.idea || 'Build the requested product'
  const audience = text(context.audience) || 'People who need the workflow described above'
  const priorityMap: Record<string, string> = {
    speed: 'Launch quickly with the lowest practical integration complexity',
    balanced: 'Balance speed, product quality and long-term maintainability',
    scale: 'Optimize for governance, reliability and future scale',
  }
  const priority = priorityMap[text(context.priority)] || text(context.priority) || 'Balance speed, quality and maintainability'
  const platform = text(context.platform) || 'Web-first, unless the requested workflow requires another surface'
  const privacy = text(context.privacy) || 'Standard secure cloud handling with least-privilege secrets'
  const budget = text(context.budget) || 'Keep recurring costs proportional to real usage'
  return {
    goal,
    audience,
    priority,
    platform,
    privacy,
    budget,
    capabilities,
    successOutcome: `A normal user can complete the requested workflow end to end without understanding repositories, adapters or infrastructure.`,
  }
}

function buildImplementationPrompt(
  idea: string,
  composition: CustomerComposition | undefined,
  brief: ReturnType<typeof buildCustomerBrief>,
) {
  const repos = composition?.repos || []
  return `You are the implementation engineer for AI Product Factory. Build the approved product as a production-ready, maintainable system.\n\nPRODUCT OUTCOME\n${idea}\n\nCUSTOMER BRIEF\n- Audience: ${brief.audience}\n- Priority: ${brief.priority}\n- Platform: ${brief.platform}\n- Privacy: ${brief.privacy}\n- Cost posture: ${brief.budget}\n- Success: ${brief.successOutcome}\n\nAPPROVED PLAN\n- Plan: ${composition?.customerTitle || 'No composition selected'}\n- Canonical implementation fit: ${composition?.estimatedFit ?? 0}%\n- Recommendation confidence: ${composition?.confidence ?? 0}%\n- Capability coverage: ${composition?.capabilityCoverage ?? 0}%\n\nOPEN-SOURCE SOURCES\n${repos.length ? repos.map((repo, index) => `${index + 1}. ${repo.fullName} — ${repo.url}\n   Role: ${repo.capabilities.join(', ') || 'Validated reusable component'}\n   License: ${repo.license}\n   Product relevance: ${(repo as RankedRepo).productRelevance ?? 0}%`).join('\n') : '- No external repository is approved. Implement product-owned code only.'}\n\nSOURCE-USAGE RULES\n- Never merge source trees blindly. Use dependencies, services, adapters or clean-room reimplementation where appropriate.\n- Re-check current README/API documentation and pin exact versions/commits before implementation.\n- Verify license obligations and maintain THIRD_PARTY_NOTICES.md.\n- Reject or replace a source if executable validation proves it does not match the required capability.\n- Keep every third-party integration replaceable behind typed contracts.\n\nMISSING / PRODUCT-OWNED CAPABILITIES\n${composition?.missingCapabilities.length ? composition.missingCapabilities.map((item) => `- ${item}`).join('\n') : '- No major capability gap is currently identified; product workflow and differentiation still remain product-owned.'}\n\nIMPLEMENTATION FLOW\n1. Inspect the target repository and create an ADR for every external source.\n2. Define product-owned domain models and typed contracts first.\n3. Make each selected external component work independently before composition.\n4. Implement the smallest end-to-end customer workflow; do not stop at scaffolding.\n5. Add authentication, authorization, input validation, secrets handling, retries, timeouts, idempotency and failure isolation.\n6. Add unit, adapter-contract, integration and end-to-end tests for success and failure paths.\n7. Add Docker/dev setup, health checks, structured logs, observability and cost metering.\n8. Run lint, typecheck, tests, security/dependency checks and production build; fix failures before declaring completion.\n9. Produce setup documentation, architecture notes, API examples and THIRD_PARTY_NOTICES.md.\n\nRELEASE RULE\nDo not call the product verified merely because an AI recommendation is confident. VERIFIED requires pinned source truth, license review, clean build, passing tests, security checks and a realistic end-user outcome test.\n\nStart with a concise implementation plan and file map, then implement and validate the runnable vertical slice.`
}

export function createFactoryManagerV10Report(input: FactoryManagerV10Input): FactoryManagerV10Report {
  const base = createFactoryManagerV8Report(input)
  const live = (input.liveResearch || null) as ExtendedResearch | null
  const ranking = rankRepositories(base, input, live)
  const idea = text(input.idea) || base.idea || 'The requested product'
  const compositions = buildCompositions(ranking.qualified, ranking.capabilities, idea)
  const recommended = compositions[0]
  const relevantSignals = list<ExtendedSignal>(live?.signals).filter((signal) => numberValue(signal.relevance, 0) >= 0.6)
  const rejectedSignals = numberValue(live?.summary?.rejectedSignalCount, Math.max(0, list(live?.signals).length - relevantSignals.length))
  const averageRelevance = relevantSignals.length
    ? Math.round(relevantSignals.reduce((sum, signal) => sum + clamp(numberValue(signal.relevance, 0) * 100), 0) / relevantSignals.length)
    : 0
  const evidenceVolume = Math.min(100, relevantSignals.length * 7 + ranking.qualified.length * 4)
  const qualityScore = Math.round(clamp(
    (recommended?.estimatedFit || 0) * 0.42 +
    (recommended?.confidence || 0) * 0.28 +
    averageRelevance * 0.18 +
    evidenceVolume * 0.12,
  ))
  const qualityBand: FactoryManagerV10Report['recommendationQuality']['band'] = qualityScore >= 85 && relevantSignals.length >= 8
    ? 'High'
    : qualityScore >= 68
      ? 'Medium'
      : 'Needs more evidence'
  const brief = buildCustomerBrief(input, base, ranking.capabilities)
  const decision: FactoryManagerV8Report['managerVerdict']['decision'] = !recommended || recommended.estimatedFit < 58
    ? 'RESEARCH_MORE'
    : recommended.estimatedFit >= 82 && recommended.confidence >= 78
      ? 'GO'
      : 'GO_WITH_GUARDS'
  const confidence = recommended?.confidence || Math.min(70, qualityScore)
  const allRelevantSignals = relevantSignals
    .sort((a, b) => numberValue(b.relevance, 0) - numberValue(a.relevance, 0))
    .slice(0, 18)

  return {
    ...base,
    version: '10.0',
    repoExplainers: ranking.qualified,
    compositionSuggestions: compositions,
    customerBrief: brief,
    recommendationQuality: {
      targetRelevance: 90,
      score: qualityScore,
      band: qualityBand,
      relevantSignals: relevantSignals.length,
      rejectedSignals,
      repositoriesConsidered: ranking.ranked.length,
      repositoriesQualified: ranking.qualified.length,
      explanation: qualityBand === 'High'
        ? 'The recommendation is supported by strong product relevance, capability coverage and multiple current evidence signals.'
        : qualityBand === 'Medium'
          ? 'The recommendation is usable, but important implementation details should still be verified before committing to the build.'
          : 'The system needs more relevant evidence or clearer requirements before it should make a strong recommendation.',
    },
    managerVerdict: {
      decision,
      estimatedFeasibility: recommended?.estimatedFit || base.managerVerdict.estimatedFeasibility,
      confidence,
      summary: recommended
        ? `${recommended.customerTitle} is the strongest current path at ${recommended.estimatedFit}% implementation fit. The score is based on product relevance, capability coverage, maintenance, license safety and integration complexity—not repository popularity alone.`
        : 'The current evidence is not strong enough to recommend a product foundation safely.',
      reasons: recommended?.whyThisCombination || base.managerVerdict.reasons,
      riskFlags: [
        ...(recommended?.missingCapabilities.length ? [`${recommended.missingCapabilities.length} capability area(s) still need product-owned implementation.`] : []),
        ...(qualityBand === 'Needs more evidence' ? ['Current research evidence is too weak for a high-confidence build recommendation.'] : []),
        ...(recommended?.licenseScore && recommended.licenseScore < 70 ? ['At least one selected source needs deeper license review.'] : []),
      ],
      humanChecks: [
        'Confirm the AI-understood product brief matches the intended customer outcome.',
        'Review the recommended plan in plain language before opening technical details.',
        'Approve the exact source set before the autonomous build starts.',
      ],
    },
    sourceIntelligence: {
      ...base.sourceIntelligence,
      signalCount: relevantSignals.length,
      sourcesWithResults: new Set(relevantSignals.map((signal) => signal.source)).size,
      topSignals: allRelevantSignals,
      rejectedSignalCount: rejectedSignals,
      averageRelevance,
      githubCandidates: numberValue(live?.summary?.githubCandidates, relevantSignals.filter((signal) => signal.kind === 'github-repository').length),
    },
    idePrompt: buildImplementationPrompt(idea, recommended, brief),
  }
}
