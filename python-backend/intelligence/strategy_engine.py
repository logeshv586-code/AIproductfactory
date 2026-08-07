"""
Product Strategy Generator — three complete, distinct product strategies.

Always produces exactly three tiers: Minimal MVP, AI-Enhanced Platform, and
Enterprise Architecture. Each is a complete product strategy with features,
capabilities, architecture, timeline, cost, complexity, innovation, feasibility,
market opportunity, risk and a capability -> repository map. The LLM writes the
narrative; the repository map is always injected from the (deterministic)
capability mappings so it is never hallucinated.
"""

from __future__ import annotations

from typing import Any

from intelligence.prompt_utils import ask_json, as_dict, as_list, as_str
from llm.provider import LLMProvider

_SYSTEM_PROMPT = """You are a product strategist inside an AI product factory.
From the intent, requirements, capability graph, repository mapping, innovation
report and market intelligence, generate exactly THREE genuinely different
product strategies:

- STRAT-A: Fast MVP — only core capabilities, fastest to market, lowest cost and risk.
- STRAT-B: Balanced Product — a well-rounded mid-tier product adding important capabilities.
- STRAT-C: Enterprise Platform — adds scale capabilities (distributed workers, event streaming, analytics, multi-tenant, observability), longest.

Return ONLY valid JSON — an array of EXACTLY 3 objects, each with EXACTLY these keys:
{
  "id": "STRAT-A",
  "name": "Fast MVP",
  "tagline": "one-line positioning",
  "description": "what this strategy delivers and for whom",
  "features": ["feature"],
  "capabilities": ["CAP-001"],
  "architecture": "one-line architecture summary",
  "timeline": "2-3 weeks",
  "estimated_cost": "$2k - $5k",
  "complexity": "low" | "medium" | "high",
  "innovation_score": 0.0,
  "feasibility": 0.0,
  "market_opportunity": 0.0,
  "confidence": 0.0,
  "risk_level": "low" | "medium" | "high",
  "risks": ["risk"],
  "repository_map": {"capability name": "org/repo"},
  "differentiation": "what makes it different",
  "why": "why this tier is the right bet"
}
Scores are 0..1. Do not add or remove keys."""

_STRATEGY_META = [
    {"id": "STRAT-A", "name": "Fast MVP"},
    {"id": "STRAT-B", "name": "Balanced Product"},
    {"id": "STRAT-C", "name": "Enterprise Platform"},
]


def _selected_repo_map(capability_mappings: list[dict[str, Any]]) -> dict[str, str]:
    """Deterministic capability_name -> selected full_name map."""
    out: dict[str, str] = {}
    for m in capability_mappings:
        md = as_dict(m)
        name = as_str(md.get("capability_name"))
        selected = as_str(md.get("selected"))
        if name and selected:
            out[name] = selected
    return out


def _fallback_strategies(
    capabilities: dict[str, Any],
    capability_mappings: list[dict[str, Any]],
    market: dict[str, Any],
    intent: dict[str, Any],
) -> list[dict[str, Any]]:
    repo_map = _selected_repo_map(capability_mappings)
    caps = as_list(capabilities.get("capabilities"))
    core = [c for c in caps if as_str(c.get("priority")) == "core"]
    important = [c for c in caps if as_str(c.get("priority")) in ("core", "important")]
    all_caps = caps

    complexity_map = {"low": 1.0, "medium": 2.0, "high": 3.0}
    def _complexity_score(clist: list[dict[str, Any]]) -> float:
        if not clist:
            return 1.0
        total = sum(complexity_map.get(as_str(c.get("complexity")), 2.0) for c in clist)
        return total / len(clist)

    domain = as_str(intent.get("domain")) or "the product"
    pain = as_list(market.get("pain_points"))
    pain_point = pain[0] if pain else "fragmented existing tools"

    tiers = [
        {
            "id": "STRAT-A",
            "name": "Fast MVP",
            "tagline": "Ship the core loop fast and prove demand.",
            "description": f"A focused {domain} MVP that solves the core problem: {pain_point}. Only essential capabilities, one deployable service, minimal ceremony.",
            "features": ["Core user flow end to end"] + [as_str(c.get("name")) for c in core],
            "capabilities": [as_str(c.get("id")) for c in core],
            "architecture": "Single service: API + UI + datastore.",
            "timeline": "2-3 weeks",
            "estimated_cost": "$2k - $5k",
            "complexity": "low",
            "innovation_score": round(0.3 + 0.1 * _complexity_score(core), 2),
            "feasibility": 0.9,
            "market_opportunity": 0.7,
            "confidence": 0.85,
            "risk_level": "low",
            "risks": ["Scope creep", "Under-invested non-functional requirements"],
            "repository_map": repo_map,
            "differentiation": f"First {domain} tool that ships the core loop in days.",
            "why": "Proves the core loop before investing in AI or scale.",
        },
        {
            "id": "STRAT-B",
            "name": "Balanced Product",
            "tagline": "Intelligence as a feature, not an add-on.",
            "description": f"A balanced {domain} product on the MVP core — smarter workflows, recommendations and automation without enterprise weight.",
            "features": ["MVP core"] + [as_str(c.get("name")) for c in important if c.get("id") not in [x.get("id") for x in core]] + ["AI assistant for the primary workflow"],
            "capabilities": [as_str(c.get("id")) for c in important],
            "architecture": "API + UI + AI service with vector store and job queue.",
            "timeline": "4-6 weeks",
            "estimated_cost": "$8k - $15k",
            "complexity": "medium",
            "innovation_score": round(0.55 + 0.1 * _complexity_score(important), 2),
            "feasibility": 0.75,
            "market_opportunity": 0.8,
            "confidence": 0.75,
            "risk_level": "medium",
            "risks": ["LLM cost and latency", "Prompt brittleness"],
            "repository_map": repo_map,
            "differentiation": "AI native from day one instead of bolted on.",
            "why": "AI is the strongest differentiator and the market already pays for it.",
        },
        {
            "id": "STRAT-C",
            "name": "Enterprise Platform",
            "tagline": "Scale, governance and reliability for real deployments.",
            "description": f"A production-hardened {domain} platform: distributed workers, event streaming, analytics, multi-tenancy and full observability.",
            "features": ["All platform capabilities"] + ["Distributed workers", "Event streaming", "Multi-tenant isolation", "Compliance-ready audit trail"],
            "capabilities": [as_str(c.get("id")) for c in all_caps],
            "architecture": "Event-driven microservices: gateway, workers, stream broker, analytics lake, observability stack.",
            "timeline": "8-12 weeks",
            "estimated_cost": "$25k - $50k",
            "complexity": "high",
            "innovation_score": round(0.7 + 0.05 * _complexity_score(all_caps), 2),
            "feasibility": 0.6,
            "market_opportunity": 0.75,
            "confidence": 0.65,
            "risk_level": "high",
            "risks": ["Operational complexity", "Long time to value", "Higher infra cost"],
            "repository_map": repo_map,
            "differentiation": "Enterprise-grade reliability and compliance no competitor offers.",
            "why": "Captures the enterprise segment and defensible revenue.",
        },
    ]
    return tiers


def _normalize_llm(
    value: Any,
    capabilities: dict[str, Any],
    capability_mappings: list[dict[str, Any]],
) -> list[dict[str, Any]] | None:
    if not isinstance(value, list) or len(value) != 3:
        return None
    repo_map = _selected_repo_map(capability_mappings)
    out: list[dict[str, Any]] = []
    for i, raw in enumerate(value):
        if not isinstance(raw, dict):
            return None
        meta = _STRATEGY_META[i]
        # always use the deterministic repo map — never trust the LLM here
        llm_map = as_dict(raw.get("repository_map"))
        merged_map = {**llm_map, **repo_map} if repo_map else llm_map
        complexity = as_str(raw.get("complexity"))
        if complexity not in ("low", "medium", "high"):
            complexity = "medium"
        risk_level = as_str(raw.get("risk_level"))
        if risk_level not in ("low", "medium", "high"):
            risk_level = "medium"
        out.append(
            {
                "id": meta["id"],
                "name": as_str(raw.get("name")) or meta["name"],
                "tagline": as_str(raw.get("tagline")) or "",
                "description": as_str(raw.get("description")) or "",
                "features": as_list(raw.get("features")),
                "capabilities": as_list(raw.get("capabilities")),
                "architecture": as_str(raw.get("architecture")),
                "timeline": as_str(raw.get("timeline")),
                "estimated_cost": as_str(raw.get("estimated_cost")),
                "complexity": complexity,
                "innovation_score": min(1.0, max(0.0, float(raw.get("innovation_score", 0.5)))),
                "feasibility": min(1.0, max(0.0, float(raw.get("feasibility", 0.5)))),
                "market_opportunity": min(1.0, max(0.0, float(raw.get("market_opportunity", 0.5)))),
                "confidence": min(1.0, max(0.0, float(raw.get("confidence", 0.7)))),
                "risk_level": risk_level,
                "risks": as_list(raw.get("risks")),
                "repository_map": merged_map,
                "differentiation": as_str(raw.get("differentiation")),
                "why": as_str(raw.get("why")),
            }
        )
    return out


async def generate_strategies(
    intent: dict[str, Any],
    requirements: list[dict[str, Any]],
    capabilities: dict[str, Any],
    capability_mappings: list[dict[str, Any]],
    market: dict[str, Any],
    provider: LLMProvider,
    innovation: dict[str, Any] | None = None,
    learning: dict[str, Any] | None = None,
    memory: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """
    Generate exactly three product strategies.

    ``learning`` is the Experience Engine's evidence report; when present, the
    learned capability → repository rankings and repository success stats are
    injected so the strategist can prefer historically proven choices.
    ``memory`` is the Product Memory retrieval result; when similar past
    products were retrieved, their DNA, repo choices and outcomes are injected
    so strategies can build on proven precedents.

    Returns a list of 3 strategy dicts. Never raises; falls back to a
    deterministic tier builder.
    """
    innovation_section = f"\nINNOVATION REPORT:\n{innovation}" if innovation else ""
    learning_section = ""
    if learning:
        ranking_lines = []
        for cap, entry in as_dict(learning.get("capability_rankings")).items():
            entry = as_dict(entry)
            if entry.get("evidence_count", 0) > 0:
                ranking_lines.append(
                    f"- {cap}: best_repo={as_str(entry.get('best_repo'))} "
                    f"({int(entry.get('successes', 0))}s/{int(entry.get('failures', 0))}f, "
                    f"rate={entry.get('success_rate')})"
                )
        if ranking_lines:
            learning_section = (
                "\n\nHISTORICAL EVIDENCE (past approved products):\n"
                "Use these proven capability→repository mappings where they fit:\n"
                + "\n".join(ranking_lines[:12])
            )
    memory_section = ""
    if memory and as_list(memory.get("matches")):
        mem_lines: list[str] = []
        for m in memory.get("matches", [])[:3]:
            rec = as_dict(m.get("record"))
            dna = as_dict(rec.get("product_dna"))
            approved = as_dict(rec.get("approved_strategy"))
            mem_lines.append(
                f"- Similarity {float(m.get('similarity', 0)):.2f} · domain {as_str(m.get('domain')) or '—'} · "
                f"repos {as_list(m.get('shared_repositories'))} · "
                f"outcome {as_str(approved.get('id')) or '—'}"
            )
        if mem_lines:
            memory_section = (
                "\n\nSIMILAR PAST PRODUCTS (from Product Memory):\n"
                "Where a past product closely matches, prefer its proven structure and repos:\n"
                + "\n".join(mem_lines)
            )
    user_prompt = (
        f"INTENT:\n{intent}\n\n"
        f"REQUIREMENTS:\n{requirements}\n\n"
        f"CAPABILITY GRAPH:\n{capabilities}\n\n"
        f"REPOSITORY MAPPING:\n{capability_mappings}\n\n"
        f"MARKET INTELLIGENCE:\n{market}"
        f"{innovation_section}"
        f"{learning_section}"
        f"{memory_section}"
    )
    data = await ask_json(
        provider,
        _SYSTEM_PROMPT,
        user_prompt,
        fallback=None,
        temperature=0.6,
        max_tokens=2200,
    )
    normalized = _normalize_llm(data, capabilities, capability_mappings)
    if normalized is not None:
        return normalized
    return _fallback_strategies(capabilities, capability_mappings, market, intent)
