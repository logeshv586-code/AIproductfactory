/**
 * AI OS — Controller
 * Graph + state engine · orchestrates all layers
 * Ported from controller.py — full pipeline integration
 */
import { getMemory } from './core/rag-memory'
import { ProbabilityEngine } from './core/probability-engine'
import { IdeaExpander } from './core/idea-expander'
import { SignalCollector } from './core/signal-collector'
import { MCPRegistry, makeGitHubSearchTool, makeWebSearchTool, makeRAGQueryTool } from './mcp/registry'
import { PlannerAgent, SystemDesignerAgent, RepoComposerAgent, CodeGeneratorAgent } from './agents/pipeline'
import type { ExpandedIdea } from './core/idea-expander'
import type { ProbabilityScore } from './core/probability-engine'
import type { SignalBundle, RepoCandidate } from './core/signal-collector'
import type { DAG, SystemArchitecture, IntegrationPlan, GeneratedComponent } from './agents/pipeline'
import { db } from '@/lib/db'
import fs from 'fs'
import path from 'path'

// ── State ─────────────────────────────────────────────────────────────────────

export interface FactoryState {
  buildId: string
  idea: string
  status: string
  probScore: ProbabilityScore | null
  expandedIdea: ExpandedIdea | null
  signals: SignalBundle | null
  repoProfiles: any[]
  dag: DAG | null
  architecture: SystemArchitecture | null
  integrationPlan: IntegrationPlan | null
  generatedComponents: GeneratedComponent[]
  testResult: { passed: boolean; details: string } | null
  fixResult: { success: boolean; attempts: number; fixedComponents: GeneratedComponent[] } | null
  outputPath: string
  errors: string[]
  timeline: { step: string; ts: number; detail: string }[]
}

function createInitialState(idea: string): FactoryState {
  return {
    buildId: `build_${Date.now().toString(36)}`,
    idea,
    status: 'init',
    probScore: null,
    expandedIdea: null,
    signals: null,
    repoProfiles: [],
    dag: null,
    architecture: null,
    integrationPlan: null,
    generatedComponents: [],
    testResult: null,
    fixResult: null,
    outputPath: '',
    errors: [],
    timeline: [],
  }
}

// ── Controller ────────────────────────────────────────────────────────────────

export class AIProductFactory {
  private memory = getMemory()
  private registry = new MCPRegistry()
  private probEngine = new ProbabilityEngine()
  private ideaExpander = new IdeaExpander()
  private signalCollector: SignalCollector
  private planner = new PlannerAgent()
  private systemDesigner = new SystemDesignerAgent()
  private repoComposer = new RepoComposerAgent()
  private codeGenerator = new CodeGeneratorAgent()
  private outputDir: string

  constructor(outputDir?: string) {
    this.outputDir = outputDir || path.join(process.cwd(), '.factory_output')

    // Register MCP tools
    this.registry.register(makeGitHubSearchTool())
    this.registry.register(makeWebSearchTool())
    this.registry.register(makeRAGQueryTool(this.memory))

    this.signalCollector = new SignalCollector()
  }

  // ── Main entry point ──────────────────────────────────────────────────────

  async build(idea: string, maxRepos = 3, onProgress?: (state: FactoryState) => void): Promise<FactoryState> {
    const state = createInitialState(idea)
    const log = (step: string, detail = '') => {
      state.timeline.push({ step, ts: Date.now(), detail })
      console.log(`[Controller] ▶ ${step}${detail ? ` — ${detail}` : ''}`)
      onProgress?.(state)
    }

    try {
      // 1. Probability scoring
      state.status = 'scoring'
      log('ProbabilityEngine', 'Scoring feasibility, novelty, demand')
      const ragCtx = this.memory.recallContext(idea, 3)
      const ctxStr = JSON.stringify(ragCtx)
      state.probScore = await this.probEngine.score(idea, ctxStr)
      this.memory.store('prob_weight', `score:${state.buildId}`, {
        composite: state.probScore.composite,
        idea: idea.slice(0, 100),
      })

      // 2. Idea expansion
      state.status = 'expanding'
      log('IdeaExpander', 'Expanding market, users, features, USP')
      state.expandedIdea = await this.ideaExpander.expand(idea, state.probScore)
      this.memory.storeIdea(state.buildId, {
        idea,
        expanded: state.expandedIdea.raw,
        prob: state.probScore.composite,
      })

      // 3. Signal collection
      state.status = 'collecting_signals'
      log('SignalCollector', 'web + github + RAG')
      state.signals = await this.signalCollector.collectAll(idea, state.expandedIdea)

      // 4. Build repo profiles from signal results
      state.status = 'profiling_repos'
      log('RepoProfiling', `Processing top ${maxRepos} repos`)
      const topRepos = state.signals.repoCandidates.slice(0, maxRepos)
      state.repoProfiles = topRepos.map(repo => ({
        fullName: repo.fullName,
        language: repo.language || 'unknown',
        summary: repo.description,
        entryPoints: [],
        publicApi: [],
        relevanceScore: repo.relevanceScore,
        reason: repo.reason,
        url: repo.url,
        cloneUrl: repo.cloneUrl,
        stars: repo.stars,
        topics: repo.topics || [],
      }))

      // Store repo knowledge
      for (const profile of state.repoProfiles) {
        this.memory.storeRepo(profile.fullName, {
          summary: profile.summary,
          language: profile.language,
          relevanceScore: profile.relevanceScore,
        })
      }

      // 5. Planner — build DAG
      state.status = 'planning'
      log('PlannerAgent (DeerFlow)', 'Building dynamic task DAG')
      state.dag = await this.planner.buildDag(state.expandedIdea, state.probScore)

      // 6. System designer
      state.status = 'designing'
      log('SystemDesignerAgent', 'Designing architecture')
      state.architecture = await this.systemDesigner.design(
        state.expandedIdea,
        state.repoProfiles,
        state.signals.ragContext
      )

      // 7. Repo composer
      state.status = 'composing'
      log('RepoComposerAgent', 'Creating integration plan')
      state.integrationPlan = await this.repoComposer.compose(
        state.architecture,
        state.repoProfiles
      )

      // 8. Code generator
      state.status = 'generating'
      log('CodeGeneratorAgent', `Generating ${state.architecture.components.length} components`)
      state.generatedComponents = await this.codeGenerator.generateAll(
        state.architecture,
        state.integrationPlan,
        state.expandedIdea
      )

      // 9. Output scaffold
      state.status = 'scaffolding'
      log('OutputScaffold', 'Writing output files')
      state.outputPath = this.writeScaffold(state)

      // 10. Feedback loop → Probability Engine
      state.status = 'feedback'
      log('FeedbackLoop', 'Updating probability weights')
      const feedback = {
        feasibility: 0.85,
        novelty: state.probScore.novelty,
        demand: state.probScore.demand,
      }
      this.probEngine.updateWeights(feedback)

      // Save build to memory
      this.memory.storeBuild(state.buildId, {
        idea,
        status: 'complete',
        outputPath: state.outputPath,
        components: state.generatedComponents.map(c => c.filename),
        probScore: state.probScore.composite,
      })

      // Save to database
      await this.saveToDatabase(state)

      state.status = 'complete'
      log('DONE', `output → ${state.outputPath}`)
    } catch (error: any) {
      state.status = 'error'
      state.errors.push(error.message)
      console.error('[Controller] FATAL:', error)
    }

    return state
  }

  // ── Output scaffold writer ────────────────────────────────────────────────

  private writeScaffold(state: FactoryState): string {
    const buildDir = path.join(this.outputDir, state.buildId)
    const srcDir = path.join(buildDir, 'src')
    fs.mkdirSync(srcDir, { recursive: true })

    // Write generated component files
    for (const comp of state.generatedComponents) {
      const fpath = path.join(srcDir, comp.filename)
      fs.mkdirSync(path.dirname(fpath), { recursive: true })
      fs.writeFileSync(fpath, comp.code)
    }

    // Write architecture doc
    if (state.architecture) {
      const archMd = `# Architecture — ${state.idea.slice(0, 60)}

## Components
${state.architecture.components.map(c => `- **${c.name}** (${c.tech}): ${c.role}`).join('\n')}

## Data Flows
${state.architecture.dataFlows.map(d => `- ${d.from} → ${d.to}: ${d.data}`).join('\n')}

## Tech Stack
${state.architecture.techStack.join(', ')}

## Deployment
${state.architecture.deployment}

## Overview
${state.architecture.diagramDescription}
`
      fs.writeFileSync(path.join(buildDir, 'ARCHITECTURE.md'), archMd)
    }

    // Write integration plan
    if (state.integrationPlan) {
      const configNote = state.integrationPlan.configFiles.map(c => `- ${c}`).join('\n')
      const glueNote = state.integrationPlan.glueCodeNeeded.map(g => `- ${g}`).join('\n')
      fs.writeFileSync(path.join(buildDir, 'INTEGRATION.md'), `# Integration Plan\n\n## Config files needed\n${configNote}\n\n## Glue code needed\n${glueNote}`)
    }

    // Write pipeline metadata
    const meta = {
      buildId: state.buildId,
      idea: state.idea,
      probScore: state.probScore ? {
        feasibility: state.probScore.feasibility,
        novelty: state.probScore.novelty,
        demand: state.probScore.demand,
        composite: state.probScore.composite,
      } : null,
      reposUsed: state.repoProfiles.map(r => r.fullName),
      components: state.generatedComponents.map(c => c.filename),
      timeline: state.timeline,
    }
    fs.writeFileSync(path.join(buildDir, 'pipeline.json'), JSON.stringify(meta, null, 2))

    console.log(`[Controller] scaffold written to ${buildDir}`)
    return buildDir
  }

  // ── Database persistence ──────────────────────────────────────────────────

  private async saveToDatabase(state: FactoryState): Promise<void> {
    try {
      // Save as a product idea with all pipeline data
      await db.productIdea.create({
        data: {
          title: state.idea.slice(0, 100),
          tagline: state.expandedIdea?.usp || state.idea,
          description: JSON.stringify({
            idea: state.idea,
            expandedIdea: state.expandedIdea,
            architecture: state.architecture,
            integrationPlan: state.integrationPlan,
            dag: state.dag,
            timeline: state.timeline,
            probScore: state.probScore,
            repoProfiles: state.repoProfiles,
          }),
          targetAudience: state.expandedIdea?.targetUsers.join(', ') || '',
          keyFeatures: JSON.stringify(state.expandedIdea?.features || []),
          techStack: JSON.stringify(state.architecture?.techStack || []),
          marketPotential: (state.probScore?.composite || 0) > 0.6 ? 'high' : (state.probScore?.composite || 0) > 0.4 ? 'medium' : 'low',
          difficulty: 'advanced',
          monetization: JSON.stringify(state.integrationPlan?.configFiles || []),
          uniqueValue: state.expandedIdea?.usp || '',
          strategy: 'ai-product-factory',
          status: state.status,
          rating: Math.round((state.probScore?.composite || 0) * 5),
          notes: `Build ID: ${state.buildId}`,
        },
      })
    } catch (err) {
      console.error('[Controller] DB save error:', err)
    }
  }
}
