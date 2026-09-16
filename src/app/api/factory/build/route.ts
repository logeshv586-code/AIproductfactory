import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl, getPythonHealth } from '@/lib/factory/python-health'
import { createPipelineRun } from '@/lib/factory/pipeline-run'
import { createLogger } from '@/lib/structured-logging'
import { BuildRequestSchema, type FactoryBuildRequest } from '@/lib/factory/build/schemas'
import {
  makeBuildId,
  addTimelineEntry,
  errorMessage,
  currentProgress,
  resolveBuildIndustry,
  resolveBuildIdea,
  failureResponse,
  validateFactoryResponse,
} from '@/lib/factory/build/utils'
import { safelyUpdateRun, advanceRunStep } from '@/lib/factory/build/pipeline-tracker'
import { fetchRepoCandidates } from '@/lib/factory/build/github-repos'
import { normalizePythonResult, normalizeTypeScriptResult } from '@/lib/factory/build/normalizers'
export { normalizePythonResult, normalizeTypeScriptResult }
import type { TimelineEntry } from '@/lib/factory/build/schemas'
import type { PipelineMode } from '@/lib/factory/pipeline-run'

export const maxDuration = 180

const PYTHON_BACKEND = getPythonBackendUrl()

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

        const pythonResultData = normalizePythonResult(pythonData.data, requestId, runId, body.mode, buildId)
        console.log('[DEBUG] Normalized Python Result:', JSON.stringify(pythonResultData).slice(0, 500) + '...')

        let responseBody;
        try {
          responseBody = validateFactoryResponse(pythonResultData)
        } catch (validationError: any) {
          logger.error('factory.validation_error', { error: validationError.message })
          return failureResponse({
            requestId,
            runId,
            mode: body.mode,
            statusCode: 500,
            error: `Factory validation failed: ${validationError.message}`,
            source: 'python-core',
            buildId,
            currentStep: 'failed',
            progress: currentProgress('failed'),
            timeline,
          })
        }

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
