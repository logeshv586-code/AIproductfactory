/**
 * Intent Classifier — Domain-aware repo selection
 * ------------------------------------------------
 * Turns a raw user idea into:
 *   • domain tags (rpa, agents, ml, web, data, devops, mobile, security…)
 *   • high-signal GitHub search queries (NOT just popular language searches)
 *   • a negative filter list (awesome-*, tutorials, algorithms collections…)
 *   • a keyword set used to boost domain-matching repos in scoring
 *
 * This is the missing layer that previously caused queries like
 *   "Python stars:>100"
 * to return system-design-primer / awesome-python / TheAlgorithms / tensorflow
 * for an "RPA + autonomous agents" idea.
 */

export type DomainTag =
  | "rpa"
  | "agents"
  | "browser-automation"
  | "workflow"
  | "orchestration"
  | "llm"
  | "ml"
  | "rag"
  | "vector-db"
  | "web"
  | "mobile"
  | "data"
  | "devops"
  | "security"
  | "realtime"
  | "ui"

export interface IntentProfile {
  /** Sorted by descending confidence. First entry is the "primary" domain. */
  tags: DomainTag[]
  /** GitHub `q=` strings ready to send to /search/repositories */
  queries: string[]
  /** Words that, if found in repo name/description/topics, boost score */
  positiveKeywords: string[]
  /** Substrings that immediately disqualify or heavily penalize a repo */
  negativeFilters: string[]
  /** Confidence 0..1 in the classification */
  confidence: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain dictionary — order matters (first match wins ties for "primary" tag)
// ─────────────────────────────────────────────────────────────────────────────

interface DomainDef {
  tag: DomainTag
  /** Trigger words in the user idea (lowercase) */
  triggers: string[]
  /** GitHub query templates — each becomes one search call */
  queries: string[]
  /** Used by scorer to boost matching repos */
  keywords: string[]
}

const DOMAINS: DomainDef[] = [
  {
    tag: "rpa",
    triggers: ["rpa", "robotic process", "process automation", "screen scraping", "uipath", "automation anywhere"],
    queries: [
      "topic:rpa stars:>200",
      "robotic process automation stars:>200",
      "topic:automation language:Python stars:>500",
    ],
    keywords: ["rpa", "automation", "robotic", "uipath", "robocorp", "taskt"],
  },
  {
    tag: "agents",
    triggers: ["agent", "autonomous", "copilot", "assistant", "multi-agent", "agentic"],
    queries: [
      "topic:llm-agent stars:>500",
      "topic:agent stars:>1000 language:Python",
      "autonomous agents stars:>500",
      "langchain OR langgraph OR crewai OR autogen stars:>1000",
    ],
    keywords: ["agent", "langchain", "langgraph", "crewai", "autogen", "autogpt", "babyagi", "agentic"],
  },
  {
    tag: "browser-automation",
    triggers: ["browser", "scraping", "web scrap", "crawl", "playwright", "puppeteer", "selenium"],
    queries: [
      "topic:browser-automation stars:>500",
      "playwright OR puppeteer OR selenium stars:>2000",
      "topic:web-scraping stars:>500",
    ],
    keywords: ["playwright", "puppeteer", "selenium", "scrapy", "browser", "headless", "crawler"],
  },
  {
    tag: "workflow",
    triggers: ["workflow", "pipeline", "dag", "task queue", "scheduler", "cron", "etl"],
    queries: [
      "topic:workflow-engine stars:>500",
      "topic:workflow stars:>1000",
      "airflow OR temporal OR prefect OR dagster stars:>1000",
    ],
    keywords: ["workflow", "airflow", "temporal", "prefect", "dagster", "n8n", "pipeline", "dag"],
  },
  {
    tag: "orchestration",
    triggers: ["orchestrat", "kubernetes", "k8s", "service mesh"],
    queries: [
      "topic:orchestration stars:>500",
      "kubernetes operator stars:>1000",
    ],
    keywords: ["orchestration", "kubernetes", "k8s", "nomad", "mesh"],
  },
  {
    tag: "llm",
    triggers: ["llm", "gpt", "language model", "chatbot", "openai", "anthropic", "claude"],
    queries: [
      "topic:llm stars:>1000",
      "topic:chatbot stars:>1000 language:Python",
    ],
    keywords: ["llm", "gpt", "openai", "anthropic", "claude", "ollama", "vllm"],
  },
  {
    tag: "rag",
    triggers: ["rag", "retrieval", "knowledge base", "semantic search", "embedding"],
    queries: [
      "topic:rag stars:>500",
      "topic:retrieval-augmented-generation stars:>500",
      "llamaindex OR haystack stars:>1000",
    ],
    keywords: ["rag", "retrieval", "llamaindex", "haystack", "embedding", "semantic"],
  },
  {
    tag: "vector-db",
    triggers: ["vector", "embedding", "similarity search", "chroma", "pinecone", "qdrant", "weaviate"],
    queries: [
      "topic:vector-database stars:>500",
      "chroma OR qdrant OR weaviate OR milvus stars:>1000",
    ],
    keywords: ["vector", "chroma", "qdrant", "weaviate", "milvus", "faiss", "pinecone"],
  },
  {
    tag: "ml",
    triggers: ["machine learning", "deep learning", "neural", "training", "fine-tun", " ml ", "ai model"],
    queries: [
      "topic:machine-learning stars:>2000",
      "topic:deep-learning stars:>2000",
    ],
    keywords: ["pytorch", "tensorflow", "transformers", "huggingface", "scikit", "training"],
  },
  {
    tag: "data",
    triggers: ["data ", "etl", "analytics", "warehouse", "lakehouse", "stream"],
    queries: [
      "topic:data-engineering stars:>500",
      "topic:etl stars:>500",
    ],
    keywords: ["etl", "kafka", "spark", "duckdb", "dbt", "warehouse"],
  },
  {
    tag: "devops",
    triggers: ["devops", "ci/cd", "deploy", "docker", "infrastructure", "terraform"],
    queries: [
      "topic:devops stars:>1000",
      "topic:ci-cd stars:>500",
    ],
    keywords: ["devops", "ci", "cd", "docker", "terraform", "ansible"],
  },
  {
    tag: "security",
    triggers: ["security", "auth", "encrypt", "oauth", "vulnerab", "pentest"],
    queries: [
      "topic:security stars:>1000",
      "topic:authentication stars:>500",
    ],
    keywords: ["security", "auth", "oauth", "jwt", "encryption"],
  },
  {
    tag: "web",
    triggers: ["web app", "frontend", "react", "next.js", "vue", "svelte"],
    queries: [
      "topic:nextjs stars:>1000",
      "topic:react stars:>5000",
    ],
    keywords: ["nextjs", "react", "vue", "svelte", "frontend"],
  },
  {
    tag: "mobile",
    triggers: ["mobile", "ios", "android", "react native", "flutter"],
    queries: [
      "topic:react-native stars:>1000",
      "topic:flutter stars:>1000",
    ],
    keywords: ["react-native", "flutter", "ios", "android", "expo"],
  },
  {
    tag: "realtime",
    triggers: ["real-time", "realtime", "websocket", "streaming", "live"],
    queries: ["topic:websocket stars:>500"],
    keywords: ["websocket", "socket.io", "sse", "realtime"],
  },
  {
    tag: "ui",
    triggers: ["dashboard", "ui kit", "design system", "components"],
    queries: ["topic:ui-components stars:>1000"],
    keywords: ["ui", "components", "design-system", "shadcn"],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Negative filters — repos that look "popular" but are NOT real building blocks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Negative filters target REPO NAMES (full_name) and TOPICS only — NOT
 * descriptions — to avoid false positives like excluding tensorflow because
 * its description contains "Machine Learning Framework".
 */
export const DEFAULT_NEGATIVE_FILTERS: string[] = [
  // collection / awesome-list patterns
  "awesome-",
  "awesome_",
  "/awesome",
  // tutorial / learning-resource repos
  "tutorial",
  "project-based-learning",
  "learn-",
  "-learning-",
  "free-programming-books",
  "developer-roadmap",
  "build-your-own",
  "you-dont-know",
  // algorithm / interview-prep
  "/algorithms",
  "leetcode",
  "/interview",
  "system-design-primer",
  "coding-interview",
  "cracking-the-coding",
  // 30-days / 100-days style
  "30-days-of",
  "100-days-of",
]

/**
 * Returns true if the repo looks like a non-buildable collection / tutorial.
 * Used by scorer to apply the -50 penalty (or hard-exclude when strict=true).
 *
 * Strategy:
 *   • Filters apply to repo NAME and TOPICS (precise, not noisy).
 *   • Description gets only narrow regex tests for unambiguous "list" phrases.
 *   • Real frameworks (e.g. tensorflow) whose description happens to mention
 *     "machine learning framework" are NOT misflagged.
 */
export function isGenericCollection(
  repoFullName: string,
  description: string | null | undefined,
  topics: string[] = [],
  filters: string[] = DEFAULT_NEGATIVE_FILTERS
): boolean {
  const nameAndTopics = `${repoFullName} ${topics.join(" ")}`.toLowerCase()
  if (filters.some(f => nameAndTopics.includes(f.toLowerCase()))) return true

  // Tight description heuristics — only flag if the description explicitly
  // declares the repo IS a list/curation/algorithm dump, not a framework.
  const desc = (description || "").toLowerCase().trim()
  if (/^(curated|awesome|a list of|collection of|list of)\b/.test(desc)) return true
  if (/^all algorithms\b/.test(desc)) return true
  if (/(flashcards|interview prep|cheat ?sheet)/.test(desc)) return true
  // "Learn how to..." / "Prep for the ... interview" pattern (system-design-primer)
  if (/^learn how to\b/.test(desc) && /\binterview\b/.test(desc)) return true
  if (/\bprep for the\b.*\binterview\b/.test(desc)) return true

  // Topic-based: any awesome/tutorial topic is a hard signal
  const topicSet = topics.map(t => t.toLowerCase())
  if (topicSet.includes("awesome") || topicSet.includes("awesome-list")) return true
  if (topicSet.includes("tutorial") || topicSet.includes("tutorials")) return true

  return false
}

// ─────────────────────────────────────────────────────────────────────────────
// Classifier
// ─────────────────────────────────────────────────────────────────────────────

export function classifyIntent(userInput: string): IntentProfile {
  const lower = ` ${userInput.toLowerCase()} `
  const matched: { domain: DomainDef; hits: number }[] = []

  for (const dom of DOMAINS) {
    let hits = 0
    for (const t of dom.triggers) {
      if (lower.includes(t)) hits++
    }
    if (hits > 0) matched.push({ domain: dom, hits })
  }

  // Sort by hit count desc, preserving DOMAINS order on ties (stable)
  matched.sort((a, b) => b.hits - a.hits)

  if (matched.length === 0) {
    // Unknown domain — return a low-confidence generic profile
    return {
      tags: [],
      queries: [`${userInput.split(/\s+/).slice(0, 4).join(" ")} stars:>500`],
      positiveKeywords: userInput.toLowerCase().split(/\s+/).filter(w => w.length > 3),
      negativeFilters: DEFAULT_NEGATIVE_FILTERS,
      confidence: 0.2,
    }
  }

  const tags = matched.map(m => m.domain.tag)
  // Take queries from top 3 matched domains (cap at ~6 queries for rate-limits)
  const queries: string[] = []
  for (const m of matched.slice(0, 3)) {
    for (const q of m.domain.queries) {
      if (queries.length < 6) queries.push(q)
    }
  }
  const positiveKeywords = Array.from(
    new Set(matched.flatMap(m => m.domain.keywords))
  )

  // Confidence: 1 strong domain hit ≈ 0.6; 2+ ≈ 0.85; 3+ ≈ 0.95
  const totalHits = matched.reduce((s, m) => s + m.hits, 0)
  const confidence = Math.min(0.5 + totalHits * 0.15, 0.97)

  return {
    tags,
    queries,
    positiveKeywords,
    negativeFilters: DEFAULT_NEGATIVE_FILTERS,
    confidence,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scorer — replaces the old "stars dominate" formula
// ─────────────────────────────────────────────────────────────────────────────

export interface ScorableRepo {
  fullName: string
  description?: string | null
  stars: number
  topics?: string[]
  language?: string | null
}

export interface ScoredRepo extends ScorableRepo {
  score: number
  reasons: string[]
  rejected: boolean
}

/**
 * Domain-aware scoring:
 *   score = keywordMatch * 3   ← intent-specific relevance dominates
 *         + log10(stars+1) * 0.2  ← stars are a tiebreaker, not the driver
 *         - 50 if generic collection / tutorial
 *         + 1 per matching topic (signal of a real lib)
 *         + 2 if name itself contains a positive keyword
 */
export function scoreRepo(
  repo: ScorableRepo,
  intent: IntentProfile,
  opts: { hardExcludeGeneric?: boolean } = {}
): ScoredRepo {
  const reasons: string[] = []
  const haystack = `${repo.fullName} ${repo.description || ""} ${(repo.topics || []).join(" ")}`.toLowerCase()
  const nameLower = repo.fullName.toLowerCase()

  // 1. Negative-filter / generic-collection check
  const generic = isGenericCollection(repo.fullName, repo.description, repo.topics, intent.negativeFilters)
  if (generic && opts.hardExcludeGeneric) {
    return { ...repo, score: -Infinity, reasons: ["excluded: generic collection / tutorial"], rejected: true }
  }

  // 2. Keyword-match score (the new dominant signal)
  let keywordHits = 0
  let nameKeywordBoost = 0
  for (const kw of intent.positiveKeywords) {
    const k = kw.toLowerCase()
    if (haystack.includes(k)) {
      keywordHits++
      if (nameLower.includes(k)) nameKeywordBoost += 1
    }
  }
  const keywordScore = keywordHits * 3
  if (keywordHits > 0) reasons.push(`+${keywordScore} (${keywordHits} domain keywords)`)
  if (nameKeywordBoost > 0) {
    reasons.push(`+${nameKeywordBoost * 2} (keyword in repo name)`)
  }

  // 3. Topic match bonus (real libs tag themselves)
  const topicHits = (repo.topics || []).filter(t =>
    intent.tags.includes(t as DomainTag) || intent.positiveKeywords.includes(t.toLowerCase())
  ).length
  if (topicHits > 0) reasons.push(`+${topicHits} (matching topics)`)

  // 4. Stars contribute logarithmically and lightly
  const starScore = Math.log10(Math.max(repo.stars, 1) + 1) * 0.2
  reasons.push(`+${starScore.toFixed(2)} (stars: ${repo.stars})`)

  // 5. Generic-collection penalty (soft mode)
  let genericPenalty = 0
  if (generic) {
    genericPenalty = -50
    reasons.push("-50 (generic collection / tutorial)")
  }

  const score =
    keywordScore +
    nameKeywordBoost * 2 +
    topicHits +
    starScore +
    genericPenalty

  return { ...repo, score, reasons, rejected: generic && opts.hardExcludeGeneric === true }
}

export function rankByIntent(
  repos: ScorableRepo[],
  intent: IntentProfile,
  opts: { hardExcludeGeneric?: boolean; topK?: number } = {}
): ScoredRepo[] {
  const scored = repos
    .map(r => scoreRepo(r, intent, opts))
    .filter(r => !r.rejected)
    .sort((a, b) => b.score - a.score)
  return opts.topK ? scored.slice(0, opts.topK) : scored
}
