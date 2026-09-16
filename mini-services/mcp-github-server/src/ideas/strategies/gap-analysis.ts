import type { RepoAnalysis, ProductIdea } from "../../types.js";
import { extractTechFromRepos } from "../helpers.js";

export function generateGapIdea(
  category: string,
  signals: string[],
  repos: RepoAnalysis[],
  focus?: string
): ProductIdea | null {
  if (focus && !category.toLowerCase().includes(focus.toLowerCase()) && !signals.join(" ").toLowerCase().includes(focus.toLowerCase())) {
    return null;
  }

  const signalStr = signals.slice(0, 3).join(" + ");

  return {
    id: `idea-gap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `The Missing ${category} Platform`,
    tagline: `Filling the gap in ${category} with ${signalStr}`,
    description: `After analyzing ${repos.length} top ${category} projects, we identified a clear gap: no single solution combines ${signalStr}. This product fills that gap by creating a unified platform that brings together the best innovations from the ${category} ecosystem into a cohesive, user-friendly experience. Instead of juggling multiple tools, users get everything in one place.`,
    targetAudience: `${category} developers and teams who need integrated solutions`,
    keyFeatures: [
      `Unified ${category} workflow management`,
      `Built-in ${signals[0] || "innovation"} capabilities`,
      `Seamless integration with top ${category} tools`,
      `Community-driven feature development`,
      `One-click deployment and configuration`,
    ],
    techStack: extractTechFromRepos(repos),
    inspiredBy: repos.slice(0, 5).map((r) => r.repo.full_name),
    marketPotential: repos.length > 5 ? "high" : "medium",
    difficulty: "intermediate",
    monetization: ["Freemium model", "Enterprise tier", "Marketplace for plugins"],
    uniqueValue: `First platform to combine ${signalStr} in the ${category} space`,
  };
}
