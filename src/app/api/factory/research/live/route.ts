import { NextRequest, NextResponse } from 'next/server'
import { runDeepResearchV12, type DeepResearchSignalV12 } from '@/lib/factory/deep-research-v12'

export const runtime = 'nodejs'
export const maxDuration = 90

function numberValue(value: unknown, fallback = 0) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))
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

function applyRunnableGuard(research: Awaited<ReturnType<typeof runDeepResearchV12>>) {
  const specializedCapabilities = Array.isArray(research.profile?.specializedCapabilities)
    ? research.profile.specializedCapabilities.filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
    : []
  const originalRepos = research.signals.filter((signal) => signal.kind === 'github-repository')
  const selectedRepos = selectRunnableRepositories(research.signals, specializedCapabilities)
  const allowedNames = new Set(selectedRepos.map(repositoryName).filter(Boolean))
  const selectedByName = new Map(selectedRepos.map((signal) => [repositoryName(signal), signal]))

  const signals = research.signals
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
      ...research.summary,
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
    accuracyPolicy: 'A GitHub source must now pass three independent filters before recommendation: direct specialized-capability proof, deep README/source inspection, and runnable-code evidence. Curated lists, generic frameworks, data-only scrapers and keyword-only matches are rejected. The 90% gate is an evidence-quality target, not a universal correctness guarantee.',
    repositoryGuard: {
      originalDeepCandidates: originalRepos.length,
      runnableQualified: selectedRepos.length,
      rejectedAfterInspection: Math.max(0, originalRepos.length - selectedRepos.length),
      qualifiedRepositories: [...selectedByName.keys()],
    },
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

    const research = await runDeepResearchV12(idea, graph, repos)
    return NextResponse.json(applyRunnableGuard(research))
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Deep product research failed' },
      { status: 500 },
    )
  }
}
