"""
Market Intelligence — existing-product discovery and market analysis.

Runs structured web searches (Tavily) derived from the intent's search keywords,
then interprets the snippets into competitor intelligence, trends, opportunities
and threats. Replaces the old ``webSignals`` path that collected raw results and
discarded them. When no web key or LLM is available it degrades to a
deterministic fallback with the same output shape.
"""

from __future__ import annotations

from typing import Any

from intelligence.prompt_utils import ask_json, as_dict, as_list, as_str
from intelligence.web_tools import multi_search
from llm.provider import LLMProvider

_SYSTEM_PROMPT = """You are a market intelligence analyst inside an AI product factory.
From the web evidence provided, produce structured market intelligence.

Return ONLY valid JSON with EXACTLY these keys:
{
  "existing_products": [
    {
      "name": "product name",
      "category": "category",
      "features": ["feature"],
      "strengths": ["strength"],
      "weaknesses": ["weakness"],
      "pricing": "pricing model",
      "target_users": ["segment"],
      "missing_capabilities": ["capability the product lacks"],
      "source": "url"
    }
  ],
  "market_trends": ["trend"],
  "growth_indicators": ["indicator"],
  "emerging_technologies": ["technology"],
  "pain_points": ["user pain point"],
  "opportunities": ["opportunity"],
  "threats": ["threat"],
  "sources": ["url"]
}
Be CONCRETE — base every claim on the web evidence, not generic statements.
Include both commercial and open-source products. Do not add or remove keys."""


def _search_queries(intent: dict[str, Any]) -> list[str]:
    idea = as_str(intent.get("idea")) or "product"
    domain = as_str(intent.get("domain"))
    category = as_str(intent.get("product_category"))
    keywords = as_list(intent.get("search_keywords")) or [idea]

    queries = [
        f"{idea} competitors",
        f"{idea} alternatives",
        f"{domain or category} market trends",
    ]
    if category and category not in queries:
        queries.append(f"{category} top products")
    for kw in keywords[:3]:
        if kw not in idea:
            queries.append(f"{kw} market")
    # cap the fan-out
    return queries[:6]


# Curated domain -> existing products (used when web evidence is unavailable so
# the competitor chain always has raw material). Each product:
# (name, category, [features], [strengths], [weaknesses], pricing, [target_users],
#  [missing_capabilities], source)
_KNOWN_PRODUCTS: dict[str, list[tuple]] = {
    "e-commerce": [
        ("Google Shopping", "price comparison", ["product search", "price listings", "seller aggregation"], ["large merchant coverage", "trusted brand"], ["weak price-drop alerts", "no price forecasting"], "free (ads)", ["shoppers"], ["AI price prediction", "proactive drop alerts"], "https://shopping.google.com"),
        ("Honey", "shopping assistant", ["coupon finder", "price history", "cashback rewards"], ["large user base", "easy browser extension"], ["opaque data", "no cross-retailer watchlists"], "free", ["consumers"], ["API access", "price forecasting"], "https://www.joinhoney.com"),
        ("CamelCamelCamel", "price tracker", ["Amazon price history", "drop alerts", "price charts"], ["trusted historical data"], ["Amazon-only", "no retailer aggregation"], "freemium", ["deal hunters"], ["multi-retailer coverage", "mobile alerts"], "https://camelcamelcamel.com"),
        ("PriceSpy", "price comparison", ["multi-retailer prices", "price alerts", "product reviews"], ["broad retailer coverage"], ["dated UI", "no personalization"], "free", ["deal hunters"], ["AI recommendations"], "https://www.pricespy.co.nz"),
    ],
    "agent": [
        ("LangChain", "LLM orchestration", ["agent frameworks", "tool calling", "memory integrations"], ["large ecosystem", "active community"], ["complexity", "breaking API changes"], "open source + cloud", ["developers"], ["production observability", "managed hosting"], "https://github.com/langchain-ai/langchain"),
        ("OpenAI Assistants", "agent platform", ["hosted assistants", "tool use", "file retrieval"], ["managed", "reliable"], ["vendor lock-in", "limited customization"], "usage-based", ["developers", "businesses"], ["self-hosting", "open models"], "https://openai.com"),
        ("AutoGen", "multi-agent", ["conversational agents", "code execution"], ["research-backed"], ["steep learning curve"], "open source", ["researchers"], ["production hardening"], "https://microsoft.github.io/autogen/"),
    ],
    "automation": [
        ("Zapier", "workflow automation", ["app integrations", "triggers", "no-code automation"], ["broad integration catalog", "easy to use"], ["cost at scale", "opaque execution"], "freemium", ["SMBs"], ["programmable workflows", "self-hosted"], "https://zapier.com"),
        ("n8n", "workflow automation", ["self-hosted workflows", "code nodes", "API builder"], ["open source", "self-hostable"], ["smaller ecosystem"], "open source + cloud", ["developers"], ["enterprise governance"], "https://n8n.io"),
        ("Make", "automation platform", ["visual builder", "app connectors", "scenarios"], ["intuitive UI"], ["pricing tiers"], "freemium", ["marketers", "ops"], ["programmable control"], "https://www.make.com"),
    ],
    "general": [
        ("Notion", "productivity", ["notes", "docs", "databases"], ["flexible", "popular"], ["no offline-first mobile"], "freemium", ["teams"], ["automation", "offline"], "https://notion.so"),
        ("Jira", "project management", ["issue tracking", "sprints", "reporting"], ["powerful", "enterprise-standard"], ["heavy", "slow"], "per-user", ["software teams"], ["simple workflows"], "https://www.atlassian.com/software/jira"),
        ("Trello", "project management", ["boards", "cards", "automation"], ["simple", "visual"], ["limited scaling"], "freemium", ["small teams"], ["rich reporting"], "https://trello.com"),
    ],
}


def _detect_domain(domain: str) -> str:
    lowered = (domain or "").lower()
    for key in ("e-commerce", "price", "shop", "retail", "comparison"):
        if key in lowered:
            return "e-commerce"
    if "agent" in lowered or "assistant" in lowered or "llm" in lowered:
        return "agent"
    for key in ("automation", "workflow", "schedule"):
        if key in lowered:
            return "automation"
    return "general"


def _known_products(domain: str) -> list[dict[str, Any]]:
    """Curated existing products for a domain — competitor raw material."""
    return [
        {
            "name": p[0],
            "category": p[1],
            "features": list(p[2]),
            "strengths": list(p[3]),
            "weaknesses": list(p[4]),
            "pricing": p[5],
            "target_users": list(p[6]),
            "missing_capabilities": list(p[7]),
            "source": p[8],
        }
        for p in _KNOWN_PRODUCTS.get(_detect_domain(domain), _KNOWN_PRODUCTS["general"])
    ]


def _fallback(intent: dict[str, Any]) -> dict[str, Any]:
    idea = as_str(intent.get("idea")) or "the product"
    domain = as_str(intent.get("domain")) or "the market"
    return {
        "existing_products": _known_products(domain),
        "market_trends": [f"Growing adoption of {domain} solutions"],
        "growth_indicators": ["Increasing digital transformation spend"],
        "emerging_technologies": ["AI-powered personalization"],
        "pain_points": [f"Existing {domain} tools are fragmented and hard to integrate"],
        "opportunities": [f"An integrated, user-friendly {idea} has headroom"],
        "threats": ["Incumbent competitors with large distribution"],
        "sources": [p["source"] for p in _known_products(domain) if p.get("source")],
    }


def _format_evidence(snippets: list[dict[str, Any]]) -> str:
    lines = []
    for i, s in enumerate(snippets, start=1):
        title = as_str(s.get("title"))
        url = as_str(s.get("url"))
        content = as_str(s.get("content"))
        lines.append(f"[{i}] {title} ({url})\n{content}")
    return "\n\n".join(lines) if lines else "(no web evidence available)"


async def analyze_market(
    intent: dict[str, Any],
    provider: LLMProvider,
    tavily_key: str | None = None,
) -> dict[str, Any]:
    """
    Analyze the market: existing products, trends, opportunities, threats.

    Returns a dict with the exact keys from PI_CONTRACT (Engine 3). Never
    raises; falls back to a deterministic shape when web/LLM are unavailable.
    """
    queries = _search_queries(intent)
    snippets = await multi_search(queries, api_key=tavily_key, per_query=4)

    user_prompt = (
        f"PRODUCT INTENT:\n{intent}\n\n"
        f"WEB EVIDENCE:\n{_format_evidence(snippets)}"
    )
    data = await ask_json(
        provider,
        _SYSTEM_PROMPT,
        user_prompt,
        fallback=None,
        temperature=0.4,
        max_tokens=1600,
    )

    if not isinstance(data, dict) or not data:
        return _fallback(intent)

    domain = as_str(intent.get("domain")) or "general"
    idea = as_str(intent.get("idea")) or "the product"
    # Without web evidence the LLM may (correctly) refuse to invent products.
    # Merge in the curated catalog so downstream competitor intelligence always
    # has raw material — the fallback should be useful, not empty.
    curated = _known_products(domain)
    existing = []
    for p in as_list(data.get("existing_products")):
        pd = as_dict(p)
        existing.append(
            {
                "name": as_str(pd.get("name")) or "Unknown product",
                "category": as_str(pd.get("category")),
                "features": as_list(pd.get("features")),
                "strengths": as_list(pd.get("strengths")),
                "weaknesses": as_list(pd.get("weaknesses")),
                "pricing": as_str(pd.get("pricing")),
                "target_users": as_list(pd.get("target_users")),
                "missing_capabilities": as_list(pd.get("missing_capabilities")),
                "source": as_str(pd.get("source")),
            }
        )

    sources = [s.get("url", "") for s in snippets if isinstance(s, dict) and s.get("url")]
    sources = list(dict.fromkeys(sources))  # dedupe preserving order

    # merge curated catalog when the LLM (without web evidence) returned nothing
    if not existing and curated:
        existing = curated
        sources = [p["source"] for p in curated if p.get("source")]

    return {
        "existing_products": existing,
        "market_trends": as_list(data.get("market_trends")) or [f"Growing adoption of {domain} solutions"],
        "growth_indicators": as_list(data.get("growth_indicators")) or ["Increasing digital transformation spend"],
        "emerging_technologies": as_list(data.get("emerging_technologies")) or ["AI-powered personalization"],
        "pain_points": as_list(data.get("pain_points")) or [f"Existing {domain} tools are fragmented and hard to integrate"],
        "opportunities": as_list(data.get("opportunities")) or [f"An integrated, user-friendly {idea} has headroom"],
        "threats": as_list(data.get("threats")) or ["Incumbent competitors with large distribution"],
        "sources": as_list(data.get("sources")) or sources,
    }
