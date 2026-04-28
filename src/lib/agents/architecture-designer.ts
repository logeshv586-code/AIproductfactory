// ============================================================
// Architecture Designer Agent
// Designs system architecture and generates exportable plans
// ============================================================

import { ArchitectureBlock, FlowStep, BuildVariant, KnowledgeGraphNode, KnowledgeGraphEdge, ProductBuild } from "./types";

export function designArchitecture(product: ProductBuild): {
  enhancedBlocks: ArchitectureBlock[];
  enhancedFlow: FlowStep[];
  knowledgeNodes: KnowledgeGraphNode[];
  knowledgeEdges: KnowledgeGraphEdge[];
} {
  const knowledgeNodes: KnowledgeGraphNode[] = [];
  const knowledgeEdges: KnowledgeGraphEdge[] = [];

  // Use the intermediate build as the primary architecture
  const primaryBuild = product.buildVariants[1]; // intermediate
  const enhancedBlocks = [...primaryBuild.architecture];
  const enhancedFlow = [...primaryBuild.systemFlow];

  // Add product node
  knowledgeNodes.push({
    id: `product-${product.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
    label: product.title,
    type: "product",
    size: 50,
    color: "#8b5cf6",
    data: { score: product.productScore.finalScore },
  });

  // Add capability nodes and connect to product
  for (const cap of product.capabilities) {
    knowledgeNodes.push({
      id: `cap-${cap.category}`,
      label: cap.label,
      type: "capability",
      size: 35,
      color: getCapabilityNodeColor(cap.category),
      data: { repoCount: cap.repos.length },
    });

    knowledgeEdges.push({
      id: `edge-product-${cap.category}`,
      source: `product-${product.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      target: `cap-${cap.category}`,
      label: "requires",
      type: "requires",
    });

    // Add tech nodes for each capability
    for (const repo of cap.repos.slice(0, 3)) {
      const techNodeId = `tech-${repo.fullName.replace(/[^a-zA-Z0-9]/g, "-")}`;
      if (!knowledgeNodes.find(n => n.id === techNodeId)) {
        knowledgeNodes.push({
          id: techNodeId,
          label: repo.name,
          type: "tech",
          size: Math.min(Math.max(repo.stars / 5000, 15), 45),
          color: "#3b82f6",
          data: { stars: repo.stars, role: repo.why },
        });
      }

      knowledgeEdges.push({
        id: `edge-${cap.category}-${repo.fullName.replace(/[^a-zA-Z0-9]/g, "-")}`,
        source: `cap-${cap.category}`,
        target: techNodeId,
        label: "uses",
        type: "provides",
      });
    }
  }

  // Add connection between capabilities that share repos
  for (let i = 0; i < product.capabilities.length - 1; i++) {
    for (let j = i + 1; j < product.capabilities.length; j++) {
      const sharedRepos = product.capabilities[i].repos.filter(r1 =>
        product.capabilities[j].repos.some(r2 => r1.fullName === r2.fullName)
      );
      if (sharedRepos.length > 0) {
        knowledgeEdges.push({
          id: `edge-${product.capabilities[i].category}-${product.capabilities[j].category}`,
          source: `cap-${product.capabilities[i].category}`,
          target: `cap-${product.capabilities[j].category}`,
          label: "shares repos",
          type: "related",
        });
      }
    }
  }

  return { enhancedBlocks, enhancedFlow, knowledgeNodes, knowledgeEdges };
}

function getCapabilityNodeColor(category: string): string {
  const colors: Record<string, string> = {
    memory: "#8b5cf6",
    agent: "#f59e0b",
    rag: "#10b981",
    ui: "#3b82f6",
    automation: "#ef4444",
    "model-serving": "#6366f1",
    data: "#f97316",
    security: "#dc2626",
    infra: "#64748b",
    communication: "#06b6d4",
  };
  return colors[category] || "#6366f1";
}

export function generateExportData(product: ProductBuild): Record<string, any> {
  return {
    product: {
      title: product.title,
      tagline: product.tagline,
      description: product.description,
      targetAudience: product.targetAudience,
      uniqueValue: product.uniqueValue,
      score: product.productScore,
    },
    capabilities: product.capabilities.map(cap => ({
      category: cap.category,
      label: cap.label,
      repos: cap.repos.map(r => ({
        name: r.fullName,
        url: r.url,
        role: r.why,
      })),
    })),
    buildVariants: product.buildVariants.map(variant => ({
      tier: variant.tier,
      label: variant.label,
      description: variant.description,
      techStack: variant.techStack,
      agents: variant.agents,
      architecture: variant.architecture.map(block => ({
        layer: block.label,
        technology: block.technology,
        connections: block.connections,
      })),
      systemFlow: variant.systemFlow.map(step => ({
        step: step.label,
        type: step.type,
        next: step.next,
      })),
      estimatedTime: variant.estimatedTime,
      difficulty: variant.difficulty,
    })),
    compositionPlan: product.compositionPlan ? {
      selectedRepos: product.compositionPlan.selectedRepos,
      repoRoles: product.compositionPlan.repoRoles,
      combinationSteps: product.compositionPlan.combinationSteps,
      requirements: product.compositionPlan.requirements,
      codingType: product.compositionPlan.codingType,
      structures: product.compositionPlan.structures,
    } : null,
    monetization: product.monetization,
    exampleOutput: product.exampleOutput,
    generatedAt: new Date().toISOString(),
  };
}
