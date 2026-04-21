// ============================================================
// Repo Analyzer Agent
// Analyzes repos and extracts deep capability signals
// ============================================================

import { RepoInput, CapabilityCategory } from "./types";

const CAPABILITY_KEYWORDS: Record<CapabilityCategory, string[]> = {
  memory: [
    "vector", "embedding", "chroma", "pinecone", "weaviate", "milvus",
    "qdrant", "faiss", "memory", "storage", "redis", "memcached",
    "neo4j", "graph-db", "knowledge-graph", "faiss", "db", "database",
    "sqlite", "postgres", "mongodb", "supabase",
  ],
  agent: [
    "agent", "langchain", "langgraph", "crewai", "autogen", "autogpt",
    "orchestrat", "planning", "multi-agent", "workflow", "task",
    "copilot", "assistant", "bot", "chatbot", "delegate", "swarm",
    "mcp", "tool-use", "function-call",
  ],
  rag: [
    "rag", "retrieval", "search", "semantic", "llamaindex", "llama-index",
    "document", "ingest", "chunk", "embed", "index", "query-engine",
    "hyde", "re-rank", "rerank", "document-load",
  ],
  ui: [
    "react", "vue", "svelte", "nextjs", "next.js", "dashboard", "frontend",
    "component", "ui", "design", "tailwind", "css", "storybook",
    "shadcn", "radix", "chart", "visualization", "web", "app",
  ],
  automation: [
    "automation", "workflow", "pipeline", "n8n", "zapier", "trigger",
    "schedule", "cron", "ci-cd", "github-actions", "webhook",
    "event", "queue", "temporal", "bull", "agenda",
  ],
  "model-serving": [
    "inference", "serving", "deploy", "vllm", "triton", "tensorrt",
    "onnx", "model", "llm", "gpt", "claude", "openai", "huggingface",
    "ollama", "llamacpp", "llama.cpp", "fine-tun", "training",
    "transformer", "diffusion", "stable-diffusion",
  ],
  data: [
    "data", "etl", "pipeline", "stream", "kafka", "spark", "airflow",
    "dbt", "analytics", "metrics", "warehouse", "lake", "parquet",
    "arrow", "pandas", "polars",
  ],
  security: [
    "security", "auth", "oauth", "jwt", "encryption", "privacy",
    "rbac", "firewall", "scan", "vulnerability", "secret",
  ],
  infra: [
    "docker", "kubernetes", "k8s", "terraform", "cloud", "serverless",
    "aws", "gcp", "azure", "helm", "nginx", "caddy", "proxy",
    "monitor", "observ", "log", "tracing",
  ],
  communication: [
    "chat", "real-time", "websocket", "socket", "email", "sms",
    "notification", "slack", "discord", "telegram", "api",
  ],
};

const CAPABILITY_LABELS: Record<CapabilityCategory, string> = {
  memory: "Memory & Storage",
  agent: "Agent Framework",
  rag: "RAG & Retrieval",
  ui: "Frontend & UI",
  automation: "Automation & Workflow",
  "model-serving": "Model Serving & LLM",
  data: "Data & Analytics",
  security: "Security & Auth",
  infra: "Infrastructure & DevOps",
  communication: "Communication & Real-time",
};

const CAPABILITY_ICONS: Record<CapabilityCategory, string> = {
  memory: "Database",
  agent: "Bot",
  rag: "BookOpen",
  ui: "Palette",
  automation: "Workflow",
  "model-serving": "Cpu",
  data: "BarChart3",
  security: "Shield",
  infra: "Server",
  communication: "MessageSquare",
};

export interface AnalyzedRepo extends RepoInput {
  detectedCapabilities: CapabilityCategory[];
  capabilityScores: Record<CapabilityCategory, number>;
  maturityLevel: "experimental" | "growing" | "mature" | "industry-standard";
  roleHints: string[];
}

export function analyzeRepo(repo: RepoInput): AnalyzedRepo {
  const combined = `${repo.name} ${repo.description || ""} ${(repo.topics || []).join(" ")} ${repo.innovationSignals.join(" ")}`.toLowerCase();

  const capabilityScores: Record<CapabilityCategory, number> = {} as any;
  const detectedCapabilities: CapabilityCategory[] = [];

  for (const [cat, keywords] of Object.entries(CAPABILITY_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        score += kw.includes(repo.language?.toLowerCase() || "") ? 3 : kw.length > 5 ? 2 : 1;
      }
    }
    capabilityScores[cat as CapabilityCategory] = score;
    if (score > 0) detectedCapabilities.push(cat as CapabilityCategory);
  }

  // Determine maturity
  let maturityLevel: AnalyzedRepo["maturityLevel"] = "experimental";
  if (repo.stars > 50000) maturityLevel = "industry-standard";
  else if (repo.stars > 10000) maturityLevel = "mature";
  else if (repo.stars > 2000) maturityLevel = "growing";

  // Generate role hints
  const roleHints: string[] = [];
  if (detectedCapabilities.includes("memory")) roleHints.push("Storage Layer");
  if (detectedCapabilities.includes("agent")) roleHints.push("Orchestration Engine");
  if (detectedCapabilities.includes("rag")) roleHints.push("Knowledge Processor");
  if (detectedCapabilities.includes("ui")) roleHints.push("User Interface");
  if (detectedCapabilities.includes("automation")) roleHints.push("Automation Engine");
  if (detectedCapabilities.includes("model-serving")) roleHints.push("LLM Backend");
  if (detectedCapabilities.includes("data")) roleHints.push("Data Pipeline");
  if (detectedCapabilities.includes("security")) roleHints.push("Security Layer");
  if (detectedCapabilities.includes("infra")) roleHints.push("Infrastructure");
  if (detectedCapabilities.includes("communication")) roleHints.push("Communication Hub");
  if (roleHints.length === 0) roleHints.push("Utility");

  return {
    ...repo,
    detectedCapabilities,
    capabilityScores,
    maturityLevel,
    roleHints,
  };
}

export function analyzeRepos(repos: RepoInput[]): AnalyzedRepo[] {
  return repos.map(analyzeRepo);
}

export { CAPABILITY_LABELS, CAPABILITY_ICONS, CAPABILITY_KEYWORDS };
