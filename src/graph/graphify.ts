// ============================================================
// Graphify — Knowledge Graph Construction Engine
// Converts: Repos → Capabilities → Relationships → Products
// ============================================================

import { Capability, MappedRepo, ProductBuild, KnowledgeGraphNode, KnowledgeGraphEdge, CapabilityCategory } from "@/lib/agents/types";

export type GraphNodeType = "repo" | "capability" | "product" | "tech" | "category";
export type EdgeLabel = "provides" | "builds" | "requires" | "inspires" | "combines" | "related" | "uses" | "shares";

export interface GraphifyNode {
  id: string;
  type: GraphNodeType;
  label: string;
  size?: number;
  color?: string;
  data?: Record<string, any>;
}

export interface GraphifyEdge {
  id: string;
  source: string;
  target: string;
  label: EdgeLabel;
  weight?: number;
}

export interface GraphifyGraph {
  nodes: GraphifyNode[];
  edges: GraphifyEdge[];
  metadata: {
    repoCount: number;
    capabilityCount: number;
    productCount: number;
    edgeCount: number;
    generatedAt: string;
  };
}

const CAPABILITY_COLORS: Record<CapabilityCategory, string> = {
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

const NODE_COLORS: Record<GraphNodeType, string> = {
  repo: "#3b82f6",
  capability: "#8b5cf6",
  product: "#10b981",
  tech: "#06b6d4",
  category: "#f59e0b",
};

/**
 * Build a complete knowledge graph from repos, capabilities, and products.
 * This is the core Graphify engine.
 */
export function buildGraph(
  repos: { name: string; fullName: string; url: string; stars: number; language: string | null; category: string; description: string | null; topics: string[] }[],
  capabilities: Capability[],
  products: ProductBuild[]
): GraphifyGraph {
  const nodes: GraphifyNode[] = [];
  const edges: GraphifyEdge[] = [];
  const nodeIds = new Set<string>();

  // Helper to add node without duplicates
  const addNode = (node: GraphifyNode) => {
    if (!nodeIds.has(node.id)) {
      nodeIds.add(node.id);
      nodes.push(node);
    }
  };

  // Helper to add edge without duplicates
  const addEdge = (edge: GraphifyEdge) => {
    const edgeKey = `${edge.source}-${edge.target}-${edge.label}`;
    if (!nodeIds.has(`edge-${edgeKey}`)) {
      nodeIds.add(`edge-${edgeKey}`);
      edges.push(edge);
    }
  };

  // =====================
  // Layer 1: Repo Nodes
  // =====================
  for (const repo of repos) {
    const repoId = `repo-${slugify(repo.fullName || repo.name)}`;
    addNode({
      id: repoId,
      type: "repo",
      label: repo.name.split("/").pop() || repo.name,
      size: Math.min(Math.max(repo.stars / 3000, 20), 60),
      color: NODE_COLORS.repo,
      data: {
        stars: repo.stars,
        language: repo.language,
        category: repo.category,
        url: repo.url,
      },
    });
  }

  // =====================
  // Layer 2: Capability Nodes
  // =====================
  for (const cap of capabilities) {
    const capId = `cap-${cap.category}`;
    addNode({
      id: capId,
      type: "capability",
      label: cap.label,
      size: 35 + cap.repos.length * 3,
      color: CAPABILITY_COLORS[cap.category] || NODE_COLORS.capability,
      data: { repoCount: cap.repos.length, description: cap.description },
    });

    // Edges: Repo → Capability (provides)
    for (const repo of cap.repos.slice(0, 5)) {
      const repoId = `repo-${slugify(repo.fullName)}`;
      addEdge({
        id: `edge-${repoId}-${capId}`,
        source: repoId,
        target: capId,
        label: "provides",
        weight: repo.stars / 10000,
      });
    }
  }

  // =====================
  // Layer 3: Product Nodes
  // =====================
  for (const product of products) {
    const productId = `product-${slugify(product.title)}`;
    addNode({
      id: productId,
      type: "product",
      label: product.title,
      size: 50,
      color: NODE_COLORS.product,
      data: {
        score: product.productScore.finalScore,
        tagline: product.tagline,
      },
    });

    // Edges: Capability → Product (builds)
    for (const cap of product.capabilities) {
      const capId = `cap-${cap.category}`;
      addEdge({
        id: `edge-${capId}-${productId}`,
        source: capId,
        target: productId,
        label: "builds",
        weight: 0.8,
      });
    }

    // Edges: Product → Capability (requires)
    for (const cap of product.capabilities) {
      const capId = `cap-${cap.category}`;
      addEdge({
        id: `edge-${productId}-${capId}-req`,
        source: productId,
        target: capId,
        label: "requires",
        weight: 0.6,
      });
    }
  }

  // =====================
  // Layer 4: Cross-Capability Relationships
  // =====================
  for (let i = 0; i < capabilities.length - 1; i++) {
    for (let j = i + 1; j < capabilities.length; j++) {
      const sharedRepos = capabilities[i].repos.filter((r1) =>
        capabilities[j].repos.some((r2) => r1.fullName === r2.fullName)
      );
      if (sharedRepos.length > 0) {
        addEdge({
          id: `edge-cap-${capabilities[i].category}-${capabilities[j].category}`,
          source: `cap-${capabilities[i].category}`,
          target: `cap-${capabilities[j].category}`,
          label: "related",
          weight: sharedRepos.length * 0.3,
        });
      }
    }
  }

  // =====================
  // Layer 5: Product Inspiration Edges
  // =====================
  for (let i = 0; i < products.length - 1; i++) {
    for (let j = i + 1; j < products.length; j++) {
      const sharedCaps = products[i].capabilities.filter((c1) =>
        products[j].capabilities.some((c2) => c1.category === c2.category)
      );
      if (sharedCaps.length >= 2) {
        addEdge({
          id: `edge-prod-${slugify(products[i].title)}-${slugify(products[j].title)}`,
          source: `product-${slugify(products[i].title)}`,
          target: `product-${slugify(products[j].title)}`,
          label: "inspires",
          weight: sharedCaps.length * 0.2,
        });
      }
    }
  }

  // =====================
  // Layer 6: Tech Nodes from Build Variants
  // =====================
  for (const product of products) {
    const intermediateBuild = product.buildVariants[1];
    if (intermediateBuild) {
      for (const tech of intermediateBuild.techStack) {
        const techId = `tech-${slugify(tech.layer)}`;
        addNode({
          id: techId,
          type: "tech",
          label: tech.layer,
          size: 25,
          color: NODE_COLORS.tech,
          data: { technologies: tech.technologies },
        });

        // Connect product to its tech
        const productId = `product-${slugify(product.title)}`;
        addEdge({
          id: `edge-${productId}-${techId}`,
          source: productId,
          target: techId,
          label: "uses",
          weight: 0.5,
        });
      }
    }
  }

  return {
    nodes,
    edges,
    metadata: {
      repoCount: repos.length,
      capabilityCount: capabilities.length,
      productCount: products.length,
      edgeCount: edges.length,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Get shortest path between two nodes (BFS)
 */
export function findPath(graph: GraphifyGraph, fromId: string, toId: string): string[] {
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
    adjacency.get(edge.source)!.push(edge.target);
  }

  const visited = new Set<string>();
  const queue: { node: string; path: string[] }[] = [{ node: fromId, path: [fromId] }];
  visited.add(fromId);

  while (queue.length > 0) {
    const { node, path } = queue.shift()!;
    if (node === toId) return path;

    const neighbors = adjacency.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push({ node: neighbor, path: [...path, neighbor] });
      }
    }
  }

  return []; // No path found
}

/**
 * Filter graph by node type
 */
export function filterGraph(graph: GraphifyGraph, type: GraphNodeType): GraphifyGraph {
  const filteredNodes = graph.nodes.filter((n) => n.type === type);
  const nodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = graph.edges.filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
  );

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    metadata: {
      ...graph.metadata,
      edgeCount: filteredEdges.length,
    },
  };
}

/**
 * Get neighborhood of a node (1-hop)
 */
export function getNeighborhood(graph: GraphifyGraph, nodeId: string): { nodes: GraphifyNode[]; edges: GraphifyEdge[] } {
  const connectedEdges = graph.edges.filter((e) => e.source === nodeId || e.target === nodeId);
  const connectedNodeIds = new Set([nodeId]);
  for (const edge of connectedEdges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }
  const connectedNodes = graph.nodes.filter((n) => connectedNodeIds.has(n.id));

  return { nodes: connectedNodes, edges: connectedEdges };
}

/**
 * Convert Graphify graph to React Flow compatible format
 */
export function toReactFlowFormat(graph: GraphifyGraph): {
  flowNodes: { id: string; type: string; position: { x: number; y: number }; data: Record<string, any> }[];
  flowEdges: { id: string; source: string; target: string; label: string; type: string; animated: boolean; style: Record<string, any> }[];
} {
  const flowNodes = graph.nodes.map((node, index) => {
    const angle = (index / graph.nodes.length) * 2 * Math.PI;
    const radiusByType: Record<GraphNodeType, number> = {
      repo: 220,
      capability: 120,
      product: 30,
      tech: 280,
      category: 180,
    };
    const radius = radiusByType[node.type] || 150;

    return {
      id: node.id,
      type: "custom",
      position: {
        x: 400 + Math.cos(angle) * radius,
        y: 300 + Math.sin(angle) * radius,
      },
      data: {
        label: node.label,
        nodeType: node.type,
        color: node.color,
        size: node.size,
        ...node.data,
      },
    };
  });

  const edgeColors: Record<EdgeLabel, string> = {
    provides: "#3b82f6",
    builds: "#8b5cf6",
    requires: "#f59e0b",
    inspires: "#10b981",
    combines: "#06b6d4",
    related: "#94a3b8",
    uses: "#f97316",
    shares: "#64748b",
  };

  const flowEdges = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    type: "smoothstep" as const,
    animated: edge.label === "builds" || edge.label === "provides",
    style: {
      stroke: edgeColors[edge.label] || "#94a3b8",
      strokeWidth: 1 + (edge.weight || 0.5) * 2,
    },
  }));

  return { flowNodes, flowEdges };
}

// Helper
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
}
