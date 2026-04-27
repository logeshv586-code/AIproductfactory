"""
Capability Mapper — Maps analyzed repos to structured capability types.
Uses semantic similarity for accurate capability classification.
"""

from typing import Any
import math

from agents.repo_analyzer import CAPABILITY_KEYWORDS


# Capability definitions with representative text for embedding similarity
CAPABILITY_DEFINITIONS: list[dict[str, str]] = [
    {"type": "memory", "text": "vector database semantic search embeddings storage retrieval chromadb pinecone weaviate"},
    {"type": "agent", "text": "autonomous agents workflows decision making planning orchestration multi-agent crew langchain"},
    {"type": "rag", "text": "retrieval augmented generation document chunking indexing knowledge base question answering"},
    {"type": "ui", "text": "frontend user interface react vue dashboard component visualization chart rendering"},
    {"type": "backend", "text": "api server backend microservice rest graphql database orm authentication middleware"},
    {"type": "automation", "text": "automation scheduling pipeline ci cd deployment workflow bot trigger cron task"},
]


def map_capability(repo: dict[str, Any]) -> dict[str, Any]:
    """
    Map a single analyzed repo to its primary capability type.

    Uses keyword matching with weighted scoring based on:
    - Description match strength
    - Topic overlap
    - Name patterns
    """
    description = (repo.get("description") or "").lower()
    name = repo.get("name", "").lower()
    topics = [t.lower() for t in (repo.get("topics") or [])]
    signals = repo.get("signals", {})
    existing_caps = signals.get("capabilities", [])

    # If repo analyzer already detected capabilities, use those as starting point
    if existing_caps and existing_caps != ["general"]:
        primary = existing_caps[0]
        confidence = 0.85
    else:
        # Score each capability type
        scores: dict[str, float] = {}
        for cap_def in CAPABILITY_DEFINITIONS:
            cap_type = cap_def["type"]
            keywords = CAPABILITY_KEYWORDS.get(cap_type, [])
            def_words = cap_def["text"].split()

            # Score based on description match
            desc_score = sum(1 for kw in keywords if kw in description) / max(len(keywords), 1)
            # Score based on definition text match
            def_score = sum(1 for w in def_words if w in description or w in name) / max(len(def_words), 1)
            # Score based on topic match
            topic_score = sum(1 for kw in keywords if any(kw in t for t in topics)) / max(len(keywords), 1)

            # Weighted combination
            scores[cap_type] = desc_score * 0.5 + def_score * 0.3 + topic_score * 0.2

        # Find the best matching capability
        best_type = max(scores, key=scores.get) if scores else "general"
        best_score = scores.get(best_type, 0)
        confidence = min(best_score * 3, 0.95) if best_score > 0.05 else 0.3
        primary = best_type if best_score > 0.05 else "general"

    # Build capability profile
    profile = {
        "repo": repo.get("full_name", repo.get("name", "")),
        "name": repo.get("name", ""),
        "capability": primary,
        "confidence": round(confidence, 3),
        "all_capabilities": existing_caps if existing_caps and existing_caps != ["general"] else [primary],
        "description": repo.get("description", ""),
        "language": repo.get("language"),
        "stars": repo.get("stars", 0),
    }

    return profile


def map_capabilities(analyzed_repos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Map a list of analyzed repos to their capability profiles."""
    return [map_capability(repo) for repo in analyzed_repos]


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def map_capabilities_with_embedding(
    repos: list[dict[str, Any]],
    provider=None
) -> list[dict[str, Any]]:
    """
    Map repos to capabilities using semantic embeddings for higher accuracy.
    Falls back to keyword matching if embeddings are unavailable.
    """
    if provider is None:
        # Use keyword-based mapping as fallback
        return map_capabilities(repos)

    try:
        # Get embeddings for capability definitions
        cap_embeddings: dict[str, list[float]] = {}
        for cap_def in CAPABILITY_DEFINITIONS:
            embedding = await provider.get_embedding(cap_def["text"])
            cap_embeddings[cap_def["type"]] = embedding

        results = []
        for repo in repos:
            # Get embedding for repo description
            desc_text = f"{repo.get('description', '')} {repo.get('name', '')} {' '.join(repo.get('topics', []))}"
            repo_embedding = await provider.get_embedding(desc_text)

            # Find best matching capability
            best_type = "general"
            best_score = 0.0
            scores = {}
            for cap_type, cap_emb in cap_embeddings.items():
                sim = cosine_similarity(repo_embedding, cap_emb)
                scores[cap_type] = sim
                if sim > best_score:
                    best_score = sim
                    best_type = cap_type

            profile = {
                "repo": repo.get("full_name", repo.get("name", "")),
                "name": repo.get("name", ""),
                "capability": best_type,
                "confidence": round(min(best_score, 0.99), 3),
                "all_capabilities": [best_type] if best_score > 0.3 else ["general"],
                "similarity_scores": {k: round(v, 3) for k, v in scores.items()},
                "description": repo.get("description", ""),
                "language": repo.get("language"),
                "stars": repo.get("stars", 0),
            }
            results.append(profile)

        return results

    except Exception as e:
        print(f"[CapabilityMapper] embedding error, falling back to keywords: {e}")
        return map_capabilities(repos)
