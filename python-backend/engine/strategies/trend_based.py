"""
Trend-Based Strategy — Generates products aligned with current tech trends.
Uses market signals and trending repos to create in-demand products.
"""

from typing import Any, Optional
from llm.provider import LLMProvider


# Current trending technology domains
TREND_DOMAINS = {
    "ai_agents": "Autonomous AI agents, multi-agent systems, agentic workflows",
    "vector_dbs": "Vector databases, semantic search, embedding storage",
    "ai_coding": "AI-powered code generation, copilot tools, automated development",
    "ai_observability": "LLM monitoring, AI system observability, tracing",
    "edge_ai": "Edge AI inference, on-device ML, lightweight models",
    "ai_safety": "AI safety, alignment, guardrails, content moderation",
    "synthetic_data": "Synthetic data generation, data augmentation, privacy-preserving ML",
    "ai_workflows": "AI workflow orchestration, pipeline automation, DAG execution",
}


class TrendBasedStrategy:
    """Generate products aligned with current technology trends."""

    def __init__(self, provider: LLMProvider):
        self.provider = provider

    async def generate(
        self,
        capabilities: list[dict[str, Any]],
        user_intent: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Generate trend-aligned products from available capabilities."""
        # Map repos to trend domains
        repo_trend_map = self._map_repos_to_trends(capabilities)

        # Find the most relevant trends
        top_trends = sorted(repo_trend_map.items(), key=lambda x: len(x[1]), reverse=True)[:3]

        products = []
        for trend, repos in top_trends:
            try:
                product = await self._generate_trend_product(trend, repos, capabilities, user_intent)
                if product:
                    products.append(product)
            except Exception as e:
                print(f"[TrendBased] trend product error for {trend}: {e}")

        return products

    def _map_repos_to_trends(
        self, capabilities: list[dict[str, Any]]
    ) -> dict[str, list[dict[str, Any]]]:
        """Map repos to trending domains based on their descriptions and capabilities."""
        trend_map: dict[str, list[dict]] = {trend: [] for trend in TREND_DOMAINS}

        for cap in capabilities:
            desc = (cap.get("description") or "").lower()
            name = cap.get("name", "").lower()
            cap_type = cap.get("capability", "")

            for trend, keywords in TREND_DOMAINS.items():
                kw_list = keywords.lower().split(", ")
                if any(kw in desc or kw in name for kw in kw_list):
                    trend_map[trend].append(cap)
                elif cap_type in keywords.lower():
                    trend_map[trend].append(cap)

        # Remove empty trends
        return {k: v for k, v in trend_map.items() if v}

    async def _generate_trend_product(
        self,
        trend: str,
        repos: list[dict[str, Any]],
        all_capabilities: list[dict[str, Any]],
        user_intent: Optional[str],
    ) -> Optional[dict[str, Any]]:
        """Generate a product aligned with a specific trend."""
        trend_desc = TREND_DOMAINS.get(trend, "")
        repo_info = [{"name": r.get("name", ""), "capability": r.get("capability", "")} for r in repos[:3]]

        intent_ctx = f"\nUser Intent: {user_intent}" if user_intent else ""

        messages = [
            {
                "role": "system",
                "content": """You are a trend-aligned product strategist. Create products that ride
current technology trends while leveraging available open-source capabilities.

Return ONLY valid JSON:
{
  "name": "<product name>",
  "description": "<2-3 sentence description highlighting trend alignment>",
  "system_flow": "<step-by-step system flow>",
  "capabilities": ["<cap1>", "<cap2>"],
  "target_users": ["<user1>", "<user2>"],
  "key_features": ["<feature1>", "<feature2>", "<feature3>"],
  "trend_alignment": "<which trend this aligns with and why>"
}""",
            },
            {
                "role": "user",
                "content": f"""TREND: {trend} — {trend_desc}

Available repos for this trend:
{repo_info}

All available capability types: {list(set(c.get('capability', '') for c in all_capabilities))}{intent_ctx}

Design a product that capitalizes on the {trend} trend using these repos.""",
            },
        ]

        raw = await self.provider.chat(messages, temperature=0.7, max_tokens=600)
        data = self.provider.parse_json(raw)

        if not data.get("name"):
            return None

        return {
            "name": data.get("name", f"{trend.replace('_', ' ').title()} Platform"),
            "description": data.get("description", ""),
            "system_flow": data.get("system_flow", ""),
            "capabilities": data.get("capabilities", [r.get("capability", "") for r in repos]),
            "target_users": data.get("target_users", []),
            "key_features": data.get("key_features", []),
            "repos_used": [r.get("name", "") for r in repos],
            "trend_alignment": data.get("trend_alignment", trend),
        }
