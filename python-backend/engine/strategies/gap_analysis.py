"""
Gap Analysis Strategy — Identifies gaps in the capability landscape
and generates products that fill those gaps.
"""

from typing import Any, Optional
from llm.provider import LLMProvider


# Expected capability ecosystem for a complete AI product
EXPECTED_CAPABILITIES = ["memory", "agent", "rag", "ui", "backend", "automation"]


class GapAnalysisStrategy:
    """Generate products by identifying and filling capability gaps."""

    def __init__(self, provider: LLMProvider):
        self.provider = provider

    async def generate(
        self,
        capabilities: list[dict[str, Any]],
        user_intent: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Identify gaps and generate products that fill them."""
        # Find which capabilities are present and which are missing
        present_caps = set()
        cap_repos: dict[str, list[dict]] = {}
        for cap in capabilities:
            cap_type = cap.get("capability", "general")
            present_caps.add(cap_type)
            if cap_type not in cap_repos:
                cap_repos[cap_type] = []
            cap_repos[cap_type].append(cap)

        missing_caps = [c for c in EXPECTED_CAPABILITIES if c not in present_caps]

        if not missing_caps:
            # No gaps — look for quality gaps (weak capabilities)
            return await self._generate_quality_improvements(cap_repos, user_intent)

        # Generate products that bridge present capabilities with missing ones
        products = []
        for missing in missing_caps[:3]:
            try:
                product = await self._generate_gap_filler(
                    missing, present_caps, cap_repos, user_intent
                )
                if product:
                    products.append(product)
            except Exception as e:
                print(f"[GapAnalysis] gap filler error for {missing}: {e}")

        # Also generate a "complete ecosystem" product if multiple gaps
        if len(missing_caps) >= 2:
            try:
                ecosystem = await self._generate_ecosystem_product(
                    missing_caps, cap_repos, user_intent
                )
                if ecosystem:
                    products.append(ecosystem)
            except Exception as e:
                print(f"[GapAnalysis] ecosystem product error: {e}")

        return products

    async def _generate_gap_filler(
        self,
        missing: str,
        present: set[str],
        cap_repos: dict[str, list[dict]],
        user_intent: Optional[str],
    ) -> Optional[dict[str, Any]]:
        """Generate a product that fills a specific capability gap."""
        bridge_caps = list(present)[:2]
        bridge_repos = []
        for cap in bridge_caps:
            bridge_repos.extend(cap_repos.get(cap, [])[:1])

        intent_ctx = f"\nUser Intent: {user_intent}" if user_intent else ""

        messages = [
            {
                "role": "system",
                "content": """You are a gap analysis product strategist. You identify missing capabilities
in a tech ecosystem and design products that fill those gaps by connecting existing capabilities.

Return ONLY valid JSON:
{
  "name": "<product name>",
  "description": "<2-3 sentence description>",
  "system_flow": "<step-by-step flow>",
  "capabilities": ["<existing_caps_used>", "<missing_cap_filled>"],
  "target_users": ["<user1>", "<user2>"],
  "key_features": ["<feature1>", "<feature2>", "<feature3>"],
  "gap_filled": "<the capability gap this fills>"
}""",
            },
            {
                "role": "user",
                "content": f"""Missing capability: {missing}
Present capabilities: {', '.join(present)}
Available repos for bridging: {[{'name': r.get('name', ''), 'cap': r.get('capability', '')} for r in bridge_repos]}{intent_ctx}

Design a product that fills the {missing} gap by leveraging existing {', '.join(bridge_caps)} capabilities.""",
            },
        ]

        raw = await self.provider.chat(messages, temperature=0.7, max_tokens=600)
        data = self.provider.parse_json(raw)

        if not data.get("name"):
            return None

        return {
            "name": data.get("name", f"{missing.title()} Bridge"),
            "description": data.get("description", ""),
            "system_flow": data.get("system_flow", ""),
            "capabilities": data.get("capabilities", list(present) + [missing]),
            "target_users": data.get("target_users", []),
            "key_features": data.get("key_features", []),
            "repos_used": [r.get("name", "") for r in bridge_repos],
            "gap_filled": data.get("gap_filled", missing),
        }

    async def _generate_ecosystem_product(
        self,
        missing_caps: list[str],
        cap_repos: dict[str, list[dict]],
        user_intent: Optional[str],
    ) -> Optional[dict[str, Any]]:
        """Generate a comprehensive product that fills multiple gaps."""
        all_repos = []
        for repos in cap_repos.values():
            all_repos.extend(repos[:1])

        messages = [
            {
                "role": "system",
                "content": """You are a product strategist designing a comprehensive platform.
This platform fills multiple capability gaps in the current ecosystem.

Return ONLY valid JSON:
{
  "name": "<platform name>",
  "description": "<2-3 sentence description>",
  "system_flow": "<step-by-step architecture flow>",
  "capabilities": ["<all capabilities covered>"],
  "target_users": ["<user1>", "<user2>"],
  "key_features": ["<feature1>", "<feature2>", "<feature3>", "<feature4>"],
  "gaps_filled": ["<gap1>", "<gap2>"]
}""",
            },
            {
                "role": "user",
                "content": f"""Design a comprehensive platform that fills these gaps: {', '.join(missing_caps)}
Current capabilities available: {', '.join(cap_repos.keys())}
{f'User intent: {user_intent}' if user_intent else ''}""",
            },
        ]

        raw = await self.provider.chat(messages, temperature=0.7, max_tokens=600)
        data = self.provider.parse_json(raw)

        if not data.get("name"):
            return None

        return {
            "name": data.get("name", "Unified AI Platform"),
            "description": data.get("description", ""),
            "system_flow": data.get("system_flow", ""),
            "capabilities": data.get("capabilities", list(cap_repos.keys()) + missing_caps),
            "target_users": data.get("target_users", []),
            "key_features": data.get("key_features", []),
            "repos_used": [r.get("name", "") for r in all_repos],
            "gaps_filled": data.get("gaps_filled", missing_caps),
        }

    async def _generate_quality_improvements(
        self,
        cap_repos: dict[str, list[dict]],
        user_intent: Optional[str],
    ) -> list[dict[str, Any]]:
        """When all capabilities are present, suggest quality improvements."""
        return [{
            "name": "Enhanced AI Product Suite",
            "description": "An upgraded platform that improves upon existing capabilities with better integration and performance",
            "system_flow": "Unified API → Smart Router → Capability Services → Result Aggregator → Feedback Loop",
            "capabilities": list(cap_repos.keys()),
            "target_users": ["Enterprise teams", "AI developers"],
            "key_features": ["Unified API layer", "Performance optimization", "Better integration patterns", "Advanced monitoring"],
            "repos_used": [r.get("name", "") for repos in cap_repos.values() for r in repos[:1]],
        }]
