"""
Product Thinking Agent — thinks like an experienced product manager before
any code or search happens.

Understands the business objective, infers hidden user needs, identifies target
personas, chooses a business model, estimates market maturity, surfaces
assumptions, and only asks clarifying questions when confidence is low. Produces
the Product Thinking Report stored in the graph under ``product_thinking``.
"""

from __future__ import annotations

from typing import Any

from intelligence.prompt_utils import ask_json, as_dict, as_list, as_str
from llm.provider import LLMProvider

_SYSTEM_PROMPT = """You are an experienced Product Manager inside an AI product factory.
The user gave a product idea. Think like a PM BEFORE any implementation.

Return ONLY valid JSON with EXACTLY these keys:
{
  "business_objective": "the core business outcome this product must deliver",
  "customer_segments": [
    {"name": "segment name", "description": "who they are", "needs": ["hidden need", "stated need"]}
  ],
  "value_proposition": "the compelling reason to buy/use this",
  "revenue_model": "e.g. freemium, subscription, affiliate, marketplace commission",
  "success_metrics": ["North Star metric", "activation", "retention", "revenue"],
  "constraints": ["technical", "regulatory", "budget", "time"],
  "risks": ["market risk", "execution risk"],
  "assumptions": ["assumptions the plan depends on"],
  "market_maturity": "emerging" | "growing" | "mature" | "declining",
  "product_vision": "one-paragraph vision statement",
  "confidence": 0.0,
  "clarifying_questions": ["ONLY if confidence < 0.6; otherwise []"],
  "reasoning": "short justification"
}
Be concrete, not generic. Confidence is 0..1. Do not add or remove keys."""


def _fallback(intent: dict[str, Any]) -> dict[str, Any]:
    idea = as_str(intent.get("idea")) or "the product"
    domain = as_str(intent.get("domain")) or "the market"
    goals = as_list(intent.get("user_goals")) or ["solve the core problem"]
    targets = as_list(intent.get("target_users")) or ["end users"]
    bm = as_str(intent.get("business_model")) or "freemium with subscription"
    return {
        "business_objective": f"Deliver a {domain} product that helps users {goals[0]}.",
        "customer_segments": [
            {
                "name": targets[0] if targets else "Primary users",
                "description": f"Primary audience for the {domain} solution",
                "needs": goals[:3],
            }
        ],
        "value_proposition": f"Faster, simpler, cheaper way to {goals[0]} compared with existing {domain} tools.",
        "revenue_model": bm,
        "success_metrics": ["Activation rate", "Task completion", "Weekly retention", "Revenue per user"],
        "constraints": ["Time to market", "Budget", "Team size"],
        "risks": ["Incumbent competitors", "Scope creep"],
        "assumptions": [f"Users need a better {domain} tool", "Feasible with current technology"],
        "market_maturity": "growing",
        "product_vision": f"A {domain} platform built around {goals[0]}, trusted by {targets[0] if targets else 'users'}.",
        "confidence": 0.5,
        "clarifying_questions": [],
        "reasoning": "keyword-based fallback (LLM unavailable)",
    }


def _normalize(data: Any, intent: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(data, dict) or not data:
        return _fallback(intent)
    segments = []
    for s in as_list(data.get("customer_segments")):
        sd = as_dict(s)
        segments.append(
            {
                "name": as_str(sd.get("name")) or "Segment",
                "description": as_str(sd.get("description")),
                "needs": as_list(sd.get("needs")),
            }
        )
    maturity = as_str(data.get("market_maturity"))
    if maturity not in ("emerging", "growing", "mature", "declining"):
        maturity = "growing"
    return {
        "business_objective": as_str(data.get("business_objective")) or as_str(intent.get("idea")),
        "customer_segments": segments or [{"name": "Primary users", "description": "", "needs": []}],
        "value_proposition": as_str(data.get("value_proposition")),
        "revenue_model": as_str(data.get("revenue_model")) or "freemium with subscription",
        "success_metrics": as_list(data.get("success_metrics")),
        "constraints": as_list(data.get("constraints")),
        "risks": as_list(data.get("risks")),
        "assumptions": as_list(data.get("assumptions")),
        "market_maturity": maturity,
        "product_vision": as_str(data.get("product_vision")),
        "confidence": min(1.0, max(0.0, float(data.get("confidence", 0.6)))),
        "clarifying_questions": as_list(data.get("clarifying_questions")),
        "reasoning": as_str(data.get("reasoning")),
    }


async def analyze_product_thinking(intent: dict[str, Any], provider: LLMProvider) -> dict[str, Any]:
    """
    Produce the Product Thinking Report from the analyzed intent.

    Returns the exact keys above. Never raises; falls back to a deterministic
    PM-shaped report derived from the intent fields.
    """
    data = await ask_json(
        provider,
        _SYSTEM_PROMPT,
        f"Product idea and intent:\n{intent}",
        fallback=None,
        temperature=0.5,
        max_tokens=1200,
    )
    return _normalize(data, intent)
