import {
  createFactoryManagerReport,
  type FactoryManagerInput,
  type FactoryManagerReport,
  type FactoryPortfolio,
} from '@/lib/factory/manager'

export type LiveResearch = {
  success?: boolean
  query?: string
  generatedAt?: string
  sourceCatalog?: Array<{ id: string; name: string; mode: string; purpose: string }>
  signals?: Array<{
    source: string
    kind: string
    title: string
    url: string
    summary: string
    publishedAt?: string
    relevance?: number
    metrics?: Record<string, number | string>
  }>
  summary?: { signalCount?: number; sourcesWithResults?: number; sourceCounts?: Record<string, number> }
}

export interface FactoryManagerV8Input extends FactoryManagerInput {
  liveResearch?: LiveResearch | null
}

type RepoIntel = {
  full_name?: string
  description?: string
  language?: string
  license?: string
  explainable_score?: number
  capabilities?: string[]
  strengths?: string[]
  weaknesses?: string[]
  reasons?: string[]
  dimensions?: Record<string, number>
  evidence?: Record<string, unknown>
}

export type RepoExplainer = {
  fullName: string
  url: string
  description: string
  language: string
  license: string
  healthScore: number
  capabilities: string[]
  whatItCanDo: string[]
  whySelected: string[]
  strengths: string[]
  weaknesses: string[]
  integrationMode: 'dependency-adapter' | 'service-adapter' | 'reference-reimplementation'
  integrationExplanation: string
  exactCombinationRole: string
  validationSteps: string[]
  evidence: Record<string, unknown>
}

export type CompositionSuggestion = {
  id: string
  title: string
  type: 'recommended' | 'two-repo-fusion' | 'alternative-stack'
  repos: RepoExplainer[]
  overlapWithRecommended: number
  estimatedFit: number
  whyThisCombination: string[]
  combinationPattern: string
  dataFlow: string[]
  resultingProduct: string
  customCodeNeeded: string[]
  buildSteps: string[]
  risks: string[]
  validationGates: string[]
}

export type CommercialPlan = {
  currency: 'USD'
  status: string
  pricingConfidence: number
  evidence: Array<{ source: string; text: string; url?: string; values: number[] }>
  tiers: Array<{
    name: string
    monthlyPriceUsd: number
    annualPriceUsd: number
    modeledCogsPerCustomerUsd: number
    modeledGrossMarginPct: number
    modeledBreakEvenCustomers: number | null
    bestFor: string
  }>
  implementationSaleRangeUsd: { low: number; high: number }
  scenarios: Array<{ name: string; monthlyRevenueUsd: number; modeledMonthlyCostUsd: number; modeledContributionUsd: number }>
  profitActions: string[]
  warning: string
}

export type FactoryManagerV8Report = FactoryManagerReport & {
  version: '8.0'
  repoExplainers: RepoExplainer[]
  compositionSuggestions: CompositionSuggestion[]
  sourceIntelligence: {
    generatedAt: string | null
    query: string
    sourcesConfigured: number
    sourcesWithResults: number
    signalCount: number
    sourceCatalog: LiveResearch['sourceCatalog']
    topSignals: NonNullable<LiveResearch['signals']>
  }
  commercialPlan: CommercialPlan
  accuracyContract: {
    promise: string
    releaseRule: string
    gates: Array<{ gate: string; passCondition: string }>
  }
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function list<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))
}

function pct(value: unknown, fallback = 0.5) {
  const raw = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(raw)) return Math.round(fallback * 100)
  return Math.round(clamp(raw > 1 ? raw / 100 : raw) * 100)
}

function repoUrl(fullName: string, graph: Record<string, any>) {
  const repo = list<Record<string, any>>(graph.repos).find((item) => text(item.full_name) === fullName)
  return text(repo?.html_url) || text(repo?.url) || `https://github.com/${fullName}`
}

function roleMap(graph: Record<string, any>) {
  const map = new Map<string, Set<string>>()
  for (const mapping of list<Record<string, any>>(graph.capability_mappings)) {
    const role = text(mapping.capability_name) || text(mapping.capability_id) || 'Product capability'
    const names = [text(mapping.selected), ...list<Record<string, any>>(mapping.candidates).map((candidate) => text(candidate.full_name))].filter(Boolean)
    for (const name of names) {
      if (!map.has(name)) map.set(name, new Set())
      map.get(name)?.add(role)
    }
  }
  return map
}

function buildRepoExplainers(graph: Record<string, any>): RepoExplainer[] {
  const reports = list<RepoIntel>(graph?.repository_intelligence?.reports)
  const roles = roleMap(graph)
  const repoByName = new Map(list<Record<string, any>>(graph.repos).map((repo) => [text(repo.full_name), repo]))
  const allNames = new Set<string>([
    ...reports.map((report) => text(report.full_name)),
    ...list<Record<string, any>>(graph.capability_mappings).flatMap((mapping) => [
      text(mapping.selected),
      ...list<Record<string, any>>(mapping.candidates).map((candidate) => text(candidate.full_name)),
    ]),
  ].filter(Boolean))

  return [...allNames].map((fullName) => {
    const report = reports.find((item) => text(item.full_name) === fullName) || {}
    const repo = repoByName.get(fullName) || {}
    const capabilities = [...new Set([...(report.capabilities || []), ...(roles.get(fullName) || [])])]
    const license = text(report.license) || text(repo.license) || 'unknown'
    const language = text(report.language) || text(repo.language) || 'Unknown'
    const dimensions = report.dimensions || repo.scores || {}
    const api = Number(dimensions.api_stability ?? dimensions.api_quality ?? 0.5)
    const extensibility = Number(dimensions.extensibility ?? 0.5)
    const licenseUnsafe = !license || ['unknown', 'none', 'noassertion', 'other'].includes(license.toLowerCase())
    const integrationMode: RepoExplainer['integrationMode'] = licenseUnsafe
      ? 'reference-reimplementation'
      : api >= 0.65 || extensibility >= 0.7
        ? 'dependency-adapter'
        : 'service-adapter'
    const integrationExplanation = integrationMode === 'reference-reimplementation'
      ? 'Use this repository to understand the behavior and architecture, but do not copy source until the license is verified. Reimplement the required capability behind your own interface.'
      : integrationMode === 'dependency-adapter'
        ? 'Pin the repository/package version and wrap its public API behind an internal adapter. Your product talks to the adapter, never directly to repository internals.'
        : 'Run the repository as an isolated process/container and integrate through HTTP, queue, CLI or another documented boundary. Keep its runtime and dependencies separate.'
    const description = text(report.description) || text(repo.description) || `Open-source project selected for ${capabilities.join(', ') || 'the requested product'}.`
    const whatItCanDo = capabilities.length
      ? capabilities.map((capability) => `Provides or accelerates the ${capability} capability.`)
      : ['Provides reusable open-source behavior relevant to the requested product.']

    return {
      fullName,
      url: repoUrl(fullName, graph),
      description,
      language,
      license,
      healthScore: pct(report.explainable_score ?? repo.weighted_score, 0.5),
      capabilities,
      whatItCanDo,
      whySelected: [...(report.reasons || []), ...list<string>(repo.reasons)].filter(Boolean).slice(0, 7),
      strengths: (report.strengths || []).slice(0, 6),
      weaknesses: (report.weaknesses || []).slice(0, 6),
      integrationMode,
      integrationExplanation,
      exactCombinationRole: capabilities.length
        ? `${fullName} owns ${capabilities.slice(0, 3).join(', ')}; the Product Factory supplies the orchestration, unified data contracts, auth, UI and failure handling around it.`
        : `${fullName} is used as a replaceable implementation component, not as the whole product.`,
      validationSteps: [
        `Open ${repoUrl(fullName, graph)} and verify the current README/API against the proposed integration.`,
        `Verify ${license} licensing and preserve required notices before redistribution.`,
        'Pin a commit/tag and run the repository or package in isolation before composition.',
        'Add contract tests around the adapter so future upstream changes cannot silently break the product.',
      ],
      evidence: report.evidence || {},
    }
  }).sort((a, b) => b.healthScore - a.healthScore)
}

function signature(names: string[]) {
  return [...new Set(names)].sort().join('|')
}

function makeComposition(
  id: string,
  title: string,
  type: CompositionSuggestion['type'],
  names: string[],
  explainers: RepoExplainer[],
  recommendedNames: Set<string>,
  idea: string,
): CompositionSuggestion | null {
  const repos = names.map((name) => explainers.find((repo) => repo.fullName === name)).filter((repo): repo is RepoExplainer => Boolean(repo))
  if (!repos.length) return null
  const capabilities = [...new Set(repos.flatMap((repo) => repo.capabilities))]
  const avgHealth = repos.reduce((sum, repo) => sum + repo.healthScore, 0) / repos.length
  const licensePenalty = repos.filter((repo) => repo.integrationMode === 'reference-reimplementation').length * 7
  const integrationPenalty = Math.max(0, repos.length - 1) * 4
  const estimatedFit = Math.max(20, Math.min(96, Math.round(avgHealth * 0.55 + Math.min(100, capabilities.length * 12) * 0.45 - licensePenalty - integrationPenalty)))
  const overlap = repos.filter((repo) => recommendedNames.has(repo.fullName)).length / repos.length
  const runtimes = [...new Set(repos.map((repo) => repo.language).filter((value) => value && value !== 'Unknown'))]
  const crossRuntime = runtimes.length > 1
  const pattern = crossRuntime ? 'service federation + typed adapters' : 'dependency composition + adapter layer'
  const flow = [
    'User/API request enters the Product Factory application layer.',
    ...repos.map((repo, index) => `Adapter ${index + 1} calls ${repo.fullName} for ${repo.capabilities.slice(0, 2).join(' + ') || 'its specialized capability'}.`),
    'Factory orchestration normalizes outputs into one internal schema and applies business rules.',
    'Shared persistence/cache stores only normalized product-owned data, not repository-specific internals.',
    'Unified API/UI returns one product experience and records telemetry for learning and cost control.',
  ]
  const warnings = repos.flatMap((repo) => repo.weaknesses.slice(0, 2))
  if (crossRuntime) warnings.push(`Multiple runtimes (${runtimes.join(', ')}) increase deployment and observability complexity.`)

  return {
    id, title, type, repos,
    overlapWithRecommended: Math.round(overlap * 100),
    estimatedFit,
    whyThisCombination: [
      `${capabilities.length || 1} distinct capabilities are covered by specialized components.`,
      `${Math.round(avgHealth)}% average repository-health signal across the selected set.`,
      type === 'alternative-stack' ? 'Designed as a genuinely different implementation path to reduce dependence on the first recommendation.' : 'Keeps repository count bounded so integration complexity remains testable.',
    ],
    combinationPattern: pattern,
    dataFlow: flow,
    resultingProduct: `${idea || 'The requested product'} becomes a single application in which ${repos.map((repo) => `${repo.fullName} handles ${repo.capabilities.slice(0, 2).join('/') || 'a specialized module'}`).join('; ')}. The value users buy is the unified workflow, data model, intelligence, automation, UX and reliability layer built around those components—not a raw bundle of repositories.`,
    customCodeNeeded: [
      'Product-owned domain model and typed contracts',
      'Adapters/service clients for every selected repository',
      'Workflow/orchestration layer and retries/timeouts',
      'Authentication, authorization, tenant boundaries and secrets handling',
      'Unified frontend/API and normalized persistence/cache',
      'Observability, cost metering, tests, migrations and deployment configuration',
    ],
    buildSteps: [
      'Verify repository versions, licenses, APIs and runnable examples.',
      'Create an ADR and interface contract for each repository boundary.',
      'Make every selected repository work independently before composing them.',
      'Implement one end-to-end vertical slice through all adapters.',
      'Add failure isolation, caching, rate limits, idempotency and fallback behavior.',
      'Run unit, contract, integration, E2E, security, load and production-build gates.',
    ],
    risks: warnings.length ? warnings.slice(0, 8) : ['No major repository-specific warning was present in the current evidence; runtime validation is still required.'],
    validationGates: [
      'License gate: every redistributed/copied component has a verified compatible license.',
      'API gate: integration uses real documented APIs or inspected source—not invented methods.',
      'Build gate: clean install and production build pass from a fresh checkout.',
      'Contract gate: every adapter passes success, timeout, invalid-input and upstream-change tests.',
      'E2E gate: the target user workflow succeeds against realistic fixtures.',
      'Security gate: dependency/advisory scan and auth/secret tests pass.',
    ],
  }
}

function buildCompositionSuggestions(base: FactoryManagerReport, graph: Record<string, any>, explainers: RepoExplainer[], idea: string) {
  const ranked = explainers.map((repo) => repo.fullName)
  const recommendedNames = new Set(base.recommendedPortfolio?.repos.map((repo) => repo.fullName) || ranked.slice(0, 1))
  const usedSignatures = new Set<string>()
  const out: CompositionSuggestion[] = []
  const push = (item: CompositionSuggestion | null) => {
    if (!item) return
    const sig = signature(item.repos.map((repo) => repo.fullName))
    if (usedSignatures.has(sig)) return
    usedSignatures.add(sig)
    out.push(item)
  }

  push(makeComposition('option-a', 'Recommended product foundation', 'recommended', [...recommendedNames], explainers, recommendedNames, idea))

  let pair = ranked.slice(0, 2)
  if (signature(pair) === signature([...recommendedNames])) pair = ranked.slice(0, Math.min(3, ranked.length))
  push(makeComposition('option-b', 'Two-repo fusion / expanded core', 'two-repo-fusion', pair, explainers, recommendedNames, idea))

  const excluded = new Set([...recommendedNames, ...pair])
  let alternative = ranked.filter((name) => !excluded.has(name)).slice(0, 3)
  if (!alternative.length) {
    const baseAlternatives = base.portfolioRecommendations
      .map((portfolio: FactoryPortfolio) => portfolio.repos.map((repo) => repo.fullName))
      .sort((a, b) => a.filter((name) => recommendedNames.has(name)).length - b.filter((name) => recommendedNames.has(name)).length)
    alternative = baseAlternatives.find((names) => !usedSignatures.has(signature(names))) || []
  }
  push(makeComposition('option-c', 'Alternative open-source stack', 'alternative-stack', alternative, explainers, recommendedNames, idea))

  // Ensure the manager returns as many useful paths as current evidence permits.
  for (const portfolio of base.portfolioRecommendations) {
    if (out.length >= 3) break
    push(makeComposition(`option-${out.length + 1}`, `Evidence-backed composition ${out.length + 1}`, out.length === 0 ? 'recommended' : 'two-repo-fusion', portfolio.repos.map((repo) => repo.fullName), explainers, recommendedNames, idea))
  }
  return out.slice(0, 3)
}

function extractPriceEvidence(graph: Record<string, any>, live: LiveResearch | null | undefined) {
  const evidence: CommercialPlan['evidence'] = []
  const add = (source: string, value: string, url?: string) => {
    const values = [...value.matchAll(/(?:\$|USD\s*)(\d+(?:\.\d+)?)/gi)].map((match) => Number(match[1])).filter((number) => number >= 1 && number <= 100000)
    if (values.length) evidence.push({ source, text: value.slice(0, 500), url, values: values.slice(0, 6) })
  }
  for (const product of list<Record<string, any>>(graph?.market?.existing_products || graph?.existing_products)) {
    add(text(product.name) || 'Competitor', text(product.pricing), text(product.source))
  }
  for (const signal of list<NonNullable<LiveResearch['signals']>[number]>(live?.signals)) {
    if (signal.kind === 'pricing-market') add(signal.title || signal.source, `${signal.title} ${signal.summary}`, signal.url)
  }
  return evidence.slice(0, 12)
}

function friendlyPrice(value: number) {
  if (value < 15) return Math.max(5, Math.round(value))
  return Math.max(9, Math.round(value / 10) * 10 - 1)
}

function commercialPlan(graph: Record<string, any>, live: LiveResearch | null | undefined, composition: CompositionSuggestion[]): CommercialPlan {
  const evidence = extractPriceEvidence(graph, live)
  const values = evidence.flatMap((item) => item.values).filter((value) => value <= 10000).sort((a, b) => a - b)
  const complexity = clamp(0.35 + Math.min(0.35, list(graph.requirements).length * 0.025) + Math.min(0.2, (composition[0]?.repos.length || 1) * 0.055))
  const median = values.length ? values[Math.floor(values.length / 2)] : null
  const starter = friendlyPrice(median ? median * 0.45 : 12 + complexity * 28)
  const pro = friendlyPrice(median ? median * 0.95 : 39 + complexity * 90)
  const business = friendlyPrice(median ? median * 2.1 : 119 + complexity * 260)
  const variable = 5 + complexity * 34
  const support = 3 + complexity * 12
  const fixed = 150 + complexity * 850
  const cogs = variable + support
  const tiers = [
    ['Starter', starter, 'individuals and light usage'],
    ['Pro', pro, 'power users and small teams'],
    ['Business', business, 'teams needing higher limits, governance and support'],
  ].map(([name, priceValue, bestFor]) => {
    const price = Number(priceValue)
    const gp = Math.max(0, price - cogs)
    return {
      name: String(name), monthlyPriceUsd: price, annualPriceUsd: Math.round(price * 10),
      modeledCogsPerCustomerUsd: Number(cogs.toFixed(2)),
      modeledGrossMarginPct: Number((price ? gp / price * 100 : 0).toFixed(1)),
      modeledBreakEvenCustomers: gp > 0 ? Math.ceil(fixed / gp) : null,
      bestFor: String(bestFor),
    }
  })
  const confidence = Math.round(clamp(0.32 + Math.min(0.48, evidence.length * 0.08) + Math.min(0.12, (live?.summary?.sourcesWithResults || 0) * 0.02)) * 100)
  const implementationLow = friendlyPrice(1500 + complexity * 6000)
  const implementationHigh = friendlyPrice(5000 + complexity * 18000)
  const proTier = tiers[1]
  const scenario = (customers: number) => ({
    name: `${customers} Pro customers`,
    monthlyRevenueUsd: customers * proTier.monthlyPriceUsd,
    modeledMonthlyCostUsd: Math.round(customers * cogs + fixed),
    modeledContributionUsd: Math.round(customers * proTier.monthlyPriceUsd - (customers * cogs + fixed)),
  })
  return {
    currency: 'USD',
    status: evidence.length >= 3 ? 'Evidence-backed pricing hypothesis' : 'Pricing hypothesis — more current competitor/customer evidence required',
    pricingConfidence: confidence,
    evidence,
    tiers,
    implementationSaleRangeUsd: { low: implementationLow, high: implementationHigh },
    scenarios: [scenario(100), scenario(500)],
    profitActions: [
      'Meter expensive AI/compute operations or put them behind plan quotas instead of unlimited usage.',
      'Offer annual prepay near 10 months of monthly price to improve cash flow while preserving unit economics.',
      'Charge separately for private deployment, migration, SSO, audit logs, SLA and implementation services.',
      'Route simple tasks to cheaper models/services and track cost per successful user outcome.',
      'Validate willingness-to-pay with customer interviews and price experiments before locking public pricing.',
    ],
    warning: 'Profit, margin and price cannot be guaranteed before real operating-cost and willingness-to-pay data exists. These numbers are modeled scenarios, not financial promises.',
  }
}

export function createFactoryManagerV8Report(input: FactoryManagerV8Input): FactoryManagerV8Report {
  const base = createFactoryManagerReport(input)
  const graph = input.graph || {}
  const idea = input.idea || text(graph.idea) || text(graph?.intent?.summary) || 'The requested product'
  const explainers = buildRepoExplainers(graph)
  const compositions = buildCompositionSuggestions(base, graph, explainers, idea)
  const live = input.liveResearch || null
  return {
    ...base,
    version: '8.0',
    repoExplainers: explainers,
    compositionSuggestions: compositions,
    sourceIntelligence: {
      generatedAt: live?.generatedAt || null,
      query: live?.query || '',
      sourcesConfigured: live?.sourceCatalog?.length || 0,
      sourcesWithResults: live?.summary?.sourcesWithResults || 0,
      signalCount: live?.summary?.signalCount || 0,
      sourceCatalog: live?.sourceCatalog || [],
      topSignals: list(live?.signals).slice(0, 18),
    },
    commercialPlan: commercialPlan(graph, live, compositions),
    accuracyContract: {
      promise: 'The Factory will maximize evidence, traceability and executable verification. It will not claim 100% correctness from research or model confidence alone.',
      releaseRule: 'A product may be labeled VERIFIED BUILD only after its exact pinned sources, licenses, clean build, tests, security checks and target user workflow have passed. Otherwise it remains an estimated recommendation.',
      gates: [
        { gate: 'Source truth', passCondition: 'Every external repo/model/package has a working URL, pinned version/commit and inspected current documentation.' },
        { gate: 'License', passCondition: 'Every reused/copy-distributed component has a reviewed compatible license and required attribution.' },
        { gate: 'Build', passCondition: 'Fresh install and production build complete without hidden manual steps.' },
        { gate: 'Tests', passCondition: 'Unit, adapter contract, integration and end-to-end tests pass for success and failure paths.' },
        { gate: 'Security', passCondition: 'Dependency/advisory scan, authentication, secrets and permission tests meet the product policy.' },
        { gate: 'Product outcome', passCondition: 'The requested user workflow succeeds against realistic data with measured latency/cost limits.' },
      ],
    },
  }
}
