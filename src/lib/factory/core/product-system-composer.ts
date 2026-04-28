import { z } from 'zod'
import { classifyIntent } from './intent-classifier'

export const ProductSystemRequestSchema = z.object({
  industry: z.string().trim().min(1, 'Industry is required'),
  idea: z.string().trim().optional(),
  fields: z.array(z.string().trim().min(1)).default([]),
  maxRepos: z.number().int().min(1).max(10).default(7),
})

export type ProductSystemRequest = z.infer<typeof ProductSystemRequestSchema>

type FieldTag =
  | 'ai'
  | 'automation'
  | 'analytics'
  | 'devops'
  | 'security'
  | 'data'
  | 'rag'
  | 'workflow'
  | 'integration'

type RepoRole =
  | 'agent'
  | 'orchestration'
  | 'execution'
  | 'workflow'
  | 'storage'
  | 'interface'
  | 'monitoring'
  | 'security'

interface NormalizedBrief {
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

interface ProductBlueprint {
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

interface RepoCatalogItem {
  fullName: string
  url: string
  description: string
  roles: RepoRole[]
  tags: string[]
  maturity: number
  activeSignal: string
  selectionHint: string
}

interface SelectedRepo {
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

interface ArchitectureNode {
  id: string
  label: string
  role: string
  component: string
  repos: string[]
}

interface ArchitectureEdge {
  from: string
  to: string
  type: 'data_flow' | 'control_flow'
  description: string
}

interface NodeContract {
  input: {
    type: string
    schema: Record<string, unknown>
  }
  output: {
    type: string
    schema: Record<string, unknown>
  }
}

interface ProductSystemOutput {
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

const REGULATED_INDUSTRIES = new Set([
  'healthcare',
  'health-care',
  'finance',
  'financial-services',
  'insurance',
  'legal',
  'government',
  'public-sector',
  'pharma',
])

const FIELD_ALIASES: Array<{ matches: string[]; tag: FieldTag }> = [
  { matches: ['ai', 'artificial intelligence', 'llm', 'agents', 'agentic'], tag: 'ai' },
  { matches: ['automation', 'rpa', 'ops', 'operations'], tag: 'automation' },
  { matches: ['analytics', 'bi', 'dashboard', 'reporting'], tag: 'analytics' },
  { matches: ['devops', 'platform', 'sre', 'observability'], tag: 'devops' },
  { matches: ['security', 'compliance', 'identity', 'auth'], tag: 'security' },
  { matches: ['data', 'etl', 'warehouse', 'lakehouse'], tag: 'data' },
  { matches: ['rag', 'retrieval', 'knowledge', 'vector'], tag: 'rag' },
  { matches: ['workflow', 'orchestration', 'scheduler'], tag: 'workflow' },
  { matches: ['integration', 'api', 'connectors'], tag: 'integration' },
]

const REPO_CATALOG: RepoCatalogItem[] = [
  {
    fullName: 'vercel/next.js',
    url: 'https://github.com/vercel/next.js',
    description: 'Production web framework for operator dashboards, portals, and API routes.',
    roles: ['interface'],
    tags: ['web', 'ui', 'dashboard', 'portal', 'api'],
    maturity: 95,
    activeSignal: 'Large production footprint across SaaS products.',
    selectionHint: 'Best fit when the product needs an authenticated operator workspace.',
  },
  {
    fullName: 'langchain-ai/langchain',
    url: 'https://github.com/langchain-ai/langchain',
    description: 'Agent runtime and tool abstraction layer for structured business workflows.',
    roles: ['agent'],
    tags: ['ai', 'agent', 'rag', 'workflow'],
    maturity: 90,
    activeSignal: 'Widely adopted for production LLM orchestration patterns.',
    selectionHint: 'Strong default for tool-using task agents and typed business flows.',
  },
  {
    fullName: 'microsoft/autogen',
    url: 'https://github.com/microsoft/autogen',
    description: 'Multi-agent framework for collaborative planning, review, and escalation.',
    roles: ['agent'],
    tags: ['ai', 'agent', 'multi-agent'],
    maturity: 87,
    activeSignal: 'Strong enterprise mindshare for agent collaboration.',
    selectionHint: 'Useful when the product needs specialist agents or reviewer loops.',
  },
  {
    fullName: 'langchain-ai/langgraph',
    url: 'https://github.com/langchain-ai/langgraph',
    description: 'Stateful orchestration engine for planner-led agent execution graphs.',
    roles: ['orchestration'],
    tags: ['ai', 'workflow', 'planner', 'stateful'],
    maturity: 89,
    activeSignal: 'Rapid adoption for durable agent state machines.',
    selectionHint: 'Maps cleanly to the planner layer required in the execution graph.',
  },
  {
    fullName: 'temporalio/temporal',
    url: 'https://github.com/temporalio/temporal',
    description: 'Durable workflow engine for retries, SLAs, and long-running business processes.',
    roles: ['workflow'],
    tags: ['workflow', 'durable', 'automation', 'orchestration'],
    maturity: 94,
    activeSignal: 'Proven at scale for mission-critical business workflows.',
    selectionHint: 'Best when the system needs resumable, auditable, long-running jobs.',
  },
  {
    fullName: 'n8n-io/n8n',
    url: 'https://github.com/n8n-io/n8n',
    description: 'Connector-rich workflow automation platform for business system integrations.',
    roles: ['workflow'],
    tags: ['workflow', 'automation', 'integration', 'connectors'],
    maturity: 91,
    activeSignal: 'Strong usage in integration-heavy internal tooling stacks.',
    selectionHint: 'Best when the system needs fast connector breadth and human-friendly automation.',
  },
  {
    fullName: 'microsoft/playwright',
    url: 'https://github.com/microsoft/playwright',
    description: 'Reliable browser and web automation runtime for operational task execution.',
    roles: ['execution'],
    tags: ['automation', 'browser', 'integration', 'testing'],
    maturity: 93,
    activeSignal: 'Actively maintained automation runtime with broad ecosystem support.',
    selectionHint: 'Ideal when execution must touch third-party portals or brittle web workflows.',
  },
  {
    fullName: 'celery/celery',
    url: 'https://github.com/celery/celery',
    description: 'Distributed task execution framework for backend jobs and asynchronous workloads.',
    roles: ['execution'],
    tags: ['execution', 'jobs', 'automation', 'backend'],
    maturity: 89,
    activeSignal: 'Long-lived background job runtime with strong operational familiarity.',
    selectionHint: 'Best for service-side execution that does not require browser automation.',
  },
  {
    fullName: 'supabase/supabase',
    url: 'https://github.com/supabase/supabase',
    description: 'Postgres-based application platform for transactional storage, auth, and APIs.',
    roles: ['storage'],
    tags: ['storage', 'database', 'auth', 'api'],
    maturity: 92,
    activeSignal: 'Popular application backend foundation with strong developer velocity.',
    selectionHint: 'Good default operational store for cases, users, and audit records.',
  },
  {
    fullName: 'qdrant/qdrant',
    url: 'https://github.com/qdrant/qdrant',
    description: 'Vector database for semantic retrieval over documents, events, and evidence.',
    roles: ['storage'],
    tags: ['storage', 'vector', 'rag', 'retrieval', 'ai'],
    maturity: 88,
    activeSignal: 'Actively used in production RAG systems and semantic search stacks.',
    selectionHint: 'Best when agent decisions need retrieval over unstructured evidence.',
  },
  {
    fullName: 'grafana/grafana',
    url: 'https://github.com/grafana/grafana',
    description: 'Observability and operational analytics UI for workflow health and business KPIs.',
    roles: ['monitoring', 'interface'],
    tags: ['monitoring', 'analytics', 'dashboard', 'observability'],
    maturity: 96,
    activeSignal: 'Battle-tested monitoring surface with strong alerting and dashboard support.',
    selectionHint: 'Best for operational visibility, SLA tracking, and run-level observability.',
  },
  {
    fullName: 'open-telemetry/opentelemetry-collector',
    url: 'https://github.com/open-telemetry/opentelemetry-collector',
    description: 'Telemetry pipeline for traces, metrics, and logs across product services.',
    roles: ['monitoring'],
    tags: ['monitoring', 'observability', 'telemetry', 'devops'],
    maturity: 91,
    activeSignal: 'Standard observability backbone across modern platform teams.',
    selectionHint: 'Best when the stack needs portable telemetry and vendor-neutral tracing.',
  },
  {
    fullName: 'keycloak/keycloak',
    url: 'https://github.com/keycloak/keycloak',
    description: 'Identity and access management platform for regulated or enterprise environments.',
    roles: ['security'],
    tags: ['security', 'identity', 'auth', 'compliance'],
    maturity: 91,
    activeSignal: 'Common enterprise identity layer for audited business systems.',
    selectionHint: 'Important when the product handles regulated workflows or privileged operations.',
  },
]

const ROLE_ORDER: RepoRole[] = [
  'interface',
  'agent',
  'orchestration',
  'workflow',
  'execution',
  'storage',
  'monitoring',
]

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some(needle => haystack.includes(needle))
}

function normalizeFields(inputFields: string[], seedText: string): FieldTag[] {
  const tags: FieldTag[] = []
  const combined = `${inputFields.join(' ')} ${seedText}`.toLowerCase()

  for (const alias of FIELD_ALIASES) {
    if (alias.matches.some(match => combined.includes(match))) {
      tags.push(alias.tag)
    }
  }

  if (!tags.includes('ai')) tags.push('ai')
  if (!tags.includes('workflow')) tags.push('workflow')
  if (!tags.includes('automation')) tags.push('automation')

  return unique(tags)
}

function normalizeBrief(input: ProductSystemRequest): NormalizedBrief {
  const industry = input.industry.trim()
  const seedText = `${industry} ${input.idea || ''}`
  const intent = classifyIntent(seedText)
  const fields = normalizeFields(input.fields, seedText)
  const industrySlug = slugify(industry)
  const isRegulated = REGULATED_INDUSTRIES.has(industrySlug)
  const needsVectorMemory = fields.includes('rag') || fields.includes('ai') || intent.tags.includes('rag')
  const needsExternalAutomation = fields.includes('automation') || intent.tags.includes('browser-automation')
  const preferredOutput: NormalizedBrief['preferredOutput'] = fields.includes('analytics')
    ? 'dashboard'
    : fields.includes('integration')
      ? 'api'
      : 'automation'

  return {
    industry,
    industrySlug,
    idea: input.idea?.trim() || undefined,
    fields,
    intentTags: intent.tags,
    maxRepos: Math.min(10, Math.max(5, input.maxRepos)),
    isRegulated,
    needsExternalAutomation,
    needsVectorMemory,
    preferredOutput,
  }
}

function buildBlueprint(brief: NormalizedBrief): ProductBlueprint {
  const name = toTitleCase(brief.industry)

  if (includesAny(brief.industrySlug, ['health', 'hospital', 'payer', 'pharma'])) {
    return {
      productName: `${name} Prior Authorization Orchestrator`,
      problem: 'Revenue-cycle and care-ops teams still assemble payer evidence by hand, bounce across portals, and lose time on missing documentation, which increases denial risk and slows patient access.',
      solution: 'An agentic authorization control plane that ingests a case, plans payer-specific evidence steps, runs workflow and browser automation against external portals, stores every artifact, and routes only true exceptions to human reviewers.',
      finalOutput: 'A dashboard plus API and workflow automation layer that turns a raw authorization request into a submission packet, review queue, and audit-ready status timeline.',
      userOutcome: 'Users reduce manual touch time, shorten authorization turnaround, and improve first-pass approval rates.',
      caseSchema: {
        type: 'object',
        required: ['case_id', 'patient_id', 'payer', 'procedure_codes'],
        properties: {
          case_id: { type: 'string' },
          patient_id: { type: 'string' },
          payer: { type: 'string' },
          procedure_codes: { type: 'array', items: { type: 'string' } },
          clinical_packet_uri: { type: 'string' },
          priority: { type: 'string', enum: ['routine', 'urgent'] },
        },
      },
      planSchema: {
        type: 'object',
        required: ['case_id', 'steps', 'missing_evidence'],
        properties: {
          case_id: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
          missing_evidence: { type: 'array', items: { type: 'string' } },
          escalation_rule: { type: 'string' },
        },
      },
      executionSchema: {
        type: 'object',
        required: ['case_id', 'job_id', 'actions'],
        properties: {
          case_id: { type: 'string' },
          job_id: { type: 'string' },
          actions: { type: 'array', items: { type: 'string' } },
          portal_session_required: { type: 'boolean' },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['case_id', 'submission_status', 'review_flags'],
        properties: {
          case_id: { type: 'string' },
          submission_status: { type: 'string' },
          review_flags: { type: 'array', items: { type: 'string' } },
          evidence_bundle_uri: { type: 'string' },
          next_action_at: { type: 'string' },
        },
      },
    }
  }

  if (includesAny(brief.industrySlug, ['finance', 'bank', 'fintech', 'payments'])) {
    return {
      productName: `${name} Exception Resolution Copilot`,
      problem: 'Finance operations teams juggle payment exceptions, ledger breaks, and suspicious anomalies across fragmented systems, so high-value cases sit unresolved and audit trails stay incomplete.',
      solution: 'A finance exception orchestration platform that uses an agent to classify the case, a planner to assemble remediation steps, workflows to manage approvals, and execution adapters to gather evidence and post safe downstream actions.',
      finalOutput: 'A case-resolution dashboard and API that converts raw exception alerts into a disposition package, routed tasks, and reconciled execution history.',
      userOutcome: 'Users clear backlogs faster, improve control coverage, and cut reconciliation time without weakening approvals.',
      caseSchema: {
        type: 'object',
        required: ['exception_id', 'account_id', 'source_system', 'amount'],
        properties: {
          exception_id: { type: 'string' },
          account_id: { type: 'string' },
          source_system: { type: 'string' },
          amount: { type: 'number' },
          anomaly_signals: { type: 'array', items: { type: 'string' } },
          attachments_uri: { type: 'string' },
        },
      },
      planSchema: {
        type: 'object',
        required: ['exception_id', 'resolution_steps', 'approval_policy'],
        properties: {
          exception_id: { type: 'string' },
          resolution_steps: { type: 'array', items: { type: 'string' } },
          approval_policy: { type: 'string' },
          control_checks: { type: 'array', items: { type: 'string' } },
        },
      },
      executionSchema: {
        type: 'object',
        required: ['exception_id', 'actions'],
        properties: {
          exception_id: { type: 'string' },
          actions: { type: 'array', items: { type: 'string' } },
          writeback_targets: { type: 'array', items: { type: 'string' } },
          human_approval_token: { type: 'string' },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['exception_id', 'disposition', 'audit_packet_uri'],
        properties: {
          exception_id: { type: 'string' },
          disposition: { type: 'string' },
          audit_packet_uri: { type: 'string' },
          journal_actions: { type: 'array', items: { type: 'string' } },
          reviewer_queue: { type: 'string' },
        },
      },
    }
  }

  if (includesAny(brief.industrySlug, ['insurance', 'claims'])) {
    return {
      productName: `${name} Claims Triage Engine`,
      problem: 'Claims teams lose time reading submissions, chasing missing documents, and coordinating approvals across adjusters, carriers, and external systems.',
      solution: 'An AI-assisted claims command center that structures intake, plans the next-best actions, drives workflows through adjuster queues, triggers execution tasks, and centralizes evidence for every claim.',
      finalOutput: 'A dashboard and automation service that produces claim routing, next-best-action recommendations, and a complete claim evidence ledger.',
      userOutcome: 'Users shorten cycle times, improve straight-through processing, and surface risky claims earlier.',
      caseSchema: {
        type: 'object',
        required: ['claim_id', 'policy_id', 'loss_type'],
        properties: {
          claim_id: { type: 'string' },
          policy_id: { type: 'string' },
          loss_type: { type: 'string' },
          intake_bundle_uri: { type: 'string' },
          severity_signal: { type: 'string' },
        },
      },
      planSchema: {
        type: 'object',
        required: ['claim_id', 'triage_path'],
        properties: {
          claim_id: { type: 'string' },
          triage_path: { type: 'array', items: { type: 'string' } },
          missing_documents: { type: 'array', items: { type: 'string' } },
          reserve_recommendation: { type: 'string' },
        },
      },
      executionSchema: {
        type: 'object',
        required: ['claim_id', 'jobs'],
        properties: {
          claim_id: { type: 'string' },
          jobs: { type: 'array', items: { type: 'string' } },
          external_party_updates: { type: 'array', items: { type: 'string' } },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['claim_id', 'status', 'owner'],
        properties: {
          claim_id: { type: 'string' },
          status: { type: 'string' },
          owner: { type: 'string' },
          evidence_timeline_uri: { type: 'string' },
          settlement_blockers: { type: 'array', items: { type: 'string' } },
        },
      },
    }
  }

  if (includesAny(brief.industrySlug, ['manufacturing', 'factory', 'industrial'])) {
    return {
      productName: `${name} Quality Deviation Control Tower`,
      problem: 'Manufacturing teams investigate quality incidents across MES, ERP, and manual spreadsheets, which delays containment and makes root-cause work inconsistent.',
      solution: 'A deviation response platform that assembles production evidence, plans the investigation path, runs workflow assignments, triggers corrective-action tasks, and keeps a single record for every incident.',
      finalOutput: 'A command dashboard and workflow layer that turns a production deviation into an owned action plan, evidence packet, and closure report.',
      userOutcome: 'Users contain incidents faster, improve traceability, and cut the time from detection to corrective action.',
      caseSchema: {
        type: 'object',
        required: ['incident_id', 'line_id', 'sku'],
        properties: {
          incident_id: { type: 'string' },
          line_id: { type: 'string' },
          sku: { type: 'string' },
          sensor_window_uri: { type: 'string' },
          defect_signals: { type: 'array', items: { type: 'string' } },
        },
      },
      planSchema: {
        type: 'object',
        required: ['incident_id', 'containment_steps'],
        properties: {
          incident_id: { type: 'string' },
          containment_steps: { type: 'array', items: { type: 'string' } },
          root_cause_hypotheses: { type: 'array', items: { type: 'string' } },
          escalation_owner: { type: 'string' },
        },
      },
      executionSchema: {
        type: 'object',
        required: ['incident_id', 'tasks'],
        properties: {
          incident_id: { type: 'string' },
          tasks: { type: 'array', items: { type: 'string' } },
          system_writebacks: { type: 'array', items: { type: 'string' } },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['incident_id', 'status', 'closure_report_uri'],
        properties: {
          incident_id: { type: 'string' },
          status: { type: 'string' },
          closure_report_uri: { type: 'string' },
          quality_kpis: { type: 'array', items: { type: 'string' } },
        },
      },
    }
  }

  if (includesAny(brief.industrySlug, ['logistics', 'transport', 'supply-chain'])) {
    return {
      productName: `${name} Shipment Exception Orchestrator`,
      problem: 'Logistics teams monitor delays, handoffs, and missing milestone events across multiple carriers and portals, which leads to slow interventions and poor customer communication.',
      solution: 'A shipment exception platform that classifies disruptions, plans the best remediation path, automates updates and escalations, and stores a complete runbook for every shipment.',
      finalOutput: 'A dashboard, API, and automation backbone that transforms raw delay signals into owner assignments, customer updates, and recovery workflows.',
      userOutcome: 'Users resolve disruptions faster, improve SLA adherence, and reduce manual carrier follow-up.',
      caseSchema: {
        type: 'object',
        required: ['shipment_id', 'carrier', 'milestone_gap'],
        properties: {
          shipment_id: { type: 'string' },
          carrier: { type: 'string' },
          milestone_gap: { type: 'string' },
          order_id: { type: 'string' },
          customer_tier: { type: 'string' },
        },
      },
      planSchema: {
        type: 'object',
        required: ['shipment_id', 'recovery_steps'],
        properties: {
          shipment_id: { type: 'string' },
          recovery_steps: { type: 'array', items: { type: 'string' } },
          notification_plan: { type: 'array', items: { type: 'string' } },
          fallback_carrier_policy: { type: 'string' },
        },
      },
      executionSchema: {
        type: 'object',
        required: ['shipment_id', 'actions'],
        properties: {
          shipment_id: { type: 'string' },
          actions: { type: 'array', items: { type: 'string' } },
          partner_updates: { type: 'array', items: { type: 'string' } },
        },
      },
      outputSchema: {
        type: 'object',
        required: ['shipment_id', 'status', 'next_update_at'],
        properties: {
          shipment_id: { type: 'string' },
          status: { type: 'string' },
          next_update_at: { type: 'string' },
          exception_owner: { type: 'string' },
          audit_timeline_uri: { type: 'string' },
        },
      },
    }
  }

  return {
    productName: `${name} Operations Decision Engine`,
    problem: `Teams in ${brief.industry} still move high-friction cases through email, spreadsheets, and disconnected systems, which slows decisions and hides operational risk.`,
    solution: `A domain-specific control plane that receives work items, uses agents to structure the case, plans the right actions, executes integrations safely, stores evidence, and exposes a dashboard plus API for humans and downstream systems.`,
    finalOutput: 'A dashboard, API, and automation service that converts a raw work item into an actionable plan, execution trail, and review-ready result.',
    userOutcome: `Users in ${brief.industry} reduce manual triage, standardize execution, and improve throughput for high-value cases.`,
    caseSchema: {
      type: 'object',
      required: ['work_item_id', 'account_id', 'summary'],
      properties: {
        work_item_id: { type: 'string' },
        account_id: { type: 'string' },
        summary: { type: 'string' },
        attachments_uri: { type: 'string' },
        priority: { type: 'string' },
      },
    },
    planSchema: {
      type: 'object',
      required: ['work_item_id', 'steps'],
      properties: {
        work_item_id: { type: 'string' },
        steps: { type: 'array', items: { type: 'string' } },
        blockers: { type: 'array', items: { type: 'string' } },
        reviewer_queue: { type: 'string' },
      },
    },
    executionSchema: {
      type: 'object',
      required: ['work_item_id', 'actions'],
      properties: {
        work_item_id: { type: 'string' },
        actions: { type: 'array', items: { type: 'string' } },
        writeback_targets: { type: 'array', items: { type: 'string' } },
      },
    },
    outputSchema: {
      type: 'object',
      required: ['work_item_id', 'status', 'artifacts'],
      properties: {
        work_item_id: { type: 'string' },
        status: { type: 'string' },
        artifacts: { type: 'array', items: { type: 'string' } },
        next_action_at: { type: 'string' },
      },
    },
  }
}

function scoreRepoForRole(repo: RepoCatalogItem, role: RepoRole, brief: NormalizedBrief): number {
  let score = repo.maturity
  if (repo.roles.includes(role)) score += 25
  if (brief.fields.includes('analytics') && repo.tags.includes('analytics')) score += 10
  if (brief.fields.includes('devops') && repo.tags.includes('observability')) score += 10
  if (brief.needsExternalAutomation && repo.tags.includes('browser')) score += 14
  if (!brief.needsExternalAutomation && repo.fullName === 'celery/celery') score += 12
  if (brief.needsVectorMemory && repo.tags.includes('vector')) score += 12
  if (brief.isRegulated && repo.tags.includes('compliance')) score += 12
  if (brief.intentTags.includes('workflow') && repo.tags.includes('workflow')) score += 8
  if (brief.intentTags.includes('agents') && repo.tags.includes('agent')) score += 8
  if (brief.preferredOutput === 'dashboard' && repo.tags.includes('dashboard')) score += 8
  return score
}

async function hydrateRepoStars(repos: SelectedRepo[]): Promise<SelectedRepo[]> {
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'ai-product-factory',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const hydrated = await Promise.allSettled(
    repos.map(async repo => {
      const response = await fetch(`https://api.github.com/repos/${repo.name}`, {
        headers,
        next: { revalidate: 900 },
      })
      if (!response.ok) return repo
      const data = await response.json()
      return {
        ...repo,
        stars: typeof data.stargazers_count === 'number' ? data.stargazers_count : repo.stars,
      }
    })
  )

  return hydrated.map((result, index) => result.status === 'fulfilled' ? result.value : repos[index])
}

function chooseRepo(
  role: RepoRole,
  brief: NormalizedBrief,
  chosenNames: Set<string>,
  preferred?: string
): RepoCatalogItem | null {
  const candidates = REPO_CATALOG
    .filter(repo => repo.roles.includes(role))
    .sort((a, b) => {
      const preferredBoostA = preferred && a.fullName === preferred ? 1000 : 0
      const preferredBoostB = preferred && b.fullName === preferred ? 1000 : 0
      return (scoreRepoForRole(b, role, brief) + preferredBoostB) - (scoreRepoForRole(a, role, brief) + preferredBoostA)
    })

  return candidates.find(repo => !chosenNames.has(repo.fullName)) || candidates[0] || null
}

async function selectRepos(brief: NormalizedBrief, blueprint: ProductBlueprint): Promise<SelectedRepo[]> {
  const chosenNames = new Set<string>()
  const selections: SelectedRepo[] = []

  const workflowPreferred = brief.fields.includes('integration') ? 'n8n-io/n8n' : 'temporalio/temporal'
  const executionPreferred = brief.needsExternalAutomation ? 'microsoft/playwright' : 'celery/celery'
  const storagePreferred = brief.needsVectorMemory ? 'qdrant/qdrant' : 'supabase/supabase'

  for (const role of ROLE_ORDER) {
    const preferred =
      role === 'workflow' ? workflowPreferred :
      role === 'execution' ? executionPreferred :
      role === 'storage' ? storagePreferred :
      undefined
    const repo = chooseRepo(role, brief, chosenNames, preferred)
    if (!repo) continue

    chosenNames.add(repo.fullName)
    selections.push({
      name: repo.fullName,
      role,
      url: repo.url,
      description: repo.description,
      reason: `${repo.selectionHint} For ${blueprint.productName}, it anchors the ${role} layer.`,
      tags: repo.tags,
      maturity: repo.maturity,
      active_signal: repo.activeSignal,
      stars: null,
    })
  }

  if (brief.needsVectorMemory && !chosenNames.has('supabase/supabase') && selections.length < brief.maxRepos) {
    const repo = REPO_CATALOG.find(item => item.fullName === 'supabase/supabase')
    if (repo) {
      chosenNames.add(repo.fullName)
      selections.push({
        name: repo.fullName,
        role: 'storage',
        url: repo.url,
        description: repo.description,
        reason: `Pairs relational case state with vector retrieval so ${blueprint.productName} can persist both workflow records and operational state.`,
        tags: repo.tags,
        maturity: repo.maturity,
        active_signal: repo.activeSignal,
        stars: null,
      })
    }
  }

  if (brief.isRegulated && selections.length < brief.maxRepos) {
    const repo = chooseRepo('security', brief, chosenNames)
    if (repo) {
      chosenNames.add(repo.fullName)
      selections.push({
        name: repo.fullName,
        role: 'security',
        url: repo.url,
        description: repo.description,
        reason: `Adds SSO, RBAC, and audit-friendly identity controls required for ${brief.industry} workflows.`,
        tags: repo.tags,
        maturity: repo.maturity,
        active_signal: repo.activeSignal,
        stars: null,
      })
    }
  }

  if (brief.fields.includes('devops') && selections.length < brief.maxRepos && !chosenNames.has('open-telemetry/opentelemetry-collector')) {
    const repo = REPO_CATALOG.find(item => item.fullName === 'open-telemetry/opentelemetry-collector')
    if (repo) {
      chosenNames.add(repo.fullName)
      selections.push({
        name: repo.fullName,
        role: 'monitoring',
        url: repo.url,
        description: repo.description,
        reason: `Complements dashboard monitoring with a telemetry backbone for traces, metrics, and logs.`,
        tags: repo.tags,
        maturity: repo.maturity,
        active_signal: repo.activeSignal,
        stars: null,
      })
    }
  }

  const limited = selections.slice(0, brief.maxRepos)
  return hydrateRepoStars(limited)
}

function reposForRole(selected: SelectedRepo[], role: RepoRole): SelectedRepo[] {
  return selected.filter(repo => repo.role === role)
}

function buildArchitecture(selected: SelectedRepo[], blueprint: ProductBlueprint): { nodes: ArchitectureNode[]; edges: ArchitectureEdge[] } {
  const nodes: ArchitectureNode[] = [
    {
      id: 'user_input',
      label: 'User Input',
      role: 'input',
      component: 'Case intake event',
      repos: [],
    },
    {
      id: 'interface',
      label: 'Interface',
      role: 'interface',
      component: 'Operator workspace and case review UI',
      repos: reposForRole(selected, 'interface').map(repo => repo.name),
    },
    {
      id: 'agent',
      label: 'Agent',
      role: 'agent',
      component: 'Case understanding and decision agent',
      repos: reposForRole(selected, 'agent').map(repo => repo.name),
    },
    {
      id: 'planner',
      label: 'Planner',
      role: 'planner',
      component: 'Structured workflow planner',
      repos: reposForRole(selected, 'orchestration').map(repo => repo.name),
    },
    {
      id: 'workflow',
      label: 'Workflow',
      role: 'workflow',
      component: 'Durable workflow and SLA engine',
      repos: reposForRole(selected, 'workflow').map(repo => repo.name),
    },
    {
      id: 'execution',
      label: 'Execution',
      role: 'execution',
      component: 'Task runner and external system automation',
      repos: reposForRole(selected, 'execution').map(repo => repo.name),
    },
    {
      id: 'storage',
      label: 'Storage',
      role: 'storage',
      component: 'Operational state and evidence store',
      repos: reposForRole(selected, 'storage').map(repo => repo.name),
    },
    {
      id: 'monitoring',
      label: 'Monitoring',
      role: 'monitoring',
      component: 'Run health, audit, and KPI visibility',
      repos: reposForRole(selected, 'monitoring').map(repo => repo.name),
    },
    {
      id: 'output',
      label: 'Output',
      role: 'output',
      component: blueprint.finalOutput,
      repos: [],
    },
  ]

  if (reposForRole(selected, 'security').length > 0) {
    nodes.splice(7, 0, {
      id: 'security',
      label: 'Security',
      role: 'security',
      component: 'Identity, access control, and audit policy',
      repos: reposForRole(selected, 'security').map(repo => repo.name),
    })
  }

  const edges: ArchitectureEdge[] = [
    {
      from: 'user_input',
      to: 'interface',
      type: 'data_flow',
      description: 'Operators submit or review a case.',
    },
    {
      from: 'user_input',
      to: 'agent',
      type: 'data_flow',
      description: 'Raw work item enters the AI reasoning layer.',
    },
    {
      from: 'interface',
      to: 'agent',
      type: 'control_flow',
      description: 'Human context and overrides are passed to the agent.',
    },
    {
      from: 'agent',
      to: 'planner',
      type: 'data_flow',
      description: 'The agent emits a structured plan request.',
    },
    {
      from: 'planner',
      to: 'workflow',
      type: 'control_flow',
      description: 'The planner translates intent into durable workflow state.',
    },
    {
      from: 'workflow',
      to: 'execution',
      type: 'control_flow',
      description: 'Workflow steps dispatch execution jobs.',
    },
    {
      from: 'execution',
      to: 'storage',
      type: 'data_flow',
      description: 'Execution writes evidence, state changes, and outputs.',
    },
    {
      from: 'storage',
      to: 'output',
      type: 'data_flow',
      description: 'Stored results are exposed through dashboards, APIs, and notifications.',
    },
    {
      from: 'workflow',
      to: 'monitoring',
      type: 'data_flow',
      description: 'Workflow state and SLA signals feed operational monitoring.',
    },
    {
      from: 'execution',
      to: 'monitoring',
      type: 'data_flow',
      description: 'Execution traces and failure signals feed observability.',
    },
  ]

  if (nodes.some(node => node.id === 'security')) {
    edges.push({
      from: 'security',
      to: 'interface',
      type: 'control_flow',
      description: 'Access policy and identity enforcement protect the operator surface.',
    })
    edges.push({
      from: 'security',
      to: 'workflow',
      type: 'control_flow',
      description: 'Role-based approvals gate sensitive workflow actions.',
    })
  }

  return { nodes, edges }
}

function buildContracts(blueprint: ProductBlueprint, selected: SelectedRepo[]): Record<string, NodeContract> {
  const securityEnabled = reposForRole(selected, 'security').length > 0

  return {
    user_input: {
      input: {
        type: 'json',
        schema: blueprint.caseSchema,
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['case_payload', 'submitted_by'],
          properties: {
            case_payload: blueprint.caseSchema,
            submitted_by: { type: 'string' },
            channel: { type: 'string' },
          },
        },
      },
    },
    interface: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['case_payload', 'submitted_by'],
          properties: {
            case_payload: blueprint.caseSchema,
            submitted_by: { type: 'string' },
            draft_notes: { type: 'string' },
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['case_payload', 'operator_context'],
          properties: {
            case_payload: blueprint.caseSchema,
            operator_context: {
              type: 'object',
              properties: {
                assignee: { type: 'string' },
                priority_override: { type: 'string' },
              },
            },
          },
        },
      },
    },
    agent: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['case_payload'],
          properties: {
            case_payload: blueprint.caseSchema,
            operator_context: { type: 'object' },
            retrieval_context: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['case_summary', 'proposed_plan'],
          properties: {
            case_summary: { type: 'string' },
            proposed_plan: blueprint.planSchema,
            confidence: { type: 'number' },
            citations: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    planner: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['case_summary', 'proposed_plan'],
          properties: {
            case_summary: { type: 'string' },
            proposed_plan: blueprint.planSchema,
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['workflow_id', 'jobs'],
          properties: {
            workflow_id: { type: 'string' },
            jobs: { type: 'array', items: blueprint.executionSchema },
            retry_policy: { type: 'string' },
          },
        },
      },
    },
    workflow: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['workflow_id', 'jobs'],
          properties: {
            workflow_id: { type: 'string' },
            jobs: { type: 'array', items: blueprint.executionSchema },
            approval_token: securityEnabled ? { type: 'string' } : { type: 'null' },
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['workflow_id', 'dispatch_batch'],
          properties: {
            workflow_id: { type: 'string' },
            dispatch_batch: { type: 'array', items: blueprint.executionSchema },
            sla_due_at: { type: 'string' },
          },
        },
      },
    },
    execution: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['dispatch_batch'],
          properties: {
            dispatch_batch: { type: 'array', items: blueprint.executionSchema },
            execution_context: { type: 'object' },
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['execution_results'],
          properties: {
            execution_results: { type: 'array', items: blueprint.outputSchema },
            error_events: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    storage: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['execution_results'],
          properties: {
            execution_results: { type: 'array', items: blueprint.outputSchema },
            event_log: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['record_ids', 'materialized_output'],
          properties: {
            record_ids: { type: 'array', items: { type: 'string' } },
            materialized_output: blueprint.outputSchema,
            dashboard_projection_uri: { type: 'string' },
          },
        },
      },
    },
    monitoring: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['workflow_metrics'],
          properties: {
            workflow_metrics: { type: 'array', items: { type: 'string' } },
            error_events: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['dashboards', 'alerts'],
          properties: {
            dashboards: { type: 'array', items: { type: 'string' } },
            alerts: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    output: {
      input: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['materialized_output'],
          properties: {
            materialized_output: blueprint.outputSchema,
            dashboard_projection_uri: { type: 'string' },
          },
        },
      },
      output: {
        type: 'json',
        schema: {
          type: 'object',
          required: ['delivery_channel', 'result'],
          properties: {
            delivery_channel: { type: 'string', enum: ['dashboard', 'api', 'automation'] },
            result: blueprint.outputSchema,
          },
        },
      },
    },
  }
}

function buildScores(selected: SelectedRepo[], brief: NormalizedBrief): ProductSystemOutput['scores'] {
  const coveredRoles = new Set(selected.map(repo => repo.role))
  const requiredRoles: RepoRole[] = ['interface', 'agent', 'orchestration', 'workflow', 'execution', 'storage', 'monitoring']
  if (brief.isRegulated) requiredRoles.push('security')

  const coverage = Math.round((requiredRoles.filter(role => coveredRoles.has(role)).length / requiredRoles.length) * 100)

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

function buildCompositionExplanation(
  blueprint: ProductBlueprint,
  selected: SelectedRepo[],
  brief: NormalizedBrief,
  scores: ProductSystemOutput['scores']
): string {
  const roleLines = ROLE_ORDER
    .map(role => {
      const repos = reposForRole(selected, role)
      if (repos.length === 0) return null
      return `${role}: ${repos.map(repo => repo.name).join(', ')}`
    })
    .filter(Boolean)
    .join('; ')

  const securityLine = reposForRole(selected, 'security').length > 0
    ? ` Security is enforced by ${reposForRole(selected, 'security').map(repo => repo.name).join(', ')}.`
    : ''

  return `${blueprint.productName} is composed as a layered operations system. ${roleLines}. The interface captures cases, the agent structures the work item, the planner turns it into a durable workflow, the execution layer performs integrations and automation, storage preserves evidence and state, and monitoring exposes reliability plus business KPIs.${securityLine} This stack scores ${scores.coherence}/100 on coherence because the control-plane layers are separated cleanly, required roles are covered, and the selected repositories are mature production frameworks rather than tutorials or list repos.`
}

function makeBuildStarter(selected: SelectedRepo[], blueprint: ProductBlueprint): ProductSystemOutput['build_starter'] {
  const roleRepo = (role: RepoRole) => reposForRole(selected, role).map(repo => repo.name).join(', ')

  return {
    folder_structure: [
      { path: 'apps/web', purpose: 'Operator dashboard, intake forms, review queues, and reporting surfaces.' },
      { path: 'apps/api', purpose: 'Typed API for case intake, status queries, and downstream integrations.' },
      { path: 'apps/worker', purpose: 'Workflow workers, execution jobs, and scheduled maintenance tasks.' },
      { path: 'packages/contracts', purpose: 'Shared JSON schemas and TypeScript types for every node contract.' },
      { path: 'packages/agents', purpose: 'Agent prompts, tool adapters, and retrieval policies.' },
      { path: 'packages/workflows', purpose: 'Planner graph definitions and long-running workflow specs.' },
      { path: 'packages/execution', purpose: 'Execution adapters for APIs, browser automation, and write-backs.' },
      { path: 'infra/docker', purpose: 'Local compose stack for app, workflow, storage, and monitoring services.' },
    ],
    services: [
      { name: 'web', responsibility: 'Case intake, reviewer workbench, and KPI dashboards.', repo: roleRepo('interface') },
      { name: 'agent-runtime', responsibility: 'Case understanding, tool selection, and decision support.', repo: roleRepo('agent') },
      { name: 'planner', responsibility: 'Stateful plan generation and orchestration graph control.', repo: roleRepo('orchestration') },
      { name: 'workflow-engine', responsibility: 'Durable execution state, retries, timers, and approvals.', repo: roleRepo('workflow') },
      { name: 'executor', responsibility: 'Runs background tasks, automations, and external system actions.', repo: roleRepo('execution') },
      { name: 'data-plane', responsibility: 'Persists cases, evidence, outputs, and retrieval indexes.', repo: roleRepo('storage') },
      { name: 'observability', responsibility: 'Dashboards, alerts, traces, and operational audit views.', repo: roleRepo('monitoring') },
      ...(reposForRole(selected, 'security').length > 0
        ? [{ name: 'identity', responsibility: 'SSO, RBAC, and audit-friendly access control.', repo: roleRepo('security') }]
        : []),
    ],
    implementation_steps: [
      `Create the monorepo skeleton and publish the shared contracts first so every service aligns to the same schemas.`,
      `Stand up ${roleRepo('storage')} for durable state and connect ${roleRepo('interface')} to the intake API.`,
      `Implement the agent runtime on ${roleRepo('agent')} and make it emit planner-ready JSON that matches the contracts package.`,
      `Model the planner and durable workflow states with ${roleRepo('orchestration')} plus ${roleRepo('workflow')}.`,
      `Wire ${roleRepo('execution')} into the workflow engine for side effects, retries, and human escalation checkpoints.`,
      `Add business dashboards and operational alerting with ${roleRepo('monitoring')} before production rollout.`,
      `Seed realistic cases for ${blueprint.productName}, validate end-to-end DAG execution, then canary the system with a review queue.`,
    ],
    validation_checks: [
      'Required roles present: agent, orchestration, execution, workflow, storage, interface, monitoring.',
      'DAG includes User Input -> Agent -> Planner -> Execution -> Output.',
      'Every node has explicit input and output schemas.',
      'Selected repositories are framework-grade building blocks, not tutorials or awesome lists.',
    ],
  }
}

export function resolveFactoryIdea(input: { industry?: string; idea?: string; fields?: string[] }): string {
  const idea = input.idea?.trim()
  if (idea) return idea

  const industry = input.industry?.trim() || 'general business'
  const fieldText = (input.fields || []).filter(Boolean).join(', ')
  return fieldText
    ? `${toTitleCase(industry)} workflow platform with ${fieldText}`
    : `${toTitleCase(industry)} workflow orchestration platform`
}

export async function composeProductSystem(input: ProductSystemRequest): Promise<ProductSystemOutput> {
  const parsed = ProductSystemRequestSchema.parse(input)
  const brief = normalizeBrief(parsed)
  const blueprint = buildBlueprint(brief)
  const selected = await selectRepos(brief, blueprint)
  const architecture = buildArchitecture(selected, blueprint)
  const contracts = buildContracts(blueprint, selected)
  const scores = buildScores(selected, brief)
  const compositionExplanation = buildCompositionExplanation(blueprint, selected, brief, scores)
  const starter = makeBuildStarter(selected, blueprint)

  return {
    product_name: blueprint.productName,
    industry: brief.industry,
    problem: blueprint.problem,
    solution: blueprint.solution,
    selected_repos: selected,
    architecture,
    contracts,
    scores,
    composition_explanation: compositionExplanation,
    final_output: `${blueprint.finalOutput} ${blueprint.userOutcome}`,
    build_starter: starter,
  }
}
