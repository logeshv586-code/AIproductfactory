import type { LiveResearch } from '@/lib/factory/manager-v8'

export type Strategy = {
  id: string
  name: string
  tagline?: string
  description?: string
  why?: string
  feasibility?: number
  innovation_score?: number
  complexity?: string
}

export type StrategizeResponse = {
  success: boolean
  run_id: string
  graph: Record<string, any>
  strategies: Strategy[]
  error?: string
}

export type ApproveResponse = {
  success: boolean
  run_id: string
  graph: Record<string, any>
  approved_strategy?: Strategy
  error?: string
}

export type ApprovedBuildResult = {
  success: boolean
  pipelineVerified?: boolean
  status?: string
  buildId?: string
  outputPath?: string | null
  selectedRepos?: Array<Record<string, any>>
  verification?: Record<string, unknown>
  errors?: string[]
  note?: string
}

export type CustomerPriority = 'speed' | 'balanced' | 'scale'

export type ResearchResponse = LiveResearch & {
  profile?: {
    intentTerms?: string[]
    capabilities?: string[]
    domain?: string
  }
  summary?: LiveResearch['summary'] & {
    relevantSignalCount?: number
    rejectedSignalCount?: number
    githubCandidates?: number
    averageRelevance?: number
    confidenceBand?: string
  }
}
