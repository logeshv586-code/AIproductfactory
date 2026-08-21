import { NextRequest, NextResponse } from 'next/server'
import { runDeepResearchV12, type DeepResearchSignalV12 } from '@/lib/factory/deep-research-v12'
import { runTokenlessPublicResearch } from '@/lib/factory/tokenless-public-research'

export const runtime = 'nodejs'
export const maxDuration = 90

function numberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))
}

const EXPERT_SEED_GROUPS: Array<{ pattern: RegExp; capability: string; repos: string[] }> = [
  {
    pattern: /desktop|computer[- ]?use|windows app|screen control|mouse|keyboard|rpa|vision|screenshot|gui/i,
    capability: 'Desktop computer control',
    repos: ['microsoft/UFO', 'bytedance/UI-TARS-desktop', 'OpenAdaptAI/OpenAdapt'],
  },
  {
    pattern: /vision|screen|screenshot|visual|ocr|multimodal/i,
    capability: 'Vision screen understanding',
    repos: ['microsoft/UFO', 'bytedance/UI-TARS-desktop'],
  },
  {
    pattern: /powerpoint|pptx|presentation/i,
    capability: 'PowerPoint automation',
    repos: ['gitbrent/PptxGenJS', 'scanny/python-pptx'],
  },
  {
    pattern: /excel|xlsx|spreadsheet|workbook|worksheet/i,
    capability: 'Excel automation',
    repos: ['xlwings/xlwings', 'exceljs/exceljs', 'jmcnamara/XlsxWriter'],
  },
  {
    pattern: /word document|docx|microsoft word|office document/i,
    capability: 'Word document automation',
    repos: ['python-openxml/python-docx'],
  },
  {
    pattern: /browser|website|web automation|playwright|selenium/i,
    capability: 'Browser automation',
    repos: ['browser-use/browser-use', 'microsoft/playwright'],
  },
  {
    pattern: /autonomous|agentic|self[- ]?evolving|self[- ]?improv|plan task|planner/i,
    capability: 'Autonomous task planning',
    repos: ['langchain-ai/langgraph', 'microsoft/autogen'],
  },
  {
    pattern: /memory|self[- ]?evolving|self[- ]?improv|learn|reflection|experience/i,
    capability: 'Memory and learning loop',
    repos: ['langchain-ai/langgraph', 'microsoft/autogen'],
  },
  {
    pattern: /workflow|automation|orchestration|schedule|trigger/i,
    capability: 'Workflow orchestration',
    repos: ['langchain-ai/langgraph', 'microsoft/autogen'],
  },
  {
    pattern: /any task|tool use|tool-use|skills|plugin|mcp|automation/i,
    capability: 'Tool and skill execution',
    repos: ['langchain-ai/langgraph', 'microsoft/autogen'],
  },
]

function expertSeedsForIdea(idea: string) {
  const ordered = EXPERT_SEED_GROUPS
    .filter((group) => group.pattern.test(idea))
    .flatMap((group) => group.repos)
  return [...new Set(ordered)].slice(0, 10)
}

function expertCapabilitiesForIdea(idea: string) {
  return [...new Set(EXPERT_SEED_GROUPS.filter((group) => group.pattern.test(idea)).map((group) => group.capability))]
}

function repositoryName(signal: DeepResearchSignalV12) {
  return String(signal.repository?.fullName || signal.title || '').trim()
}

function isCodePath(path: string) {
  return /\.(py|ts|tsx|js|jsx|mjs|cjs|go|rs|java|kt|kts|cs|cpp|cc|cxx|c|h|hpp|swift|rb|php|scala|vue|svelte)$/i.test(path)
}

function catalogLike(signal: DeepResearchSignalV12) {
  const value = `${repositoryName(signal)} ${signal.repository?.description || ''} ${signal.summary || ''}`.toLowerCase()
  return /(^|[\s/_-])awesome[\s/_-]|curated\s+(list|collection)|list\s+of\s+(awesome|useful|best|chatgpt|ai)\b|collection\s+of\s+(links|resources|repositories|projects|papers)|resource\s+list|repository\s+list|paper\s+list|cheat\s*sheet|learning\s+resources/.test(value)
}

function dataOnlyLike(signal: DeepResearchSignalV12) {
  const value = `${signal.repository?.description || ''} ${signal.summary || ''}`.toLowerCase()
  const dataPattern = /web\s*scrap|scraper|scraping|dataset|download(ing)?\s+.*(csv|excel|xlsx|data)|publicly available .*data|api access .*data|data ingestion only/
  const actionPattern = /agent|automation|automate|computer[- ]?use|desktop|control|workflow|executor|edit|write|create|generate|format|tool[- ]?use|office|powerpoint|workbook|word document/
  return dataPattern.test(value) && !actionPattern.test(value)
}

function runnableScore(signal: DeepResearchSignalV12) {
  const inspection = signal.inspection
  if (!inspection?.inspected) return 0
  const codeFiles = inspection.keyFiles.filter((file) => isCodePath(file.path)).length
  const codeSignal = Math.min(1, codeFiles / 2)
  const sampledSignal = Math.min(1, inspection.sourceFilesSampled / 3)
  const architectureSignal = Math.min(1, inspection.architectureHints.length / 3)
  const readmeSignal = Math.min(1, inspection.readmeCharacters / 5000)
  const proofSignal = Math.min(1, inspection.sourceLinks.length / 5)
  return clamp(codeSignal * 0.32 + sampledSignal * 0.24 + architectureSignal * 0.18 + readmeSignal * 0.12 + proofSignal * 0.14)
}

function selectRunnableRepositories(signals: DeepResearchSignalV12[], specializedCapabilities: string[]) {
  const qualified = signals
    .filter((signal) => signal.kind === 'github-repository')
    .map((signal) => {
      const runnable = runnableScore(signal)
      const codeFiles = signal.inspection?.keyFiles.filter((file) => isCodePath(file.path)).length || 0
      const adjustedRelevance = clamp(numberValue(signal.relevance) * 0.78 + runnable * 0.22)
      return {
        ...signal,
        relevance: Number(adjustedRelevance.toFixed(3)),
        metrics: {
          ...(signal.metrics || {}),
          runnableScore: Math.round(runnable * 100),
          inspectedCodeFiles: codeFiles,
        },
      } satisfies DeepResearchSignalV12
    })
    .filter((signal) => {
      const inspection = signal.inspection
      if (!inspection?.inspected) return false
      if (catalogLike(signal) || dataOnlyLike(signal)) return false
      if (numberValue(signal.metrics?.runnableScore) < 48) return false
      if (numberValue(signal.metrics?.inspectedCodeFiles) < 1) return false
      if (inspection.sourceFilesSampled < 1) return false
      if (inspection.inspectionScore < 52) return false
      if (numberValue(signal.relevance) < 0.66) return false
      if (specializedCapabilities.length && !inspection.specializedCapabilities.length) return false
      return true
    })

  const selected: DeepResearchSignalV12[] = []
  const remaining = [...qualified]
  const covered = new Set<string>()

  while (remaining.length && selected.length < 8) {
    let bestIndex = 0
    let bestValue = -Infinity
    remaining.forEach((signal, index) => {
      const capabilities = signal.inspection?.specializedCapabilities || []
      const newCapabilities = capabilities.filter((capability) => !covered.has(capability)).length
      const value =
        newCapabilities * 25 +
        numberValue(signal.relevance) * 45 +
        numberValue(signal.inspection?.inspectionScore) * 0.18 +
        numberValue(signal.metrics?.runnableScore) * 0.12
      if (value > bestValue) {
        bestValue = value
        bestIndex = index
      }
    })
    const [winner] = remaining.splice(bestIndex, 1)
    if (!winner) break
    selected.push(winner)
    for (const capability of winner.inspection?.specializedCapabilities || []) covered.add(capability)
    if (specializedCapabilities.length && covered.size >= specializedCapabilities.length && selected.length >= 3) break
  }

  return selected
}

function proofBelongsTo(signal: DeepResearchSignalV12, allowedNames: Set<string>) {
  if (signal.kind === 'github-source-proof' || signal.kind === 'release') {
    return [...allowedNames].some((name) => signal.title.startsWith(`${name} ·`) || signal.title.startsWith(`${name} `))
  }
  return true
}

function applyRunnableGuard(research: any) {
  const specializedCapabilities = Array.isArray(research.profile?.specializedCapabilities)
    ? research.profile.specializedCapabilities.filter((value: unknown): value is string => typeof value === 'string' && Boolean(value.trim()))
    : []
  const researchSignals: DeepResearchSignalV12[] = Array.isArray(research.signals) ? research.signals : []
  const originalRepos = researchSignals.filter((signal) => signal.kind === 'github-repository')
  const selectedRepos = selectRunnableRepositories(researchSignals, specializedCapabilities)
  const allowedNames = new Set(selectedRepos.map(repositoryName).filter(Boolean))
  const selectedByName = new Map(selectedRepos.map((signal) => [repositoryName(signal), signal]))

  const signals = researchSignals
    .filter((signal) => signal.kind !== 'github-repository')
    .filter((signal) => proofBelongsTo(signal, allowedNames))
  signals.push(...selectedRepos)
  signals.sort((a, b) => {
    const repoBonusA = a.kind === 'github-repository' ? 0.08 : a.kind === 'github-source-proof' ? 0.035 : 0
    const repoBonusB = b.kind === 'github-repository' ? 0.08 : b.kind === 'github-source-proof' ? 0.035 : 0
    return numberValue(b.relevance) + repoBonusB - (numberValue(a.relevance) + repoBonusA)
  })

  const sourceCounts = signals.reduce<Record<string, number>>((acc, signal) => {
    acc[signal.source] = (acc[signal.source] || 0) + 1
    return acc
  }, {})
  const evidenceSignals = signals.filter((signal) => signal.kind !== 'github-source-proof')
  const averageRelevance = evidenceSignals.length
    ? Number((evidenceSignals.reduce((sum, signal) => sum + numberValue(signal.relevance), 0) / evidenceSignals.length).toFixed(3))
    : 0
  const averageInspection = selectedRepos.length
    ? Math.round(selectedRepos.reduce((sum, signal) => sum + numberValue(signal.inspection?.inspectionScore), 0) / selectedRepos.length)
    : 0
  const covered = new Set(selectedRepos.flatMap((signal) => signal.inspection?.specializedCapabilities || []))
  const capabilityCoverage = specializedCapabilities.length
    ? Math.round(covered.size / specializedCapabilities.length * 100)
    : 0
  const averageRunnable = selectedRepos.length
    ? Math.round(selectedRepos.reduce((sum, signal) => sum + numberValue(signal.metrics?.runnableScore), 0) / selectedRepos.length)
    : 0
  const researchCompleteness = Math.round(clamp(
    Math.min(1, selectedRepos.length / 5) * 0.20 +
    capabilityCoverage / 100 * 0.34 +
    averageInspection / 100 * 0.20 +
    averageRunnable / 100 * 0.16 +
    Math.min(1, Object.keys(sourceCounts).length / 4) * 0.05 +
    Math.min(1, averageRelevance / 0.82) * 0.05,
  ) * 100)
  const sourceLinks = selectedRepos
    .flatMap((signal) => signal.inspection?.sourceLinks || [])
    .filter((link, index, all) => all.findIndex((item) => item.url === link.url) === index)
    .slice(0, 50)
  const architecturePatterns = Array.from(new Set(selectedRepos.flatMap((signal) => signal.inspection?.architectureHints || []))).slice(0, 16)

  return {
    ...research,
    signals: signals.slice(0, 80),
    sourceLinks,
    architecturePatterns,
    summary: {
      ...(research.summary || {}),
      signalCount: signals.length,
      relevantSignalCount: evidenceSignals.length,
      rejectedSignalCount: numberValue(research.summary?.rejectedSignalCount) + Math.max(0, originalRepos.length - selectedRepos.length),
      sourcesWithResults: Object.keys(sourceCounts).length,
      sourceCounts,
      githubCandidates: selectedRepos.length,
      averageRelevance,
      averageInspection,
      averageRunnable,
      capabilityCoverage,
      researchCompleteness,
      confidenceBand: researchCompleteness >= 90 && selectedRepos.length >= 3 && capabilityCoverage >= 75
        ? 'high'
        : researchCompleteness >= 70 && selectedRepos.length >= 2
          ? 'medium'
          : 'low',
    },
    accuracyPolicy: 'A GitHub source must pass direct specialized-capability proof, README/source inspection and runnable-code evidence. In tokenless mode, deep file verification comes from a shallow public clone pinned to an observed commit; repository code is never executed during research. The 90% gate remains an evidence-quality target, not a universal correctness guarantee.',
    repositoryGuard: {
      originalDeepCandidates: originalRepos.length,
      runnableQualified: selectedRepos.length,
      rejectedAfterInspection: Math.max(0, originalRepos.length - selectedRepos.length),
      qualifiedRepositories: [...selectedByName.keys()],
    },
  }
}

function tokenlessResearchShape(idea: string, local: Awaited<ReturnType<typeof runTokenlessPublicResearch>>) {
  const specializedCapabilities = expertCapabilitiesForIdea(idea)
  const sourceLinks = local.signals.flatMap((signal) => signal.inspection?.sourceLinks || [])
  const architecturePatterns = [...new Set(local.signals.flatMap((signal) => signal.inspection?.architectureHints || []))]
  const averageRelevance = local.signals.length
    ? local.signals.reduce((sum, signal) => sum + numberValue(signal.relevance), 0) / local.signals.length
    : 0
  const averageInspection = local.signals.length
    ? Math.round(local.signals.reduce((sum, signal) => sum + numberValue(signal.inspection?.inspectionScore), 0) / local.signals.length)
    : 0
  const covered = new Set(local.signals.flatMap((signal) => signal.inspection?.specializedCapabilities || []))
  const capabilityCoverage = specializedCapabilities.length ? Math.round(covered.size / specializedCapabilities.length * 100) : 0

  return {
    success: true,
    engineVersion: '12.0',
    query: idea,
    profile: {
      query: idea,
      queries: [],
      intentTerms: idea.toLowerCase().match(/[a-z0-9+#.-]{3,}/g) || [],
      domainTerms: specializedCapabilities.flatMap((capability) => capability.toLowerCase().split(/\s+/)).filter(Boolean),
      capabilities: specializedCapabilities,
      specializedCapabilities,
      genericCapabilities: [],
      domain: 'Tokenless public GitHub product research',
      productArchetype: specializedCapabilities.join(' + ') || 'public GitHub software product',
    },
    generatedAt: new Date().toISOString(),
    elapsedMs: 0,
    sourceCatalog: [
      { id: 'github-public-discovery', name: 'GitHub public discovery', mode: 'tokenless', purpose: 'Find public repositories without requiring a personal GitHub token.' },
      { id: 'github-local-clone', name: 'Local shallow clone inspection', mode: 'core', purpose: 'Map repository tree and inspect README/source files locally at a pinned commit without executing repository code.' },
    ],
    signals: local.signals,
    sourceLinks,
    architecturePatterns,
    summary: {
      signalCount: local.signals.length,
      relevantSignalCount: local.signals.length,
      rejectedSignalCount: Math.max(0, local.telemetry.repositoriesDiscovered - local.signals.length),
      sourcesWithResults: local.signals.length ? 1 : 0,
      sourceCounts: local.signals.length ? { 'GitHub local clone': local.signals.length } : {},
      githubCandidates: local.signals.length,
      repositoriesDiscovered: local.telemetry.repositoriesDiscovered,
      repositoriesInspected: local.telemetry.repositoriesLocallyInspected,
      repositorySourceLinks: sourceLinks.length,
      averageRelevance: Number(averageRelevance.toFixed(3)),
      averageInspection,
      capabilityCoverage,
      researchCompleteness: Math.round(clamp(
        Math.min(1, local.signals.length / 5) * 0.24 +
        capabilityCoverage / 100 * 0.40 +
        averageInspection / 100 * 0.26 +
        Math.min(1, averageRelevance / 0.82) * 0.10,
      ) * 100),
      confidenceBand: 'low',
    },
    accuracyPolicy: 'Public repositories are discovered without a personal token and source-verified from shallow local clones. No cloned code is executed during research. Source lock still requires license/build/security/outcome verification.',
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const idea = typeof body.idea === 'string' ? body.idea.trim() : ''
    if (!idea) {
      return NextResponse.json({ success: false, error: 'A product idea is required' }, { status: 400 })
    }

    const graph = body?.graph && typeof body.graph === 'object' && !Array.isArray(body.graph)
      ? body.graph
      : {}
    const repos = Array.isArray(body?.repos)
      ? body.repos
        .filter((value: unknown): value is string => typeof value === 'string' && Boolean(value.trim()))
        .map((value: string) => value.trim())
        .slice(0, 8)
      : []

    const expertSeeds = expertSeedsForIdea(idea)
    const seedRepos = [...new Set([...expertSeeds, ...repos])].slice(0, 10)
    const githubAuthenticated = Boolean(process.env.GITHUB_TOKEN)
    const forcePublicLocal = body?.researchMode === 'public-local'
    const usePublicLocal = !githubAuthenticated || forcePublicLocal

    let localTelemetry: Awaited<ReturnType<typeof runTokenlessPublicResearch>>['telemetry'] | null = null
    let research: any

    if (usePublicLocal) {
      const local = await runTokenlessPublicResearch(idea, seedRepos)
      localTelemetry = local.telemetry
      research = tokenlessResearchShape(idea, local)
    } else {
      research = await runDeepResearchV12(idea, graph, seedRepos)
    }

    const guarded = applyRunnableGuard(research)

    return NextResponse.json({
      ...guarded,
      researchRuntime: {
        mode: usePublicLocal ? 'public-local-clone' : 'authenticated-api-plus-source-proof',
        githubAuthenticated: githubAuthenticated && !forcePublicLocal,
        suppliedSeedRepositories: repos.length,
        expertSeedRepositories: expertSeeds,
        effectiveSeedRepositories: seedRepos,
        githubRequestBudget: usePublicLocal ? 'public-discovery-only' : 'authenticated',
        localCloneInspection: usePublicLocal,
        localCloneRepositoriesInspected: localTelemetry?.repositoriesLocallyInspected || 0,
        localCloneCacheHits: localTelemetry?.cacheHits || 0,
        publicDiscoveryRateLimited: localTelemetry?.rateLimited || false,
        tokenOptional: true,
        guidance: guarded.summary.githubCandidates > 0
          ? usePublicLocal
            ? 'Public repositories were discovered without a personal GitHub token and deeply verified from shallow local clones pinned to observed commits. A token is optional acceleration, not a requirement.'
            : 'Repository evidence passed authenticated deep source and runnable-code qualification.'
          : usePublicLocal
            ? localTelemetry?.rateLimited
              ? 'Public discovery hit a GitHub rate limit. Cached/seed repositories were still inspected locally. Retry later or optionally add GITHUB_TOKEN to widen discovery; the token is not required for local source verification.'
              : 'No public repository passed the strict local source-proof gates. The result reflects inspected code evidence, not model confidence. Refine capabilities or add a known public repository seed and re-run.'
            : 'No repository passed the strict evidence gates. Expand the brief or inspect the rejected capability gaps.',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Deep product research failed' },
      { status: 500 },
    )
  }
}
