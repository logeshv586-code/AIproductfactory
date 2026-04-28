// ============================================================
// Enhanced Pipeline Orchestrator
// Runs the full multi-agent pipeline with all strategies + Graphify
// ============================================================

import { RepoInput, AnalysisResult, PipelineStep, KnowledgeGraphNode, KnowledgeGraphEdge, Capability, ProductBuild } from "@/lib/agents/types";
import { analyzeRepos, AnalyzedRepo } from "@/lib/agents/repo-analyzer";
import { mapCapabilities } from "@/lib/agents/capability-mapper";
import { generateProducts } from "@/lib/agents/product-generator";
import { designArchitecture, generateExportData } from "@/lib/agents/architecture-designer";
import { buildGraph, toReactFlowFormat, type GraphifyGraph } from "@/graph/graphify";
import { scoreProduct } from "@/engine/scoring";
import { selectBestRepos, selectBestReposFromIntent, type UserIntent, type RankedRepo } from "@/engine/repoSelector";
import { crossPollinate, type CrossPollinationResult } from "@/engine/strategies/crossPollination";
import { analyzeGaps, type GapAnalysisResult } from "@/engine/strategies/gapAnalysis";
import { generateTrendBased, type TrendBasedResult } from "@/engine/strategies/trendBased";
import { composeAI, type CompositionalResult } from "@/engine/strategies/compositionalAI";
import { 
  mapToArchitecturalRoles, 
  validateArchitectureCoverage, 
  generateSystemArchitecture,
  type RoleBasedMapping,
  type SystemArchitecture 
} from "@/engine/architectureComposer";


// ============================================================
// Pipeline Step Definitions (6-step enhanced pipeline)
// ============================================================

const PIPELINE_STEPS = [
  { agent: "Intent Analyzer", index: 0 },
  { agent: "Repo Analyzer", index: 1 },
  { agent: "Capability Mapper", index: 2 },
  { agent: "Graphify Engine", index: 3 },
  { agent: "Product Generator", index: 4 },
  { agent: "Architecture Designer", index: 5 },
] as const;

// ============================================================
// Enhanced Pipeline Result
// ============================================================

export interface EnhancedPipelineResult extends AnalysisResult {
  intent?: UserIntent;
  rankedRepos?: RankedRepo[];
  crossPollination: CrossPollinationResult[];
  gapAnalysis: GapAnalysisResult[];
  trendBased: TrendBasedResult[];
  compositionalAI: CompositionalResult[];
  graphifyGraph: GraphifyGraph | null;
  systemArchitecture?: SystemArchitecture;
}

// ============================================================
// Run Full Enhanced Pipeline
// ============================================================

export async function runEnhancedPipeline(
  repos: RepoInput[],
  userInput?: string,
  onStepUpdate?: (steps: PipelineStep[]) => void
): Promise<EnhancedPipelineResult> {
  // Initialize pipeline steps
  const pipeline: PipelineStep[] = [
    { agent: "Intent Analyzer", status: "pending" },
    { agent: "Repo Analyzer", status: "pending" },
    { agent: "Capability Mapper", status: "pending" },
    { agent: "Graphify Engine", status: "pending" },
    { agent: "Product Generator", status: "pending" },
    { agent: "Architecture Designer", status: "pending" },
  ];

  const updateStep = (index: number, status: PipelineStep["status"], duration?: number, result?: string) => {
    pipeline[index] = { ...pipeline[index], status, duration, result };
    onStepUpdate?.([...pipeline]);
  };

  let intent: UserIntent | undefined;
  let rankedRepos: RankedRepo[] | undefined;

  // =====================
  // STEP 1: Intent Analysis (if user input provided)
  // =====================
  const step1Start = Date.now();
  updateStep(0, "running");

  if (userInput && userInput.trim().length > 5) {
    try {
      const selection = await selectBestRepos(userInput, repos);
      intent = selection.intent;
      rankedRepos = selection.rankedRepos;
      updateStep(0, "completed", Date.now() - step1Start, `Intent: ${intent.domain}, ${intent.capabilities.length} capabilities needed`);
    } catch {
      updateStep(0, "completed", Date.now() - step1Start, "Intent extraction skipped (LLM unavailable)");
    }
  } else {
    updateStep(0, "completed", Date.now() - step1Start, "No user intent provided — using full repo set");
  }

  // =====================
  // STEP 2: Repo Analysis
  // =====================
  const step2Start = Date.now();
  updateStep(1, "running");
  const analyzedRepos = analyzeRepos(repos);
  updateStep(1, "completed", Date.now() - step2Start, `Analyzed ${analyzedRepos.length} repos`);

  // =====================
  // STEP 3: Capability Mapping
  // =====================
  const step3Start = Date.now();
  updateStep(2, "running");
  const { capabilities, analyzedRepos: mappedRepos, knowledgeNodes: capNodes, knowledgeEdges: capEdges } = mapCapabilities(repos);
  updateStep(2, "completed", Date.now() - step3Start, `Found ${capabilities.length} capabilities`);

  // =====================
  // STEP 4: Graphify Engine
  // =====================
  const step4Start = Date.now();
  updateStep(3, "running");
  let graphifyGraph: GraphifyGraph | null = null;

  // We'll complete the graph after product generation
  updateStep(3, "completed", Date.now() - step4Start, "Graphify engine initialized");

  // =====================
  // STEP 5: Product Generation (with all strategies)
  // =====================
  const step5Start = Date.now();
  updateStep(4, "running");

  // Run core product generation
  const products = generateProducts(capabilities, mappedRepos, userInput);

  // Run all 4 strategies in parallel
  const [crossPollResults, gapResults, trendResults, compositionalResults] = await Promise.all([
    Promise.resolve(crossPollinate(capabilities)),
    Promise.resolve(analyzeGaps(capabilities)),
    Promise.resolve(generateTrendBased(capabilities)),
    Promise.resolve(composeAI(capabilities)),
  ]);

  // Enhance products with strategy insights
  const enhancedProducts = products.map((product, index) => {
    // Attach strategy-based insights to product description
    const strategyInsights: string[] = [];

    if (crossPollResults[index]) {
      strategyInsights.push(`Cross-pollination: ${crossPollResults[index].fusionType}`);
    }

    if (trendResults[0]) {
      strategyInsights.push(`Trend alignment: ${trendResults[0].trend}`);
    }

    if (compositionalResults[0]) {
      strategyInsights.push(`Composition: ${compositionalResults[0].compositionType}`);
    }

    return {
      ...product,
      strategy: strategyInsights.length > 0
        ? `ai-product-builder | ${strategyInsights.join(" | ")}`
        : product.strategy,
    };
  });

  updateStep(4, "completed", Date.now() - step5Start, `Generated ${enhancedProducts.length} products with 4 strategies`);

  // =====================
  // STEP 6: Architecture Design + Complete Graphify
  // =====================
  const step6Start = Date.now();
  updateStep(5, "running");

  // --- BEGIN NEW ARCHITECTURE GRAPH & RETRY LOGIC ---
  let systemArchitecture: SystemArchitecture | undefined;
  
  if (rankedRepos && rankedRepos.length > 0) {
    let mapping = mapToArchitecturalRoles(rankedRepos);
    let validation = validateArchitectureCoverage(mapping);
    systemArchitecture = generateSystemArchitecture(rankedRepos, mapping, validation);

    // Soft Gate: Trigger targeted retry if confidence is too low or invalid
    if ((systemArchitecture.confidence < 0.4 || !validation.isValid) && intent && validation.missingRoles.length > 0) {
      updateStep(5, "running", Date.now() - step6Start, `Low confidence (${systemArchitecture.confidence.toFixed(2)}) or missing roles. Executing targeted retry...`);
      
      // Do NOT mutate original intent, instead create an augmented clone
      const augmentedIntent = {
        ...intent,
        requiredRoles: validation.missingRoles as string[]
      };

      try {
        const retrySelection = await selectBestReposFromIntent(augmentedIntent, repos);
        const retryRankedRepos = retrySelection.rankedRepos;
        const retryMapping = mapToArchitecturalRoles(retryRankedRepos);
        const retryValidation = validateArchitectureCoverage(retryMapping);
        const retryArch = generateSystemArchitecture(retryRankedRepos, retryMapping, retryValidation);

        if (retryArch.confidence > systemArchitecture.confidence || retryValidation.isValid) {
           rankedRepos = retryRankedRepos;
           systemArchitecture = retryArch;
        }
      } catch (err) {
        console.warn("Architecture retry failed:", err);
      }
    }
  }
  // --- END ARCHITECTURE LOGIC ---

  const allKnowledgeNodes: KnowledgeGraphNode[] = [...capNodes];
  const allKnowledgeEdges: KnowledgeGraphEdge[] = [...capEdges];

  for (const product of enhancedProducts) {
    const { knowledgeNodes: prodNodes, knowledgeEdges: prodEdges } = designArchitecture(product);
    allKnowledgeNodes.push(...prodNodes);
    allKnowledgeEdges.push(...prodEdges);
  }

  // Build complete Graphify graph
  try {
    graphifyGraph = buildGraph(
      repos.map(r => ({
        name: r.name,
        fullName: r.name,
        url: r.url || `https://github.com/${r.name}`,
        stars: r.stars,
        language: r.language,
        category: r.category,
        description: r.description,
        topics: r.topics,
      })),
      capabilities,
      enhancedProducts
    );
  } catch (err) {
    console.error("Graphify build error:", err);
  }

  updateStep(5, "completed", Date.now() - step6Start, `System Architecture generated: ${systemArchitecture?.status ?? "none"}. Graphify complete.`);

  // =====================
  // Return Complete Result
  // =====================

  return {
    repos,
    capabilities,
    products: enhancedProducts,
    knowledgeGraph: {
      nodes: deduplicateNodes(allKnowledgeNodes),
      edges: deduplicateEdges(allKnowledgeEdges),
    },
    pipeline,
    intent,
    rankedRepos,
    crossPollination: crossPollResults,
    gapAnalysis: gapResults,
    trendBased: trendResults,
    compositionalAI: compositionalResults,
    graphifyGraph,
    systemArchitecture,
  };
}

// ============================================================
// Backward-compatible pipeline (original 4-agent)
// ============================================================

export async function runAnalysisPipeline(
  repos: RepoInput[],
  focus?: string,
  onStepUpdate?: (steps: PipelineStep[]) => void
): Promise<AnalysisResult> {
  const result = await runEnhancedPipeline(repos, focus, onStepUpdate);
  return {
    repos: result.repos,
    capabilities: result.capabilities,
    products: result.products,
    knowledgeGraph: result.knowledgeGraph,
    pipeline: result.pipeline,
  };
}

export { generateExportData };

// ============================================================
// Helpers
// ============================================================

function deduplicateNodes(nodes: KnowledgeGraphNode[]): KnowledgeGraphNode[] {
  const seen = new Set<string>();
  return nodes.filter(node => {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

function deduplicateEdges(edges: KnowledgeGraphEdge[]): KnowledgeGraphEdge[] {
  const seen = new Set<string>();
  return edges.filter(edge => {
    if (seen.has(edge.id)) return false;
    seen.add(edge.id);
    return true;
  });
}
