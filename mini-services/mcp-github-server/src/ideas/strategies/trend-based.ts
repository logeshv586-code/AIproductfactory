import type { TrendAnalysis, RepoAnalysis, ProductIdea } from "../../types.js";
import { toTitleCase } from "../helpers.js";

export function generateTrendIdea(
  trends: TrendAnalysis,
  repos: RepoAnalysis[],
  focus?: string
): ProductIdea | null {
  const topTech = trends.emergingTech.slice(0, 2).join(" and ");
  const topLang = trends.topLanguages[0]?.language || "TypeScript";

  if (focus && !topTech.toLowerCase().includes(focus.toLowerCase()) && !trends.hotCategories.join(" ").toLowerCase().includes(focus.toLowerCase())) {
    return null;
  }

  return {
    id: `idea-trend-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: `${toTitleCase(topTech)} Innovation Hub`,
    tagline: `Riding the ${topTech} wave — a platform for the next generation`,
    description: `Trend analysis reveals that ${topTech} is rapidly gaining traction across ${trends.hotCategories.slice(0, 3).join(", ")} categories. This product creates a dedicated platform that accelerates development in this space, providing templates, tools, and community resources specifically optimized for ${topTech} projects. By focusing exclusively on this emerging technology, we can deliver a superior experience compared to general-purpose tools.`,
    targetAudience: `Early adopters and developers working with ${topTech}`,
    keyFeatures: [
      `Pre-built ${topTech} templates and starters`,
      `Integrated development environment for ${topTech}`,
      `Community showcase of ${topTech} projects`,
      `Performance benchmarking and optimization tools`,
      `Learning paths and documentation hub`,
    ],
    techStack: [topLang, "Next.js", "Tailwind CSS", "Prisma"],
    inspiredBy: repos.slice(0, 3).map((r) => r.repo.full_name),
    marketPotential: "high",
    difficulty: "advanced",
    monetization: ["SaaS subscription", "Premium templates", "Consulting services", "Certification program"],
    uniqueValue: `First dedicated platform for ${topTech} with integrated community`,
  };
}
