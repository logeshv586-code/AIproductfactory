// ============================================================
// Capability Embedding — Semantic Capability Mapping
// Uses embedding-based cosine similarity instead of keyword matching
// ============================================================

import { embed, cosineSimilarity } from "@/llm/provider";
import { CapabilityCategory } from "@/lib/agents/types";

interface CapabilityDefinition {
  type: CapabilityCategory;
  text: string;
  description: string;
}

interface CapabilityMapping {
  repo: string;
  capability: CapabilityCategory;
  confidence: number;
  allScores: Record<CapabilityCategory, number>;
}

// Semantic definitions for each capability category
const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  { type: "memory", text: "vector database semantic search embeddings storage retrieval chromadb pinecone weaviate qdrant faiss redis postgres sqlite", description: "Vector databases, embedding storage, and semantic search systems" },
  { type: "agent", text: "autonomous agents workflows decision making planning langchain langgraph crewai autogen orchestration multi-agent copilot assistant", description: "Agent frameworks, orchestration engines, and autonomous systems" },
  { type: "rag", text: "retrieval augmented generation documents search knowledge llamaindex ingest chunk embed query-engine rerank document-load", description: "RAG pipelines, document processing, and knowledge retrieval" },
  { type: "ui", text: "frontend interface dashboard visualization react vue svelte nextjs component design tailwind css storybook shadcn chart", description: "Frontend frameworks, UI components, and visualization tools" },
  { type: "automation", text: "automation workflow pipeline n8n zapier trigger schedule cron ci-cd github-actions webhook event queue temporal bull", description: "Workflow automation, event processing, and CI/CD systems" },
  { type: "model-serving", text: "inference serving deploy vllm triton onnx model llm gpt claude openai huggingface ollama transformer diffusion", description: "LLM inference, model hosting, and AI serving infrastructure" },
  { type: "data", text: "data etl pipeline stream kafka spark airflow dbt analytics metrics warehouse lake parquet arrow pandas polars", description: "Data processing, ETL pipelines, and analytics engines" },
  { type: "security", text: "security authentication oauth jwt encryption privacy rbac firewall vulnerability secret compliance audit", description: "Security, authentication, and access control systems" },
  { type: "infra", text: "docker kubernetes terraform cloud serverless aws gcp azure helm nginx caddy proxy monitor observ tracing", description: "Infrastructure, deployment, and container orchestration" },
  { type: "communication", text: "chat real-time websocket socket email sms notification slack discord telegram api messaging", description: "Communication, real-time messaging, and notification systems" },
];

let cachedCapabilityEmbeddings: Map<CapabilityCategory, number[]> | null = null;

/**
 * Get embeddings for all capability definitions (cached)
 */
async function getCapabilityEmbeddings(): Promise<Map<CapabilityCategory, number[]>> {
  if (cachedCapabilityEmbeddings) return cachedCapabilityEmbeddings;

  const map = new Map<CapabilityCategory, number[]>();
  for (const cap of CAPABILITY_DEFINITIONS) {
    const embedding = await embed(cap.text);
    map.set(cap.type, embedding);
  }

  cachedCapabilityEmbeddings = map;
  return map;
}

/**
 * Map repos to capabilities using semantic embedding similarity
 */
export async function mapCapabilitiesWithEmbedding(
  repos: Array<{ name: string; description: string | null; topics?: string[]; readme?: string }>
): Promise<CapabilityMapping[]> {
  const capabilityEmbeddings = await getCapabilityEmbeddings();
  const results: CapabilityMapping[] = [];

  for (const repo of repos) {
    const repoText = `${repo.name} ${repo.description || ""} ${(repo.topics || []).join(" ")} ${repo.readme || ""}`;
    const repoEmbedding = await embed(repoText);

    const scores: Record<CapabilityCategory, number> = {} as any;
    let bestMatch: { type: CapabilityCategory; score: number } = { type: "agent", score: 0 };

    for (const [capType, capEmbedding] of capabilityEmbeddings.entries()) {
      const similarity = cosineSimilarity(repoEmbedding, capEmbedding);
      scores[capType] = similarity;
      if (similarity > bestMatch.score) {
        bestMatch = { type: capType, score: similarity };
      }
    }

    results.push({
      repo: repo.name,
      capability: bestMatch.type,
      confidence: bestMatch.score,
      allScores: scores,
    });
  }

  return results;
}

/**
 * Hybrid mapping: Combine keyword-based and embedding-based approaches
 */
export function hybridCapabilityMapping(
  keywordResults: Array<{ repo: string; capabilities: CapabilityCategory[] }>,
  embeddingResults: CapabilityMapping[]
): CapabilityMapping[] {
  return embeddingResults.map((embResult) => {
    const keywordResult = keywordResults.find((kr) => kr.repo === embResult.repo);

    if (keywordResult && keywordResult.capabilities.length > 0) {
      // If keyword mapping found capabilities, boost their embedding scores
      const boostedScores = { ...embResult.allScores };
      for (const cap of keywordResult.capabilities) {
        if (boostedScores[cap] !== undefined) {
          boostedScores[cap] = boostedScores[cap] * 1.5 + 0.1;
        }
      }

      // Re-determine best match after boosting
      let bestCap = embResult.capability;
      let bestScore = 0;
      for (const [cap, score] of Object.entries(boostedScores)) {
        if (score > bestScore) {
          bestScore = score;
          bestCap = cap as CapabilityCategory;
        }
      }

      return {
        ...embResult,
        capability: bestCap,
        confidence: Math.min(bestScore, 1),
        allScores: boostedScores,
      };
    }

    return embResult;
  });
}

/**
 * Get all capability definitions (for reference/display)
 */
export function getCapabilityDefinitions(): CapabilityDefinition[] {
  return CAPABILITY_DEFINITIONS;
}
