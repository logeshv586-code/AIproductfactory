// ============================================================
// Strategy: Compositional AI
// Fuses multiple repos into novel multi-repo AI systems
// ============================================================

import { Capability, CapabilityCategory, MappedRepo } from "@/lib/agents/types";

export interface CompositionalResult {
  name: string;
  description: string;
  compositionType: string;
  repos: Array<{ name: string; role: string; capability: CapabilityCategory }>;
  systemArchitecture: string;
  innovationScore: number;
  capabilities: CapabilityCategory[];
}

const COMPOSITION_PATTERNS = [
  {
    name: "Full-Stack AI Product",
    required: ["ui", "agent", "memory", "model-serving"] as CapabilityCategory[],
    architecture: "Frontend → API → Agent Orchestrator → Memory + LLM",
    innovation: 9,
  },
  {
    name: "Autonomous Knowledge Worker",
    required: ["agent", "rag", "memory", "automation"] as CapabilityCategory[],
    architecture: "Scheduler → Agent Planner → RAG Retriever → Memory Store → Executor",
    innovation: 9,
  },
  {
    name: "Self-Improving AI System",
    required: ["agent", "memory", "data", "model-serving"] as CapabilityCategory[],
    architecture: "Agent → Memory → Analytics → Model Feedback Loop",
    innovation: 10,
  },
  {
    name: "Intelligent Automation Hub",
    required: ["automation", "agent", "communication", "ui"] as CapabilityCategory[],
    architecture: "Trigger → Agent Router → Worker Agents → Notification → Dashboard",
    innovation: 8,
  },
  {
    name: "Enterprise AI Platform",
    required: ["agent", "security", "memory", "ui", "infra"] as CapabilityCategory[],
    architecture: "Auth → API Gateway → Agent Cluster → Secure Memory → Admin UI",
    innovation: 7,
  },
  {
    name: "RAG-Powered Research Engine",
    required: ["rag", "memory", "agent", "data"] as CapabilityCategory[],
    architecture: "Query → RAG Pipeline → Memory Context → Agent Synthesis → Data Export",
    innovation: 8,
  },
];

/**
 * Generate compositional AI product ideas by fusing multiple repos
 */
export function composeAI(capabilities: Capability[]): CompositionalResult[] {
  const existingCategories = new Set(capabilities.map(c => c.category));
  const results: CompositionalResult[] = [];

  for (const pattern of COMPOSITION_PATTERNS) {
    // Check how many required capabilities we have
    const matchCount = pattern.required.filter(c => existingCategories.has(c)).length;
    const matchRatio = matchCount / pattern.required.length;

    // Only include if we match at least 60% of required capabilities
    if (matchRatio < 0.6) continue;

    // Build repo composition
    const repoComposition = pattern.required
      .filter(cap => existingCategories.has(cap))
      .map(cap => {
        const capData = capabilities.find(c => c.category === cap);
        const topRepo = capData?.repos[0];
        return {
          name: topRepo?.name || `${cap}-repo`,
          role: getRoleForCapability(cap),
          capability: cap,
        };
      });

    results.push({
      name: pattern.name,
      description: `A ${pattern.name.toLowerCase()} that combines ${pattern.required.filter(c => existingCategories.has(c)).join(", ")} capabilities into a unified system. ${matchRatio === 1 ? "All required capabilities are available." : `Missing: ${pattern.required.filter(c => !existingCategories.has(c)).join(", ")}`}`,
      compositionType: matchRatio === 1 ? "Complete Composition" : "Partial Composition",
      repos: repoComposition,
      systemArchitecture: pattern.architecture,
      innovationScore: Math.round(pattern.innovation * matchRatio * 10) / 10,
      capabilities: pattern.required.filter(c => existingCategories.has(c)),
    });
  }

  return results.sort((a, b) => b.innovationScore - a.innovationScore).slice(0, 4);
}

function getRoleForCapability(cap: CapabilityCategory): string {
  const roles: Record<CapabilityCategory, string> = {
    memory: "Knowledge Store",
    agent: "Orchestration Engine",
    rag: "Retrieval Pipeline",
    ui: "User Interface",
    automation: "Automation Engine",
    "model-serving": "LLM Backend",
    data: "Data Processing",
    security: "Security Layer",
    infra: "Infrastructure",
    communication: "Communication Hub",
  };
  return roles[cap] || "Component";
}
