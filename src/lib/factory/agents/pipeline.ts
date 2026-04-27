/**
 * Agent Pipeline — Planner · System Designer · Repo Composer · Code Generator
 * Ported from agents.py
 */
import { llm } from '@/llm/provider'
import { z } from 'zod'
import type { ProbabilityScore } from '../core/probability-engine'
import type { ExpandedIdea } from '../core/idea-expander'

// ── Data models ───────────────────────────────────────────────────────────────

export interface DAGTask {
  id: string
  name: string
  dependsOn: string[]
  agent: string
  inputs: Record<string, any>
  priority: number
}

export interface DAG {
  tasks: DAGTask[]
}

export interface SystemArchitecture {
  components: { name: string; role: string; tech: string; interface: string }[]
  dataFlows: { from: string; to: string; data: string }[]
  techStack: string[]
  deployment: string
  diagramDescription: string
}

export interface IntegrationPlan {
  steps: { order: number; action: string; file: string; detail: string }[]
  repoRoles: Record<string, string>
  glueCodeNeeded: string[]
  configFiles: string[]
}

export interface GeneratedComponent {
  name: string
  filename: string
  language: string
  code: string
  description: string
}

// ── Planner Agent ─────────────────────────────────────────────────────────────

const DAGSchema = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    name: z.string(),
    depends_on: z.array(z.string()),
    agent: z.string(),
    inputs: z.record(z.string(), z.any()),
    priority: z.number()
  }))
})

export class PlannerAgent {
  async buildDag(expanded: ExpandedIdea, probScore: ProbabilityScore): Promise<DAG> {
    try {
      const data = await llm.generateJSON(
        DAGSchema,
        `IDEA: ${expanded.original}\nMARKET: ${expanded.market}\nFEATURES: ${expanded.features.join(', ')}\nUSP: ${expanded.usp}\nSTACK: ${expanded.suggestedStack.join(', ')}\nPROB composite=${probScore.composite}\nDIRECTIVES: ${probScore.directives.join(', ')}`,
        `You are a DeerFlow-style planner for an AI product factory.
Given an expanded product idea and probability directives, build a task DAG.

Start with a system_designer task with no dependencies.
Then repo_composer (depends on system_designer).
Then code_generator tasks per component (depends on repo_composer).
Then test_agent (depends on all code_generator tasks).
Then fix_agent (depends on test_agent).
Be specific about inputs.`,
        { profile: 'reasoning', temperature: 0.5 }
      )

      const tasks: DAGTask[] = (data.tasks || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        dependsOn: t.depends_on || [],
        agent: t.agent,
        inputs: t.inputs || {},
        priority: t.priority || 0,
      }))

      console.log(`[Planner] DAG has ${tasks.length} tasks`)
      return { tasks }
    } catch (error) {
      console.error('[Planner] error:', error)
      // Fallback DAG
      return {
        tasks: [
          { id: 'arch', name: 'Design Architecture', dependsOn: [], agent: 'system_designer', inputs: {}, priority: 10 },
          { id: 'compose', name: 'Compose Repos', dependsOn: ['arch'], agent: 'repo_composer', inputs: {}, priority: 8 },
          { id: 'gen1', name: 'Generate Core Module', dependsOn: ['compose'], agent: 'code_generator', inputs: {}, priority: 7 },
          { id: 'gen2', name: 'Generate API Layer', dependsOn: ['compose'], agent: 'code_generator', inputs: {}, priority: 6 },
          { id: 'test', name: 'Run Tests', dependsOn: ['gen1', 'gen2'], agent: 'test_agent', inputs: {}, priority: 5 },
        ],
      }
    }
  }
}

// ── System Designer Agent ────────────────────────────────────────────────────

const ArchitectureSchema = z.object({
  components: z.array(z.object({
    name: z.string(),
    role: z.string(),
    tech: z.string(),
    interface: z.string()
  })),
  data_flows: z.array(z.object({
    from: z.string(),
    to: z.string(),
    data: z.string()
  })),
  tech_stack: z.array(z.string()),
  deployment: z.string(),
  diagram_description: z.string()
})

export class SystemDesignerAgent {
  async design(expanded: ExpandedIdea, repoProfiles: any[], ragContext: any[]): Promise<SystemArchitecture> {
    try {
      const reposSummary = repoProfiles.map(r => ({
        name: r.fullName,
        summary: r.summary,
        api: (r.publicApi || []).slice(0, 3),
      }))

      const data = await llm.generateJSON(
        ArchitectureSchema,
        `IDEA: ${expanded.original}\nFEATURES: ${expanded.features.join(', ')}\nUSP: ${expanded.usp}\nAVAILABLE REPOS:\n${JSON.stringify(reposSummary, null, 2)}\nRAG CONTEXT (past builds):\n${JSON.stringify(ragContext.slice(0, 3), null, 2)}`,
        `You are a senior software architect inside an AI product factory.
Given an expanded product idea and relevant repos, design the system architecture.`,
        { profile: 'reasoning', temperature: 0.6 }
      )

      const arch: SystemArchitecture = {
        components: data.components || [],
        dataFlows: data.data_flows || [],
        techStack: data.tech_stack || [],
        deployment: data.deployment || 'docker-compose',
        diagramDescription: data.diagram_description || '',
      }

      console.log(`[SystemDesigner] components: ${arch.components.map(c => c.name).join(', ')}`)
      return arch
    } catch (error) {
      console.error('[SystemDesigner] error:', error)
      return {
        components: [
          { name: 'Core Engine', role: 'Main processing', tech: 'TypeScript', interface: 'api' },
          { name: 'API Gateway', role: 'Request handling', tech: 'Next.js', interface: 'rest' },
          { name: 'Data Layer', role: 'Persistence', tech: 'Prisma', interface: 'lib' },
        ],
        dataFlows: [
          { from: 'API Gateway', to: 'Core Engine', data: 'Requests' },
          { from: 'Core Engine', to: 'Data Layer', data: 'State' },
        ],
        techStack: ['TypeScript', 'Next.js', 'Prisma'],
        deployment: 'docker-compose',
        diagramDescription: 'Three-tier architecture with API Gateway, Core Engine, and Data Layer',
      }
    }
  }
}

// ── Repo Composer Agent ──────────────────────────────────────────────────────

const IntegrationPlanSchema = z.object({
  steps: z.array(z.object({
    order: z.number(),
    action: z.string(),
    file: z.string(),
    detail: z.string()
  })),
  repo_roles: z.record(z.string(), z.string()),
  glue_code_needed: z.array(z.string()),
  config_files: z.array(z.string())
})

export class RepoComposerAgent {
  async compose(architecture: SystemArchitecture, repoProfiles: any[]): Promise<IntegrationPlan> {
    try {
      const reposInfo = repoProfiles.map(r => ({
        name: r.fullName,
        language: r.language,
        entryPoints: r.entryPoints || [],
        api: r.publicApi || [],
      }))

      const data = await llm.generateJSON(
        IntegrationPlanSchema,
        `ARCHITECTURE:\n${JSON.stringify({ components: architecture.components, dataFlows: architecture.dataFlows }, null, 2)}\n\nREPOS:\n${JSON.stringify(reposInfo, null, 2)}`,
        `You are a repo integration specialist.
Given an architecture and available repos, create a detailed integration plan.`,
        { temperature: 0.5 }
      )

      const plan: IntegrationPlan = {
        steps: data.steps || [],
        repoRoles: (data.repo_roles as Record<string, string>) || {},
        glueCodeNeeded: data.glue_code_needed || [],
        configFiles: data.config_files || [],
      }

      console.log(`[RepoComposer] ${plan.steps.length} steps, ${plan.glueCodeNeeded.length} glue modules`)
      return plan
    } catch (error) {
      console.error('[RepoComposer] error:', error)
      return {
        steps: [{ order: 1, action: 'Initialize project structure', file: 'package.json', detail: 'Create Next.js project' }],
        repoRoles: {},
        glueCodeNeeded: ['Integration adapter'],
        configFiles: ['package.json', '.env.example'],
      }
    }
  }
}

// ── Code Generator Agent ────────────────────────────────────────────────────

const GeneratedComponentSchema = z.object({
  filename: z.string(),
  language: z.string(),
  code: z.string(),
  description: z.string()
})

export class CodeGeneratorAgent {
  async generate(
    component: { name: string; role: string; tech: string; interface: string },
    architecture: SystemArchitecture,
    integrationPlan: IntegrationPlan,
    expanded?: ExpandedIdea
  ): Promise<GeneratedComponent> {
    try {
      const data = await llm.generateJSON(
        GeneratedComponentSchema,
        `COMPONENT TO BUILD:\n${JSON.stringify(component, null, 2)}\n\nFULL ARCHITECTURE:\n${architecture.diagramDescription}\nTECH STACK: ${architecture.techStack.join(', ')}\n\nINTEGRATION STEPS:\n${JSON.stringify(integrationPlan.steps.slice(0, 5), null, 2)}\n\nGLUE CODE NEEDED: ${integrationPlan.glueCodeNeeded.join(', ')}`,
        `You are an expert software engineer. Generate clean, production-ready code for a single component of the product.
Include proper imports, type hints, docstrings, and error handling.`,
        { temperature: 0.4 }
      )

      const gen: GeneratedComponent = {
        name: component.name,
        filename: data.filename || `${component.name.toLowerCase().replace(/\s+/g, '_')}.ts`,
        language: data.language || component.tech,
        code: data.code || `// Generated ${component.name}`,
        description: data.description || component.role,
      }

      console.log(`[CodeGenerator] generated ${gen.filename} (${gen.code.length} chars)`)
      return gen
    } catch (error) {
      console.error('[CodeGenerator] error:', error)
      return {
        name: component.name,
        filename: `${component.name.toLowerCase().replace(/\s+/g, '_')}.ts`,
        language: component.tech || 'typescript',
        code: `// ${component.name} - ${component.role}\n// Generated by AI Product Factory\n\nexport class ${component.name.replace(/\s+/g, '')} {\n  // TODO: Implement\n}\n`,
        description: component.role,
      }
    }
  }

  async generateAll(
    architecture: SystemArchitecture,
    integrationPlan: IntegrationPlan,
    expanded?: ExpandedIdea
  ): Promise<GeneratedComponent[]> {
    const components: GeneratedComponent[] = []
    for (const comp of architecture.components) {
      try {
        const gen = await this.generate(comp, architecture, integrationPlan, expanded)
        components.push(gen)
      } catch (e) {
        console.error(`[CodeGenerator] error for ${comp.name}:`, e)
      }
    }
    return components
  }
}
