import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { PipelineMode } from '@/lib/factory/pipeline-run'
import type { FactoryBuildRequest, FactoryErrorResponse, TimelineEntry } from './schemas'
import { FactoryBaseResponseSchema } from './schemas'

export const STEP_PROGRESS: Record<string, number> = {
  request_accepted: 2,
  queued: 5,
  repo_discovery: 15,
  health_check: 25,
  pipeline_dispatch: 40,
  response_validation: 80,
  finalizing: 95,
  completed: 100,
  failed: 100,
}

export function makeBuildId(prefix: 'build' | 'fast' = 'build') {
  return `${prefix}_${Date.now().toString(36)}`
}

export function addTimelineEntry(timeline: TimelineEntry[], step: string, detail: string) {
  timeline.push({ step, ts: Date.now(), detail })
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown error'
}

export function currentProgress(step: string) {
  return STEP_PROGRESS[step] ?? 0
}

export function resolveBuildIndustry(body: FactoryBuildRequest) {
  return body.industry?.trim() || 'General Business'
}

export function resolveBuildIdea(body: FactoryBuildRequest) {
  const idea = body.idea?.trim()
  if (idea) return idea

  const industry = body.industry?.trim() || 'General Business'
  const fields = body.fields.filter(Boolean)
  return fields.length > 0
    ? `${industry} workflow platform with ${fields.join(', ')}`
    : `${industry} workflow orchestration platform`
}

export function failureResponse(input: {
  requestId: string
  runId: string | null
  mode: PipelineMode
  source: string
  buildId: string
  currentStep: string
  progress: number
  timeline: TimelineEntry[]
  statusCode: number
  error: string
}) {
  const body: FactoryErrorResponse = {
    success: false,
    requestId: input.requestId,
    runId: input.runId,
    mode: input.mode,
    buildId: input.buildId,
    status: 'failed',
    source: input.source,
    currentStep: input.currentStep,
    progress: input.progress,
    graphData: { nodes: [], edges: [] },
    graphStats: { total_nodes: 0, total_edges: 0, node_types: {}, edge_types: {} },
    composedProducts: [],
    capabilities: [],
    repoProfiles: [],
    architecture: null,
    integrationPlan: null,
    generatedComponents: [],
    probScore: null,
    expandedIdea: null,
    intent: null,
    timeline: input.timeline,
    errors: [input.error],
    error: input.error,
    combinedIntelligenceReport: null,
    capabilityGraphEngine: null,
    researchReport: null,
    feasibilityReport: null,
    executionPlan: null,
  }

  return NextResponse.json(body, {
    status: input.statusCode,
    headers: { 'x-request-id': input.requestId },
  })
}

export function normalizeProductScore(rawScore: unknown): number | null {
  if (typeof rawScore !== 'number' || Number.isNaN(rawScore)) return null
  if (rawScore > 1) return rawScore / 10
  if (rawScore < 0) return 0
  return rawScore
}

export function normalizePipelineScores(scores: any) {
  const finalScore = typeof scores?.final_score === 'number' ? scores.final_score : 0
  const feasibility = typeof scores?.feasibility === 'number' ? scores.feasibility : finalScore
  const competition = typeof scores?.competition === 'number' ? scores.competition : 0.6
  const successProbability = typeof scores?.success_probability === 'number'
    ? scores.success_probability
    : Math.min(0.98, Math.max(0.05, finalScore * 0.55 + feasibility * 0.30 + competition * 0.15))
  const successPercentage = typeof scores?.success_percentage === 'number'
    ? scores.success_percentage
    : Math.round(successProbability * 100)

  return {
    ...scores,
    success_probability: Number(successProbability.toFixed(3)),
    success_percentage: Number(successPercentage.toFixed(1)),
  }
}

const MIN_ACCEPTABLE_PRODUCT_SCORE = Number(process.env.MIN_ACCEPTABLE_PRODUCT_SCORE || 0.4)

export function validateQualityGate(responseBody: z.infer<typeof FactoryBaseResponseSchema>) {
  if (responseBody.mode !== 'full' || !responseBody.success) return

  if (responseBody.composedProducts.length === 0) {
    throw new Error('Full Mode returned no composed products')
  }

  if (responseBody.graphData.nodes.length === 0) {
    throw new Error('Full Mode returned an empty graph')
  }

  const topProduct = responseBody.composedProducts[0] as any
  const normalizedScore = normalizeProductScore(topProduct?.scores?.final_score)

  if (normalizedScore !== null && normalizedScore < MIN_ACCEPTABLE_PRODUCT_SCORE) {
    throw new Error(`Top product score ${normalizedScore.toFixed(2)} below minimum quality threshold ${MIN_ACCEPTABLE_PRODUCT_SCORE.toFixed(2)}`)
  }
}

export function deriveReposForProduct(
  product: any,
  selectedRepos: Array<{
    fullName: string
    summary: string
    language: string
    reason: string
    role: string
    stars: number
  }>
) {
  const reposUsed = Array.isArray(product?.repos_used) ? product.repos_used : []
  const matched = selectedRepos.filter(repo =>
    reposUsed.some((used: string) =>
      repo.fullName === used ||
      repo.fullName.endsWith(`/${used}`) ||
      repo.fullName.includes(used)
    )
  )

  return matched.length > 0 ? matched : selectedRepos.slice(0, 6)
}

export function normalizeArchitecture(architecture: any) {
  if (!architecture) return null
  return {
    components: architecture.components || [],
    dataFlows: architecture.dataFlows || architecture.data_flows || [],
    techStack: architecture.techStack || architecture.tech_stack || [],
    deployment: architecture.deployment || '',
    diagramDescription: architecture.diagramDescription || architecture.diagram_description || '',
  }
}

export function validateFactoryResponse(responseBody: unknown) {
  const parsed = FactoryBaseResponseSchema.safeParse(responseBody)
  if (!parsed.success) {
    throw new Error(`Factory response schema validation failed: ${parsed.error.issues[0]?.message || 'invalid response'}`)
  }
  validateQualityGate(parsed.data)
  return parsed.data
}
