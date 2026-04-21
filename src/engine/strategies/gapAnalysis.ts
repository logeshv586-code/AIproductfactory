// ============================================================
// Strategy: Gap Analysis
// Finds missing capabilities and suggests products to fill gaps
// ============================================================

import { Capability, CapabilityCategory } from "@/lib/agents/types";

export interface GapAnalysisResult {
  missingCapability: CapabilityCategory;
  gapDescription: string;
  suggestedProduct: string;
  potentialImpact: number;
  existingCapabilities: CapabilityCategory[];
  fillingRepos: string[];
}

const CAPABILITY_DEPENDENCIES: Record<CapabilityCategory, CapabilityCategory[]> = {
  agent: ["memory", "model-serving"],
  rag: ["memory", "model-serving"],
  memory: [],
  ui: ["agent", "communication"],
  automation: ["agent"],
  "model-serving": ["infra"],
  data: ["memory"],
  security: ["infra"],
  infra: [],
  communication: ["infra"],
};

const GAP_PRODUCT_SUGGESTIONS: Record<string, { product: string; impact: number }> = {
  "agent+missing:memory": { product: "Memory-Augmented Agent Platform", impact: 9 },
  "agent+missing:rag": { product: "Self-Researching Agent System", impact: 8 },
  "rag+missing:memory": { product: "Persistent Knowledge Engine", impact: 8 },
  "ui+missing:agent": { product: "AI-Powered Dashboard", impact: 7 },
  "automation+missing:agent": { product: "Intelligent Automation Hub", impact: 8 },
  "memory+missing:rag": { product: "Searchable Memory Platform", impact: 7 },
  "agent+missing:ui": { product: "Conversational Agent Interface", impact: 7 },
  "model-serving+missing:agent": { product: "Multi-Model Agent Orchestrator", impact: 8 },
};

/**
 * Analyze capability gaps and suggest products to fill them
 */
export function analyzeGaps(capabilities: Capability[]): GapAnalysisResult[] {
  const existingCategories = new Set(capabilities.map(c => c.category));
  const results: GapAnalysisResult[] = [];

  // Find missing dependencies for existing capabilities
  for (const cap of capabilities) {
    const deps = CAPABILITY_DEPENDENCIES[cap.category] || [];
    for (const dep of deps) {
      if (!existingCategories.has(dep)) {
        const gapKey = `${cap.category}+missing:${dep}`;
        const suggestion = GAP_PRODUCT_SUGGESTIONS[gapKey];

        results.push({
          missingCapability: dep,
          gapDescription: `${cap.label} requires ${dep} capability but it's missing from the current repo set`,
          suggestedProduct: suggestion?.product || `${cap.label} with ${dep} Integration`,
          potentialImpact: suggestion?.impact || 6,
          existingCapabilities: Array.from(existingCategories),
          fillingRepos: cap.repos.slice(0, 2).map(r => r.name),
        });
      }
    }
  }

  // Find strategic gaps (common AI product stacks missing capabilities)
  const strategicGaps = findStrategicGaps(existingCategories);
  for (const gap of strategicGaps) {
    results.push(gap);
  }

  // Sort by impact
  return results.sort((a, b) => b.potentialImpact - a.potentialImpact).slice(0, 5);
}

function findStrategicGaps(existingCategories: Set<CapabilityCategory>): GapAnalysisResult[] {
  const results: GapAnalysisResult[] = [];

  // Full AI Stack Check
  const fullAIStack: CapabilityCategory[] = ["agent", "memory", "rag", "ui", "model-serving"];
  const missingAI = fullAIStack.filter(c => !existingCategories.has(c));

  if (missingAI.length > 0 && missingAI.length <= 2) {
    results.push({
      missingCapability: missingAI[0],
      gapDescription: `Almost complete AI stack — missing ${missingAI.join(" and ")} to create a full AI product`,
      suggestedProduct: "Complete AI Product Platform",
      potentialImpact: 9,
      existingCapabilities: Array.from(existingCategories),
      fillingRepos: [],
    });
  }

  // DevTools Stack Check
  const devToolsStack: CapabilityCategory[] = ["automation", "infra", "security", "data"];
  const missingDevTools = devToolsStack.filter(c => !existingCategories.has(c));

  if (existingCategories.has("automation") && missingDevTools.includes("security")) {
    results.push({
      missingCapability: "security",
      gapDescription: "Automation pipeline without security layer — vulnerable to unauthorized access",
      suggestedProduct: "Secure Automation Platform",
      potentialImpact: 7,
      existingCapabilities: Array.from(existingCategories),
      fillingRepos: [],
    });
  }

  return results;
}
