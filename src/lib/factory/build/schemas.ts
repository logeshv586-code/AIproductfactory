import { z } from 'zod'
import type { PipelineMode } from '@/lib/factory/pipeline-run'

export const BuildRequestSchema = z.object({
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

export const FactoryBaseResponseSchema = z.object({
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
  combinedIntelligenceReport: z.unknown().nullable().optional(),
  capabilityGraphEngine: z.unknown().nullable().optional(),
  researchReport: z.unknown().nullable().optional(),
  feasibilityReport: z.unknown().nullable().optional(),
  executionPlan: z.unknown().nullable().optional(),
})

export type FactoryBuildRequest = z.infer<typeof BuildRequestSchema>
export type TimelineEntry = z.infer<typeof TimelineEntrySchema>

export interface FactoryErrorResponse {
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
  combinedIntelligenceReport?: null
  capabilityGraphEngine?: null
  researchReport?: null
  feasibilityReport?: null
  executionPlan?: null
}
