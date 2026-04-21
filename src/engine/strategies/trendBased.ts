// ============================================================
// Strategy: Trend-Based Product Generation
// Aligns product ideas with emerging tech trends
// ============================================================

import { Capability, CapabilityCategory } from "@/lib/agents/types";

export interface TrendBasedResult {
  name: string;
  description: string;
  trend: string;
  trendScore: number;
  capabilities: CapabilityCategory[];
  repos: string[];
  marketTiming: string;
}

const EMERGING_TRENDS = [
  {
    name: "AI Agent Swarms",
    keywords: ["agent", "multi-agent", "swarm", "orchestrat", "crewai", "autogen", "langgraph"],
    requiredCaps: ["agent"] as CapabilityCategory[],
    bonusCaps: ["memory", "automation", "communication"] as CapabilityCategory[],
    marketTiming: "Peak hype — ideal for launch",
    baseScore: 9,
  },
  {
    name: "RAG 2.0 — Agentic Retrieval",
    keywords: ["rag", "retrieval", "agent", "search", "knowledge", "semantic"],
    requiredCaps: ["rag"] as CapabilityCategory[],
    bonusCaps: ["agent", "memory"] as CapabilityCategory[],
    marketTiming: "Growing rapidly — early adopter phase",
    baseScore: 8,
  },
  {
    name: "AI-Native Developer Tools",
    keywords: ["copilot", "code", "developer", "ide", "ai-assisted"],
    requiredCaps: ["agent"] as CapabilityCategory[],
    bonusCaps: ["ui", "model-serving", "data"] as CapabilityCategory[],
    marketTiming: "Mainstream adoption — competitive market",
    baseScore: 7,
  },
  {
    name: "Local-First AI",
    keywords: ["local", "ollama", "llama.cpp", "self-hosted", "privacy", "edge"],
    requiredCaps: ["model-serving"] as CapabilityCategory[],
    bonusCaps: ["memory", "infra", "security"] as CapabilityCategory[],
    marketTiming: "Emerging — high growth potential",
    baseScore: 8,
  },
  {
    name: "Composable AI Systems",
    keywords: ["mcp", "tool-use", "function-call", "composition", "multi-model"],
    requiredCaps: ["agent"] as CapabilityCategory[],
    bonusCaps: ["automation", "infra", "communication"] as CapabilityCategory[],
    marketTiming: "Cutting edge — first mover advantage",
    baseScore: 9,
  },
  {
    name: "AI-Powered Analytics",
    keywords: ["analytics", "dashboard", "metrics", "data", "visualization"],
    requiredCaps: ["data"] as CapabilityCategory[],
    bonusCaps: ["ui", "model-serving", "rag"] as CapabilityCategory[],
    marketTiming: "Growing — enterprise demand",
    baseScore: 7,
  },
  {
    name: "Autonomous Workflow Systems",
    keywords: ["workflow", "automation", "n8n", "temporal", "pipeline"],
    requiredCaps: ["automation"] as CapabilityCategory[],
    bonusCaps: ["agent", "data", "communication"] as CapabilityCategory[],
    marketTiming: "Mainstream — proven ROI",
    baseScore: 7,
  },
  {
    name: "Multimodal AI Products",
    keywords: ["multimodal", "vision", "image", "video", "audio", "diffusion"],
    requiredCaps: ["model-serving"] as CapabilityCategory[],
    bonusCaps: ["ui", "agent", "data"] as CapabilityCategory[],
    marketTiming: "Emerging — high novelty",
    baseScore: 8,
  },
];

/**
 * Generate product ideas aligned with emerging trends
 */
export function generateTrendBased(capabilities: Capability[]): TrendBasedResult[] {
  const existingCategories = new Set(capabilities.map(c => c.category));
  const results: TrendBasedResult[] = [];

  for (const trend of EMERGING_TRENDS) {
    // Check if we have the required capabilities for this trend
    const hasRequired = trend.requiredCaps.every(cap => existingCategories.has(cap));
    if (!hasRequired) continue;

    // Calculate trend score based on capability overlap
    const bonusOverlap = trend.bonusCaps.filter(cap => existingCategories.has(cap)).length;
    const trendScore = Math.min(10, trend.baseScore + bonusOverlap * 0.5);

    // Get relevant repos
    const relevantRepos = capabilities
      .filter(c => [...trend.requiredCaps, ...trend.bonusCaps].includes(c.category))
      .flatMap(c => c.repos.slice(0, 2).map(r => r.name));

    results.push({
      name: trend.name,
      description: generateTrendDescription(trend.name, capabilities, trend.requiredCaps),
      trend: trend.name,
      trendScore,
      capabilities: [...trend.requiredCaps, ...trend.bonusCaps.filter(c => existingCategories.has(c))],
      repos: [...new Set(relevantRepos)].slice(0, 6),
      marketTiming: trend.marketTiming,
    });
  }

  return results.sort((a, b) => b.trendScore - a.trendScore).slice(0, 4);
}

function generateTrendDescription(
  trendName: string,
  capabilities: Capability[],
  requiredCaps: CapabilityCategory[]
): string {
  const capLabels = capabilities
    .filter(c => requiredCaps.includes(c.category))
    .map(c => c.label);

  return `Leveraging the ${trendName} trend, this product combines ${capLabels.join(" and ")} capabilities to create a forward-looking platform that aligns with current market momentum and emerging user demand.`;
}
