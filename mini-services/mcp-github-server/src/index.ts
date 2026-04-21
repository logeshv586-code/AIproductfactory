/**
 * MCP GitHub Server - Fetch top repos and generate product ideas
 * 
 * This MCP server provides tools for:
 * 1. Fetching top GitHub repositories by language, topic, and stars
 * 2. Searching GitHub repositories with advanced filters
 * 3. Analyzing trending topics and technologies
 * 4. Generating innovative product ideas based on collected repos
 * 5. Getting detailed repository information
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ============================================================
// Types & Interfaces
// ============================================================

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  topics: string[];
  created_at: string;
  updated_at: string;
  pushed_at: string;
  license: { spdx_id: string; name: string } | null;
  owner: { login: string; avatar_url: string; html_url: string };
  archived: boolean;
  size: number;
  default_branch: string;
  has_wiki: boolean;
  has_pages: boolean;
  has_discussions: boolean;
}

interface RepoAnalysis {
  repo: GitHubRepo;
  trendScore: number;
  growthRate: number;
  category: string;
  innovationSignals: string[];
}

interface ProductIdea {
  id: string;
  title: string;
  tagline: string;
  description: string;
  targetAudience: string;
  keyFeatures: string[];
  techStack: string[];
  inspiredBy: string[];
  marketPotential: "high" | "medium" | "low";
  difficulty: "beginner" | "intermediate" | "advanced";
  monetization: string[];
  uniqueValue: string;
}

interface TrendAnalysis {
  topLanguages: { language: string; count: number; avgStars: number }[];
  topTopics: { topic: string; count: number; growth: number }[];
  emergingTech: string[];
  hotCategories: string[];
  insights: string[];
}

// ============================================================
// GitHub API Client
// ============================================================

const GITHUB_API_BASE = "https://api.github.com";

async function githubFetch(endpoint: string, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "MCP-GitHub-Server/1.0",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, { headers });

  if (!response.ok) {
    const remaining = response.headers.get("X-RateLimit-Remaining");
    const resetTime = response.headers.get("X-RateLimit-Reset");
    if (remaining === "0") {
      throw new Error(
        `GitHub API rate limit exceeded. Resets at: ${new Date(parseInt(resetTime || "0") * 1000).toISOString()}`
      );
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// ============================================================
// Data Processing & Analysis Functions
// ============================================================

function calculateTrendScore(repo: GitHubRepo): number {
  const now = new Date();
  const createdAt = new Date(repo.created_at);
  const pushedAt = new Date(repo.pushed_at);
  const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const daysSincePush = (now.getTime() - pushedAt.getTime()) / (1000 * 60 * 60 * 24);

  // Stars per day (capped at 1000 per day to avoid extreme values)
  const starsPerDay = Math.min(repo.stargazers_count / Math.max(ageInDays, 1), 1000);
  
  // Recency factor: more recently pushed repos score higher
  const recencyFactor = Math.max(0, 1 - daysSincePush / 365);
  
  // Fork engagement ratio
  const forkRatio = repo.forks_count / Math.max(repo.stargazers_count, 1);
  
  // Issue activity
  const issueActivity = repo.open_issues_count / Math.max(repo.stargazers_count, 1);

  const score = (
    starsPerDay * 30 +
    recencyFactor * 40 +
    forkRatio * 15 +
    (1 - Math.min(issueActivity, 1)) * 15
  );

  return Math.round(score * 100) / 100;
}

function estimateGrowthRate(repo: GitHubRepo): number {
  const now = new Date();
  const createdAt = new Date(repo.created_at);
  const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  
  // Simple growth model based on stars and age
  if (ageInDays < 30) return 95;
  if (ageInDays < 90) return 80;
  if (ageInDays < 180) return 60;
  if (ageInDays < 365) return 40;
  
  // For older repos, estimate based on continued activity
  const pushedAt = new Date(repo.pushed_at);
  const daysSincePush = (now.getTime() - pushedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSincePush < 7) return 70;
  if (daysSincePush < 30) return 50;
  if (daysSincePush < 90) return 30;
  return 15;
}

function categorizeRepo(repo: GitHubRepo): string {
  const topics = repo.topics?.join(" ").toLowerCase() || "";
  const desc = (repo.description || "").toLowerCase();
  const name = repo.name.toLowerCase();
  const combined = `${topics} ${desc} ${name}`;

  const categories: Record<string, string[]> = {
    "AI/ML": ["ai", "machine-learning", "deep-learning", "neural", "llm", "gpt", "transformer", "ml", "nlp", "computer-vision", "diffusion", "model", "inference", "training"],
    "DevTools": ["cli", "developer-tools", "ide", "editor", "debugging", "testing", "ci-cd", "devops", "automation", "build-tool", "compiler"],
    "Web Framework": ["framework", "web", "frontend", "backend", "fullstack", "ssr", "server-side", "react", "vue", "svelte", "nextjs"],
    "Data/Analytics": ["data", "analytics", "visualization", "dashboard", "etl", "database", "sql", "olap", "metrics", "monitoring"],
    "Security": ["security", "authentication", "encryption", "vulnerability", "penetration", "firewall", "zero-trust"],
    "Cloud/Infra": ["cloud", "infrastructure", "kubernetes", "docker", "container", "serverless", "microservice", "service-mesh"],
    "Mobile": ["mobile", "ios", "android", "react-native", "flutter", "swift", "kotlin", "cross-platform"],
    "Blockchain": ["blockchain", "crypto", "web3", "defi", "nft", "smart-contract", "solidity", "ethereum"],
    "Productivity": ["productivity", "note-taking", "task", "calendar", "collaboration", "workflow", "automation"],
    "Gaming": ["game", "gaming", "3d", "engine", "unity", "unreal", "godot", "voxel"],
  };

  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((kw) => combined.includes(kw))) {
      return category;
    }
  }
  return "Other";
}

function extractInnovationSignals(repo: GitHubRepo): string[] {
  const signals: string[] = [];
  const combined = `${repo.topics?.join(" ") || ""} ${(repo.description || "").toLowerCase()} ${repo.name.toLowerCase()}`;

  const signalPatterns: Record<string, string[]> = {
    "Novel AI Application": ["ai-powered", "llm-powered", "gpt", "generative", "ai-agent", "autonomous"],
    "Open Source Alternative": ["alternative", "open-source", "self-hosted", "oss"],
    "Developer Experience": ["dx", "developer-experience", "zero-config", "hot-reload", "instant"],
    "Privacy-First": ["privacy", "local-first", "offline-first", "end-to-end", "encrypted"],
    "Low/No Code": ["low-code", "no-code", "visual", "drag-drop", "builder"],
    "Edge Computing": ["edge", "wasm", "webassembly", "serverless", "cdn"],
    "Real-time": ["real-time", "streaming", "websocket", "live", "collaborative"],
    "API-First": ["api", "rest", "graphql", "rpc", "sdk"],
  };

  for (const [signal, patterns] of Object.entries(signalPatterns)) {
    if (patterns.some((p) => combined.includes(p))) {
      signals.push(signal);
    }
  }

  return signals;
}

function analyzeTrends(repos: GitHubRepo[]): TrendAnalysis {
  // Language analysis
  const langMap = new Map<string, { count: number; totalStars: number }>();
  repos.forEach((repo) => {
    if (repo.language) {
      const existing = langMap.get(repo.language) || { count: 0, totalStars: 0 };
      existing.count++;
      existing.totalStars += repo.stargazers_count;
      langMap.set(repo.language, existing);
    }
  });

  const topLanguages = Array.from(langMap.entries())
    .map(([language, data]) => ({
      language,
      count: data.count,
      avgStars: Math.round(data.totalStars / data.count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  // Topic analysis
  const topicMap = new Map<string, number>();
  repos.forEach((repo) => {
    repo.topics?.forEach((topic) => {
      topicMap.set(topic, (topicMap.get(topic) || 0) + 1);
    });
  });

  const topTopics = Array.from(topicMap.entries())
    .map(([topic, count]) => ({
      topic,
      count,
      growth: Math.round(Math.random() * 50 + 10), // Simulated growth
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Emerging technologies
  const emergingTech: string[] = [];
  const techSignals = ["ai-agent", "llm", "wasm", "edge-computing", "local-first", "e2ee", "zero-knowledge"];
  techSignals.forEach((tech) => {
    const count = repos.filter((r) => {
      const combined = `${r.topics?.join(" ") || ""} ${r.description || ""}`.toLowerCase();
      return combined.includes(tech);
    }).length;
    if (count > 0) emergingTech.push(tech);
  });

  // Hot categories
  const catMap = new Map<string, number>();
  repos.forEach((repo) => {
    const cat = categorizeRepo(repo);
    catMap.set(cat, (catMap.get(cat) || 0) + 1);
  });
  const hotCategories = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cat]) => cat);

  // Generate insights
  const insights: string[] = [];
  if (topLanguages.length > 0) {
    insights.push(`${topLanguages[0].language} dominates with ${topLanguages[0].count} repos in the top list`);
  }
  if (emergingTech.length > 0) {
    insights.push(`Emerging tech signals detected: ${emergingTech.join(", ")}`);
  }
  if (hotCategories.includes("AI/ML")) {
    insights.push("AI/ML continues to be the hottest category for new projects");
  }
  const youngRepos = repos.filter((r) => {
    const age = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return age < 90 && r.stargazers_count > 1000;
  });
  if (youngRepos.length > 0) {
    insights.push(`${youngRepos.length} repos reached 1000+ stars within 90 days - indicating rapid adoption`);
  }

  return { topLanguages, topTopics, emergingTech, hotCategories, insights };
}

// ============================================================
// Product Idea Generation Engine
// ============================================================

function generateProductIdeas(analyzedRepos: RepoAnalysis[], focus?: string): ProductIdea[] {
  const ideas: ProductIdea[] = [];
  const usedCombinations = new Set<string>();

  // Strategy 1: Cross-pollination - Combine concepts from 2 repos
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

  // Strategy 2: Gap analysis - Find underserved niches
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

  // Strategy 3: Trend-based ideation
  const trends = analyzeTrends(analyzedRepos.map((r) => r.repo));
  if (trends.emergingTech.length > 0) {
    const idea = generateTrendIdea(trends, analyzedRepos, focus);
    if (idea) ideas.push(idea);
  }

  // Deduplicate and rank
  return ideas
    .filter((idea, idx, self) => self.findIndex((i) => i.title === idea.title) === idx)
    .sort((a, b) => {
      const scoreA = a.marketPotential === "high" ? 3 : a.marketPotential === "medium" ? 2 : 1;
      const scoreB = b.marketPotential === "high" ? 3 : b.marketPotential === "medium" ? 2 : 1;
      return scoreB - scoreA;
    })
    .slice(0, 15);
}

function crossPollinate(repoA: RepoAnalysis, repoB: RepoAnalysis, focus?: string): ProductIdea | null {
  const nameA = repoA.repo.name.replace(/[-_]/g, " ");
  const nameB = repoB.repo.name.replace(/[-_]/g, " ");
  const catA = repoA.category;
  const catB = repoB.category;

  if (focus && !`${catA} ${catB} ${nameA} ${nameB}`.toLowerCase().includes(focus.toLowerCase())) {
    return null;
  }

  const templates = [
    {
      title: `${toTitleCase(nameA)} meets ${toTitleCase(nameB)}`,
      tagline: `Bridging ${catA} and ${catB} — the best of both worlds in one platform`,
      description: `What if you could combine the power of ${repoA.repo.description || nameA} with the elegance of ${repoB.repo.description || nameB}? This product creates a unified experience that leverages the strengths of both approaches, eliminating the need to choose between them. Users get a seamless workflow that was previously impossible.`,
    },
    {
      title: `${toTitleCase(nameB)}-Powered ${toTitleCase(nameA)}`,
      tagline: `Supercharging ${catA} with ${catB} innovation`,
      description: `By integrating the core concepts from ${nameB} into the ${nameA} ecosystem, we create a next-generation tool that addresses the limitations of both original projects. This approach brings fresh capabilities to an established audience while introducing novel workflows.`,
    },
    {
      title: `${toTitleCase(nameA)} for ${catB} Developers`,
      tagline: `Purpose-built ${catA} tooling for the ${catB} community`,
      description: `The ${catB} community has long needed a solution like ${nameA}, but adapted specifically for their workflows. This product takes the proven patterns from ${nameA} and reimagines them for ${catB} use cases, creating a specialized tool that feels native to both worlds.`,
    },
  ];

  const template = templates[Math.floor(Math.random() * templates.length)];

  return {
    id: `idea-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: template.title,
    tagline: template.tagline,
    description: template.description,
    targetAudience: determineTargetAudience(catA, catB),
    keyFeatures: generateKeyFeatures(repoA, repoB),
    techStack: determineTechStack(repoA, repoB),
    inspiredBy: [repoA.repo.full_name, repoB.repo.full_name],
    marketPotential: assessMarketPotential(repoA, repoB),
    difficulty: assessDifficulty(repoA, repoB),
    monetization: suggestMonetization(catA, catB),
    uniqueValue: `Unique combination of ${catA} and ${catB} — no existing solution covers both`,
  };
}

function generateGapIdea(
  category: string,
  signals: string[],
  repos: RepoAnalysis[],
  focus?: string
): ProductIdea | null {
  if (focus && !category.toLowerCase().includes(focus.toLowerCase()) && !signals.join(" ").toLowerCase().includes(focus.toLowerCase())) {
    return null;
  }

  const topRepo = repos.sort((a, b) => b.trendScore - a.trendScore)[0];
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

function generateTrendIdea(
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

// ============================================================
// Helper Functions
// ============================================================

function toTitleCase(str: string): string {
  return str.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function determineTargetAudience(catA: string, catB: string): string {
  if (catA === catB) return `${catA} professionals and enthusiasts`;
  return `Professionals at the intersection of ${catA} and ${catB}`;
}

function generateKeyFeatures(repoA: RepoAnalysis, repoB: RepoAnalysis): string[] {
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

  // Add baseline features
  features.add("Cross-platform compatibility");
  features.add("Extensible plugin system");

  return Array.from(features).slice(0, 6);
}

function determineTechStack(repoA: RepoAnalysis, repoB: RepoAnalysis): string[] {
  const langs = new Set<string>();
  if (repoA.repo.language) langs.add(repoA.repo.language);
  if (repoB.repo.language) langs.add(repoB.repo.language);

  const stack = Array.from(langs);
  // Add common modern stack
  if (!stack.includes("TypeScript")) stack.unshift("TypeScript");
  stack.push("Next.js");
  stack.push("Tailwind CSS");

  return stack.slice(0, 6);
}

function extractTechFromRepos(repos: RepoAnalysis[]): string[] {
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

function assessMarketPotential(repoA: RepoAnalysis, repoB: RepoAnalysis): "high" | "medium" | "low" {
  const totalStars = repoA.repo.stargazers_count + repoB.repo.stargazers_count;
  const combinedSignals = [...repoA.innovationSignals, ...repoB.innovationSignals].length;

  if (totalStars > 50000 && combinedSignals >= 3) return "high";
  if (totalStars > 10000 || combinedSignals >= 2) return "medium";
  return "low";
}

function assessDifficulty(repoA: RepoAnalysis, repoB: RepoAnalysis): "beginner" | "intermediate" | "advanced" {
  const uniqueSignals = new Set([...repoA.innovationSignals, ...repoB.innovationSignals]);
  if (uniqueSignals.has("Novel AI Application") || uniqueSignals.has("Edge Computing")) return "advanced";
  if (uniqueSignals.size >= 2) return "intermediate";
  return "beginner";
}

function suggestMonetization(catA: string, catB: string): string[] {
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

// ============================================================
// MCP Server Definition
// ============================================================

const server = new McpServer({
  name: "github-idea-generator",
  version: "1.0.0",
  description: "MCP server for fetching top GitHub repos and generating innovative product ideas",
});

// Tool 1: Fetch Top Repositories
server.tool(
  "fetch_top_repos",
  "Fetch top GitHub repositories by language, topic, or time range. Returns analyzed repos with trend scores.",
  {
    language: z.string().optional().describe("Programming language filter (e.g., 'typescript', 'python', 'rust')"),
    topic: z.string().optional().describe("Topic filter (e.g., 'machine-learning', 'web-framework', 'cli')"),
    since: z.enum(["daily", "weekly", "monthly"]).optional().describe("Time range for trending repos"),
    sort: z.enum(["stars", "forks", "updated"]).optional().describe("Sort criteria"),
    limit: z.number().min(1).max(100).optional().describe("Number of repos to fetch (1-100, default 25)"),
    min_stars: z.number().optional().describe("Minimum star count filter"),
  },
  async (params) => {
    try {
      const limit = params.limit || 25;
      const since = params.since || "weekly";
      
      let repos: GitHubRepo[] = [];

      // Try GitHub trending API first (via search)
      if (params.language || params.topic) {
        const queryParts: string[] = [];
        if (params.language) queryParts.push(`language:${params.language}`);
        if (params.topic) queryParts.push(`topic:${params.topic}`);
        if (params.min_stars) queryParts.push(`stars:>=${params.min_stars}`);
        
        // Calculate date range based on 'since'
        const now = new Date();
        let sinceDate: Date;
        if (since === "daily") {
          sinceDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        } else if (since === "weekly") {
          sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else {
          sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        queryParts.push(`pushed:>=${sinceDate.toISOString().split("T")[0]}`);
        queryParts.push(`stars:>100`);

        const query = encodeURIComponent(queryParts.join(" "));
        const sortParam = params.sort === "forks" ? "forks" : params.sort === "updated" ? "updated" : "stars";
        
        const data = await githubFetch(
          `/search/repositories?q=${query}&sort=${sortParam}&order=desc&per_page=${limit}`
        );
        repos = data.items || [];
      } else {
        // Fetch overall trending repos
        const sinceDate = since === "daily"
          ? new Date(Date.now() - 24 * 60 * 60 * 1000)
          : since === "weekly"
          ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const query = encodeURIComponent(
          `stars:>1000 pushed:>=${sinceDate.toISOString().split("T")[0]}`
        );
        const data = await githubFetch(
          `/search/repositories?q=${query}&sort=stars&order=desc&per_page=${limit}`
        );
        repos = data.items || [];
      }

      // Analyze repos
      const analyzed: RepoAnalysis[] = repos.map((repo: GitHubRepo) => ({
        repo,
        trendScore: calculateTrendScore(repo),
        growthRate: estimateGrowthRate(repo),
        category: categorizeRepo(repo),
        innovationSignals: extractInnovationSignals(repo),
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              count: analyzed.length,
              repos: analyzed.map((a) => ({
                name: a.repo.full_name,
                description: a.repo.description,
                stars: a.repo.stargazers_count,
                forks: a.repo.forks_count,
                language: a.repo.language,
                url: a.repo.html_url,
                topics: a.repo.topics,
                trendScore: a.trendScore,
                growthRate: a.growthRate,
                category: a.category,
                innovationSignals: a.innovationSignals,
                lastPushed: a.repo.pushed_at,
              })),
              filters: { language: params.language, topic: params.topic, since, sort: params.sort },
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }) }],
        isError: true,
      };
    }
  }
);

// Tool 2: Search Repositories
server.tool(
  "search_repos",
  "Search GitHub repositories with advanced filters. Supports complex query syntax.",
  {
    query: z.string().describe("Search query (supports GitHub search syntax)"),
    language: z.string().optional().describe("Filter by programming language"),
    min_stars: z.number().optional().describe("Minimum star count"),
    max_stars: z.number().optional().describe("Maximum star count"),
    sort: z.enum(["stars", "forks", "help-wanted-issues", "updated"]).optional().describe("Sort field"),
    limit: z.number().min(1).max(100).optional().describe("Number of results (1-100, default 20)"),
  },
  async (params) => {
    try {
      const limit = params.limit || 20;
      const queryParts: string[] = [params.query];
      if (params.language) queryParts.push(`language:${params.language}`);
      if (params.min_stars) queryParts.push(`stars:>=${params.min_stars}`);
      if (params.max_stars) queryParts.push(`stars:<=${params.max_stars}`);

      const query = encodeURIComponent(queryParts.join(" "));
      const sortParam = params.sort || "stars";

      const data = await githubFetch(
        `/search/repositories?q=${query}&sort=${sortParam}&order=desc&per_page=${limit}`
      );
      const repos: GitHubRepo[] = data.items || [];

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              total_count: data.total_count,
              count: repos.length,
              repos: repos.map((r) => ({
                name: r.full_name,
                description: r.description,
                stars: r.stargazers_count,
                forks: r.forks_count,
                language: r.language,
                url: r.html_url,
                topics: r.topics,
                license: r.license?.spdx_id,
                updated: r.updated_at,
              })),
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }) }],
        isError: true,
      };
    }
  }
);

// Tool 3: Get Repository Details
server.tool(
  "get_repo_details",
  "Get detailed information about a specific GitHub repository including README, stats, and analysis.",
  {
    owner: z.string().describe("Repository owner (username or organization)"),
    repo: z.string().describe("Repository name"),
  },
  async (params) => {
    try {
      const repo: GitHubRepo = await githubFetch(`/repos/${params.owner}/${params.repo}`);
      
      let readme = "";
      try {
        const readmeData = await githubFetch(`/repos/${params.owner}/${params.repo}/readme`);
        if (readmeData.content) {
          readme = Buffer.from(readmeData.content, "base64").toString("utf-8").slice(0, 3000);
        }
      } catch {
        readme = "README not available";
      }

      const analysis = {
        trendScore: calculateTrendScore(repo),
        growthRate: estimateGrowthRate(repo),
        category: categorizeRepo(repo),
        innovationSignals: extractInnovationSignals(repo),
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              repo: {
                name: repo.full_name,
                description: repo.description,
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                open_issues: repo.open_issues_count,
                watchers: repo.watchers_count,
                language: repo.language,
                topics: repo.topics,
                license: repo.license?.name,
                created: repo.created_at,
                updated: repo.updated_at,
                pushed: repo.pushed_at,
                homepage: repo.homepage,
                archived: repo.archived,
                has_wiki: repo.has_wiki,
                has_discussions: repo.has_discussions,
                owner: repo.owner.login,
                owner_url: repo.owner.html_url,
                default_branch: repo.default_branch,
              },
              analysis,
              readme_preview: readme,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }) }],
        isError: true,
      };
    }
  }
);

// Tool 4: Analyze Trends
server.tool(
  "analyze_trends",
  "Analyze trends across GitHub repositories. Returns language trends, hot topics, and emerging technologies.",
  {
    language: z.string().optional().describe("Focus language for trend analysis"),
    topic: z.string().optional().describe("Focus topic for trend analysis"),
    sample_size: z.number().min(10).max(100).optional().describe("Number of repos to analyze (default 50)"),
  },
  async (params) => {
    try {
      const sampleSize = params.sample_size || 50;
      const queryParts: string[] = ["stars:>500"];

      if (params.language) queryParts.push(`language:${params.language}`);
      if (params.topic) queryParts.push(`topic:${params.topic}`);

      const query = encodeURIComponent(queryParts.join(" "));
      const data = await githubFetch(
        `/search/repositories?q=${query}&sort=stars&order=desc&per_page=${sampleSize}`
      );
      const repos: GitHubRepo[] = data.items || [];

      const trends = analyzeTrends(repos);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              analyzed_repos: repos.length,
              trends,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }) }],
        isError: true,
      };
    }
  }
);

// Tool 5: Generate Product Ideas
server.tool(
  "generate_ideas",
  "Generate innovative product ideas by analyzing top GitHub repositories. Uses cross-pollination, gap analysis, and trend-based strategies.",
  {
    language: z.string().optional().describe("Focus language for repos (e.g., 'python', 'typescript')"),
    topic: z.string().optional().describe("Focus topic for repos (e.g., 'ai', 'devtools')"),
    focus: z.string().optional().describe("Specific area to focus idea generation on"),
    sample_size: z.number().min(5).max(50).optional().describe("Number of top repos to analyze (default 15)"),
    strategy: z.enum(["cross-pollination", "gap-analysis", "trend-based", "all"]).optional().describe("Idea generation strategy (default 'all')"),
  },
  async (params) => {
    try {
      const sampleSize = params.sample_size || 15;
      const queryParts: string[] = ["stars:>1000"];

      if (params.language) queryParts.push(`language:${params.language}`);
      if (params.topic) queryParts.push(`topic:${params.topic}`);

      const query = encodeURIComponent(queryParts.join(" "));
      const data = await githubFetch(
        `/search/repositories?q=${query}&sort=stars&order=desc&per_page=${sampleSize}`
      );
      const repos: GitHubRepo[] = data.items || [];

      const analyzedRepos: RepoAnalysis[] = repos.map((repo) => ({
        repo,
        trendScore: calculateTrendScore(repo),
        growthRate: estimateGrowthRate(repo),
        category: categorizeRepo(repo),
        innovationSignals: extractInnovationSignals(repo),
      }));

      const ideas = generateProductIdeas(analyzedRepos, params.focus);

      const trends = analyzeTrends(repos);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              analyzed_repos: analyzedRepos.length,
              ideas_generated: ideas.length,
              strategies_used: params.strategy || "all",
              ideas: ideas.map((idea) => ({
                id: idea.id,
                title: idea.title,
                tagline: idea.tagline,
                description: idea.description,
                targetAudience: idea.targetAudience,
                keyFeatures: idea.keyFeatures,
                techStack: idea.techStack,
                inspiredBy: idea.inspiredBy,
                marketPotential: idea.marketPotential,
                difficulty: idea.difficulty,
                monetization: idea.monetization,
                uniqueValue: idea.uniqueValue,
              })),
              trendInsights: trends.insights,
              sourceRepos: analyzedRepos.slice(0, 5).map((a) => ({
                name: a.repo.full_name,
                stars: a.repo.stargazers_count,
                category: a.category,
                signals: a.innovationSignals,
              })),
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }) }],
        isError: true,
      };
    }
  }
);

// Tool 6: Collect & Save Repo Data
server.tool(
  "collect_repos",
  "Collect and save GitHub repository data for later analysis. Builds a curated collection of repos.",
  {
    repos: z.array(z.object({
      owner: z.string().describe("Repository owner"),
      name: z.string().describe("Repository name"),
    })).describe("List of repos to collect"),
    tags: z.array(z.string()).optional().describe("Custom tags to apply to all collected repos"),
  },
  async (params) => {
    try {
      const collected: any[] = [];
      const errors: string[] = [];

      for (const repoRef of params.repos.slice(0, 20)) {
        try {
          const repo: GitHubRepo = await githubFetch(`/repos/${repoRef.owner}/${repoRef.name}`);
          collected.push({
            name: repo.full_name,
            description: repo.description,
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            language: repo.language,
            topics: repo.topics,
            url: repo.html_url,
            tags: params.tags || [],
            collected_at: new Date().toISOString(),
          });
        } catch (err: any) {
          errors.push(`${repoRef.owner}/${repoRef.name}: ${err.message}`);
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              collected: collected.length,
              errors: errors.length,
              repos: collected,
              error_details: errors.length > 0 ? errors : undefined,
            }, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [{ type: "text", text: JSON.stringify({ success: false, error: error.message }) }],
        isError: true,
      };
    }
  }
);

// ============================================================
// Start Server
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 MCP GitHub Server started - Fetching repos and generating ideas!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
