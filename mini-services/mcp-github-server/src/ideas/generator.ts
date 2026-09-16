import type { RepoAnalysis, ProductIdea } from "../types.js";
import { analyzeTrends } from "../analysis/trend-analyzer.js";
import { crossPollinate } from "./strategies/cross-pollination.js";
import { generateGapIdea } from "./strategies/gap-analysis.js";
import { generateTrendIdea } from "./strategies/trend-based.js";

export function generateProductIdeas(analyzedRepos: RepoAnalysis[], focus?: string): ProductIdea[] {
  const ideas: ProductIdea[] = [];
  const usedCombinations = new Set<string>();

  for (let i = 0; i < Math.min(analyzedRepos.length, 10); i++) {
    for (let j = i + 1; j < Math.min(analyzedRepos.length, 10); j++) {
      const repoA = analyzedRepos[i];
      const repoB = analyzedRepos[j];
      const comboKey = [repoA.repo.name, repoB.repo.name].sort().join("+");
      if (usedCombinations.has(comboKey)) continue;
      usedCombinations.add(comboKey);

      const idea = crossPollinate(repoA, repoB, focus);
      if (idea) ideas.push(idea);
    }
  }

  const categories = new Map<string, RepoAnalysis[]>();
  analyzedRepos.forEach((r) => {
    const cat = r.category;
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(r);
  });

  categories.forEach((repos, category) => {
    const innovationSignals = repos.flatMap((r) => r.innovationSignals);
    const uniqueSignals = [...new Set(innovationSignals)];

    if (uniqueSignals.length >= 2) {
      const idea = generateGapIdea(category, uniqueSignals, repos, focus);
      if (idea) ideas.push(idea);
    }
  });

  const trends = analyzeTrends(analyzedRepos.map((r) => r.repo));
  if (trends.emergingTech.length > 0) {
    const idea = generateTrendIdea(trends, analyzedRepos, focus);
    if (idea) ideas.push(idea);
  }

  return ideas
    .filter((idea, idx, self) => self.findIndex((i) => i.title === idea.title) === idx)
    .sort((a, b) => {
      const scoreA = a.marketPotential === "high" ? 3 : a.marketPotential === "medium" ? 2 : 1;
      const scoreB = b.marketPotential === "high" ? 3 : b.marketPotential === "medium" ? 2 : 1;
      return scoreB - scoreA;
    })
    .slice(0, 15);
}
