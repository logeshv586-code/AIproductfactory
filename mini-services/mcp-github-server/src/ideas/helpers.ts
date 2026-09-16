import type { RepoAnalysis } from "../types.js";

export function toTitleCase(str: string): string {
  return str.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function determineTargetAudience(catA: string, catB: string): string {
  if (catA === catB) return `${catA} professionals and enthusiasts`;
  return `Professionals at the intersection of ${catA} and ${catB}`;
}

export function generateKeyFeatures(repoA: RepoAnalysis, repoB: RepoAnalysis): string[] {
  const features = new Set<string>();
  const signals = [...repoA.innovationSignals, ...repoB.innovationSignals];

  const featureMap: Record<string, string> = {
    "Novel AI Application": "AI-powered intelligent automation and suggestions",
    "Open Source Alternative": "Self-hosted with full data ownership",
    "Developer Experience": "Intuitive API with zero-config setup",
    "Privacy-First": "End-to-end encryption with local-first architecture",
    "Low/No Code": "Visual builder with drag-and-drop interface",
    "Edge Computing": "Edge-deployed for sub-50ms response times",
    "Real-time": "Real-time collaboration and live updates",
    "API-First": "Comprehensive REST & GraphQL API with SDK",
  };

  signals.forEach((s) => {
    if (featureMap[s]) features.add(featureMap[s]);
  });

  features.add("Cross-platform compatibility");
  features.add("Extensible plugin system");

  return Array.from(features).slice(0, 6);
}

export function determineTechStack(repoA: RepoAnalysis, repoB: RepoAnalysis): string[] {
  const langs = new Set<string>();
  if (repoA.repo.language) langs.add(repoA.repo.language);
  if (repoB.repo.language) langs.add(repoB.repo.language);

  const stack = Array.from(langs);
  if (!stack.includes("TypeScript")) stack.unshift("TypeScript");
  stack.push("Next.js");
  stack.push("Tailwind CSS");

  return stack.slice(0, 6);
}

export function extractTechFromRepos(repos: RepoAnalysis[]): string[] {
  const langs = new Map<string, number>();
  repos.forEach((r) => {
    if (r.repo.language) {
      langs.set(r.repo.language, (langs.get(r.repo.language) || 0) + 1);
    }
  });

  const sorted = Array.from(langs.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);

  return ["TypeScript", ...sorted].slice(0, 5);
}

export function assessMarketPotential(repoA: RepoAnalysis, repoB: RepoAnalysis): "high" | "medium" | "low" {
  const totalStars = repoA.repo.stargazers_count + repoB.repo.stargazers_count;
  const combinedSignals = [...repoA.innovationSignals, ...repoB.innovationSignals].length;

  if (totalStars > 50000 && combinedSignals >= 3) return "high";
  if (totalStars > 10000 || combinedSignals >= 2) return "medium";
  return "low";
}

export function assessDifficulty(repoA: RepoAnalysis, repoB: RepoAnalysis): "beginner" | "intermediate" | "advanced" {
  const uniqueSignals = new Set([...repoA.innovationSignals, ...repoB.innovationSignals]);
  if (uniqueSignals.has("Novel AI Application") || uniqueSignals.has("Edge Computing")) return "advanced";
  if (uniqueSignals.size >= 2) return "intermediate";
  return "beginner";
}

export function suggestMonetization(catA: string, catB: string): string[] {
  const strategies: string[] = ["Freemium model with generous free tier"];

  if (catA.includes("AI") || catB.includes("AI")) {
    strategies.push("Usage-based pricing for AI features");
    strategies.push("Enterprise API access");
  }
  if (catA.includes("DevTools") || catB.includes("DevTools")) {
    strategies.push("Team/Enterprise licensing");
    strategies.push("Marketplace for extensions");
  }
  strategies.push("Sponsored listings and community marketplace");

  return strategies.slice(0, 4);
}
