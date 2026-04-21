// ============================================================
// Agent Orchestrator
// Runs the full multi-agent pipeline
// ============================================================

import { RepoInput, AnalysisResult, PipelineStep, KnowledgeGraphNode, KnowledgeGraphEdge } from "./types";
import { analyzeRepos, AnalyzedRepo } from "./repo-analyzer";
import { mapCapabilities } from "./capability-mapper";
import { generateProducts } from "./product-generator";
import { designArchitecture, generateExportData } from "./architecture-designer";

export async function runAnalysisPipeline(
  repos: RepoInput[],
  focus?: string,
  onStepUpdate?: (steps: PipelineStep[]) => void
): Promise<AnalysisResult> {
  const pipeline: PipelineStep[] = [
    { agent: "Repo Analyzer", status: "pending" },
    { agent: "Capability Mapper", status: "pending" },
    { agent: "Product Generator", status: "pending" },
    { agent: "Architecture Designer", status: "pending" },
  ];

  const updateStep = (index: number, status: PipelineStep["status"], duration?: number, result?: string) => {
    pipeline[index] = { ...pipeline[index], status, duration, result };
    onStepUpdate?.([...pipeline]);
  };

  // Step 1: Repo Analyzer
  const step1Start = Date.now();
  updateStep(0, "running");
  const analyzedRepos = analyzeRepos(repos);
  updateStep(0, "completed", Date.now() - step1Start, `Analyzed ${analyzedRepos.length} repos`);

  // Step 2: Capability Mapper
  const step2Start = Date.now();
  updateStep(1, "running");
  const { capabilities, analyzedRepos: mappedRepos, knowledgeNodes: capNodes, knowledgeEdges: capEdges } = mapCapabilities(repos);
  updateStep(1, "completed", Date.now() - step2Start, `Found ${capabilities.length} capabilities`);

  // Step 3: Product Generator
  const step3Start = Date.now();
  updateStep(2, "running");
  const products = generateProducts(capabilities, mappedRepos, focus);
  updateStep(2, "completed", Date.now() - step3Start, `Generated ${products.length} product builds`);

  // Step 4: Architecture Designer
  const step4Start = Date.now();
  updateStep(3, "running");
  const allKnowledgeNodes: KnowledgeGraphNode[] = [...capNodes];
  const allKnowledgeEdges: KnowledgeGraphEdge[] = [...capEdges];

  for (const product of products) {
    const { knowledgeNodes: prodNodes, knowledgeEdges: prodEdges } = designArchitecture(product);
    allKnowledgeNodes.push(...prodNodes);
    allKnowledgeEdges.push(...prodEdges);
  }
  updateStep(3, "completed", Date.now() - step4Start, `Designed ${products.length} architectures`);

  return {
    repos,
    capabilities,
    products,
    knowledgeGraph: {
      nodes: deduplicateNodes(allKnowledgeNodes),
      edges: deduplicateEdges(allKnowledgeEdges),
    },
    pipeline,
  };
}

export { generateExportData };

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
