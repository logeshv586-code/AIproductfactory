import type { GitHubRepo } from "../types.js";

export function categorizeRepo(repo: GitHubRepo): string {
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

export function extractInnovationSignals(repo: GitHubRepo): string[] {
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
