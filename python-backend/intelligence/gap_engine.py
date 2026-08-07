"""
Gap Analysis — required capabilities vs what already exists.

Compares the requirements (what the product must do) against the market
intelligence (what competitors already do) and identifies gaps: missing
capabilities, competitive opportunities, novel combinations, differentiation
and user friction. Produces one opportunity statement.
"""

from __future__ import annotations

from typing import Any

from intelligence.prompt_utils import ask_json, as_dict, as_list, as_str
from llm.provider import LLMProvider

_SYSTEM_PROMPT = """You are a product strategist inside an AI product factory.
Compare the required capabilities (from requirements) against what existing products
(from market intelligence) provide. Identify GAPS.

Return ONLY valid JSON with EXACTLY these keys:
{
  "gaps": [
    {
      "gap": "short gap name",
      "type": "missing_capability" | "competitive_opportunity" | "novel_combination" | "differentiation" | "friction",
      "description": "what the gap is",
      "why": "why competitors haven't closed it",
      "impact": 0.0,
      "confidence": 0.0
    }
  ],
  "opportunity_statement": "The strongest unmet combination: 'Nobody combines X with Y — this is your opportunity'."
}
impact and confidence are 0..1. Do not add or remove keys."""


def _fallback(
    intent: dict[str, Any],
    requirements: list[dict[str, Any]],
    market: dict[str, Any],
) -> dict[str, Any]:
    gaps: list[dict[str, Any]] = []

    # Requirements the product must deliver but existing products may lack.
    for req in requirements:
        r = as_dict(req)
        if as_str(r.get("priority")) in ("should", "could"):
            gaps.append(
                {
                    "gap": as_str(r.get("title")) or "Unaddressed requirement",
                    "type": "missing_capability",
                    "description": as_str(r.get("description")) or "",
                    "why": "Not covered by the core requirements yet.",
                    "impact": 0.6,
                    "confidence": 0.6,
                }
            )

    # Pain points and weaknesses from market intelligence.
    for pain in as_list(market.get("pain_points"))[:3]:
        gaps.append(
            {
                "gap": str(pain),
                "type": "friction",
                "description": str(pain),
                "why": "Competitors have not solved this friction.",
                "impact": 0.7,
                "confidence": 0.5,
            }
        )

    for product in as_list(market.get("existing_products"))[:3]:
        for weakness in as_list(as_dict(product).get("weaknesses"))[:2]:
            gaps.append(
                {
                    "gap": f"Competitor weakness: {weakness}",
                    "type": "competitive_opportunity",
                    "description": f"Competitor {as_str(as_dict(product).get('name'))} lacks {weakness}.",
                    "why": "This is a differentiator worth exploiting.",
                    "impact": 0.6,
                    "confidence": 0.5,
                }
            )

    # Dedupe by gap text.
    seen: set[str] = set()
    deduped = []
    for g in gaps:
        key = str(g["gap"]).lower()
        if key not in seen:
            seen.add(key)
            deduped.append(g)
    gaps = deduped[:8]

    top = gaps[0]["gap"] if gaps else "the core capability"
    domain = as_str(intent.get("domain")) or "the market"
    opportunity = f"Nobody combines {top} with a seamless {domain} experience — this is your opportunity."

    return {
        "gaps": gaps,
        "opportunity_statement": opportunity,
    }


def _normalize(data: Any) -> dict[str, Any] | None:
    if not isinstance(data, dict) or not data:
        return None
    gaps: list[dict[str, Any]] = []
    for item in as_list(data.get("gaps")):
        d = as_dict(item)
        gap_type = as_str(d.get("type"))
        if gap_type not in ("missing_capability", "competitive_opportunity", "novel_combination", "differentiation", "friction"):
            gap_type = "missing_capability"
        gaps.append(
            {
                "gap": as_str(d.get("gap")) or "Unnamed gap",
                "type": gap_type,
                "description": as_str(d.get("description")),
                "why": as_str(d.get("why")),
                "impact": min(1.0, max(0.0, float(d.get("impact", 0.5)))),
                "confidence": min(1.0, max(0.0, float(d.get("confidence", 0.5)))),
            }
        )
    if not gaps:
        return None
    return {
        "gaps": gaps,
        "opportunity_statement": as_str(data.get("opportunity_statement")) or gaps[0]["gap"],
    }


async def analyze_gaps(
    intent: dict[str, Any],
    requirements: list[dict[str, Any]],
    market: dict[str, Any],
    provider: LLMProvider,
) -> dict[str, Any]:
    """
    Identify gaps between required capabilities and what already exists.

    Returns a dict with exact keys ``gaps`` and ``opportunity_statement``.
    Never raises; falls back to deriving gaps from requirements + market data.
    """
    data = await ask_json(
        provider,
        _SYSTEM_PROMPT,
        f"REQUIREMENTS:\n{requirements}\n\nMARKET INTELLIGENCE:\n{market}",
        fallback=None,
        temperature=0.4,
        max_tokens=1200,
    )
    normalized = _normalize(data)
    if normalized is not None:
        return normalized
    return _fallback(intent, requirements, market)
