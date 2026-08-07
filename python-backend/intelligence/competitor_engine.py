"""
Competitor Intelligence Agent — extends Market Intelligence from a list of
competitor names into a full Competitor Knowledge Graph.

For each competitor it extracts the feature matrix, strengths, weaknesses,
missing features, user complaints, market position, pricing, and technical
stack. Every node carries source/confidence so the analysis is traceable.
"""

from __future__ import annotations

from typing import Any

from intelligence.prompt_utils import ask_json, as_dict, as_list, as_str
from llm.provider import LLMProvider

_SYSTEM_PROMPT = """You are a competitive intelligence analyst inside an AI product factory.
For each existing product in the market intelligence, build a Competitor Knowledge Graph node.

Return ONLY valid JSON — an array of objects, each with EXACTLY these keys:
{
  "name": "competitor name",
  "feature_matrix": {"category": ["feature1", "feature2"]},
  "strengths": ["strength"],
  "weaknesses": ["weakness"],
  "missing_features": ["what it lacks"],
  "user_complaints": ["commonly reported complaint"],
  "market_position": "leader | challenger | niche | newcomer",
  "pricing": "pricing model",
  "technical_stack": ["tech1", "tech2"],
  "confidence": 0.0,
  "sources": ["url"]
}
Analyze each one independently and concretely. Confidence is 0..1."""


def _fallback(market: dict[str, Any]) -> list[dict[str, Any]]:
    competitors: list[dict[str, Any]] = []
    for p in as_list(market.get("existing_products"))[:8]:
        pd = as_dict(p)
        name = as_str(pd.get("name")) or "Unknown"
        features = as_list(pd.get("features"))
        competitors.append(
            {
                "name": name,
                "feature_matrix": {"core": features},
                "strengths": as_list(pd.get("strengths")),
                "weaknesses": as_list(pd.get("weaknesses")),
                "missing_features": as_list(pd.get("missing_capabilities")),
                "user_complaints": [],
                "market_position": "challenger",
                "pricing": as_str(pd.get("pricing")),
                "technical_stack": [],
                "confidence": 0.5,
                "sources": [as_str(pd.get("source"))] if as_str(pd.get("source")) else [],
            }
        )
    return competitors


def _normalize(data: Any) -> list[dict[str, Any]] | None:
    if not isinstance(data, list) or not data:
        return None
    out: list[dict[str, Any]] = []
    for item in data:
        d = as_dict(item)
        position = as_str(d.get("market_position"))
        if position not in ("leader", "challenger", "niche", "newcomer"):
            position = "challenger"
        out.append(
            {
                "name": as_str(d.get("name")) or "Unknown",
                "feature_matrix": as_dict(d.get("feature_matrix")),
                "strengths": as_list(d.get("strengths")),
                "weaknesses": as_list(d.get("weaknesses")),
                "missing_features": as_list(d.get("missing_features")),
                "user_complaints": as_list(d.get("user_complaints")),
                "market_position": position,
                "pricing": as_str(d.get("pricing")),
                "technical_stack": as_list(d.get("technical_stack")),
                "confidence": min(1.0, max(0.0, float(d.get("confidence", 0.6)))),
                "sources": as_list(d.get("sources")),
            }
        )
    return out or None


async def build_competitor_intelligence(
    market: dict[str, Any],
    provider: LLMProvider,
) -> list[dict[str, Any]]:
    """
    Build the Competitor Knowledge Graph from market intelligence.

    Returns a list of competitor nodes (see keys above). Never raises; falls
    back to a deterministic expansion of the existing-products list.
    """
    data = await ask_json(
        provider,
        _SYSTEM_PROMPT,
        f"MARKET INTELLIGENCE (existing products to analyze):\n{market}",
        fallback=None,
        temperature=0.4,
        max_tokens=2000,
    )
    normalized = _normalize(data)
    if normalized is not None:
        return normalized
    return _fallback(market)
