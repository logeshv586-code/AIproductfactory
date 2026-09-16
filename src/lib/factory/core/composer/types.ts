import { z } from 'zod'

export const ProductSystemRequestSchema = z.object({
  industry: z.string().trim().min(1, 'Industry is required'),
  idea: z.string().trim().optional(),
  fields: z.array(z.string().trim().min(1)).default([]),
  maxRepos: z.number().int().min(1).max(10).default(7),
})

export type ProductSystemRequest = z.infer<typeof ProductSystemRequestSchema>

export type FieldTag =
  | 'ai'
  | 'automation'
  | 'analytics'
  | 'devops'
  | 'security'
  | 'data'
  | 'rag'
  | 'workflow'
  | 'integration'

export type RepoRole =
  | 'agent'
  | 'orchestration'
  | 'execution'
  | 'workflow'
  | 'storage'
  | 'interface'
  | 'monitoring'
  | 'security'

export interface NormalizedBrief {
  industry: string
  industrySlug: string
  idea?: string
  fields: FieldTag[]
  intentTags: string[]
  maxRepos: number
  isRegulated: boolean
  needsExternalAutomation: boolean
  needsVectorMemory: boolean
  preferredOutput: 'dashboard' | 'api' | 'automation'
}

export interface ProductBlueprint {
  productName: string
  problem: string
  solution: string
  finalOutput: string
  userOutcome: string
  caseSchema: Record<string, unknown>
  planSchema: Record<string, unknown>
  executionSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
}

export interface RepoCatalogItem {
  fullName: string
  url: string
  description: string
  roles: RepoRole[]
  tags: string[]
  maturity: number
  activeSignal: string
  selectionHint: string
}

export interface SelectedRepo {
  name: string
  role: RepoRole
  url: string
  description: string
  reason: string
  tags: string[]
  maturity: number
  active_signal: string
  stars: number | null
}

export interface ArchitectureNode {
  id: string
  label: string
  role: string
  component: string
  repos: string[]
}

export interface ArchitectureEdge {
  from: string
  to: string
  type: 'data_flow' | 'control_flow'
  description: string
}

export interface NodeContract {
  input: {
    type: string
    schema: Record<string, unknown>
  }
  output: {
    type: string
    schema: Record<string, unknown>
  }
}

export interface ProductSystemOutput {
  product_name: string
  industry: string
  problem: string
  solution: string
  selected_repos: SelectedRepo[]
  architecture: {
    nodes: ArchitectureNode[]
    edges: ArchitectureEdge[]
  }
  contracts: Record<string, NodeContract>
  scores: {
    coherence: number
    coverage: number
    maturity: number
    confidence: number
  }
  composition_explanation: string
  final_output: string
  build_starter: {
    folder_structure: Array<{ path: string; purpose: string }>
    services: Array<{ name: string; responsibility: string; repo: string }>
    implementation_steps: string[]
    validation_checks: string[]
  }
}
