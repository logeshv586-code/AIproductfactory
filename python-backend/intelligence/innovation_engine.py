"""
Innovation Intelligence Agent — stops asking "what already exists?" and asks
"what should exist?".

Detects feature gaps, finds missing combinations, discovers emerging
opportunities and recommends concrete product innovations. Produces the
Innovation Report stored under ``innovation``.
"""

from __future__ import annotations

from typing import Any

from intelligence.prompt_utils import ask_json, as_dict, as_list, as_str
from llm.provider import LLMProvider

_SYSTEM_PROMPT = """You are an innovation strategist inside an AI product factory.
Do NOT report what already exists. Identify what SHOULD exist.

From the required capabilities, competitor weaknesses and market pain points,
invent the features and combinations that would differentiate the product.

Return ONLY valid JSON with EXACTLY these keys:
{
  "novel_features": [
    {"name": "feature", "why": "why it doesn't exist yet", "impact": 0.0, "feasibility": 0.0}
  ],
  "differentiators": ["clear, defensible differentiators"],
  "market_opportunities": ["emerging opportunities"],
  "missing_combinations": ["two+ capabilities nobody has combined yet"],
  "innovation_score": 0.0,
  "innovation_statement": "one sentence capturing the core innovation",
  "confidence": 0.0,
  "reasoning": "short justification"
}
Scores are 0..1. Do not add or remove keys."""


def _fallback(
    intent: dict[str, Any],
    requirements: list[dict[str, Any]],
    competitors: list[dict[str, Any]],
    market: dict[str, Any],
) -> dict[str, Any]:
    domain = as_str(intent.get("domain")) or "the market"
    novel: list[dict[str, Any]] = []
    seen: set[str] = set()
    for comp in competitors:
        for miss in as_list(as_dict(comp).get("missing_features"))[:2]:
            key = str(miss).lower()
            if key not in seen:
                seen.add(key)
                novel.append(
                    {
                        "name": str(miss),
                        "why": f"Competitor {as_str(as_dict(comp).get('name'))} lacks it",
                        "impact": 0.7,
                        "feasibility": 0.6,
                    }
                )
    for pain in as_list(market.get("pain_points"))[:2]:
        key = f"solve: {pain}".lower()
        if key not in seen:
            seen.add(key)
            novel.append({"name": f"Solve {pain}", "why": "Reported user pain", "impact": 0.8, "feasibility": 0.6})

    req_titles = [as_str(as_dict(r).get("title")) for r in requirements[:3]]
    combinations = (
        [f"Combine {req_titles[0]} with {req_titles[1]}"] if len(req_titles) >= 2 else []
    )
    return {
        "novel_features": novel[:6],
        "differentiators": [f"An integrated, opinionated {domain} experience competitors can't match"],
        "market_opportunities": as_list(market.get("opportunities"))[:3] or [f"Headroom in {domain}"],
        "missing_combinations": combinations,
        "innovation_score": 0.55,
        "innovation_statement": f"Rebuild {domain} around the combinations competitors haven't shipped.",
        "confidence": 0.5,
        "reasoning": "deterministic fallback from competitor gaps and pain points",
    }


def _normalize(data: Any) -> dict[str, Any] | None:
    if not isinstance(data, dict) or not data:
        return None
    novel = []
    for n in as_list(data.get("novel_features")):
        nd = as_dict(n)
        novel.append(
            {
                "name": as_str(nd.get("name")) or "Feature",
                "why": as_str(nd.get("why")),
                "impact": min(1.0, max(0.0, float(nd.get("impact", 0.6)))),
                "feasibility": min(1.0, max(0.0, float(nd.get("feasibility", 0.6)))),
            }
        )
    return {
        "novel_features": novel,
        "differentiators": as_list(data.get("differentiators")),
        "market_opportunities": as_list(data.get("market_opportunities")),
        "missing_combinations": as_list(data.get("missing_combinations")),
        "innovation_score": min(1.0, max(0.0, float(data.get("innovation_score", 0.5)))),
        "innovation_statement": as_str(data.get("innovation_statement")),
        "confidence": min(1.0, max(0.0, float(data.get("confidence", 0.6)))),
        "reasoning": as_str(data.get("reasoning")),
    }


async def analyze_innovation(
    intent: dict[str, Any],
    requirements: list[dict[str, Any]],
    competitors: list[dict[str, Any]],
    market: dict[str, Any],
    provider: LLMProvider,
) -> dict[str, Any]:
    """
    Produce the Innovation Report. Never raises; falls back to a deterministic
    derivation from competitor gaps and market pain points.
    """
    data = await ask_json(
        provider,
        _SYSTEM_PROMPT,
        f"REQUIRED CAPABILITIES (from requirements):\n{requirements}\n\n"
        f"COMPETITOR INTELLIGENCE:\n{competitors}\n\nMARKET PAIN POINTS:\n{as_list(market.get('pain_points'))}",
        fallback=None,
        temperature=0.5,
        max_tokens=1400,
    )
    normalized = _normalize(data)
    if normalized is not None:
        return normalized
    return _fallback(intent, requirements, competitors, market)
