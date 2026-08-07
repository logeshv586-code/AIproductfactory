"""
Product Memory — retrieval-augmented reasoning entry point (v6 Phase 6).

Instead of treating past products as an archive, this engine makes them a
retrieval system: every new request begins by drafting a Product DNA from the
idea (deterministic, no LLM), searching the Product Memory for similar past
products, and returning *structured guidance* the Decision Engine can consume
directly — not just a list of IDs.

For each similar product we return:
  - similarity score (composite DNA + capability + domain overlap)
  - matching capabilities
  - shared repositories
  - shared architecture patterns
  - differences from the current request
  - historical outcome (approved strategy id / name, final score, critique verdict)
  - confidence achieved
  - the full stored record for deep retrieval

Cold start: with no stored products this returns ``has_memory: False`` and the
pipeline behaves exactly like v5 — no artificial bias is introduced.
"""

from __future__ import annotations

from typing import Any

from intelligence.learning_store import get_learning_store
from intelligence.prompt_utils import as_dict, as_list, as_str

# Weight of the DNA similarity vs capability overlap vs domain match in the
# composite retrieval score. Sum = 1.0.
_WEIGHTS = {"dna": 0.5, "capabilities": 0.3, "domain": 0.2}
_SIMILARITY_THRESHOLD = 0.30
_MAX_SIMILAR = 5

# Deployment patterns are the "architecture signature" of a product — matching
# these across products is strong structural evidence.
_ARCHITECTURE_PATTERNS = [
    "docker-compose",
    "microservices",
    "monolith",
    "serverless",
    "event-driven",
    "kubernetes",
    "layered",
]


def draft_dna_from_idea(idea: str, domain: str = "") -> dict[str, Any]:
    """
    Deterministic (no-LLM) draft Product DNA for an incoming idea, so it can be
    compared against stored products before any reasoning runs. Returns a
    dict shaped like Product DNA with ``draft: True``.
    """
    idea = as_str(idea).strip()
    lowered = idea.lower()
    domain = as_str(domain).lower() or _domain_from_keywords(idea)
    capabilities: list[str] = []
    if any(k in lowered for k in ("auth", "login", "sso", "user account")):
        capabilities.append("Authentication")
    if any(k in lowered for k in ("search", "discover", "browse", "query")):
        capabilities.append("Search")
    if any(k in lowered for k in ("ai", "llm", "agent", "assistant", "recommend", "predict", "chat")):
        capabilities.append("AI Assistant")
    if any(k in lowered for k in ("pay", "checkout", "invoice", "subscription", "billing")):
        capabilities.append("Payments")
    if any(k in lowered for k in ("api", "sdk", "integrat", "workflow")):
        capabilities.append("API Platform")
    if any(k in lowered for k in ("analy", "dashboard", "report", "metric", "insight")):
        capabilities.append("Analytics")
    if any(k in lowered for k in ("notify", "alert", "push", "email")):
        capabilities.append("Notifications")
    if any(k in lowered for k in ("store", "database", "cache", "persist", "data")):
        capabilities.append("Data Store")
    if any(k in lowered for k in ("real-time", "realtime", "stream", "live", "websocket")):
        capabilities.append("Real-time")
    if any(k in lowered for k in ("multi-tenant", "multitenant", "saas", "workspace", "org")):
        capabilities.append("Multi-tenant")
    if not capabilities:
        capabilities = ["Core", "API"]

    return {
        "draft": True,
        "domain": domain,
        "capabilities": capabilities,
        "capability_count": len(capabilities),
        "complexity": "medium",
        "idea": idea,
    }


def _domain_from_keywords(idea: str) -> str:
    lowered = idea.lower()
    table: list[tuple[list[str], str]] = [
        (["price", "shop", "buy", "cart", "compare", "marketplace", "product"], "e-commerce"),
        (["pay", "bank", "financ", "invoice", "wallet", "accounting", "budget"], "fintech"),
        (["code", "api", "sdk", "developer", "cli", "kubernetes", "devops", "observability"], "developer tools"),
        (["health", "clinic", "patient", "fitness", "medical"], "health-tech"),
        (["learn", "cours", "student", "tutor", "training"], "education"),
        (["travel", "hotel", "flight", "trip"], "travel"),
        (["ship", "deliver", "logistic", "warehouse", "supply"], "logistics"),
        (["secur", "cyber", "threat", "vulnerab", "compliance"], "security"),
        (["agent", "assistant", "llm", "chat", "automation"], "AI agent"),
    ]
    for keywords, domain in table:
        if any(k in lowered for k in keywords):
            return domain
    return "general"


def _count(dna: dict[str, Any], key: str) -> int:
    """Count of a DNA field whether stored as a list or an int."""
    val = dna.get(key, 0)
    if isinstance(val, (list, tuple)):
        return len(val)
    try:
        return int(val or 0)
    except (TypeError, ValueError):
        return 0


def _dna_similarity(a: dict[str, Any], b: dict[str, Any]) -> float:
    """
    DNA similarity in [0, 1]. Domain match weighted highest; numeric fields by
    relative distance; capability lists by overlap. Re-implemented here (rather
    than importing product_dna.dna_similarity) so retrieval can work against the
    lighter draft DNA and full stored DNA with the same shape.
    """
    if not a or not b:
        return 0.0
    scores: list[float] = []
    domain_a = as_str(a.get("domain")).lower()
    domain_b = as_str(b.get("domain")).lower()
    scores.append(0.4 if domain_a == domain_b else (0.15 if domain_a and domain_b else 0.0))
    for key in ("innovation_score", "market_gap", "confidence"):
        va, vb = float(a.get(key, 0) or 0), float(b.get(key, 0) or 0)
        scores.append(0.2 * (1.0 - min(1.0, abs(va - vb))))
    scores.append(0.1 * (1.0 - min(1.0, abs(_count(a, "capabilities") - _count(b, "capabilities")) / 12.0)))
    scores.append(0.1 * (1.0 - min(1.0, abs(_count(a, "repositories") - _count(b, "repositories")) / 12.0)))
    scores.append(0.1 if as_str(a.get("complexity")) == as_str(b.get("complexity")) else 0.05)
    return round(min(1.0, sum(scores)), 3)


def _capability_overlap(draft_caps: list[str], stored_caps: list[str]) -> float:
    if not draft_caps or not stored_caps:
        return 0.0
    d = {c.lower() for c in draft_caps}
    s = {c.lower() for c in stored_caps}
    return round(len(d & s) / len(d), 3)


def _shared_repos(stored: dict[str, Any]) -> list[str]:
    repo_map = as_dict(stored.get("repository_map"))
    if repo_map:
        return list({as_str(r) for r in repo_map.values() if r})
    intel = as_dict(stored.get("repository_intelligence"))
    return [as_str(r.get("full_name")) for r in as_list(intel.get("reports")) if isinstance(r, dict)][:6]


def _shared_architectures(stored: dict[str, Any]) -> list[str]:
    patterns: list[str] = []
    deployment = as_str(as_dict(stored.get("architecture")).get("deployment"))
    if deployment:
        patterns.append(deployment)
    arch_text = " ".join(
        [
            as_str(as_dict(stored.get("architecture")).get("style")),
            as_str(stored.get("architecture_pattern", "")),
            as_str(as_dict(stored.get("blueprint")).get("architecture")),
        ]
    ).lower()
    for pat in _ARCHITECTURE_PATTERNS:
        if pat in arch_text and pat not in patterns:
            patterns.append(pat)
    return patterns[:4]


def _stored_capabilities(stored: dict[str, Any]) -> list[str]:
    cap_graph = as_dict(stored.get("capabilities"))
    if cap_graph and isinstance(cap_graph.get("capabilities"), list):
        return [as_str(c.get("name")) for c in cap_graph.get("capabilities") if isinstance(c, dict)]
    return as_list(stored.get("capabilities"))


def _differences(draft: dict[str, Any], stored: dict[str, Any]) -> list[str]:
    """Human-readable differences between the incoming idea and a stored product."""
    diff: list[str] = []
    draft_domain = as_str(draft.get("domain")).lower()
    stored_domain = as_str(stored.get("domain", as_dict(stored.get("product_dna")).get("domain"))).lower()
    if draft_domain and stored_domain and draft_domain != stored_domain:
        diff.append(f"Domain: incoming {draft_domain} vs past {stored_domain}")
    draft_caps = {c.lower() for c in as_list(draft.get("capabilities"))}
    stored_caps = {c.lower() for c in _stored_capabilities(stored)}
    missing = [c for c in stored_caps - draft_caps][:3]
    extra = [c for c in draft_caps - stored_caps][:3]
    if missing:
        diff.append(f"Past product had capabilities you didn't request: {', '.join(missing)}")
    if extra:
        diff.append(f"You request capabilities not in the past product: {', '.join(extra)}")
    return diff[:4]


def _historical_outcome(stored: dict[str, Any]) -> dict[str, Any]:
    approved = as_dict(stored.get("approved_strategy"))
    critique = as_dict(stored.get("self_critique"))
    simulation = as_dict(stored.get("architecture_simulation"))
    return {
        "approved_strategy": as_str(approved.get("id")) or "",
        "strategy_name": as_str(approved.get("name")) or "",
        "final_score": round(float(simulation.get("score", 0) or 0) / 100, 3) if simulation.get("score") else None,
        "self_critique_passed": bool(critique.get("passed")),
        "self_critique_score": critique.get("score"),
        "overall_confidence": as_dict(stored.get("confidences")).get("overall"),
    }


class ProductMemory:
    """Retrieval-augmented memory over the Product Learning Store."""

    def __init__(self, store=None):
        from intelligence.learning_store import get_learning_store
        self.store = store or get_learning_store()

    # ── Search ─────────────────────────────────────────────────────────────
    def search(
        self,
        idea: str = "",
        *,
        draft: dict[str, Any] | None = None,
        domain: str = "",
        min_score: float = _SIMILARITY_THRESHOLD,
        limit: int = _MAX_SIMILAR,
    ) -> dict[str, Any]:
        """
        Retrieve the most similar past products to an incoming idea.

        Accepts either a raw ``idea`` (drafts the DNA) or a pre-computed draft.
        Returns ``{draft, matches, has_memory, total_memory, note}`` where each
        match carries the structured guidance the Decision Engine consumes.
        """
        if draft is None:
            draft = draft_dna_from_idea(idea, domain)
        memories = self.store.product_memories()
        total = len(memories)
        matches: list[dict[str, Any]] = []
        for mem in memories:
            stored_dna = as_dict(mem.get("product_dna"))
            dna_sim = _dna_similarity(draft, stored_dna or draft)
            cap_sim = _capability_overlap(
                as_list(draft.get("capabilities")),
                _stored_capabilities(mem),
            )
            domain_sim = 1.0 if (as_str(draft.get("domain")).lower() == as_str(stored_dna.get("domain")).lower()) else 0.0
            score = round(
                _WEIGHTS["dna"] * dna_sim
                + _WEIGHTS["capabilities"] * cap_sim
                + _WEIGHTS["domain"] * domain_sim,
                3,
            )
            if score >= min_score:
                matches.append(
                    {
                        "run_id": as_str(mem.get("run_id")),
                        "idea": as_str(mem.get("idea")) or as_str(mem.get("intent", {}).get("summary")),
                        "domain": as_str(stored_dna.get("domain")) or as_str(mem.get("domain")),
                        "similarity": score,
                        "dna_similarity": dna_sim,
                        "capability_overlap": cap_sim,
                        "matching_capabilities": _matching_caps(draft, mem),
                        "shared_repositories": _shared_repos(mem),
                        "shared_architectures": _shared_architectures(mem),
                        "differences": _differences(draft, mem),
                        "historical_outcome": _historical_outcome(mem),
                        "record": mem,
                    }
                )
        matches.sort(key=lambda m: m["similarity"], reverse=True)
        matches = matches[:limit]
        return {
            "draft": draft,
            "matches": matches,
            "has_memory": total > 0,
            "total_memory": total,
            "note": (
                ""
                if matches
                else (
                    "No prior product memory yet — reasoning runs from first principles (cold start)."
                    if total == 0
                    else "No stored product is similar enough to reuse (all below similarity threshold)."
                )
            ),
        }


def _matching_caps(draft: dict[str, Any], stored: dict[str, Any]) -> list[str]:
    d = {c.lower(): c for c in as_list(draft.get("capabilities"))}
    s = {c.lower(): c for c in _stored_capabilities(stored)}
    return [d[c] for c in (set(d) & set(s))][:6]


# Singleton so the orchestrator and endpoints share one memory over the store.
_default_memory: ProductMemory | None = None


def get_product_memory(store=None) -> ProductMemory:
    global _default_memory
    if _default_memory is None or store is not None:
        _default_memory = ProductMemory(store)
    return _default_memory
