import {
  createPriorityAwareFactoryManagerV10Report,
  type PriorityAwareFactoryManagerInput,
} from '@/lib/factory/manager-v10-priority'
import type {
  CustomerComposition,
  FactoryManagerV10Report,
  RankedRepo,
} from '@/lib/factory/manager-v10'
import type { DeepResearchSignalV12, RepoInspectionV12 } from '@/lib/factory/deep-research-v12'

export type FactoryManagerV12Report = FactoryManagerV10Report & {
  engineVersion: '12.0'
  researchProof: {
    gateTarget: number
    gatePassed: boolean
    researchCompleteness: number
    capabilityCoverage: number
    averageInspection: number
    averageRepositoryRelevance: number
    inspectedRepositories: number
    qualifiedRepositories: number
    sourceLinks: Array<{ label: string; url: string; kind: string }>
    architecturePatterns: string[]
    explanation: string
  }
}

type ExtendedResearch = NonNullable<PriorityAwareFactoryManagerInput['liveResearch']> & {
  engineVersion?: string
  profile?: {
    capabilities?: string[]
    specializedCapabilities?: string[]
    genericCapabilities?: string[]
    productArchetype?: string
  }
  summary?: Record<string, any> & {
    rejectedSignalCount?: number
    repositoriesDiscovered?: number
    repositoriesInspected?: number
    githubCandidates?: number
    averageRelevance?: number
    averageInspection?: number
    capabilityCoverage?: number
    researchCompleteness?: number
  }
  signals?: DeepResearchSignalV12[]
  sourceLinks?: Array<{ label: string; url: string; kind: string }>
  architecturePatterns?: string[]
}

const GENERIC = new Set([
  'backend api', 'frontend ui', 'authentication', 'data store', 'monitoring', 'observability', 'scheduling',
  'error handling', 'audit logging', 'execution runner', 'workflow engine', 'notifications', 'search',
])

function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function numberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}
function clamp(value: number, min = 0, max = 100) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0)) }
function tokens(value: string) { return [...new Set(value.toLowerCase().match(/[a-z0-9+#.-]{3,}/g) || [])] }

function capabilityMatches(wanted: string, provided: string) {
  if (wanted.toLowerCase() === provided.toLowerCase()) return true
  const a = tokens(wanted)
  const b = new Set(tokens(provided))
  if (!a.length) return false
  return a.filter((token) => b.has(token)).length / a.length >= 0.55
}

function requestedSpecialized(report: FactoryManagerV10Report, live: ExtendedResearch | null) {
  const explicit = Array.isArray(live?.profile?.specializedCapabilities)
    ? live!.profile!.specializedCapabilities!.filter(Boolean)
    : []
  if (explicit.length) return [...new Set(explicit)]
  return report.customerBrief.capabilities.filter((capability) => !GENERIC.has(capability.toLowerCase()))
}

function githubRepoSignals(live: ExtendedResearch | null) {
  return (Array.isArray(live?.signals) ? live!.signals! : [])
    .filter((signal): signal is DeepResearchSignalV12 => signal?.kind === 'github-repository' && Boolean(signal.repository?.fullName))
}

function inspectionFor(signal: DeepResearchSignalV12 | undefined): RepoInspectionV12 | null {
  return signal?.inspection?.inspected ? signal.inspection : null
}

function strictRepositories(report: FactoryManagerV10Report, live: ExtendedResearch | null) {
  const signals = githubRepoSignals(live)
  const signalByName = new Map(signals.map((signal) => [text(signal.repository?.fullName).toLowerCase(), signal]))

  const repos = report.repoExplainers.filter((repo) => {
    const signal = signalByName.get(repo.fullName.toLowerCase())
    const inspection = inspectionFor(signal)
    if (!signal || !inspection) return false
    if (!inspection.specializedCapabilities.length) return false
    if (numberValue(signal.relevance) < 0.64) return false
    if (inspection.inspectionScore < 50) return false
    if (repo.productRelevance < 58) return false
    if (repo.recommendationScore < 58) return false
    return true
  }).map((repo) => {
    const signal = signalByName.get(repo.fullName.toLowerCase())!
    const inspection = signal.inspection!
    const evidenceStrength = Math.round(clamp(
      inspection.inspectionScore * 0.55 +
      numberValue(signal.relevance) * 100 * 0.30 +
      Math.min(100, inspection.sourceFilesSampled * 18 + inspection.sourceLinks.length * 8) * 0.15,
    ))
    return {
      ...repo,
      capabilities: inspection.verifiedCapabilities.length ? inspection.verifiedCapabilities : repo.capabilities,
      productRelevance: Math.max(repo.productRelevance, Math.round(numberValue(signal.relevance) * 100)),
      evidenceStrength,
      whySelected: [
        `${Math.round(numberValue(signal.relevance) * 100)}% deep-research relevance after README/source inspection`,
        `${inspection.inspectionScore}% repository inspection score`,
        `Verified capabilities: ${inspection.specializedCapabilities.join(', ')}`,
        ...repo.whySelected.filter((item) => !/live product relevance/i.test(item)).slice(0, 2),
      ],
      strengths: [
        ...repo.strengths.slice(0, 2),
        `${inspection.sourceFilesSampled} representative source file(s) inspected`,
        `${inspection.filesSeen} repository file(s) mapped`,
      ],
      validationSteps: [
        ...inspection.sourceLinks.slice(0, 5).map((link) => `Re-check ${link.label}: ${link.url}`),
        ...repo.validationSteps.slice(0, 3),
      ],
      evidence: {
        ...(repo.evidence || {}),
        deepInspection: inspection,
        sourceLinks: inspection.sourceLinks,
      },
    } satisfies RankedRepo
  }).sort((a, b) =>
    (b.productRelevance * 0.42 + b.capabilityCoverage * 0.24 + b.evidenceStrength * 0.22 + b.maintenanceScore * 0.12) -
    (a.productRelevance * 0.42 + a.capabilityCoverage * 0.24 + a.evidenceStrength * 0.22 + a.maintenanceScore * 0.12),
  )

  return { repos, signalByName }
}

function coveredCapabilities(repos: RankedRepo[], requested: string[]) {
  return requested.filter((capability) => repos.some((repo) =>
    repo.capabilities.some((provided) => capabilityMatches(capability, provided)),
  ))
}

function chooseRepos(pool: RankedRepo[], requested: string[], maxRepos: number, mode: 'fast' | 'balanced' | 'scale') {
  const chosen: RankedRepo[] = []
  const remaining = [...pool]
  const covered = new Set<string>()

  while (remaining.length && chosen.length < maxRepos) {
    let bestIndex = 0
    let bestScore = -1
    remaining.forEach((repo, index) => {
      const newCaps = requested.filter((capability) => !covered.has(capability) && repo.capabilities.some((provided) => capabilityMatches(capability, provided)))
      const coverageGain = requested.length ? newCaps.length / requested.length * 100 : repo.capabilityCoverage
      const modeScore = mode === 'scale'
        ? repo.maintenanceScore * 0.17 + repo.licenseScore * 0.10 + repo.evidenceStrength * 0.16
        : mode === 'fast'
          ? repo.productRelevance * 0.18 + (100 - repo.weaknesses.length * 12) * 0.10
          : repo.evidenceStrength * 0.18 + repo.productRelevance * 0.16
      const score = repo.recommendationScore * 0.34 + coverageGain * 0.38 + modeScore
      if (score > bestScore) { bestScore = score; bestIndex = index }
    })
    const [winner] = remaining.splice(bestIndex, 1)
    if (!winner) break
    chosen.push(winner)
    for (const capability of coveredCapabilities([winner], requested)) covered.add(capability)
    const target = mode === 'fast' ? 0.48 : mode === 'balanced' ? 0.75 : 0.90
    if (requested.length && covered.size / requested.length >= target) break
  }
  return chosen
}

function repoSignature(repos: RankedRepo[]) { return repos.map((repo) => repo.fullName.toLowerCase()).sort().join('|') }

function makePlan(
  id: string,
  title: string,
  bestFor: string,
  effort: CustomerComposition['effort'],
  type: CustomerComposition['type'],
  repos: RankedRepo[],
  requested: string[],
  idea: string,
  signalByName: Map<string, DeepResearchSignalV12>,
): CustomerComposition | null {
  if (!repos.length) return null
  const covered = coveredCapabilities(repos, requested)
  const missing = requested.filter((capability) => !covered.includes(capability))
  const coverage = requested.length ? Math.round(covered.length / requested.length * 100) : Math.round(repos.reduce((sum, repo) => sum + repo.capabilityCoverage, 0) / repos.length)
  const relevance = Math.round(repos.reduce((sum, repo) => sum + repo.productRelevance, 0) / repos.length)
  const maintenance = Math.round(repos.reduce((sum, repo) => sum + repo.maintenanceScore, 0) / repos.length)
  const license = Math.round(repos.reduce((sum, repo) => sum + repo.licenseScore, 0) / repos.length)
  const inspection = Math.round(repos.reduce((sum, repo) => {
    const signal = signalByName.get(repo.fullName.toLowerCase())
    return sum + numberValue(signal?.inspection?.inspectionScore, repo.evidenceStrength)
  }, 0) / repos.length)
  const runtimeCount = new Set(repos.map((repo) => repo.language).filter((language) => language && language !== 'Unknown')).size
  const complexityPenalty = Math.max(0, repos.length - 1) * 3 + Math.max(0, runtimeCount - 1) * 4
  const fit = Math.round(clamp(
    coverage * 0.42 + relevance * 0.24 + inspection * 0.18 + maintenance * 0.08 + license * 0.08 - complexityPenalty,
    15,
    97,
  ))
  const confidence = Math.round(clamp(
    fit * 0.48 + inspection * 0.28 + relevance * 0.16 + Math.min(100, repos.length * 16 + covered.length * 7) * 0.08,
    20,
    96,
  ))
  const integrationComplexity: CustomerComposition['integrationComplexity'] = repos.length <= 1 && runtimeCount <= 1
    ? 'Low'
    : repos.length <= 3 && runtimeCount <= 2
      ? 'Medium'
      : 'High'

  const sourceProofCount = repos.reduce((sum, repo) => sum + (signalByName.get(repo.fullName.toLowerCase())?.inspection?.sourceLinks.length || 0), 0)
  const technicalSummary = `Compose only deeply inspected sources: ${repos.map((repo) => `${repo.fullName} (${repo.capabilities.slice(0, 3).join(', ')})`).join('; ')}. Keep each project behind a replaceable product-owned adapter and implement uncovered behavior in first-party code.`

  return {
    id,
    title,
    customerTitle: title,
    bestFor,
    type,
    repos,
    overlapWithRecommended: 0,
    estimatedFit: fit,
    confidence,
    capabilityCoverage: coverage,
    domainRelevance: relevance,
    maintenanceScore: maintenance,
    licenseScore: license,
    integrationComplexity,
    effort,
    customerBenefits: [
      `${coverage}% of the requested specialized capabilities are directly covered by inspected repositories.`,
      `${sourceProofCount} clickable README/source proof link(s) support the selected components.`,
      'Repositories with keyword-only matches or generic framework-only value are excluded from this plan.',
      missing.length ? `${missing.length} capability area(s) remain intentionally product-owned rather than forcing an unrelated source.` : 'All currently identified specialized capabilities have at least one inspected implementation candidate.',
    ],
    missingCapabilities: missing,
    whyThisCombination: [
      `${relevance}% average direct product relevance after code-aware inspection.`,
      `${inspection}% average inspection quality across README, repository structure and representative source files.`,
      `${coverage}% specialized capability coverage with ${maintenance}% maintenance and ${license}% license-safety signals.`,
      'Popularity can improve confidence only after direct capability evidence passes; stars alone never qualify a source.',
    ],
    combinationPattern: runtimeCount > 1 ? 'capability services + typed adapters + product-owned orchestration' : 'modular components + typed adapters + product-owned orchestration',
    dataFlow: [
      'Natural-language request is converted into an explicit capability graph.',
      'The Product Factory routes each capability only to a repository that proved that capability in inspected documentation/source.',
      ...repos.map((repo) => `${repo.fullName} is isolated behind an adapter for ${repo.capabilities.slice(0, 3).join(', ') || 'its verified role'}.`),
      'A first-party planner, permission layer, memory policy, audit trail and unified data model coordinate the components.',
      'The user sees one coherent application rather than separate open-source tools.',
    ],
    resultingProduct: `${idea} is delivered as one coherent product. Existing open-source products accelerate only behavior proven by inspected source; the orchestration, safety model, user experience, approvals, memory policy and differentiating intelligence remain product-owned.`,
    customCodeNeeded: [
      'Product-owned capability router, workflow state machine and typed contracts',
      'Permission boundaries and human approval for destructive or externally visible actions',
      'Unified vision/action abstraction across desktop, browser and Office automation',
      'Memory/learning policy with evaluation, rollback and versioned skills instead of unsafe uncontrolled self-modification',
      ...missing.slice(0, 6).map((capability) => `${capability} — first-party implementation or later inspected adapter`),
      'Telemetry, cost metering, retries, timeouts, sandboxing and deployment configuration',
    ],
    buildSteps: [
      'Pin every approved repository to an exact commit/release and save its proof links.',
      'Read current README, architecture docs, manifests and capability-bearing source before writing an adapter.',
      'Run each external component independently and capture contract tests before composition.',
      'Implement a smallest realistic end-to-end workflow across the highest-value requested capabilities.',
      'Add permissions, approval gates, secrets isolation, sandboxing, retries, idempotency and rollback.',
      'Add evaluation fixtures so learned skills are promoted only after regression checks improve or preserve outcomes.',
      'Run lint, typecheck, unit, contract, integration, end-to-end, security and production-build gates.',
    ],
    risks: [
      ...repos.flatMap((repo) => repo.weaknesses.slice(0, 1)),
      ...(missing.length ? [`${missing.length} specialized capability area(s) still require first-party implementation.`] : []),
      'Autonomous self-improvement must be versioned, evaluated and reversible; unrestricted self-modifying production code is not an acceptable safety model.',
      ...(integrationComplexity === 'High' ? ['Multiple runtimes/components increase deployment and observability complexity.'] : []),
    ].slice(0, 8),
    validationGates: [
      'Deep relevance gate: selected repositories must have inspected README/source proving a requested specialized capability.',
      'Source-truth gate: repository URL, proof links and exact commit/version remain reproducible.',
      'License gate: reuse and distribution obligations match the intended product delivery model.',
      'Build gate: fresh install and production build succeed from pinned sources.',
      'Contract gate: each external adapter passes success, timeout, malformed response and upstream-change tests.',
      'Safety gate: high-impact desktop actions require explicit policy/approval and run in the least-privileged context.',
      'Learning gate: new skills/memory changes pass evaluation and rollback tests before promotion.',
      'Outcome gate: realistic user workflows succeed with measured latency, reliability and cost.',
    ],
    technicalSummary,
  }
}

function buildPlans(
  repos: RankedRepo[],
  requested: string[],
  idea: string,
  signalByName: Map<string, DeepResearchSignalV12>,
) {
  const candidates = [
    makePlan('option-a', 'Best balance', 'Best mix of direct capability coverage, inspectability and manageable integration complexity.', 'Balanced', 'recommended', chooseRepos(repos, requested, 4, 'balanced'), requested, idea, signalByName),
    makePlan('option-b', 'Fastest credible launch', 'Smallest inspected source set that covers the highest-value capabilities without padding with generic repositories.', 'Fastest', 'two-repo-fusion', chooseRepos(repos, requested, 2, 'fast'), requested, idea, signalByName),
    makePlan('option-c', 'Built to scale', 'Broader inspected composition optimized for maintainability, replaceability, governance and long-term operations.', 'Most robust', 'alternative-stack', chooseRepos(repos, requested, 5, 'scale'), requested, idea, signalByName),
  ].filter((plan): plan is CustomerComposition => Boolean(plan))

  const unique: CustomerComposition[] = []
  const signatures = new Set<string>()
  for (const plan of candidates) {
    const signature = repoSignature(plan.repos as RankedRepo[])
    if (!signature || signatures.has(signature)) continue
    signatures.add(signature)
    unique.push(plan)
  }
  return unique
}

function reorderForUser(plans: CustomerComposition[], input: PriorityAwareFactoryManagerInput) {
  if (!plans.length) return plans
  const selectedId = text(input.selectedCompositionId)
  const selected = selectedId ? plans.find((plan) => plan.id === selectedId) : undefined
  const priority = text(input.customerContext?.priority).toLowerCase()
  const wanted = priority === 'speed' ? 'Fastest' : priority === 'scale' ? 'Most robust' : 'Balanced'
  const first = selected || plans.find((plan) => plan.effort === wanted) || plans[0]
  return [first, ...plans.filter((plan) => plan.id !== first.id)].map((plan, index) => ({
    ...plan,
    type: index === 0 ? 'recommended' as const : plan.type === 'recommended' ? 'alternative-stack' as const : plan.type,
  }))
}

function implementationPrompt(idea: string, plan: CustomerComposition | undefined, report: FactoryManagerV12Report) {
  const repos = (plan?.repos || []) as RankedRepo[]
  const proofByRepo = new Map<string, RepoInspectionV12>()
  const liveSignals = ((report as any).__liveSignals || []) as DeepResearchSignalV12[]
  for (const signal of liveSignals) {
    if (signal.kind === 'github-repository' && signal.repository?.fullName && signal.inspection) proofByRepo.set(signal.repository.fullName.toLowerCase(), signal.inspection)
  }
  const sources = repos.length ? repos.map((repo, index) => {
    const proof = proofByRepo.get(repo.fullName.toLowerCase())
    return `${index + 1}. ${repo.fullName} — ${repo.url}\n   Verified role: ${repo.capabilities.join(', ') || 'Inspected component'}\n   Relevance: ${repo.productRelevance}% · Evidence: ${repo.evidenceStrength}% · License: ${repo.license}\n   Proof:\n${(proof?.sourceLinks || []).slice(0, 5).map((link) => `     - ${link.label}: ${link.url}`).join('\n') || '     - Re-open repository and re-inspect before implementation'}`
  }).join('\n') : '- No external repository passed the deep-inspection gate. Keep the build source-free until research improves.'

  return `You are the implementation engineer for AI Product Factory V12. Build only from the exact customer-approved, deeply inspected source set.\n\nPRODUCT OUTCOME\n${idea}\n\nRECOMMENDATION GATE\n- Evidence quality: ${report.recommendationQuality.score}%\n- 90% gate passed: ${report.researchProof.gatePassed ? 'YES' : 'NO'}\n- Specialized capability coverage: ${report.researchProof.capabilityCoverage}%\n- Average repository inspection: ${report.researchProof.averageInspection}%\n- If the 90% gate is NO, do not start source-based implementation; research/refine first.\n\nAPPROVED PLAN\n- ${plan?.customerTitle || 'No build-ready plan'}\n- Fit: ${plan?.estimatedFit ?? 0}%\n- Confidence: ${plan?.confidence ?? 0}%\n- Coverage: ${plan?.capabilityCoverage ?? 0}%\n\nINSPECTED OPEN-SOURCE SOURCES\n${sources}\n\nNON-NEGOTIABLE SOURCE RULES\n- Never substitute a generic repository merely to fill a capability slot.\n- Never qualify a repository from its name, stars or description alone. Re-open README/source proof before integration.\n- Pin exact commits/releases and maintain THIRD_PARTY_NOTICES.md.\n- Keep every third-party dependency behind a typed, replaceable adapter.\n- If executable tests contradict research evidence, reject the source and return to research.\n\nAUTONOMY / SELF-IMPROVEMENT SAFETY\n- Do not implement unrestricted self-modifying production code.\n- Implement versioned skills, memory and policy updates with offline evaluation, approval thresholds, regression tests and rollback.\n- Destructive desktop actions, external communications and credential-sensitive actions require explicit policy and human approval.\n\nIMPLEMENTATION FLOW\n1. Reproduce every source proof and pin source truth.\n2. Write ADRs and typed product-owned capability contracts.\n3. Validate each external component independently.\n4. Build the smallest complete end-to-end user workflow.\n5. Add sandboxing, permissions, approvals, auth, secrets, retries, timeouts, idempotency and rollback.\n6. Add skill-learning evaluation and reversible promotion.\n7. Run unit, contract, integration, E2E, security, performance and production-build gates.\n8. Deliver setup docs, architecture, source manifest, attribution and verification evidence.\n\nDo not call the product verified until all executable gates pass.`
}

export function createFactoryManagerV12Report(input: PriorityAwareFactoryManagerInput): FactoryManagerV12Report {
  const base = createPriorityAwareFactoryManagerV10Report(input)
  const live = (input.liveResearch || null) as ExtendedResearch | null
  const requested = requestedSpecialized(base, live)
  const { repos, signalByName } = strictRepositories(base, live)
  const plans = reorderForUser(buildPlans(repos, requested, text(input.idea) || base.idea, signalByName), input)
  const recommended = plans[0]

  const covered = coveredCapabilities(repos, requested)
  const capabilityCoverage = requested.length ? Math.round(covered.length / requested.length * 100) : 0
  const repoSignals = githubRepoSignals(live).filter((signal) => repos.some((repo) => repo.fullName.toLowerCase() === text(signal.repository?.fullName).toLowerCase()))
  const averageInspection = repoSignals.length
    ? Math.round(repoSignals.reduce((sum, signal) => sum + numberValue(signal.inspection?.inspectionScore), 0) / repoSignals.length)
    : 0
  const averageRepositoryRelevance = repoSignals.length
    ? Math.round(repoSignals.reduce((sum, signal) => sum + numberValue(signal.relevance) * 100, 0) / repoSignals.length)
    : 0
  const researchCompleteness = Math.round(clamp(numberValue(live?.summary?.researchCompleteness)))
  const evidenceBonus = Math.min(5, repos.length * 1.5 + Math.min(2, repoSignals.filter((signal) => (signal.inspection?.sourceFilesSampled || 0) >= 2).length * 0.5))
  const qualityScore = Math.round(clamp(
    researchCompleteness * 0.25 +
    capabilityCoverage * 0.35 +
    averageInspection * 0.25 +
    averageRepositoryRelevance * 0.15 +
    evidenceBonus,
  ))
  const relevantSignals = (Array.isArray(live?.signals) ? live!.signals! : []).filter((signal) => signal.kind !== 'github-source-proof' && numberValue(signal.relevance) >= 0.68)
  const rejectedSignals = Math.round(numberValue(live?.summary?.rejectedSignalCount))
  const gatePassed = qualityScore >= 90 && repos.length >= 2 && capabilityCoverage >= 75 && averageInspection >= 65 && Boolean(recommended)
  const band: FactoryManagerV10Report['recommendationQuality']['band'] = gatePassed
    ? 'High'
    : qualityScore >= 75
      ? 'Medium'
      : 'Needs more evidence'

  const sourceLinks = repoSignals.flatMap((signal) => signal.inspection?.sourceLinks || []).filter((link, index, all) => all.findIndex((item) => item.url === link.url) === index).slice(0, 50)
  const architecturePatterns = Array.isArray(live?.architecturePatterns) ? live!.architecturePatterns!.slice(0, 16) : [...new Set(repoSignals.flatMap((signal) => signal.inspection?.architectureHints || []))].slice(0, 16)

  const result: FactoryManagerV12Report = {
    ...base,
    engineVersion: '12.0',
    repoExplainers: repos,
    compositionSuggestions: plans,
    recommendationQuality: {
      targetRelevance: 90,
      score: qualityScore,
      band,
      relevantSignals: relevantSignals.length,
      rejectedSignals,
      repositoriesConsidered: Math.round(numberValue(live?.summary?.repositoriesDiscovered, base.recommendationQuality.repositoriesConsidered)),
      repositoriesQualified: repos.length,
      explanation: gatePassed
        ? '90% recommendation gate passed: the selected direction is backed by code-aware GitHub inspection, direct specialized-capability coverage and multiple reproducible source links. Executable build/security/outcome checks are still required.'
        : `Recommendation remains locked at ${qualityScore}%. Deep research found ${repos.length} source-qualified repository candidate(s) covering ${capabilityCoverage}% of specialized capabilities. The factory will not pad the plan with unrelated repositories just to show three options.`,
    },
    managerVerdict: {
      ...base.managerVerdict,
      decision: !gatePassed
        ? 'RESEARCH_MORE'
        : recommended && recommended.estimatedFit >= 88 && recommended.confidence >= 85 && recommended.capabilityCoverage >= 85
          ? 'GO'
          : 'GO_WITH_GUARDS',
      estimatedFeasibility: recommended?.estimatedFit || 0,
      confidence: gatePassed ? recommended?.confidence || qualityScore : Math.min(69, recommended?.confidence || qualityScore),
      summary: gatePassed && recommended
        ? `${recommended.customerTitle} passed the 90% research-quality gate with ${recommended.capabilityCoverage}% specialized capability coverage. Every selected repository has direct README/source proof and remains replaceable behind product-owned adapters.`
        : `The factory deliberately rejected weak or unrelated sources. Current research quality is ${qualityScore}%, below the 90% source-lock threshold, so approval/build remains blocked until stronger direct evidence is found.`,
      reasons: recommended?.whyThisCombination || [
        'No build-ready composition is emitted until repositories prove requested specialized capabilities in inspected documentation/source.',
        `Current direct specialized capability coverage is ${capabilityCoverage}%.`,
        `${rejectedSignals} weak or unrelated research candidate(s) were rejected.`,
      ],
      riskFlags: [
        ...base.managerVerdict.riskFlags.filter((item) => !/evidence quality/i.test(item)),
        ...(!gatePassed ? ['The strict 90% research gate has not passed; do not lock or build from the current source set.'] : []),
        ...(requested.some((item) => /self|memory|learning/i.test(item)) ? ['Self-improvement must use versioned skills/memory with evaluation and rollback, not unrestricted self-modifying production code.'] : []),
      ],
      humanChecks: [
        'Confirm the AI-understood outcome and specialized capability list.',
        'Open the source-proof links for the recommended repositories before approval.',
        'Approve only after the 90% research gate passes and the exact source set is acceptable.',
      ],
    },
    sourceIntelligence: {
      ...base.sourceIntelligence,
      signalCount: relevantSignals.length,
      sourcesWithResults: new Set(relevantSignals.map((signal) => signal.source)).size,
      topSignals: (Array.isArray(live?.signals) ? live!.signals! : [])
        .filter((signal) => numberValue(signal.relevance) >= 0.62)
        .sort((a, b) => numberValue(b.relevance) - numberValue(a.relevance))
        .slice(0, 24) as any,
      rejectedSignalCount: rejectedSignals,
      averageRelevance: averageRepositoryRelevance,
      githubCandidates: repoSignals.length,
    },
    researchProof: {
      gateTarget: 90,
      gatePassed,
      researchCompleteness,
      capabilityCoverage,
      averageInspection,
      averageRepositoryRelevance,
      inspectedRepositories: Math.round(numberValue(live?.summary?.repositoriesInspected, repoSignals.length)),
      qualifiedRepositories: repos.length,
      sourceLinks,
      architecturePatterns,
      explanation: gatePassed
        ? 'Direct capability evidence, code-aware inspection and coverage are strong enough to present a source-locked recommendation.'
        : 'More direct source evidence is required. Generic frameworks and repositories that only share keywords with the request are intentionally excluded.',
    },
    idePrompt: base.idePrompt,
  }

  ;(result as any).__liveSignals = live?.signals || []
  result.idePrompt = implementationPrompt(text(input.idea) || result.idea, recommended, result)
  delete (result as any).__liveSignals
  return result
}
