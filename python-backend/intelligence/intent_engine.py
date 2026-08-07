"""
Intent Intelligence — semantic interpretation of the user's product idea.

The old pipeline did keyword matching and guessed. This engine restates the
idea to prove understanding, then extracts the domain, product category,
business model, target users, goals, constraints, success metrics and derived
search keywords. It degrades to a deterministic keyword-map heuristic when the
LLM is unavailable or returns garbage.
"""

from __future__ import annotations

from typing import Any

from intelligence.prompt_utils import ask_json, as_dict, as_list, as_str
from llm.provider import LLMProvider

_SYSTEM_PROMPT = """You are a product intelligence analyst working inside an AI product factory.
Interpret the user's idea SEMANTICALLY — not by keyword matching. Restate it in your own words,
then extract structured intelligence from it.

Return ONLY valid JSON with EXACTLY these keys:
{
  "summary": "one-sentence restatement proving semantic understanding",
  "domain": "business domain, e.g. e-commerce, fintech, developer tools",
  "product_category": "e.g. price comparison platform",
  "business_model": "e.g. freemium with affiliate revenue",
  "core_problem": "the core problem the product solves",
  "user_goals": ["goal1", "goal2"],
  "target_users": ["user segment 1", "user segment 2"],
  "success_metrics": ["metric1", "metric2"],
  "constraints": ["constraint1"],
  "desired_outcomes": ["outcome1"],
  "search_keywords": ["6-10 derived keywords for later market and github search"],
  "confidence": 0.0,
  "reasoning": "short justification of the interpretation"
}
Do not add or remove keys. Confidence is 0..1."""

# keyword -> domain heuristic map used by the no-LLM fallback
_DOMAIN_KEYWORDS: list[tuple[list[str], str, str]] = [
    (["price", "shop", "buy", "cart", "compare", "marketplace", "product"], "e-commerce", "price comparison platform"),
    (["pay", "bank", "financ", "invoice", "wallet", "accounting", "budget"], "fintech", "financial tool"),
    (["code", "api", "sdk", "developer", "cli", "kubernetes", "devops", "observability"], "developer tools", "developer tool"),
    (["health", "clinic", "patient", "fitness", "medical"], "health-tech", "health platform"),
    (["learn", "cours", "student", "tutor", "training"], "education", "learning platform"),
    (["travel", "hotel", "flight", "trip"], "travel", "travel platform"),
    (["ship", "deliver", "logistic", "warehouse", "supply"], "logistics", "logistics platform"),
    (["secur", "cyber", "threat", "vulnerab", "compliance"], "security", "security tool"),
    (["agent", "assistant", "llm", "chat", "automation"], "AI agent", "AI assistant"),
]

_STOPWORDS = {
    "a", "an", "the", "for", "and", "or", "to", "of", "in", "on", "at",
    "with", "from", "make", "build", "create", "app", "application", "platform",
    "that", "this", "it", "is", "be", "by", "as", "new", "tool", "product",
}


def _detect_domain(idea: str) -> tuple[str, str]:
    lowered = idea.lower()
    for keywords, domain, category in _DOMAIN_KEYWORDS:
        if any(k in lowered for k in keywords):
            return domain, category
    return "general", "digital product"


def _derive_keywords(idea: str) -> list[str]:
    """No-LLM keyword derivation: content words from the idea, deduped."""
    seen: list[str] = []
    for word in idea.lower().replace("_", " ").replace("-", " ").split():
        clean = "".join(c for c in word if c.isalnum())
        if clean and clean not in _STOPWORDS and clean not in seen:
            seen.append(clean)
    return seen[:10]


def _fallback(idea: str) -> dict[str, Any]:
    domain, category = _detect_domain(idea)
    keywords = _derive_keywords(idea) or [domain, category]
    return {
        "idea": idea,
        "summary": idea.strip(),
        "domain": domain,
        "product_category": category,
        "business_model": "freemium with subscription",
        "core_problem": idea.strip(),
        "user_goals": [f"Complete the task {idea.strip()} addresses"],
        "target_users": ["End users"],
        "success_metrics": ["User adoption", "Task completion rate"],
        "constraints": ["Time to market", "Budget"],
        "desired_outcomes": [f"A working {category} based on the idea"],
        "search_keywords": keywords,
        "confidence": 0.4,
        "reasoning": "keyword-based fallback (LLM unavailable)",
    }


async def analyze_intent(idea: str, provider: LLMProvider) -> dict[str, Any]:
    """
    Analyze the user's product idea semantically.

    Returns a dict with the exact keys documented in PI_CONTRACT (Engine 1).
    Never raises; falls back to a keyword-map heuristic.
    """
    if not idea or not idea.strip():
        return _fallback(idea or "")

    data = await ask_json(
        provider,
        _SYSTEM_PROMPT,
        f"User's product idea:\n{idea}",
        fallback=None,
        temperature=0.4,
        max_tokens=1200,
    )
    if not isinstance(data, dict) or not data:
        return _fallback(idea)

    domain = as_str(data.get("domain")) or _detect_domain(idea)[0]
    return {
        "idea": idea,
        "summary": as_str(data.get("summary")) or idea,
        "domain": domain,
        "product_category": as_str(data.get("product_category")) or _detect_domain(idea)[1],
        "business_model": as_str(data.get("business_model")) or "freemium with subscription",
        "core_problem": as_str(data.get("core_problem")) or idea,
        "user_goals": as_list(data.get("user_goals")) or ["Solve the core problem"],
        "target_users": as_list(data.get("target_users")) or ["End users"],
        "success_metrics": as_list(data.get("success_metrics")) or ["User adoption"],
        "constraints": as_list(data.get("constraints")) or [],
        "desired_outcomes": as_list(data.get("desired_outcomes")) or [],
        "search_keywords": as_list(data.get("search_keywords")) or _derive_keywords(idea),
        "confidence": min(1.0, max(0.0, float(data.get("confidence", 0.6)))),
        "reasoning": as_str(data.get("reasoning")) or "interpreted by LLM",
    }
