// ============================================================
// Strategy: Cross-Pollination
// Combines complementary repos from different capability domains
// ============================================================

import { Capability, CapabilityCategory } from "@/lib/agents/types";

export interface CrossPollinationResult {
  name: string;
  description: string;
  combinedCapabilities: CapabilityCategory[];
  repos: string[];
  fusionType: string;
  noveltyScore: number;
}

/**
 * Find complementary capability pairs and create product ideas
 */
export function crossPollinate(capabilities: Capability[]): CrossPollinationResult[] {
  const results: CrossPollinationResult[] = [];

  // Generate all meaningful capability pairs
  const pairs = generateCapabilityPairs(capabilities);

  for (const pair of pairs) {
    const [capA, capB] = pair;
    const fusion = createFusion(capA, capB);
    results.push(fusion);
  }

  // Generate triple combinations for more advanced products
  if (capabilities.length >= 3) {
    const triples = generateCapabilityTriples(capabilities);
    for (const triple of triples.slice(0, 3)) {
      const fusion = createMultiFusion(triple);
      results.push(fusion);
    }
  }

  return results;
}

function generateCapabilityPairs(capabilities: Capability[]): [Capability, Capability][] {
  const pairs: [Capability, Capability][] = [];
  for (let i = 0; i < capabilities.length; i++) {
    for (let j = i + 1; j < capabilities.length; j++) {
      pairs.push([capabilities[i], capabilities[j]]);
    }
  }
  return pairs.slice(0, 8); // Limit to avoid explosion
}

function generateCapabilityTriples(capabilities: Capability[]): Capability[][] {
  const triples: Capability[][] = [];
  for (let i = 0; i < capabilities.length - 2; i++) {
    for (let j = i + 1; j < capabilities.length - 1; j++) {
      for (let k = j + 1; k < capabilities.length; k++) {
        triples.push([capabilities[i], capabilities[j], capabilities[k]]);
      }
    }
  }
  return triples.slice(0, 5);
}

const FUSION_TEMPLATES: Record<string, { name: string; desc: string; fusion: string; novelty: number }> = {
  "agent+memory": {
    name: "Persistent Agent System",
    desc: "Autonomous agents with long-term memory that learn from every interaction",
    fusion: "Agent Memory Fusion",
    novelty: 9,
  },
  "agent+rag": {
    name: "Research Agent Platform",
    desc: "Agents that can research, retrieve, and synthesize knowledge autonomously",
    fusion: "Agent-RAG Pipeline",
    novelty: 8,
  },
  "memory+rag": {
    name: "Intelligent Knowledge Base",
    desc: "Semantic knowledge base with both storage and intelligent retrieval",
    fusion: "Memory-RAG Integration",
    novelty: 7,
  },
  "agent+ui": {
    name: "Interactive AI Assistant",
    desc: "Agent-powered conversational UI with real-time responses",
    fusion: "Agent-UI Bridge",
    novelty: 7,
  },
  "memory+ui": {
    name: "Knowledge Dashboard",
    desc: "Visual dashboard for exploring stored knowledge and memories",
    fusion: "Memory Visualization",
    novelty: 6,
  },
  "rag+ui": {
    name: "Smart Search Interface",
    desc: "Beautiful search interface powered by semantic retrieval",
    fusion: "RAG-Powered UI",
    novelty: 6,
  },
  "automation+agent": {
    name: "Autonomous Workflow Engine",
    desc: "Self-orchestrating workflows powered by AI agents",
    fusion: "Agent Automation",
    novelty: 9,
  },
  "model-serving+agent": {
    name: "Multi-Model Agent Hub",
    desc: "Agent platform that orchestrates multiple LLM models",
    fusion: "Model-Agent Orchestration",
    novelty: 8,
  },
};

function createFusion(capA: Capability, capB: Capability): CrossPollinationResult {
  const key1 = `${capA.category}+${capB.category}`;
  const key2 = `${capB.category}+${capA.category}`;
  const template = FUSION_TEMPLATES[key1] || FUSION_TEMPLATES[key2];

  if (template) {
    return {
      name: template.name,
      description: template.desc,
      combinedCapabilities: [capA.category, capB.category],
      repos: [
        ...capA.repos.slice(0, 2).map(r => r.name),
        ...capB.repos.slice(0, 2).map(r => r.name),
      ],
      fusionType: template.fusion,
      noveltyScore: template.novelty,
    };
  }

  // Generic fusion for untemplated pairs
  return {
    name: `${capA.label} + ${capB.label} Platform`,
    description: `Combining ${capA.label} with ${capB.label} to create a unified system that bridges both domains`,
    combinedCapabilities: [capA.category, capB.category],
    repos: [
      ...capA.repos.slice(0, 2).map(r => r.name),
      ...capB.repos.slice(0, 2).map(r => r.name),
    ],
    fusionType: "Generic Fusion",
    noveltyScore: 5,
  };
}

function createMultiFusion(caps: Capability[]): CrossPollinationResult {
  const labels = caps.map(c => c.label);
  const categories = caps.map(c => c.category);

  return {
    name: `Unified ${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]} Engine`,
    description: `A comprehensive platform combining ${labels.join(", ")} into a seamless AI-native system`,
    combinedCapabilities: categories,
    repos: caps.flatMap(c => c.repos.slice(0, 1).map(r => r.name)),
    fusionType: "Multi-Capability Fusion",
    noveltyScore: Math.min(10, 6 + caps.length),
  };
}
