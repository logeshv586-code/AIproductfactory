export type FactoryGraph = Record<string, any>

export interface FactoryManagerInput {
  idea?: string
  runId?: string
  graph: FactoryGraph
}

export interface FactoryRepoChoice {
  fullName: string
  url: string
  language: string
  license: string
  stars: number
  score: number
  roles: string[]
  reasons: string[]
  cloneCommand: string
}

export interface FactoryPortfolio {
  id: string
  title: string
  repoCount: number
  repos: FactoryRepoChoice[]
  coverage: number
  quality: number
  licenseSafety: number
  maintenance: number
  compatibility: number
  integrationRisk: number
  fitPercentage: number
  confidence: number
  rationale: string[]
  warnings: string[]
}

export interface FactoryManagerReport {
  version: string
  runId: string | null
  generatedAt: string
  idea: string
  stage: 'strategy' | 'approved'
  recommendedStrategy: {
    id: string
    name: string
    why: string
    confidence: number
  } | null
  portfolioRecommendations: FactoryPortfolio[]
  recommendedPortfolio: FactoryPortfolio | null
  managerVerdict: {
    decision: 'GO' | 'GO_WITH_GUARDS' | 'RESEARCH_MORE'
    estimatedFeasibility: number
    confidence: number
    summary: string
    reasons: string[]
    riskFlags: string[]
    humanChecks: string[]
  }
  buildFlow: Array<{
    step: number
    name: string
    owner: string
    output: string
  }>
  architecturePreview: {
    style: string
    components: string[]
    deployment: string
  }
  idePrompt: string
  sourcePolicy: string
}

const PERMISSIVE = new Set([
  'mit',
  'apache-2.0',
  'apache 2.0',
  'bsd-2-clause',
  'bsd-3-clause',
  'isc',
  'mpl-2.0',
])

const STRONG_COPYLEFT = new Set(['gpl-2.0', 'gpl-3.0', 'agpl-3.0', 'agpl'])

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))
}

function numberValue(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function list<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function normalizeScore(value: unknown, fallback = 0.5) {
  const raw = numberValue(value, fallback)
  if (raw > 1 && raw <= 100) return clamp(raw / 100)
  if (raw > 100) return 1
  return clamp(raw)
}

function licenseScore(license: string) {
  const key = license.toLowerCase()
  if (!key || key === 'none' || key === 'noassertion' || key === 'other') return 0.25
  if (PERMISSIVE.has(key)) return 1
  if (STRONG_COPYLEFT.has(key)) return 0.42
  return 0.68
}

function combinations<T>(items: T[], size: number): T[][] {
  const output: T[][] = []
  const walk = (start: number, current: T[]) => {
    if (current.length === size) {
      output.push([...current])
      return
    }
    for (let index = start; index < items.length; index += 1) {
      current.push(items[index])
      walk(index + 1, current)
      current.pop()
    }
  }
  walk(0, [])
  return output
}

function capabilityPriorityMap(graph: FactoryGraph) {
  const caps = list<Record<string, any>>(graph?.capabilities?.capabilities)
  const priorities = new Map<string, number>()
  for (const cap of caps) {
    const name = text(cap.name)
    const priority = text(cap.priority).toLowerCase()
    const weight = priority === 'core' || priority === 'critical'
      ? 1.5
      : priority === 'high'
        ? 1.3
        : priority === 'important'
          ? 1.15
          : 1
    if (name) priorities.set(name, weight)
  }
  return priorities
}

function collectRepoRoles(graph: FactoryGraph) {
  const roles = new Map<string, Set<string>>()
  for (const mapping of list<Record<string, any>>(graph.capability_mappings)) {
    const capability = text(mapping.capability_name) || text(mapping.capability_id) || 'Product capability'
    const selected = text(mapping.selected)
    if (selected) {
      if (!roles.has(selected)) roles.set(selected, new Set())
      roles.get(selected)?.add(capability)
    }
    for (const candidate of list<Record<string, any>>(mapping.candidates)) {
      const name = text(candidate.full_name)
      if (!name) continue
      if (!roles.has(name)) roles.set(name, new Set())
      roles.get(name)?.add(capability)
    }
  }
  return roles
}

function repositoryIndex(graph: FactoryGraph) {
  const roles = collectRepoRoles(graph)
  const repoMap = new Map<string, FactoryRepoChoice & { raw: Record<string, any> }>()
  for (const repo of list<Record<string, any>>(graph.repos)) {
    const fullName = text(repo.full_name) || text(repo.fullName)
    if (!fullName) continue
    const url = text(repo.html_url) || text(repo.url) || `https://github.com/${fullName}`
    const license = text(repo.license) || 'none'
    const weightedScore = normalizeScore(repo.weighted_score ?? repo.score, 0.5)
    repoMap.set(fullName, {
      fullName,
      url,
      language: text(repo.language) || 'Unknown',
      license,
      stars: Math.max(0, Math.round(numberValue(repo.stars, 0))),
      score: weightedScore,
      roles: [...(roles.get(fullName) || new Set<string>())],
      reasons: list<string>(repo.reasons).filter(Boolean).slice(0, 4),
      cloneCommand: `git clone ${url}.git`,
      raw: repo,
    })
  }

  // Some graph variants keep the useful candidates only in mappings.
  for (const mapping of list<Record<string, any>>(graph.capability_mappings)) {
    for (const candidate of list<Record<string, any>>(mapping.candidates)) {
      const fullName = text(candidate.full_name)
      if (!fullName || repoMap.has(fullName)) continue
      const url = `https://github.com/${fullName}`
      repoMap.set(fullName, {
        fullName,
        url,
        language: 'Unknown',
        license: 'none',
        stars: Math.max(0, Math.round(numberValue(candidate.stars, 0))),
        score: normalizeScore(candidate.weighted_score, 0.45),
        roles: [...(roles.get(fullName) || new Set<string>())],
        reasons: ['Selected by capability-level GitHub research'],
        cloneCommand: `git clone ${url}.git`,
        raw: candidate,
      })
    }
  }
  return repoMap
}

function portfolioCoverage(graph: FactoryGraph, names: Set<string>) {
  const mappings = list<Record<string, any>>(graph.capability_mappings)
  if (!mappings.length) return 0
  const priorities = capabilityPriorityMap(graph)
  let earned = 0
  let possible = 0

  for (const mapping of mappings) {
    const capability = text(mapping.capability_name)
    const weight = priorities.get(capability) || 1
    possible += weight
    const selected = text(mapping.selected)
    if (selected && names.has(selected)) {
      earned += weight
      continue
    }
    const candidates = list<Record<string, any>>(mapping.candidates)
    const candidate = candidates.find((item) => names.has(text(item.full_name)))
    if (candidate) earned += weight * Math.max(0.55, normalizeScore(candidate.weighted_score, 0.55) * 0.9)
  }
  return possible > 0 ? clamp(earned / possible) : 0
}

function scorePortfolio(graph: FactoryGraph, repos: Array<FactoryRepoChoice & { raw: Record<string, any> }>, id: string): FactoryPortfolio {
  const names = new Set(repos.map((repo) => repo.fullName))
  const coverage = portfolioCoverage(graph, names)
  const quality = repos.reduce((sum, repo) => sum + repo.score, 0) / Math.max(repos.length, 1)
  const licenses = repos.map((repo) => licenseScore(repo.license))
  const licenseSafety = licenses.reduce((sum, score) => sum + score, 0) / Math.max(licenses.length, 1)
  const maintenance = repos.reduce((sum, repo) => {
    const value = normalizeScore(repo.raw?.scores?.maintenance, 0.6)
    return sum + value
  }, 0) / Math.max(repos.length, 1)

  const languages = new Set(repos.map((repo) => repo.language).filter((language) => language && language !== 'Unknown'))
  const languagePenalty = languages.size <= 1 ? 0 : languages.size === 2 ? 0.12 : 0.25
  const apiBoost = repos.reduce((sum, repo) => sum + normalizeScore(repo.raw?.scores?.api_quality, 0.5), 0) / Math.max(repos.length, 1)
  const compatibility = clamp(0.9 - languagePenalty + (apiBoost - 0.5) * 0.2)

  const unknownLicenses = repos.filter((repo) => licenseScore(repo.license) <= 0.25).length
  const strongCopyleft = repos.filter((repo) => STRONG_COPYLEFT.has(repo.license.toLowerCase())).length
  const integrationRisk = clamp(
    0.08 +
    Math.max(0, repos.length - 1) * 0.12 +
    languagePenalty * 0.8 +
    unknownLicenses * 0.15 +
    strongCopyleft * 0.1 +
    (1 - apiBoost) * 0.08,
  )

  const rawFit = (
    coverage * 0.40 +
    quality * 0.20 +
    licenseSafety * 0.14 +
    maintenance * 0.11 +
    compatibility * 0.15 -
    integrationRisk * 0.12
  )
  const fit = clamp(rawFit)
  const confidence = clamp(
    normalizeScore(graph?.confidences?.overall, 0.62) * 0.45 +
    fit * 0.4 +
    Math.min(1, list(graph.capability_mappings).length / 6) * 0.15,
  )

  const warnings: string[] = []
  if (unknownLicenses) warnings.push(`${unknownLicenses} repo(s) have unknown or missing license metadata`)
  if (strongCopyleft) warnings.push(`${strongCopyleft} repo(s) use strong copyleft licensing; review distribution obligations`)
  if (languages.size > 2) warnings.push(`Cross-language integration spans ${languages.size} runtimes`)
  if (coverage < 0.7) warnings.push('Portfolio does not cover every requested capability; custom implementation is required')
  if (integrationRisk > 0.55) warnings.push('Integration risk is elevated; isolate repositories behind adapters/services')

  const rationale = [
    `${Math.round(coverage * 100)}% estimated capability coverage`,
    `${Math.round(quality * 100)}% repository quality signal`,
    `${Math.round(licenseSafety * 100)}% license safety signal`,
    repos.length === 1 ? 'Lowest integration overhead' : `${repos.length}-repo composition balances coverage and implementation effort`,
  ]

  return {
    id,
    title: repos.length === 1 ? 'Focused foundation' : repos.length === 2 ? 'Balanced composition' : 'Maximum coverage composition',
    repoCount: repos.length,
    repos: repos.map(({ raw: _raw, ...repo }) => repo),
    coverage: Number(coverage.toFixed(3)),
    quality: Number(quality.toFixed(3)),
    licenseSafety: Number(licenseSafety.toFixed(3)),
    maintenance: Number(maintenance.toFixed(3)),
    compatibility: Number(compatibility.toFixed(3)),
    integrationRisk: Number(integrationRisk.toFixed(3)),
    fitPercentage: Math.round(fit * 100),
    confidence: Number(confidence.toFixed(3)),
    rationale,
    warnings,
  }
}

function buildPortfolios(graph: FactoryGraph) {
  const repoMap = repositoryIndex(graph)
  const mappings = list<Record<string, any>>(graph.capability_mappings)
  const preferred = new Set<string>()
  for (const mapping of mappings) {
    const selected = text(mapping.selected)
    if (selected) preferred.add(selected)
    for (const candidate of list<Record<string, any>>(mapping.candidates).slice(0, 2)) {
      const name = text(candidate.full_name)
      if (name) preferred.add(name)
    }
  }

  let pool = [...preferred]
    .map((name) => repoMap.get(name))
    .filter((repo): repo is FactoryRepoChoice & { raw: Record<string, any> } => Boolean(repo))
  if (!pool.length) pool = [...repoMap.values()]

  pool = pool
    .sort((a, b) => b.score - a.score || b.stars - a.stars)
    .slice(0, 8)

  const portfolios: FactoryPortfolio[] = []
  for (let size = 1; size <= Math.min(3, pool.length); size += 1) {
    for (const combo of combinations(pool, size)) {
      portfolios.push(scorePortfolio(graph, combo, `portfolio-${size}-${portfolios.length + 1}`))
    }
  }

  const sorted = portfolios.sort((a, b) => {
    if (b.fitPercentage !== a.fitPercentage) return b.fitPercentage - a.fitPercentage
    if (a.integrationRisk !== b.integrationRisk) return a.integrationRisk - b.integrationRisk
    return b.coverage - a.coverage
  })

  // Return three useful options rather than three near-identical permutations.
  const picked: FactoryPortfolio[] = []
  const signatures = new Set<string>()
  for (const portfolio of sorted) {
    const signature = portfolio.repos.map((repo) => repo.fullName).sort().join('|')
    if (signatures.has(signature)) continue
    picked.push(portfolio)
    signatures.add(signature)
    if (picked.length === 3) break
  }
  return picked
}

function findRecommendedStrategy(graph: FactoryGraph) {
  const strategies = list<Record<string, any>>(graph.strategies)
  if (!strategies.length) return null
  const tournamentWinner = graph?.tournament?.winner
  const winnerId = text(tournamentWinner?.id)
  const approved = graph.approved_strategy || graph.approvedStrategy
  const selected = approved || strategies.find((strategy) => text(strategy.id) === winnerId) || strategies[0]
  const confidence = normalizeScore(selected?.confidence ?? tournamentWinner?.confidence, 0.68)
  return {
    id: text(selected?.id) || 'recommended',
    name: text(selected?.name) || 'Recommended strategy',
    why: text(selected?.why) || text(tournamentWinner?.rationale) || text(selected?.description),
    confidence: Number(confidence.toFixed(3)),
  }
}

function architecturePreview(graph: FactoryGraph, strategy: ReturnType<typeof findRecommendedStrategy>) {
  const architecture = graph.architecture || {}
  const components = list<Record<string, any>>(architecture.components)
    .map((component) => text(component.name) || text(component.id) || text(component.type))
    .filter(Boolean)
    .slice(0, 10)
  const capabilityFallback = list<Record<string, any>>(graph?.capabilities?.capabilities)
    .map((capability) => text(capability.name))
    .filter(Boolean)
    .slice(0, 8)
  return {
    style: text(architecture.style) || text(architecture.pattern) || text(strategy?.name) || 'Modular service architecture',
    components: components.length ? components : capabilityFallback,
    deployment: typeof architecture.deployment === 'string'
      ? architecture.deployment
      : text(architecture?.deployment?.type) || 'Container-ready deployment',
  }
}

function createIdePrompt(input: FactoryManagerInput, portfolio: FactoryPortfolio | null, strategy: ReturnType<typeof findRecommendedStrategy>, architecture: ReturnType<typeof architecturePreview>) {
  const graph = input.graph
  const requirements = list<Record<string, any>>(graph.requirements)
    .map((item) => text(item.requirement) || text(item.description) || text(item.name))
    .filter(Boolean)
    .slice(0, 12)
  const repos = portfolio?.repos || []
  const repoText = repos.length
    ? repos.map((repo, index) => `${index + 1}. ${repo.fullName} — ${repo.url}\n   Role: ${repo.roles.join(', ') || 'foundation/reference'}\n   License: ${repo.license}`).join('\n')
    : 'No repository passed the evidence threshold. Implement from first principles and rerun GitHub discovery.'
  const componentText = architecture.components.length ? architecture.components.join(', ') : 'derive modular components from the requirements'

  return `You are the implementation engineer for AI Product Factory. Build the product below as a production-ready, maintainable system.

PRODUCT
${input.idea || text(graph.idea) || text(graph?.intent?.summary) || 'Use the supplied Product Knowledge Graph as the source of truth.'}

MANAGER DECISION
Strategy: ${strategy ? `${strategy.id} — ${strategy.name}` : 'Use the safest high-coverage architecture'}
Recommended repository composition: ${portfolio ? `${portfolio.repoCount} repo(s), estimated implementation fit ${portfolio.fitPercentage}%` : 'No repository composition available'}
Architecture/deployment: ${architecture.style}; ${architecture.deployment}
Core components: ${componentText}

OPEN-SOURCE SOURCES
${repoText}

SOURCE-USAGE RULES
- Treat repositories as reusable dependencies, services, adapters, or implementation references; do not blindly merge source trees.
- Before copying any source, verify the repository license and preserve notices/attribution. If license metadata is missing or incompatible, reimplement the behavior behind a clean interface instead of copying code.
- Pin versions/commits, keep provenance in THIRD_PARTY_NOTICES.md, and isolate each external project behind an adapter so it can be replaced.

REQUIREMENTS
${requirements.length ? requirements.map((requirement, index) => `${index + 1}. ${requirement}`).join('\n') : '- Derive acceptance criteria from the product intent, capability graph, and approved strategy.'}

IMPLEMENTATION FLOW
1. Inspect the target repository and existing architecture before editing.
2. Create an ADR describing which open-source repositories are used and why.
3. Define typed contracts/interfaces first, then adapters for each external repository.
4. Implement the smallest end-to-end vertical slice and make it runnable locally.
5. Add configuration via environment variables; never hard-code secrets.
6. Add unit/integration tests for adapters, critical business logic, failure paths, and API contracts.
7. Add Docker/dev setup, health checks, structured logs, timeouts, retries, caching where appropriate, and safe concurrency limits.
8. Run lint, type-check, tests, and production build; fix failures before declaring completion.
9. Produce README setup instructions, architecture diagram text, API examples, and THIRD_PARTY_NOTICES.md.

QUALITY GATES
- No unlicensed source copying.
- No invented APIs from referenced repositories: inspect actual docs/code before integration.
- Graceful fallback when a third-party repository/service is unavailable.
- Idempotent operations where retries can occur.
- Input validation and least-privilege secret handling.
- Explain any capability that still requires custom implementation.

Start by returning a concise implementation plan and file map, then implement it. Do not stop at scaffolding: complete the runnable vertical slice and validation steps.`
}

export function createFactoryManagerReport(input: FactoryManagerInput): FactoryManagerReport {
  const graph = input.graph || {}
  const portfolios = buildPortfolios(graph)
  const recommendedPortfolio = portfolios[0] || null
  const strategy = findRecommendedStrategy(graph)
  const architecture = architecturePreview(graph, strategy)

  const reviewScoreRaw = numberValue(graph?.review?.score, 70)
  const reviewScore = clamp(reviewScoreRaw > 1 ? reviewScoreRaw / 100 : reviewScoreRaw)
  const overallConfidence = normalizeScore(graph?.confidences?.overall, 0.62)
  const portfolioFit = recommendedPortfolio ? recommendedPortfolio.fitPercentage / 100 : 0.35
  const critiquePassed = graph?.self_critique?.passed !== false
  const simulationScoreRaw = numberValue(graph?.architecture_simulation?.score, graph?.architecture_simulation?.passed === false ? 45 : 75)
  const simulationScore = clamp(simulationScoreRaw > 1 ? simulationScoreRaw / 100 : simulationScoreRaw)

  const feasibility = clamp(
    reviewScore * 0.25 +
    overallConfidence * 0.25 +
    portfolioFit * 0.35 +
    simulationScore * 0.15 -
    (critiquePassed ? 0 : 0.08),
  )

  const riskFlags = [...(recommendedPortfolio?.warnings || [])]
  for (const concern of list<Record<string, any>>(graph?.self_critique?.concerns).slice(0, 4)) {
    const message = text(concern.message) || text(concern.concern) || text(concern)
    if (message) riskFlags.push(message)
  }
  if (graph?.review?.verdict && String(graph.review.verdict).toLowerCase().includes('reject')) {
    riskFlags.push(`Review gate verdict: ${graph.review.verdict}`)
  }

  const decision: FactoryManagerReport['managerVerdict']['decision'] =
    feasibility >= 0.72 && riskFlags.length <= 2
      ? 'GO'
      : feasibility >= 0.55
        ? 'GO_WITH_GUARDS'
        : 'RESEARCH_MORE'

  const managerConfidence = clamp(overallConfidence * 0.55 + (recommendedPortfolio?.confidence || 0.45) * 0.45)
  const summary = recommendedPortfolio
    ? `${decision.replaceAll('_', ' ')}: use ${recommendedPortfolio.repos.map((repo) => repo.fullName).join(' + ')} as the open-source foundation, with adapters rather than a raw source-tree merge.`
    : `${decision.replaceAll('_', ' ')}: GitHub evidence is not yet strong enough to recommend a repository foundation.`

  const reasons = [
    recommendedPortfolio ? `Best portfolio scores ${recommendedPortfolio.fitPercentage}% estimated implementation fit.` : 'No repository portfolio met the evidence threshold.',
    strategy ? `Strategy ${strategy.id} (${strategy.name}) is the current decision path.` : 'No strategy winner was available; use the review gate before building.',
    `Reasoning confidence is ${Math.round(overallConfidence * 100)}%; review signal is ${Math.round(reviewScore * 100)}%.`,
  ]

  const humanChecks = [
    'Verify every selected repository license and redistribution obligations before copying source.',
    'Open each GitHub repository and confirm its current API, setup instructions, maintenance state, and security posture.',
    'Validate the manager percentages with a runnable proof-of-concept; they are evidence-based estimates, not success guarantees.',
  ]

  const buildFlow = [
    { step: 1, name: 'Understand', owner: 'Product Thinking + Intent agents', output: 'Problem definition, users, constraints, acceptance criteria' },
    { step: 2, name: 'Research', owner: 'Market + GitHub + Repository agents', output: 'Current open-source candidates and evidence' },
    { step: 3, name: 'Decide', owner: 'Debate + Tournament + Manager', output: 'One recommended strategy and up to three repo portfolios' },
    { step: 4, name: 'Architect', owner: 'Composition + Architecture agents', output: 'Adapters, services, data flow, deployment, simulation' },
    { step: 5, name: 'Build', owner: 'Engineering + Execution agents', output: 'Runnable vertical slice, config, tests, generated components' },
    { step: 6, name: 'Validate', owner: 'Review + Self-Critique', output: 'Quality gates, risks, test/build results' },
    { step: 7, name: 'Learn', owner: 'Experience + Product Memory', output: 'Reusable evidence for future products' },
  ]

  return {
    version: '7.0',
    runId: input.runId || text(graph._run_id) || null,
    generatedAt: new Date().toISOString(),
    idea: input.idea || text(graph.idea) || text(graph?.intent?.summary),
    stage: graph?._status === 'complete' || graph?.approved_strategy ? 'approved' : 'strategy',
    recommendedStrategy: strategy,
    portfolioRecommendations: portfolios,
    recommendedPortfolio,
    managerVerdict: {
      decision,
      estimatedFeasibility: Math.round(feasibility * 100),
      confidence: Math.round(managerConfidence * 100),
      summary,
      reasons,
      riskFlags: [...new Set(riskFlags)].slice(0, 8),
      humanChecks,
    },
    buildFlow,
    architecturePreview: architecture,
    idePrompt: createIdePrompt(input, recommendedPortfolio, strategy, architecture),
    sourcePolicy: 'Use open-source repositories through dependency/API/adapter boundaries. Copy source only when the license explicitly permits it, preserve notices/attribution, pin versions, and record provenance.',
  }
}
