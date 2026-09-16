import { z } from 'zod'
import { buildProductCompositionPlan } from '@/lib/agents/composition-plan'
import type { PipelineMode } from '@/lib/factory/pipeline-run'
import type { TimelineEntry } from './schemas'
import { normalizeArchitecture, normalizePipelineScores, deriveReposForProduct } from './utils'

export function normalizePythonResult(result: any, requestId: string, runId: string | null, mode: PipelineMode, buildId: string) {
  const normalizedRepoProfiles = (result.selected_repos || []).map((r: any) => ({
    fullName: r.name,
    stars: r.stars || 0,
    language: r.language || '',
    summary: r.description || '',
    relevanceScore: r.relevance_score || 0,
    reason: r.selection_reasoning || '',
    role: r.suggested_role || r.capability || '',
  }))

  return {
    success: true,
    requestId,
    runId,
    mode,
    buildId,
    status: 'completed',
    source: 'python-core',
    currentStep: 'completed',
    progress: 100,
    intent: result.intent,
    probScore: {
      feasibility: 0.72,
      novelty: 0.65,
      demand: 0.78,
      composite: 0.72,
      directives: result.intent?.required_capabilities || [],
      rationale: result.intent?.description || '',
    },
    expandedIdea: {
      market: result.intent?.domain || '',
      targetUsers: ['Developers', 'Tech startups'],
      features: result.composed_products?.[0]?.key_features || [],
      usp: result.composed_products?.[0]?.description || '',
      risks: ['Market competition', 'Technical complexity'],
      suggestedStack: result.composed_products?.[0]?.architecture?.tech_stack || result.composed_products?.[0]?.architecture?.techStack || [],
    },
    repoProfiles: normalizedRepoProfiles.map((r: any) => ({
      fullName: r.fullName,
      stars: r.stars,
      language: r.language,
      summary: r.summary,
      relevanceScore: r.relevanceScore,
      reason: r.reason,
    })),
    architecture: normalizeArchitecture(result.composed_products?.[0]?.architecture),
    integrationPlan: null,
    generatedComponents: [],
    graphData: result.capability_graph_engine
      ? { nodes: result.capability_graph_engine.nodes || [], edges: result.capability_graph_engine.edges || [] }
      : result.graphify_nodes_and_edges || { nodes: [], edges: [] },
    graphStats: result.capability_graph_engine?.stats || result.graph_stats || { total_nodes: 0, total_edges: 0, node_types: {}, edge_types: {} },
    composedProducts: (result.composed_products || []).map((p: any) => {
      const productRepos = deriveReposForProduct(p, normalizedRepoProfiles)
      const compositionPlan = buildProductCompositionPlan({
        productTitle: p.name,
        capabilities: Array.isArray(p.capabilities) ? p.capabilities : [],
        repos: productRepos.map((repo: any) => ({
          name: repo.fullName.split('/').pop() || repo.fullName,
          fullName: repo.fullName,
          summary: repo.summary,
          language: repo.language,
          why: repo.reason,
          role: repo.role,
          stars: repo.stars,
        })),
        techStack: p.architecture?.tech_stack || [],
        architecture: p.architecture ? {
          components: p.architecture.components,
          dataFlows: p.architecture.data_flows,
        } : null,
      })

      return {
        name: p.name,
        description: p.description,
        systemFlow: p.system_flow,
        capabilities: p.capabilities,
        targetUsers: p.target_users,
        keyFeatures: p.key_features,
        reposUsed: p.repos_used,
        scores: normalizePipelineScores(p.scores),
        architecture: normalizeArchitecture(p.architecture),
        starterBlueprint: p.starter_blueprint,
        strategy: p.strategy,
        compositionPlan,
      }
    }),
    capabilities: result.capabilities || [],
    timeline: result.timeline || [],
    errors: [],
    combinedIntelligenceReport: result.combined_intelligence_report || null,
    capabilityGraphEngine: result.capability_graph_engine || null,
    researchReport: result.research_report || null,
    feasibilityReport: result.feasibility_report || null,
    executionPlan: result.execution_plan || null,
  }
}

export function normalizeTypeScriptResult(state: any, requestId: string, runId: string | null, mode: PipelineMode) {
  return {
    success: state.status === 'complete',
    requestId,
    runId,
    mode,
    buildId: state.buildId,
    status: state.status === 'complete' ? 'completed' : 'failed',
    source: 'typescript-fast-mode',
    currentStep: state.status === 'complete' ? 'completed' : 'failed',
    progress: 100,
    probScore: state.probScore ? {
      feasibility: state.probScore.feasibility,
      novelty: state.probScore.novelty,
      demand: state.probScore.demand,
      composite: state.probScore.composite,
      directives: state.probScore.directives,
      rationale: state.probScore.rationale,
    } : null,
    expandedIdea: state.expandedIdea ? {
      market: state.expandedIdea.market,
      targetUsers: state.expandedIdea.targetUsers,
      features: state.expandedIdea.features,
      usp: state.expandedIdea.usp,
      risks: state.expandedIdea.risks,
      suggestedStack: state.expandedIdea.suggestedStack,
    } : null,
    repoProfiles: state.repoProfiles.map((r: any) => ({
      fullName: r.fullName,
      stars: r.stars,
      language: r.language,
      summary: r.summary,
      relevanceScore: r.relevanceScore,
      reason: r.reason,
    })),
    architecture: state.architecture ? {
      components: state.architecture.components,
      dataFlows: state.architecture.dataFlows,
      techStack: state.architecture.techStack,
      deployment: state.architecture.deployment,
      diagramDescription: state.architecture.diagramDescription,
    } : null,
    integrationPlan: state.integrationPlan ? {
      steps: state.integrationPlan.steps,
      repoRoles: state.integrationPlan.repoRoles,
      glueCodeNeeded: state.integrationPlan.glueCodeNeeded,
      configFiles: state.integrationPlan.configFiles,
    } : null,
    generatedComponents: state.generatedComponents.map((c: any) => ({
      name: c.name,
      filename: c.filename,
      language: c.language,
      description: c.description,
      codeLength: c.code.length,
    })),
    composedProducts: [],
    graphData: { nodes: [], edges: [] },
    graphStats: { total_nodes: 0, total_edges: 0, node_types: {}, edge_types: {} },
    capabilities: [],
    intent: null,
    timeline: state.timeline,
    errors: state.errors,
    outputPath: state.outputPath,
    combinedIntelligenceReport: null,
    capabilityGraphEngine: null,
    researchReport: null,
    feasibilityReport: null,
    executionPlan: null,
  }
}
