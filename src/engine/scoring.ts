// ============================================================
// Scoring Engine
// Calculates product viability scores based on multiple metrics
// ============================================================

import { Capability, ProductScore, CapabilityCategory } from "@/lib/agents/types";

interface ScoringInput {
  capabilities: Capability[];
  totalStars: number;
  repoCount: number;
  innovationSignals: string[];
  categoryDistribution: Record<string, number>;
}

export function scoreProduct(input: ScoringInput): ProductScore {
  const { capabilities, totalStars, repoCount, innovationSignals, categoryDistribution } = input;

  // 1. Market Demand (0-10)
  // Based on: trend signals, category popularity, repo star momentum
  const categoryPopularity = Object.values(categoryDistribution).reduce((a, b) => a + b, 0);
  const trendBonus = innovationSignals.length > 3 ? 1.5 : innovationSignals.length > 1 ? 0.8 : 0;
  const marketDemand = Math.min(10, 4 + capabilities.length * 0.8 + trendBonus + Math.min(categoryPopularity / 5, 2));

  // 2. Technical Feasibility (0-10)
  // Based on: ecosystem maturity (total stars), repo count (manageability), capability coverage
  const starMaturity = Math.min(totalStars / 50000, 3);
  const repoManageability = repoCount <= 4 ? 2 : repoCount <= 7 ? 1.5 : repoCount <= 10 ? 1 : 0.5;
  const capabilityCoverage = hasCoreCapabilities(capabilities) ? 2 : 1;
  const technicalFeasibility = Math.min(10, 3 + starMaturity + repoManageability + capabilityCoverage);

  // 3. Innovation Score (0-10)
  // Based on: cross-capability fusion, uniqueness of combination, AI-native patterns
  const crossCapabilityBonus = capabilities.length > 3 ? 2 : capabilities.length > 2 ? 1.5 : 1;
  const hasAI = capabilities.some(c => c.category === "agent" || c.category === "model-serving");
  const hasMemory = capabilities.some(c => c.category === "memory");
  const hasRAG = capabilities.some(c => c.category === "rag");
  const fusionBonus = (hasAI && hasMemory ? 1.5 : 0) + (hasAI && hasRAG ? 1 : 0) + (hasMemory && hasRAG ? 0.5 : 0);
  const innovation = Math.min(10, 4 + crossCapabilityBonus + fusionBonus + Math.min(innovationSignals.length * 0.3, 1.5));

  // 4. Competition Level
  // Based on: market saturation (total stars = many others building similar), uniqueness
  const competition = totalStars > 200000 ? "high" : totalStars > 80000 ? "medium" : "low";

  // 5. Ecosystem Maturity (0-10)
  // Based on: repo star average, number of repos per capability, language diversity
  const avgStars = repoCount > 0 ? totalStars / repoCount : 0;
  const repoDepth = capabilities.filter(c => c.repos.length >= 2).length / Math.max(capabilities.length, 1);
  const ecosystemMaturity = Math.min(10, 3 + Math.min(avgStars / 15000, 3) + repoDepth * 3 + (repoCount > 5 ? 1 : 0));

  // Final Score (weighted)
  const competitionModifier = competition === "low" ? 0.5 : competition === "medium" ? 0 : -0.5;
  const finalScore = Math.min(10, Math.round(
    (marketDemand * 0.3 +
    technicalFeasibility * 0.25 +
    innovation * 0.25 +
    ecosystemMaturity * 0.2 +
    competitionModifier) * 10
  ) / 10);

  const competitionSuccess = competition === "low" ? 0.75 : competition === "medium" ? 0.6 : 0.45;
  const successProbability = Math.min(
    0.98,
    Math.max(
      0.05,
      (finalScore / 10) * 0.55 +
      (technicalFeasibility / 10) * 0.30 +
      competitionSuccess * 0.15
    )
  );
  const successPercentage = Math.round(successProbability * 100);

  return {
    marketDemand: Math.round(marketDemand * 10) / 10,
    technicalFeasibility: Math.round(technicalFeasibility * 10) / 10,
    innovation: Math.round(innovation * 10) / 10,
    competition,
    ecosystemMaturity: Math.round(ecosystemMaturity * 10) / 10,
    finalScore,
    successProbability: Number(successProbability.toFixed(3)),
    successPercentage,
  };
}

/**
 * Score multiple products and rank them
 */
export function scoreAndRankProducts(
  products: Array<{
    capabilities: Capability[];
    inspiredBy: string[];
    keyFeatures: string[];
  } & { totalStars?: number; repoCount?: number; innovationSignals?: string[]; categoryDistribution?: Record<string, number> }>
): ProductScore[] {
  return products.map((product) => {
    return scoreProduct({
      capabilities: product.capabilities,
      totalStars: (product as any).totalStars || product.capabilities.reduce((s, c) => s + c.repos.reduce((s2, r) => s2 + r.stars, 0), 0),
      repoCount: (product as any).repoCount || product.capabilities.reduce((s, c) => s + c.repos.length, 0),
      innovationSignals: (product as any).innovationSignals || product.keyFeatures || [],
      categoryDistribution: (product as any).categoryDistribution || Object.fromEntries(
        product.capabilities.map(c => [c.category, c.repos.length])
      ),
    });
  });
}

function hasCoreCapabilities(capabilities: Capability[]): boolean {
  const coreCategories: CapabilityCategory[] = ["agent", "rag", "memory", "ui"];
  return capabilities.some(c => coreCategories.includes(c.category));
}
