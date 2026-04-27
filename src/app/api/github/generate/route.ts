import { NextRequest, NextResponse } from "next/server";
import { llm } from "@/llm/provider";
import { z } from "zod";
import { db } from "@/lib/db";

interface RepoData {
  name: string;
  description: string | null;
  stars: number;
  language: string | null;
  topics: string[];
  category: string;
  trendScore: number;
  growthRate: number;
  innovationSignals: string[];
}

const IdeaSchema = z.object({
  title: z.string(),
  tagline: z.string(),
  description: z.string(),
  targetAudience: z.string(),
  keyFeatures: z.array(z.string()),
  techStack: z.array(z.string()),
  marketPotential: z.enum(["high", "medium", "low"]),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  monetization: z.array(z.string()),
  uniqueValue: z.string(),
  strategy: z.string(),
  inspiredBy: z.array(z.string())
});

const IdeasArraySchema = z.array(IdeaSchema);

function toTitleCase(str: string): string {
  return str.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function generateIdeasLocally(repos: RepoData[], focus?: string): any[] {
  const ideas: any[] = [];

  // Strategy 1: Cross-pollination
  for (let i = 0; i < Math.min(repos.length, 6); i++) {
    for (let j = i + 1; j < Math.min(repos.length, 6); j++) {
      const repoA = repos[i];
      const repoB = repos[j];
      const nameA = repoA.name.split("/")[1]?.replace(/[-_]/g, " ") || repoA.name;
      const nameB = repoB.name.split("/")[1]?.replace(/[-_]/g, " ") || repoB.name;

      if (focus && !`${repoA.category} ${repoB.category} ${nameA} ${nameB}`.toLowerCase().includes(focus.toLowerCase())) {
        continue;
      }

      ideas.push({
        title: `${toTitleCase(nameA)} meets ${toTitleCase(nameB)}`,
        tagline: `Bridging ${repoA.category} and ${repoB.category} in one platform`,
        description: `What if you could combine the power of ${repoA.description || nameA} with the approach of ${repoB.description || nameB}? This product creates a unified experience leveraging both strengths, eliminating the need to choose between them.`,
        targetAudience: `Professionals at the intersection of ${repoA.category} and ${repoB.category}`,
        keyFeatures: [
          `Unified workflow combining ${repoA.category} and ${repoB.category}`,
          `${repoA.innovationSignals[0] || "Smart"} automation`,
          `Real-time collaboration capabilities`,
          `Extensible plugin architecture`,
          `One-click deployment`,
        ],
        techStack: [...new Set([repoA.language, repoB.language, "TypeScript"].filter(Boolean) as string[])].slice(0, 5),
        inspiredBy: [repoA.name, repoB.name],
        marketPotential: (repoA.stars + repoB.stars > 50000) ? "high" : (repoA.stars + repoB.stars > 10000) ? "medium" : "low",
        difficulty: [...repoA.innovationSignals, ...repoB.innovationSignals].some(s => s.includes("AI")) ? "advanced" : "intermediate",
        monetization: ["Freemium model", "Enterprise tier", "Marketplace"],
        uniqueValue: `First to combine ${repoA.category} and ${repoB.category} seamlessly`,
        strategy: "cross-pollination",
      });
    }
  }

  // Strategy 2: Gap analysis
  const categories = new Map<string, RepoData[]>();
  repos.forEach((r) => {
    const cat = r.category;
    if (!categories.has(cat)) categories.set(cat, []);
    categories.get(cat)!.push(r);
  });

  categories.forEach((catRepos, category) => {
    if (focus && !category.toLowerCase().includes(focus.toLowerCase())) return;
    const allSignals = [...new Set(catRepos.flatMap((r) => r.innovationSignals))];
    if (allSignals.length >= 2 && catRepos.length >= 2) {
      ideas.push({
        title: `The Missing ${category} Platform`,
        tagline: `Filling the gap in ${category} with ${allSignals.slice(0, 2).join(" + ")}`,
        description: `After analyzing ${catRepos.length} top ${category} projects, we found a gap: no single solution combines ${allSignals.slice(0, 3).join(", ")}. This product fills that gap by creating a unified platform bringing together the best innovations from the ${category} ecosystem.`,
        targetAudience: `${category} developers and teams who need integrated solutions`,
        keyFeatures: [
          `Unified ${category} workflow management`,
          `Built-in ${allSignals[0]} capabilities`,
          `Seamless integration with top ${category} tools`,
          `Community-driven feature development`,
          `One-click configuration`,
        ],
        techStack: [...new Set(catRepos.map((r) => r.language).filter(Boolean) as string[])].slice(0, 4),
        inspiredBy: catRepos.slice(0, 3).map((r) => r.name),
        marketPotential: catRepos.length > 5 ? "high" : "medium",
        difficulty: "intermediate",
        monetization: ["Freemium", "Enterprise tier", "Plugin marketplace"],
        uniqueValue: `First platform to combine ${allSignals.slice(0, 2).join(" + ")} in ${category}`,
        strategy: "gap-analysis",
      });
    }
  });

  // Strategy 3: Trend-based
  const topLang = repos[0]?.language || "TypeScript";
  ideas.push({
    title: "Next-Gen Innovation Hub",
    tagline: "Riding the wave of emerging technology trends",
    description: `Based on trend analysis of ${repos.length} top repositories, this product creates a dedicated platform that accelerates development in the hottest emerging areas. By focusing exclusively on cutting-edge technology, we deliver a superior experience compared to general-purpose tools.`,
    targetAudience: "Early adopters and developers working with emerging technologies",
    keyFeatures: [
      "Pre-built templates and starters",
      "Integrated development environment",
      "Community showcase of projects",
      "Performance benchmarking tools",
      "Learning paths and documentation hub",
    ],
    techStack: [topLang, "Next.js", "Tailwind CSS", "Prisma"],
    inspiredBy: repos.slice(0, 3).map((r) => r.name),
    marketPotential: "high",
    difficulty: "advanced",
    monetization: ["SaaS subscription", "Premium templates", "Consulting"],
    uniqueValue: "First dedicated platform for emerging tech with integrated community",
    strategy: "trend-based",
  });

  return ideas.sort((a, b) => {
    const scoreA = a.marketPotential === "high" ? 3 : a.marketPotential === "medium" ? 2 : 1;
    const scoreB = b.marketPotential === "high" ? 3 : b.marketPotential === "medium" ? 2 : 1;
    return scoreB - scoreA;
  }).slice(0, 12);
}

async function generateIdeasWithAI(repos: RepoData[], focus?: string): Promise<any[]> {
  try {
    const repoSummaries = repos.slice(0, 15).map((r) => ({
      name: r.name,
      description: r.description,
      stars: r.stars,
      language: r.language,
      category: r.category,
      signals: r.innovationSignals,
    }));

    const prompt = `You are a world-class product strategist and startup ideator. Based on the following top GitHub repositories, generate 5 innovative product ideas.

TOP REPOSITORIES:
${JSON.stringify(repoSummaries, null, 2)}

${focus ? `FOCUS AREA: ${focus}` : ""}

Return ONLY valid JSON array with 5 idea objects.
Use cross-pollination (combining ideas from different repos), gap analysis (finding underserved niches), and trend extrapolation.`;

    const ideas = await llm.generateJSON(
      IdeasArraySchema,
      prompt,
      "You are a product strategy AI that generates innovative startup ideas. Always respond with valid JSON only.",
      { temperature: 0.9 }
    );

    return ideas;
  } catch (error) {
    console.error("AI generation failed, using local fallback:", error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repos, focus, useAI = true } = body as { repos: RepoData[]; focus?: string; useAI?: boolean };

    if (!repos || repos.length === 0) {
      return NextResponse.json({ success: false, error: "No repos provided for idea generation" }, { status: 400 });
    }

    // Try AI generation first
    let ideas: any[] = [];
    if (useAI) {
      ideas = await generateIdeasWithAI(repos, focus);
    }

    // Fallback to local generation
    if (ideas.length === 0) {
      ideas = generateIdeasLocally(repos, focus);
    }

    return NextResponse.json({
      success: true,
      ideas_generated: ideas.length,
      strategy: useAI ? "ai-enhanced" : "local",
      ideas,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
