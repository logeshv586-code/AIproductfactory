import { createLogger } from '@/lib/structured-logging'
import { updatePipelineRun, type PipelineRunStatus } from '@/lib/factory/pipeline-run'
import type { TimelineEntry } from './schemas'
import { addTimelineEntry, currentProgress, errorMessage } from './utils'

export async function safelyUpdateRun(
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

export async function advanceRunStep(
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
