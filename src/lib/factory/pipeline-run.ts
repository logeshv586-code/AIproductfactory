import { db } from '@/lib/db'

export type PipelineMode = 'full' | 'fast'
export type PipelineRunStatus = 'queued' | 'running' | 'failed' | 'completed'

export interface PipelineTimelineEntry {
  step: string
  ts: number
  detail: string
}

interface CreatePipelineRunInput {
  requestId: string
  idea: string
  mode: PipelineMode
}

interface UpdatePipelineRunInput {
  status?: PipelineRunStatus
  currentStep?: string | null
  progress?: number
  buildId?: string | null
  source?: string | null
  steps?: PipelineTimelineEntry[]
  output?: unknown
  errors?: string[]
  completedAt?: Date | null
}

const toJson = (value: unknown): string => JSON.stringify(value ?? null)

export async function createPipelineRun(input: CreatePipelineRunInput) {
  return db.pipelineRun.create({
    data: {
      requestId: input.requestId,
      idea: input.idea,
      mode: input.mode,
      status: 'queued',
      currentStep: 'request_accepted',
      progress: 0,
      startedAt: new Date(),
    },
  })
}

export async function updatePipelineRun(runId: string, input: UpdatePipelineRunInput) {
  return db.pipelineRun.update({
    where: { id: runId },
    data: {
      status: input.status,
      currentStep: input.currentStep ?? undefined,
      progress: input.progress ?? undefined,
      buildId: input.buildId ?? undefined,
      source: input.source ?? undefined,
      steps: input.steps ? toJson(input.steps) : undefined,
      output: input.output !== undefined ? toJson(input.output) : undefined,
      errors: input.errors ? toJson(input.errors) : undefined,
      completedAt: input.completedAt ?? undefined,
    },
  })
}
