"""
Product Evolution Engine — the goal is not replication, it is evolution.

Compares required features against competitor features and generates evolution
opportunities: chains of capability additions that move from what competitors
ship today to a next-generation product. E.g.:

    Google Shopping → Honey → AI Recommendation → Price Prediction → Trust Engine
    → Next-generation Commerce Intelligence Platform
"""

from __future__ import annotations

from typing import Any

from intelligence.prompt_utils import ask_json, as_dict, as_list, as_str
from llm.provider import LLMProvider

_SYSTEM_PROMPT = """You are a product evolution strategist inside an AI product factory.
Compare the required features against competitor features and design EVOLUTION
opportunities — the sequence of capability additions that leapfrogs competitors
into a next-generation product.

Return ONLY valid JSON with EXACTLY these keys:
{
  "evolution_opportunities": [
    {
      "from": "current state / competitor capability",
      "to": "next generation capability",
      "description": "what the leap is",
      "impact": 0.0,
      "confidence": 0.0,
      "required_capabilities": ["capability ids or names needed"]
    }
  ],
  "evolution_chain": ["capability A", "capability B", "...", "Next-generation Platform"],
  "evolution_statement": "one sentence: from X today to Y next",
  "competitive_advantage": "the durable moat",
  "confidence": 0.0,
  "reasoning": "short justification"
}
Scores are 0..1. Do not add or remove keys."""


def _fallback(
    intent: dict[str, Any],
    requirements: list[dict[str, Any]],
    competitors: list[dict[str, Any]],
) -> dict[str, Any]:
    domain = as_str(intent.get("domain")) or "the market"
    req_titles = [as_str(as_dict(r).get("title")) for r in requirements[:4] if as_str(as_dict(r).get("title"))]
    competitor_names = [as_str(as_dict(c).get("name")) for c in competitors[:3] if as_str(as_dict(c).get("name"))]

    opportunities: list[dict[str, Any]] = []
    if competitor_names:
        opportunities.append(
            {
                "from": " / ".join(competitor_names),
                "to": f"A unified {domain} experience combining their strengths",
                "description": "Combine the strengths of existing players into one integrated product.",
                "impact": 0.8,
                "confidence": 0.6,
                "required_capabilities": req_titles[:3],
            }
        )
    # every must requirement a competitor misses is an evolution step
    for req in requirements:
        r = as_dict(req)
        if as_str(r.get("priority")) == "must" and as_str(r.get("title")):
            opportunities.append(
                {
                    "from": "Competitors' current coverage",
                    "to": as_str(r.get("title")),
                    "description": as_str(r.get("description")) or "",
                    "impact": 0.7,
                    "confidence": 0.6,
                    "required_capabilities": [as_str(r.get("title"))],
                }
            )

    chain = competitor_names + req_titles[:3] + [f"Next-generation {domain} Platform"]
    return {
        "evolution_opportunities": opportunities[:6],
        "evolution_chain": chain[:8],
        "evolution_statement": f"From {competitor_names[0] if competitor_names else 'current tools'} to a next-generation {domain} intelligence platform.",
        "competitive_advantage": f"An integrated {domain} data + intelligence layer no single competitor ships.",
        "confidence": 0.5,
        "reasoning": "deterministic fallback from requirement vs competitor comparison",
    }


def _normalize(data: Any) -> dict[str, Any] | None:
    if not isinstance(data, dict) or not data:
        return None
    ops = []
    for o in as_list(data.get("evolution_opportunities")):
        od = as_dict(o)
        ops.append(
            {
                "from": as_str(od.get("from")),
                "to": as_str(od.get("to")),
                "description": as_str(od.get("description")),
                "impact": min(1.0, max(0.0, float(od.get("impact", 0.6)))),
                "confidence": min(1.0, max(0.0, float(od.get("confidence", 0.5)))),
                "required_capabilities": as_list(od.get("required_capabilities")),
            }
        )
    return {
        "evolution_opportunities": ops,
        "evolution_chain": as_list(data.get("evolution_chain")),
        "evolution_statement": as_str(data.get("evolution_statement")),
        "competitive_advantage": as_str(data.get("competitive_advantage")),
        "confidence": min(1.0, max(0.0, float(data.get("confidence", 0.6)))),
        "reasoning": as_str(data.get("reasoning")),
    }


async def analyze_evolution(
    intent: dict[str, Any],
    requirements: list[dict[str, Any]],
    competitors: list[dict[str, Any]],
    provider: LLMProvider,
) -> dict[str, Any]:
    """
    Generate evolution opportunities. Never raises; falls back to a
    deterministic requirement-vs-competitor comparison.
    """
    data = await ask_json(
        provider,
        _SYSTEM_PROMPT,
        f"PRODUCT INTENT:\n{intent}\n\nREQUIRED FEATURES:\n{requirements}\n\nCOMPETITOR FEATURES:\n{competitors}",
        fallback=None,
        temperature=0.5,
        max_tokens=1400,
    )
    normalized = _normalize(data)
    if normalized is not None:
        return normalized
    return _fallback(intent, requirements, competitors)
