import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPythonBackendUrl, getPythonHealth } from '@/lib/factory/python-health'
import { createPipelineRun, type PipelineMode, type PipelineRunStatus, updatePipelineRun } from '@/lib/factory/pipeline-run'
import { buildProductCompositionPlan } from '@/lib/agents/composition-plan'
import { createLogger } from '@/lib/structured-logging'

export const maxDuration = 180

const PYTHON_BACKEND = getPythonBackendUrl()
const MIN_ACCEPTABLE_PRODUCT_SCORE = Number(process.env.MIN_ACCEPTABLE_PRODUCT_SCORE || 0.4)

const BuildRequestSchema = z.object({
  idea: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  fields: z.array(z.string().trim().min(1)).default([]),
  maxRepos: z.number().int().min(1).max(10).default(3),
  mode: z.enum(['full', 'fast']).default('full'),
  outputFormat: z.enum(['pipeline', 'strict-json']).default('pipeline'),
}).superRefine((value, ctx) => {
  if (!value.idea?.trim() && !value.industry?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either an idea or an industry',
      path: ['idea'],
    })
  }
})

const RepoProfileSchema = z.object({
  fullName: z.string(),
  stars: z.number(),
  language: z.string(),
  summary: z.string(),
  relevanceScore: z.number(),
  reason: z.string(),
})

const TimelineEntrySchema = z.object({
  step: z.string(),
  ts: z.number(),
  detail: z.string(),
})

const FactoryBaseResponseSchema = z.object({
  success: z.boolean(),
  requestId: z.string(),
  runId: z.string().nullable(),
  mode: z.enum(['full', 'fast']),
  buildId: z.string(),
  status: z.string(),
  source: z.string(),
  currentStep: z.string(),
  progress: z.number().int().min(0).max(100),
  repoProfiles: z.array(RepoProfileSchema),
  graphData: z.object({
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
  }),
  graphStats: z.object({
    total_nodes: z.number(),
    total_edges: z.number(),
    node_types: z.record(z.string(), z.number()),
    edge_types: z.record(z.string(), z.number()),
  }),
  composedProducts: z.array(z.unknown()),
  capabilities: z.array(z.unknown()),
  generatedComponents: z.array(z.unknown()),
  architecture: z.unknown().nullable(),
  integrationPlan: z.unknown().nullable(),
  probScore: z.unknown().nullable(),
  expandedIdea: z.unknown().nullable(),
  intent: z.unknown().nullable(),
  timeline: z.array(TimelineEntrySchema),
  errors: z.array(z.string()),
})

type FactoryBuildRequest = z.infer<typeof BuildRequestSchema>
type TimelineEntry = z.infer<typeof TimelineEntrySchema>

interface FactoryErrorResponse {
  success: false
  requestId: string
  runId: string | null
  mode: PipelineMode
  buildId: string
  status: 'failed'
  source: string
  currentStep: string
  progress: number
  graphData: { nodes: []; edges: [] }
  graphStats: { total_nodes: number; total_edges: number; node_types: Record<string, number>; edge_types: Record<string, number> }
  composedProducts: []
  capabilities: []
  repoProfiles: []
  architecture: null
  integrationPlan: null
  generatedComponents: []
  probScore: null
  expandedIdea: null
  intent: null
  timeline: TimelineEntry[]
  errors: string[]
  error: string
}

const STEP_PROGRESS: Record<string, number> = {
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

function makeBuildId(prefix: 'build' | 'fast' = 'build') {
  return `${prefix}_${Date.now().toString(36)}`
}

function addTimelineEntry(timeline: TimelineEntry[], step: string, detail: string) {
  timeline.push({ step, ts: Date.now(), detail })
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown error'
}

function currentProgress(step: string) {
  return STEP_PROGRESS[step] ?? 0
}

function resolveBuildIndustry(body: FactoryBuildRequest) {
  return body.industry?.trim() || 'General Business'
}

function resolveBuildIdea(body: FactoryBuildRequest) {
  const idea = body.idea?.trim()
  if (idea) return idea

  const industry = body.industry?.trim() || 'General Business'
  const fields = body.fields.filter(Boolean)
  return fields.length > 0
    ? `${industry} workflow platform with ${fields.join(', ')}`
    : `${industry} workflow orchestration platform`
}

function failureResponse(input: {
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
  }

  return NextResponse.json(body, {
    status: input.statusCode,
    headers: { 'x-request-id': input.requestId },
  })
}

async function safelyUpdateRun(
  runId: string | null,
  logger: ReturnType<typeof createLogger>,
  input: {
    status?: PipelineRunStatus
    currentStep?: string | null
    progress?: number
    buildId?: string | null
    source?: string | null
    steps?: TimelineEntry[]
    output?: unknown
    errors?: string[]
    completedAt?: Date | null
  }
) {
  if (!runId) return
  try {
    await updatePipelineRun(runId, input)
  } catch (error) {
    logger.warn('factory.run_tracking_update_failed', { error: errorMessage(error) })
  }
}

async function advanceRunStep(
  runId: string | null,
  logger: ReturnType<typeof createLogger>,
  timeline: TimelineEntry[],
  currentStep: string,
  detail: string,
  status: PipelineRunStatus = 'running',
  extra?: { buildId?: string; source?: string }
) {
  addTimelineEntry(timeline, currentStep, detail)
  await safelyUpdateRun(runId, logger, {
    status,
    currentStep,
    progress: currentProgress(currentStep),
    steps: timeline,
    buildId: extra?.buildId,
    source: extra?.source,
  })
}

async function fetchRepoCandidates(idea: string, logger: ReturnType<typeof createLogger>) {
  const githubToken = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'AI-Product-Factory/1.0',
  }
  if (githubToken) headers.Authorization = `Bearer ${githubToken}`

  const searchQuery = encodeURIComponent(`${idea.split(' ').slice(0, 3).join(' ')} stars:>100`)
  const githubRes = await fetch(
    `https://api.github.com/search/repositories?q=${searchQuery}&sort=stars&order=desc&per_page=10`,
    { headers, next: { revalidate: 300 } }
  )
  const githubData = await githubRes.json()
  const repos = (githubData.items || []).map((item: any) => ({
    name: item.name,
    full_name: item.full_name,
    description: item.description || '',
    stars: item.stargazers_count,
    language: item.language || '',
    topics: item.topics || [],
    url: item.html_url,
    cloneUrl: item.clone_url,
  }))
  logger.info('factory.repos_loaded', { count: repos.length })
  return repos
}

function normalizeProductScore(rawScore: unknown): number | null {
  if (typeof rawScore !== 'number' || Number.isNaN(rawScore)) return null
  if (rawScore > 1) return rawScore / 10
  if (rawScore < 0) return 0
  return rawScore
}

function normalizePipelineScores(scores: any) {
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

function validateQualityGate(responseBody: z.infer<typeof FactoryBaseResponseSchema>) {
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

function deriveReposForProduct(
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

function normalizeArchitecture(architecture: any) {
  if (!architecture) return null
  return {
    components: architecture.components || [],
    dataFlows: architecture.dataFlows || architecture.data_flows || [],
    techStack: architecture.techStack || architecture.tech_stack || [],
    deployment: architecture.deployment || '',
    diagramDescription: architecture.diagramDescription || architecture.diagram_description || '',
  }
}

function normalizePythonResult(result: any, requestId: string, runId: string | null, mode: PipelineMode, buildId: string) {
  const normalizedRepoProfiles = (result.selected_repos || []).map((r: any) => ({
    fullName: r.name,
    stars: r.stars || 0,
    language: r.language || '',
    summary: r.description || '',
    relevanceScore: r.relevance_score || 0,
    reason: r.selection_reasoning || '',
    role: r.suggested_role || r.capability || '',
  }))

  return {
    success: true,
    requestId,
    runId,
    mode,
    buildId,
    status: 'completed',
    source: 'python-core',
    currentStep: 'completed',
    progress: 100,
    intent: result.intent,
    probScore: {
      feasibility: 0.72,
      novelty: 0.65,
      demand: 0.78,
      composite: 0.72,
      directives: result.intent?.required_capabilities || [],
      rationale: result.intent?.description || '',
    },
    expandedIdea: {
      market: result.intent?.domain || '',
      targetUsers: ['Developers', 'Tech startups'],
      features: result.composed_products?.[0]?.key_features || [],
      usp: result.composed_products?.[0]?.description || '',
      risks: ['Market competition', 'Technical complexity'],
      suggestedStack: result.composed_products?.[0]?.architecture?.tech_stack || result.composed_products?.[0]?.architecture?.techStack || [],
    },
    repoProfiles: normalizedRepoProfiles.map((r: any) => ({
      fullName: r.fullName,
      stars: r.stars,
      language: r.language,
      summary: r.summary,
      relevanceScore: r.relevanceScore,
      reason: r.reason,
    })),
    architecture: normalizeArchitecture(result.composed_products?.[0]?.architecture),
    integrationPlan: null,
    generatedComponents: [],
    graphData: result.graphify_nodes_and_edges || { nodes: [], edges: [] },
    graphStats: result.graph_stats || { total_nodes: 0, total_edges: 0, node_types: {}, edge_types: {} },
    composedProducts: (result.composed_products || []).map((p: any) => {
      const productRepos = deriveReposForProduct(p, normalizedRepoProfiles)
      const compositionPlan = buildProductCompositionPlan({
        productTitle: p.name,
        capabilities: Array.isArray(p.capabilities) ? p.capabilities : [],
        repos: productRepos.map((repo: any) => ({
          name: repo.fullName.split('/').pop() || repo.fullName,
          fullName: repo.fullName,
          summary: repo.summary,
          language: repo.language,
          why: repo.reason,
          role: repo.role,
          stars: repo.stars,
        })),
        techStack: p.architecture?.tech_stack || [],
        architecture: p.architecture ? {
          components: p.architecture.components,
          dataFlows: p.architecture.data_flows,
        } : null,
      })

      return {
        name: p.name,
        description: p.description,
        systemFlow: p.system_flow,
        capabilities: p.capabilities,
        targetUsers: p.target_users,
        keyFeatures: p.key_features,
        reposUsed: p.repos_used,
        scores: normalizePipelineScores(p.scores),
        architecture: normalizeArchitecture(p.architecture),
        starterBlueprint: p.starter_blueprint,
        strategy: p.strategy,
        compositionPlan,
      }
    }),
    capabilities: result.capabilities || [],
    timeline: result.timeline || [],
    errors: [],
  }
}

function normalizeTypeScriptResult(state: any, requestId: string, runId: string | null, mode: PipelineMode) {
  return {
    success: state.status === 'complete',
    requestId,
    runId,
    mode,
    buildId: state.buildId,
    status: state.status === 'complete' ? 'completed' : 'failed',
    source: 'typescript-fast-mode',
    currentStep: state.status === 'complete' ? 'completed' : 'failed',
    progress: 100,
    probScore: state.probScore ? {
      feasibility: state.probScore.feasibility,
      novelty: state.probScore.novelty,
      demand: state.probScore.demand,
      composite: state.probScore.composite,
      directives: state.probScore.directives,
      rationale: state.probScore.rationale,
    } : null,
    expandedIdea: state.expandedIdea ? {
      market: state.expandedIdea.market,
      targetUsers: state.expandedIdea.targetUsers,
      features: state.expandedIdea.features,
      usp: state.expandedIdea.usp,
      risks: state.expandedIdea.risks,
      suggestedStack: state.expandedIdea.suggestedStack,
    } : null,
    repoProfiles: state.repoProfiles.map((r: any) => ({
      fullName: r.fullName,
      stars: r.stars,
      language: r.language,
      summary: r.summary,
      relevanceScore: r.relevanceScore,
      reason: r.reason,
    })),
    architecture: state.architecture ? {
      components: state.architecture.components,
      dataFlows: state.architecture.dataFlows,
      techStack: state.architecture.techStack,
      deployment: state.architecture.deployment,
      diagramDescription: state.architecture.diagramDescription,
    } : null,
    integrationPlan: state.integrationPlan ? {
      steps: state.integrationPlan.steps,
      repoRoles: state.integrationPlan.repoRoles,
      glueCodeNeeded: state.integrationPlan.glueCodeNeeded,
      configFiles: state.integrationPlan.configFiles,
    } : null,
    generatedComponents: state.generatedComponents.map((c: any) => ({
      name: c.name,
      filename: c.filename,
      language: c.language,
      description: c.description,
      codeLength: c.code.length,
    })),
    composedProducts: [],
    graphData: { nodes: [], edges: [] },
    graphStats: { total_nodes: 0, total_edges: 0, node_types: {}, edge_types: {} },
    capabilities: [],
    intent: null,
    timeline: state.timeline,
    errors: state.errors,
    outputPath: state.outputPath,
  }
}

function validateFactoryResponse(responseBody: unknown) {
  const parsed = FactoryBaseResponseSchema.safeParse(responseBody)
  if (!parsed.success) {
    throw new Error(`Factory response schema validation failed: ${parsed.error.issues[0]?.message || 'invalid response'}`)
  }
  validateQualityGate(parsed.data)
  return parsed.data
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || randomUUID()
  let runId: string | null = null
  let mode: PipelineMode = 'full'
  let currentStep = 'request_accepted'
  const timeline: TimelineEntry[] = []
  const buildId = makeBuildId()
  const logger = createLogger({ requestId, route: '/api/factory/build' })

  addTimelineEntry(timeline, 'request_accepted', 'Factory build request accepted')

  try {
    const parsed = BuildRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || 'Invalid build request'
      logger.warn('factory.request_invalid', { error: message })
      return failureResponse({
        requestId,
        runId,
        mode,
        source: 'api-gateway',
        buildId,
        currentStep,
        progress: currentProgress(currentStep),
        timeline,
        statusCode: 400,
        error: message,
      })
    }

    const body: FactoryBuildRequest = parsed.data
    mode = body.mode
    const resolvedIndustry = resolveBuildIndustry(body)
    const resolvedIdea = resolveBuildIdea(body)

    if (body.outputFormat === 'strict-json') {
      const { composeProductSystem } = await import('@/lib/factory/core/product-system-composer')
      const system = await composeProductSystem({
        industry: resolvedIndustry,
        idea: body.idea?.trim() || undefined,
        fields: body.fields,
        maxRepos: body.maxRepos,
      })

      return NextResponse.json(system, {
        headers: { 'x-request-id': requestId },
      })
    }

    try {
      const run = await createPipelineRun({
        requestId,
        idea: resolvedIdea,
        mode: body.mode,
      })
      runId = run.id
      currentStep = 'queued'
      await safelyUpdateRun(runId, logger, {
        status: 'queued',
        currentStep,
        progress: currentProgress(currentStep),
        steps: timeline,
      })
    } catch (error) {
      logger.warn('factory.run_tracking_create_failed', { error: errorMessage(error) })
    }

    logger.info('factory.build_started', { mode: body.mode, maxRepos: body.maxRepos })

    currentStep = 'repo_discovery'
    await advanceRunStep(runId, logger, timeline, currentStep, 'Searching GitHub candidate repos')
    let repos: any[] = []
    try {
      repos = await fetchRepoCandidates(resolvedIdea, logger)
      addTimelineEntry(timeline, currentStep, `Loaded ${repos.length} GitHub candidates`)
      await safelyUpdateRun(runId, logger, {
        status: 'running',
        currentStep,
        progress: currentProgress(currentStep),
        steps: timeline,
      })
    } catch (error) {
      const message = `GitHub candidate fetch failed: ${errorMessage(error)}`
      logger.warn('factory.repo_discovery_failed', { error: message })
      addTimelineEntry(timeline, currentStep, message)
      await safelyUpdateRun(runId, logger, {
        status: 'running',
        currentStep,
        progress: currentProgress(currentStep),
        steps: timeline,
        errors: [message],
      })
    }

    if (body.mode === 'full') {
      currentStep = 'health_check'
      await advanceRunStep(runId, logger, timeline, currentStep, `Checking canonical Python pipeline health at ${PYTHON_BACKEND}`)
      const pythonHealth = await getPythonHealth(PYTHON_BACKEND)
      if (!pythonHealth.available) {
        const message = `Canonical Python pipeline unavailable: ${pythonHealth.error || pythonHealth.status}`
        logger.error('factory.python_unavailable_preflight', { error: message, pythonStatus: pythonHealth.status })
        addTimelineEntry(timeline, currentStep, message)
        await safelyUpdateRun(runId, logger, {
          status: 'failed',
          currentStep: 'failed',
          progress: currentProgress('failed'),
          buildId,
          source: 'python-core',
          steps: timeline,
          errors: [message],
          completedAt: new Date(),
        })

        return failureResponse({
          requestId,
          runId,
          mode: body.mode,
          source: 'python-core',
          buildId,
          currentStep: 'failed',
          progress: currentProgress('failed'),
          timeline,
          statusCode: 503,
          error: message,
        })
      }

      const pythonPipelineBaseUrl = pythonHealth.url
      currentStep = 'pipeline_dispatch'
      await advanceRunStep(runId, logger, timeline, currentStep, `Dispatching canonical Python pipeline at ${pythonPipelineBaseUrl}`, 'running', { source: 'python-core', buildId })
      try {
        const pythonRes = await fetch(`${pythonPipelineBaseUrl}/pipeline/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Id': requestId,
          },
          body: JSON.stringify({
            idea: resolvedIdea,
            repos,
            strategy: 'all',
            use_embeddings: true,
            max_repos: body.maxRepos,
            request_id: requestId,
          }),
          signal: AbortSignal.timeout(170000),
        })

        if (!pythonRes.ok) {
          const pythonError = await pythonRes.text()
          const message = `Canonical Python pipeline failed (${pythonRes.status}): ${pythonError || 'no response body'}`
          logger.error('factory.python_failed', { status: pythonRes.status, error: pythonError })
          addTimelineEntry(timeline, currentStep, message)
          await safelyUpdateRun(runId, logger, {
            status: 'failed',
            currentStep: 'failed',
            progress: currentProgress('failed'),
            buildId,
            source: 'python-core',
            steps: timeline,
            errors: [message],
            completedAt: new Date(),
          })

          return failureResponse({
            requestId,
            runId,
            mode: body.mode,
            source: 'python-core',
            buildId,
            currentStep: 'failed',
            progress: currentProgress('failed'),
            timeline,
            statusCode: pythonRes.status >= 500 ? 503 : pythonRes.status,
            error: message,
          })
        }

        const pythonData = await pythonRes.json()
        if (!pythonData.success) {
          const message = pythonData.detail || pythonData.error || 'Canonical Python pipeline returned an unsuccessful response'
          logger.error('factory.python_unsuccessful', { error: message })
          addTimelineEntry(timeline, currentStep, message)
          await safelyUpdateRun(runId, logger, {
            status: 'failed',
            currentStep: 'failed',
            progress: currentProgress('failed'),
            buildId,
            source: 'python-core',
            steps: timeline,
            errors: [message],
            completedAt: new Date(),
          })

          return failureResponse({
            requestId,
            runId,
            mode: body.mode,
            source: 'python-core',
            buildId,
            currentStep: 'failed',
            progress: currentProgress('failed'),
            timeline,
            statusCode: 503,
            error: message,
          })
        }

        currentStep = 'response_validation'
        await advanceRunStep(runId, logger, timeline, currentStep, 'Validating canonical pipeline output', 'running', { source: 'python-core', buildId })
        const responseBody = validateFactoryResponse(
          normalizePythonResult(pythonData.data, requestId, runId, body.mode, buildId)
        )

        currentStep = 'completed'
        addTimelineEntry(timeline, currentStep, `Validated ${responseBody.composedProducts.length} products`)
        const finalResponse = { ...responseBody, currentStep, progress: currentProgress(currentStep), timeline }
        logger.info('factory.build_completed', {
          mode: body.mode,
          source: finalResponse.source,
          productCount: finalResponse.composedProducts.length,
        })

        await safelyUpdateRun(runId, logger, {
          status: 'completed',
          currentStep,
          progress: currentProgress(currentStep),
          buildId,
          source: finalResponse.source,
          steps: timeline,
          output: finalResponse,
          errors: [],
          completedAt: new Date(),
        })

        return NextResponse.json(finalResponse, {
          headers: { 'x-request-id': requestId },
        })
      } catch (error) {
        const message = `Canonical Python pipeline unavailable: ${errorMessage(error)}`
        logger.error('factory.python_unavailable', { error: message })
        addTimelineEntry(timeline, 'failed', message)
        await safelyUpdateRun(runId, logger, {
          status: 'failed',
          currentStep: 'failed',
          progress: currentProgress('failed'),
          buildId,
          source: 'python-core',
          steps: timeline,
          errors: [message],
          completedAt: new Date(),
        })

        return failureResponse({
          requestId,
          runId,
          mode: body.mode,
          source: 'python-core',
          buildId,
          currentStep: 'failed',
          progress: currentProgress('failed'),
          timeline,
          statusCode: 503,
          error: message,
        })
      }
    }

    currentStep = 'pipeline_dispatch'
    await advanceRunStep(runId, logger, timeline, currentStep, 'Running explicit TypeScript fast mode pipeline', 'running', {
      source: 'typescript-fast-mode',
      buildId,
    })

    const { AIProductFactory } = await import('@/lib/factory/controller')
    const factory = new AIProductFactory()
    const state = await factory.build(resolvedIdea, body.maxRepos)

    currentStep = 'response_validation'
    await advanceRunStep(runId, logger, timeline, currentStep, 'Validating fast mode output', 'running', {
      source: 'typescript-fast-mode',
      buildId: state.buildId,
    })
    const responseBody = validateFactoryResponse(
      normalizeTypeScriptResult(state, requestId, runId, body.mode)
    )

    const completionStep = responseBody.success ? 'completed' : 'failed'
    addTimelineEntry(timeline, completionStep, responseBody.success ? 'Fast mode output ready' : 'Fast mode failed quality checks')
    const finalResponse = { ...responseBody, currentStep: completionStep, progress: currentProgress(completionStep), timeline }

    logger.info('factory.build_completed', {
      mode: body.mode,
      source: finalResponse.source,
      status: finalResponse.status,
      componentCount: finalResponse.generatedComponents.length,
    })

    await safelyUpdateRun(runId, logger, {
      status: responseBody.success ? 'completed' : 'failed',
      currentStep: completionStep,
      progress: currentProgress(completionStep),
      buildId: responseBody.buildId,
      source: responseBody.source,
      steps: timeline,
      output: finalResponse,
      errors: responseBody.errors,
      completedAt: new Date(),
    })

    return NextResponse.json(finalResponse, {
      status: responseBody.success ? 200 : 500,
      headers: { 'x-request-id': requestId },
    })
  } catch (error) {
    const message = errorMessage(error)
    logger.error('factory.build_crashed', { error: message })
    currentStep = 'failed'
    addTimelineEntry(timeline, currentStep, message)

    await safelyUpdateRun(runId, logger, {
      status: 'failed',
      currentStep,
      progress: currentProgress(currentStep),
      buildId,
      source: mode === 'fast' ? 'typescript-fast-mode' : 'python-core',
      steps: timeline,
      errors: [message],
      completedAt: new Date(),
    })

    return failureResponse({
      requestId,
      runId,
      mode,
      source: mode === 'fast' ? 'typescript-fast-mode' : 'python-core',
      buildId,
      currentStep,
      progress: currentProgress(currentStep),
      timeline,
      statusCode: 500,
      error: message,
    })
  }
}
