import { clamp } from './nlp-utils'
import { buildProfile } from './profile-builder'
import { githubCandidates } from './github'
import { sourceProofSignals, huggingFace, gitlab, tavily, arxiv, githubReleases } from './github-adapters'
import { dedupeSignals } from './dedup'
import { SOURCE_CATALOG } from './constants'

export async function runDeepResearchV12(idea: string, graph: Record<string, any>, seedRepos: string[]) {
  const profile = buildProfile(idea, graph)
  const started = Date.now()
  const github = await githubCandidates(profile, seedRepos)
  const qualifiedRepos = github.signals
  const proofSignals = qualifiedRepos.flatMap(sourceProofSignals)
  const [gitlabSignals, modelSignals, webSignals, paperSignals, releaseSignals] = await Promise.all([
    gitlab(profile),
    huggingFace(profile),
    tavily(profile),
    arxiv(profile),
    githubReleases(qualifiedRepos),
  ])

  const signals = dedupeSignals([
    ...qualifiedRepos,
    ...proofSignals,
    ...releaseSignals,
    ...webSignals,
    ...modelSignals,
    ...gitlabSignals,
    ...paperSignals,
  ]).filter((signal) => {
    if (signal.kind === 'github-repository') return Number(signal.relevance || 0) >= 0.64 && Boolean(signal.inspection?.specializedCapabilities.length)
    if (signal.kind === 'github-source-proof') return Number(signal.relevance || 0) >= 0.62
    if (signal.source === 'arXiv') return Number(signal.relevance || 0) >= 0.78
    return Number(signal.relevance || 0) >= 0.66
  }).sort((a, b) => {
    const repoBonusA = a.kind === 'github-repository' ? 0.08 : a.kind === 'github-source-proof' ? 0.035 : 0
    const repoBonusB = b.kind === 'github-repository' ? 0.08 : b.kind === 'github-source-proof' ? 0.035 : 0
    return Number(b.relevance || 0) + repoBonusB - (Number(a.relevance || 0) + repoBonusA)
  }).slice(0, 80)

  const counts = signals.reduce<Record<string, number>>((acc, signal) => {
    acc[signal.source] = (acc[signal.source] || 0) + 1
    return acc
  }, {})
  const repoSignals = signals.filter((signal) => signal.kind === 'github-repository')
  const evidenceSignals = signals.filter((signal) => signal.kind !== 'github-source-proof')
  const averageRelevance = evidenceSignals.length
    ? Number((evidenceSignals.reduce((sum, signal) => sum + Number(signal.relevance || 0), 0) / evidenceSignals.length).toFixed(3))
    : 0
  const covered = new Set(repoSignals.flatMap((signal) => signal.inspection?.specializedCapabilities || []))
  const capabilityCoverage = profile.specializedCapabilities.length
    ? Math.round((covered.size / profile.specializedCapabilities.length) * 100)
    : 0
  const averageInspection = repoSignals.length
    ? Math.round(repoSignals.reduce((sum, signal) => sum + Number(signal.inspection?.inspectionScore || 0), 0) / repoSignals.length)
    : 0
  const researchCompleteness = Math.round(clamp(
    Math.min(1, repoSignals.length / 5) * 0.24 +
    (capabilityCoverage / 100) * 0.36 +
    (averageInspection / 100) * 0.24 +
    Math.min(1, Object.keys(counts).length / 4) * 0.08 +
    Math.min(1, averageRelevance / 0.82) * 0.08,
  ) * 100)
  const confidenceBand = researchCompleteness >= 90 && repoSignals.length >= 3 && capabilityCoverage >= 75
    ? 'high'
    : researchCompleteness >= 70 && repoSignals.length >= 2
      ? 'medium'
      : 'low'

  const architecturePatterns = [...new Set(repoSignals.flatMap((signal) => signal.inspection?.architectureHints || []))].slice(0, 12)
  const sourceLinks = repoSignals.flatMap((signal) => signal.inspection?.sourceLinks || []).slice(0, 40)

  return {
    success: true,
    engineVersion: '12.0',
    query: profile.query,
    profile,
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    sourceCatalog: SOURCE_CATALOG,
    signals,
    sourceLinks,
    architecturePatterns,
    summary: {
      signalCount: signals.length,
      relevantSignalCount: evidenceSignals.length,
      rejectedSignalCount: Math.max(0, github.discoveredCount - repoSignals.length) + Math.max(0, gitlabSignals.length + modelSignals.length + webSignals.length + paperSignals.length - evidenceSignals.filter((signal) => signal.kind !== 'github-repository' && signal.kind !== 'release').length),
      sourcesWithResults: Object.keys(counts).length,
      sourceCounts: counts,
      githubCandidates: repoSignals.length,
      repositoriesDiscovered: github.discoveredCount,
      repositoriesInspected: github.inspectedCount,
      repositorySourceLinks: sourceLinks.length,
      averageRelevance,
      averageInspection,
      capabilityCoverage,
      researchCompleteness,
      confidenceBand,
    },
    accuracyPolicy: '90% is a release-quality recommendation target, never a fabricated guarantee. A GitHub repository cannot qualify from name/stars alone: README and representative capability-bearing source must prove direct fit. Generic frameworks and keyword-only matches are rejected; below-threshold research keeps the build gate locked.',
  }
}
