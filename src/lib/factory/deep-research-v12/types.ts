export type SourceLink = { label: string; url: string; kind: string }

export type RepoInspectionV12 = {
  inspected: boolean
  depth: 'metadata' | 'readme' | 'code-sample'
  defaultBranch: string
  filesSeen: number
  sourceFilesSampled: number
  readmeCharacters: number
  inspectionScore: number
  verifiedCapabilities: string[]
  specializedCapabilities: string[]
  architectureHints: string[]
  keyFiles: Array<{ path: string; url: string; reason: string }>
  sourceLinks: SourceLink[]
  warnings: string[]
}

export type DeepResearchSignalV12 = {
  source: string
  kind: string
  title: string
  url: string
  summary: string
  publishedAt?: string
  relevance?: number
  metrics?: Record<string, number | string>
  capabilities?: string[]
  repository?: {
    fullName?: string
    description?: string
    language?: string
    license?: string
    stars?: number
    forks?: number
    updatedAt?: string
    archived?: boolean
    topics?: string[]
  }
  inspection?: RepoInspectionV12
}

export type QueryPlan = { query: string; focus: string; kind: 'product' | 'capability' | 'architecture' }

export type ResearchProfileV12 = {
  query: string
  queries: QueryPlan[]
  intentTerms: string[]
  domainTerms: string[]
  capabilities: string[]
  specializedCapabilities: string[]
  genericCapabilities: string[]
  domain: string
  productArchetype: string
}
