// ============================================================
// Capability Mapper Agent
// Maps repos to capability categories and creates composition
// ============================================================

import { RepoInput, Capability, CapabilityCategory, MappedRepo, KnowledgeGraphNode, KnowledgeGraphEdge } from "./types";
import { analyzeRepo, AnalyzedRepo, CAPABILITY_LABELS, CAPABILITY_ICONS } from "./repo-analyzer";

const ROLE_DESCRIPTIONS: Record<CapabilityCategory, (repo: RepoInput) => string> = {
  memory: (r) => `Vector DB / semantic storage for ${r.name}`,
  agent: (r) => `Workflow + agent orchestration via ${r.name}`,
  rag: (r) => `Document ingestion + RAG pipeline with ${r.name}`,
  ui: (r) => `User interface + dashboard built with ${r.name}`,
  automation: (r) => `Automation + event processing via ${r.name}`,
  "model-serving": (r) => `LLM inference + model serving with ${r.name}`,
  data: (r) => `Data processing + analytics via ${r.name}`,
  security: (r) => `Authentication + security layer via ${r.name}`,
  infra: (r) => `Infrastructure + deployment with ${r.name}`,
  communication: (r) => `Real-time communication via ${r.name}`,
};

const WHY_DESCRIPTIONS: Record<CapabilityCategory, string[]> = {
  memory: ["vector DB for semantic search", "persistent knowledge storage", "embedding management", "fast similarity retrieval"],
  agent: ["agent orchestration", "multi-step workflows", "task planning", "tool integration"],
  rag: ["RAG pipeline", "document ingestion", "semantic retrieval", "knowledge processing"],
  ui: ["interactive dashboard", "responsive UI", "component library", "data visualization"],
  automation: ["event-driven automation", "workflow scheduling", "CI/CD pipeline", "trigger processing"],
  "model-serving": ["LLM inference", "model hosting", "API endpoints", "token management"],
  data: ["data processing", "analytics engine", "ETL pipeline", "metric aggregation"],
  security: ["auth layer", "access control", "encryption", "audit logging"],
  infra: ["container orchestration", "deployment automation", "monitoring", "scaling"],
  communication: ["real-time messaging", "notification system", "API gateway", "event streaming"],
};

export function mapCapabilities(repos: RepoInput[]): {
  capabilities: Capability[];
  analyzedRepos: AnalyzedRepo[];
  knowledgeNodes: KnowledgeGraphNode[];
  knowledgeEdges: KnowledgeGraphEdge[];
} {
  const analyzedRepos = repos.map(analyzeRepo);
  const capabilityMap = new Map<CapabilityCategory, MappedRepo[]>();
  const knowledgeNodes: KnowledgeGraphNode[] = [];
  const knowledgeEdges: KnowledgeGraphEdge[] = [];

  // Group repos by capability
  for (const repo of analyzedRepos) {
    // Create repo node
    knowledgeNodes.push({
      id: `repo-${repo.name.replace(/[^a-zA-Z0-9]/g, "-")}`,
      label: repo.name.split("/").pop() || repo.name,
      type: "repo",
      size: Math.min(Math.max(repo.stars / 5000, 20), 60),
      color: repo.language === "TypeScript" ? "#3178c6" : repo.language === "Python" ? "#3572A5" : "#6366f1",
      data: { stars: repo.stars, language: repo.language, category: repo.category },
    });

    for (const cap of repo.detectedCapabilities) {
      if (!capabilityMap.has(cap)) capabilityMap.set(cap, []);

      const whyOptions = WHY_DESCRIPTIONS[cap];
      const why = whyOptions[Math.floor(Math.random() * whyOptions.length)] || `${cap} capability`;

      capabilityMap.get(cap)!.push({
        name: repo.name.split("/").pop() || repo.name,
        fullName: repo.name,
        url: repo.url || `https://github.com/${repo.name}`,
        role: ROLE_DESCRIPTIONS[cap](repo),
        why,
        stars: repo.stars,
        category: cap,
        language: repo.language,
      });

      // Create edge from repo to capability
      knowledgeEdges.push({
        id: `edge-${repo.name.replace(/[^a-zA-Z0-9]/g, "-")}-${cap}`,
        source: `repo-${repo.name.replace(/[^a-zA-Z0-9]/g, "-")}`,
        target: `cap-${cap}`,
        label: "provides",
        type: "provides",
      });
    }
  }

  // Build capabilities
  const capabilities: Capability[] = [];
  for (const [category, mappedRepos] of capabilityMap.entries()) {
    // Sort repos by stars within each capability
    mappedRepos.sort((a, b) => b.stars - a.stars);

    // Create capability node
    knowledgeNodes.push({
      id: `cap-${category}`,
      label: CAPABILITY_LABELS[category],
      type: "capability",
      size: 40,
      color: getCapabilityColor(category),
      data: { repoCount: mappedRepos.length },
    });

    capabilities.push({
      category,
      label: CAPABILITY_LABELS[category],
      repos: mappedRepos.slice(0, 5), // Top 5 repos per capability
      description: getCapabilityDescription(category, mappedRepos),
      icon: CAPABILITY_ICONS[category],
    });
  }

  // Add cross-capability edges (repos that span multiple capabilities)
  for (const repo of analyzedRepos) {
    if (repo.detectedCapabilities.length > 1) {
      for (let i = 0; i < repo.detectedCapabilities.length - 1; i++) {
        for (let j = i + 1; j < repo.detectedCapabilities.length; j++) {
          knowledgeEdges.push({
            id: `cross-${repo.name.replace(/[^a-zA-Z0-9]/g, "-")}-${repo.detectedCapabilities[i]}-${repo.detectedCapabilities[j]}`,
            source: `cap-${repo.detectedCapabilities[i]}`,
            target: `cap-${repo.detectedCapabilities[j]}`,
            label: "related",
            type: "related",
          });
        }
      }
    }
  }

  return { capabilities, analyzedRepos, knowledgeNodes, knowledgeEdges };
}

function getCapabilityDescription(category: CapabilityCategory, repos: MappedRepo[]): string {
  const topRepos = repos.slice(0, 3).map(r => r.name);
  return `${repos.length} repos provide ${CAPABILITY_LABELS[category]} capabilities, including ${topRepos.join(", ")}`;
}

function getCapabilityColor(category: CapabilityCategory): string {
  const colors: Record<CapabilityCategory, string> = {
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
