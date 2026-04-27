import { NextRequest, NextResponse } from "next/server";

const GITHUB_API_BASE = "https://api.github.com";

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
}

async function githubFetch(endpoint: string): Promise<any> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "GitHub-Idea-Generator/1.0",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, { headers, next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
  return response.json();
}

function calculateTrendScore(repo: GitHubRepo): number {
  const now = new Date();
  const createdAt = new Date(repo.created_at);
  const pushedAt = new Date(repo.pushed_at);
  const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const daysSincePush = (now.getTime() - pushedAt.getTime()) / (1000 * 60 * 60 * 24);
  const starsPerDay = Math.min(repo.stargazers_count / Math.max(ageInDays, 1), 1000);
  const recencyFactor = Math.max(0, 1 - daysSincePush / 365);
  const forkRatio = repo.forks_count / Math.max(repo.stargazers_count, 1);
  const issueActivity = repo.open_issues_count / Math.max(repo.stargazers_count, 1);
  return Math.round((starsPerDay * 30 + recencyFactor * 40 + forkRatio * 15 + (1 - Math.min(issueActivity, 1)) * 15) * 100) / 100;
}

function estimateGrowthRate(repo: GitHubRepo): number {
  const ageInDays = (Date.now() - new Date(repo.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (ageInDays < 30) return 95;
  if (ageInDays < 90) return 80;
  if (ageInDays < 180) return 60;
  if (ageInDays < 365) return 40;
  const daysSincePush = (Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSincePush < 7) return 70;
  if (daysSincePush < 30) return 50;
  if (daysSincePush < 90) return 30;
  return 15;
}

function categorizeRepo(repo: GitHubRepo): string {
  const combined = `${(repo.topics || []).join(" ")} ${(repo.description || "").toLowerCase()} ${repo.name.toLowerCase()}`;
  const categories: Record<string, string[]> = {
    "AI/ML": ["ai", "machine-learning", "deep-learning", "llm", "gpt", "transformer", "nlp", "diffusion", "model", "inference"],
    "DevTools": ["cli", "developer-tools", "ide", "editor", "debugging", "testing", "ci-cd", "devops", "automation"],
    "Web Framework": ["framework", "web", "frontend", "backend", "fullstack", "react", "vue", "svelte", "nextjs"],
    "Data/Analytics": ["data", "analytics", "visualization", "dashboard", "database", "sql", "metrics"],
    "Security": ["security", "authentication", "encryption", "vulnerability"],
    "Cloud/Infra": ["cloud", "infrastructure", "kubernetes", "docker", "container", "serverless"],
    "Mobile": ["mobile", "ios", "android", "react-native", "flutter"],
    "Productivity": ["productivity", "note-taking", "task", "workflow"],
  };
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some((kw) => combined.includes(kw))) return category;
  }
  return "Other";
}

function extractInnovationSignals(repo: GitHubRepo): string[] {
  const signals: string[] = [];
  const combined = `${(repo.topics || []).join(" ")} ${(repo.description || "").toLowerCase()}`;
  const patterns: Record<string, string[]> = {
    "Novel AI Application": ["ai-powered", "llm-powered", "gpt", "generative", "ai-agent", "autonomous"],
    "Open Source Alternative": ["alternative", "open-source", "self-hosted"],
    "Developer Experience": ["dx", "developer-experience", "zero-config", "hot-reload"],
    "Privacy-First": ["privacy", "local-first", "offline-first", "end-to-end", "encrypted"],
    "Low/No Code": ["low-code", "no-code", "visual", "builder"],
    "Edge Computing": ["edge", "wasm", "webassembly", "serverless"],
    "Real-time": ["real-time", "streaming", "websocket", "live", "collaborative"],
    "API-First": ["api", "rest", "graphql", "sdk"],
  };
  for (const [signal, kws] of Object.entries(patterns)) {
    if (kws.some((p) => combined.includes(p))) signals.push(signal);
  }
  return signals;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const language = searchParams.get("language") || "";
    const topic = searchParams.get("topic") || "";
    const since = searchParams.get("since") || "weekly";
    const sort = searchParams.get("sort") || "stars";
    const limit = parseInt(searchParams.get("limit") || "25");
    const minStars = searchParams.get("min_stars");

    const queryParts: string[] = [];
    if (language) queryParts.push(`language:${language}`);
    if (topic) queryParts.push(`topic:${topic}`);
    if (minStars) queryParts.push(`stars:>=${minStars}`);

    const now = new Date();
    const sinceDate = since === "daily"
      ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
      : since === "weekly"
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    queryParts.push(`pushed:>=${sinceDate.toISOString().split("T")[0]}`);
    if (!minStars) queryParts.push("stars:>100");

    const query = encodeURIComponent(queryParts.join(" "));
    const sortParam = sort === "forks" ? "forks" : sort === "updated" ? "updated" : "stars";
    const data = await githubFetch(`/search/repositories?q=${query}&sort=${sortParam}&order=desc&per_page=${limit}`);
    const repos: GitHubRepo[] = data.items || [];

    const analyzed = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      url: repo.html_url,
      homepage: repo.homepage,
      topics: repo.topics || [],
      trendScore: calculateTrendScore(repo),
      growthRate: estimateGrowthRate(repo),
      category: categorizeRepo(repo),
      innovationSignals: extractInnovationSignals(repo),
      owner: repo.owner.login,
      ownerAvatar: repo.owner.avatar_url,
      lastPushed: repo.pushed_at,
      license: repo.license?.spdx_id,
    }));

    return NextResponse.json({ success: true, count: analyzed.length, repos: analyzed });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
