import type { SelectedRepo, NormalizedBrief, ProductSystemOutput } from './types'

export function buildScores(selected: SelectedRepo[], brief: NormalizedBrief): ProductSystemOutput['scores'] {
  const coveredRoles = new Set(selected.map(repo => repo.role))
  const requiredRoles: Array<string> = ['interface', 'agent', 'orchestration', 'workflow', 'execution', 'storage', 'monitoring']
  if (brief.isRegulated) requiredRoles.push('security')

  const coverage = Math.round((requiredRoles.filter(role => coveredRoles.has(role as any)).length / requiredRoles.length) * 100)

  const names = new Set(selected.map(repo => repo.name))
  let coherence = 68
  if (names.has('langchain-ai/langchain') && names.has('langchain-ai/langgraph')) coherence += 10
  if (names.has('langchain-ai/langgraph') && names.has('temporalio/temporal')) coherence += 8
  if (names.has('microsoft/playwright') && (names.has('temporalio/temporal') || names.has('n8n-io/n8n'))) coherence += 8
  if (names.has('grafana/grafana') && names.has('open-telemetry/opentelemetry-collector')) coherence += 4
  if (brief.needsVectorMemory && names.has('qdrant/qdrant')) coherence += 4
  if (brief.isRegulated && names.has('keycloak/keycloak')) coherence += 4
  coherence = Math.max(0, Math.min(100, coherence))

  const baseMaturity = selected.reduce((sum, repo) => sum + repo.maturity, 0) / Math.max(selected.length, 1)
  const liveStarRepos = selected.filter(repo => typeof repo.stars === 'number' && repo.stars !== null)
  const liveStarAverage = liveStarRepos.length > 0
    ? liveStarRepos.reduce((sum, repo) => sum + Number(repo.stars || 0), 0) / liveStarRepos.length
    : 0
  const maturityBoost = liveStarAverage > 0 ? Math.min(8, Math.log10(liveStarAverage + 1) * 2) : 0
  const maturity = Math.round(Math.max(0, Math.min(100, baseMaturity + maturityBoost)))

  const confidenceRaw = (coherence * 0.4 + coverage * 0.3 + maturity * 0.3) / 100
  const confidence = Number(confidenceRaw.toFixed(2))

  return { coherence, coverage, maturity, confidence }
}
