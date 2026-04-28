// ============================================================
// Repo Selector — LLM-Driven Intent-Based Repo Selection
// Understands user intent → picks BEST repos → builds product
// ============================================================

import { generate, generateJSON, embed, cosineSimilarity } from "@/llm/provider";
import { CapabilityCategory } from "@/lib/agents/types";

export interface UserIntent {
  domain: string;
  features: string[];
  techPreferences: string[];
  capabilities: CapabilityCategory[];
  summary: string;
  requiredRoles?: string[]; // Added for targeted retries
}

export interface RankedRepo {
  name: string;
  description: string;
  score: number;
  reason: string;
  role: CapabilityCategory | "general" | string;
  confidence: number;
}

/**
 * Step 1: Extract structured intent from user input
 */
export async function extractIntent(userInput: string): Promise<UserIntent> {
  const prompt = `Extract structured intent from this product idea:

"${userInput}"

Return JSON with:
{
  "domain": "the primary domain (e.g., AI, DevTools, Healthcare)",
  "features": ["list of key features needed"],
  "techPreferences": ["preferred technologies mentioned"],
  "capabilities": ["which of these are needed: memory, agent, rag, ui, automation, model-serving, data, security, infra, communication"],
  "summary": "one sentence summary of what the user wants to build"
}`;

  try {
    const intent = await generateJSON<UserIntent>(prompt, "You are a product analysis AI. Be precise and actionable.");
    return intent;
  } catch {
    // Fallback: keyword-based intent extraction
    return extractIntentLocal(userInput);
  }
}

/**
 * Step 2: Rank repos based on intent using LLM
 */
export async function rankRepos(
  repos: Array<{ name: string; description: string | null; stars: number; language: string | null; topics: string[] }>,
  intent: UserIntent
): Promise<RankedRepo[]> {
  const roleToQueryMap: Record<string, string[]> = {
    'workflow': ['n8n', 'temporal', 'airflow', 'zapier'],
    'execution': ['playwright', 'selenium', 'puppeteer', 'webdriver'],
    'agent': ['autogen', 'langchain', 'llamaindex', 'crewai'],
    'orchestration': ['langgraph']
  };

  const targetedQueries: string[] = [];
  if (intent.requiredRoles) {
    intent.requiredRoles.forEach(role => {
      if (roleToQueryMap[role]) {
        targetedQueries.push(...roleToQueryMap[role]);
      }
    });
  }

  const prompt = `You are selecting the BEST repositories to build a product.

User Intent:
${JSON.stringify(intent, null, 2)}

Targeted Overrides (Must strongly prioritize if present): ${targetedQueries.join(', ')}

Available Repositories:
${repos.map((r, i) => `${i + 1}. ${r.name}: ${r.description || "No description"} (${r.stars} stars, ${r.language || "unknown"})`).join("\n")}

Return top 7 repos as JSON array:
[
  {
    "name": "repo full name",
    "description": "brief description",
    "score": 0-10,
    "reason": "why this repo fits the intent",
    "role": "memory | agent | rag | ui | automation | model-serving | data | security | infra | communication | general",
    "confidence": 0.0-1.0
  }
]`;

  try {
    const ranked = await generateJSON<RankedRepo[]>(prompt, "You are an expert repo selector AI. Be critical and selective.");
    return ranked.sort((a, b) => b.score - a.score);
  } catch {
    // Fallback: semantic similarity ranking
    return rankReposLocal(repos, intent, targetedQueries);
  }
}

/**
 * Full selector pipeline: Extract intent → Rank repos → Return top picks
 */
export async function selectBestRepos(
  userInput: string,
  repos: Array<{ name: string; description: string | null; stars: number; language: string | null; topics: string[] }>
): Promise<{ intent: UserIntent; rankedRepos: RankedRepo[] }> {
  const intent = await extractIntent(userInput);
  const rankedRepos = await rankRepos(repos, intent);
  return { intent, rankedRepos };
}

/**
 * Retries or runs targeted matching.
 */
export async function selectBestReposFromIntent(
  intent: UserIntent,
  repos: Array<{ name: string; description: string | null; stars: number; language: string | null; topics: string[] }>
): Promise<{ intent: UserIntent; rankedRepos: RankedRepo[] }> {
  const rankedRepos = await rankRepos(repos, intent);
  return { intent, rankedRepos };
}

// ============================================================
// Fallback: Local keyword-based extraction
// ============================================================

function extractIntentLocal(userInput: string): UserIntent {
  const lower = userInput.toLowerCase();
  const capabilities: CapabilityCategory[] = [];

  const capKeywords: Record<CapabilityCategory, string[]> = {
    memory: ["database", "storage", "vector", "memory", "cache", "redis", "db"],
    agent: ["agent", "autonomous", "copilot", "assistant", "bot", "workflow"],
    rag: ["search", "retrieval", "rag", "document", "knowledge", "semantic"],
    ui: ["dashboard", "interface", "frontend", "ui", "visualization", "react"],
    automation: ["automat", "schedule", "pipeline", "ci/cd", "trigger", "cron"],
    "model-serving": ["model", "llm", "gpt", "inference", "ai", "ml", "deploy"],
    data: ["data", "analytics", "etl", "stream", "metrics"],
    security: ["security", "auth", "encrypt", "privacy"],
    infra: ["docker", "kubernetes", "cloud", "deploy", "infrastructure"],
    communication: ["chat", "real-time", "message", "notification"],
  };

  for (const [cap, keywords] of Object.entries(capKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      capabilities.push(cap as CapabilityCategory);
    }
  }

  if (capabilities.length === 0) capabilities.push("agent", "rag");

  return {
    domain: "Technology",
    features: userInput.split(" ").filter((w) => w.length > 4).slice(0, 5),
    techPreferences: [],
    capabilities,
    summary: userInput.slice(0, 200),
  };
}

async function rankReposLocal(
  repos: Array<{ name: string; description: string | null; stars: number; language: string | null; topics: string[] }>,
  intent: UserIntent,
  targetedQueries: string[] = []
): Promise<RankedRepo[]> {
  const intentText = `${intent.domain} ${intent.features.join(" ")} ${intent.capabilities.join(" ")} ${targetedQueries.join(" ")}`;

  const scored = repos.map((repo) => {
    const repoText = `${repo.name} ${repo.description || ""} ${repo.topics.join(" ")}`.toLowerCase();
    const intentLower = intentText.toLowerCase();

    // Simple keyword overlap scoring
    const intentWords = intentLower.split(/\s+/);
    const matchCount = intentWords.filter((w) => w.length > 2 && repoText.includes(w)).length;
    let keywordScore = Math.min(matchCount / Math.max(intentWords.length, 1) * 10, 10);
    
    // Targeted boost
    if (targetedQueries.some(q => repoText.includes(q.toLowerCase()))) {
      keywordScore += 5; // Heavy boost for explicitly targeting
    }

    // Star-based popularity score
    const starScore = Math.min(repo.stars / 10000, 3);

    // Combined score
    const totalScore = keywordScore * 0.7 + starScore * 0.3;

    // Determine role
    const role = determineRole(repoText);

    return {
      name: repo.name,
      description: repo.description || "",
      score: Math.round(totalScore * 10) / 10,
      reason: `Matches ${matchCount} intent keywords with ${repo.stars} stars`,
      role,
      confidence: Math.min(totalScore / 10, 1),
    } as RankedRepo;
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 7);
}

function determineRole(repoText: string): CapabilityCategory {
  const roleScores: Record<CapabilityCategory, number> = {
    memory: 0, agent: 0, rag: 0, ui: 0, automation: 0,
    "model-serving": 0, data: 0, security: 0, infra: 0, communication: 0,
  };

  const roleKeywords: Record<CapabilityCategory, string[]> = {
    memory: ["vector", "embed", "chroma", "redis", "database", "storage", "db"],
    agent: ["agent", "langchain", "langgraph", "crewai", "autogen", "orchestrat"],
    rag: ["rag", "retrieval", "search", "semantic", "llamaindex", "document"],
    ui: ["react", "vue", "frontend", "dashboard", "ui", "component"],
    automation: ["automation", "workflow", "pipeline", "n8n", "trigger"],
    "model-serving": ["inference", "serving", "deploy", "llm", "gpt", "model"],
    data: ["data", "analytics", "etl", "stream", "kafka"],
    security: ["security", "auth", "oauth", "encryption"],
    infra: ["docker", "kubernetes", "cloud", "terraform", "nginx"],
    communication: ["chat", "websocket", "real-time", "message"],
  };

  for (const [role, keywords] of Object.entries(roleKeywords)) {
    roleScores[role as CapabilityCategory] = keywords.filter((kw) => repoText.includes(kw)).length;
  }

  const bestRole = Object.entries(roleScores).sort(([, a], [, b]) => b - a)[0];
  return (bestRole[1] > 0 ? bestRole[0] : "agent") as CapabilityCategory;
}
