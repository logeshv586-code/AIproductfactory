"""
Cross-Pollination Strategy — Combines capabilities from different repos
to create novel product ideas at the intersection of domains.
"""

from typing import Any, Optional
from llm.provider import LLMProvider


class CrossPollinationStrategy:
    """Generate products by combining capabilities from disparate repos."""

    def __init__(self, provider: LLMProvider):
        self.provider = provider

    async def generate(
        self,
        capabilities: list[dict[str, Any]],
        user_intent: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Generate products by cross-pollinating different capability types."""
        # Group repos by capability type
        cap_groups: dict[str, list[dict]] = {}
        for cap in capabilities:
            cap_type = cap.get("capability", "general")
            if cap_type not in cap_groups:
                cap_groups[cap_type] = []
            cap_groups[cap_type].append(cap)

        # Need at least 2 different capability types for cross-pollination
        cap_types = list(cap_groups.keys())
        if len(cap_types) < 2:
            # If only one type, still generate a product based on it
            return await self._generate_single_type(cap_groups, cap_types, user_intent)

        # Find interesting combinations
        combos = self._find_combinations(cap_types, cap_groups)

        # Generate products from top combinations
        products = []
        for combo in combos[:3]:  # Top 3 combinations
            try:
                product = await self._generate_from_combo(combo, cap_groups, user_intent)
                if product:
                    products.append(product)
            except Exception as e:
                print(f"[CrossPollination] combo error: {e}")

        return products

    def _find_combinations(
        self,
        cap_types: list[str],
        cap_groups: dict[str, list[dict]],
    ) -> list[tuple[str, str]]:
        """Find interesting capability type pairs for cross-pollination."""
        priority_pairs = [
            ("agent", "memory"), ("agent", "rag"), ("agent", "ui"),
            ("memory", "rag"), ("memory", "backend"), ("rag", "ui"),
            ("ui", "backend"), ("automation", "agent"), ("automation", "backend"),
        ]

        combos = []
        for a, b in priority_pairs:
            if a in cap_groups and b in cap_groups:
                combos.append((a, b))

        # Add remaining pairs
        for i, a in enumerate(cap_types):
            for b in cap_types[i+1:]:
                if (a, b) not in combos and (b, a) not in combos:
                    combos.append((a, b))

        return combos

    async def _generate_from_combo(
        self,
        combo: tuple[str, str],
        cap_groups: dict[str, list[dict]],
        user_intent: Optional[str],
    ) -> Optional[dict[str, Any]]:
        """Generate a product from a capability combination using LLM."""
        type_a, type_b = combo
        repos_a = cap_groups[type_a][:2]
        repos_b = cap_groups[type_b][:2]

        prompt_repos = []
        for r in repos_a + repos_b:
            prompt_repos.append({
                "name": r.get("name", ""),
                "capability": r.get("capability", ""),
                "description": r.get("description", ""),
            })

        intent_ctx = f"\nUser Intent: {user_intent}" if user_intent else ""

        messages = [
            {
                "role": "system",
                "content": """You are a creative product strategist. Combine two different capability types
to create an innovative product idea that leverages both.

Return ONLY valid JSON:
{
  "name": "<product name>",
  "description": "<2-3 sentence product description>",
  "system_flow": "<step-by-step system flow>",
  "capabilities": ["<cap1>", "<cap2>"],
  "target_users": ["<user1>", "<user2>"],
  "key_features": ["<feature1>", "<feature2>", "<feature3>"],
  "repos_used": ["<repo_name1>", "<repo_name2>"]
}""",
            },
            {
                "role": "user",
                "content": f"""Combine these capability types: {type_a} + {type_b}

Available repos:
{prompt_repos}{intent_ctx}

Create an innovative product that combines {type_a} capabilities with {type_b} capabilities.""",
            },
        ]

        raw = await self.provider.chat(messages, temperature=0.8, max_tokens=600)
        data = self.provider.parse_json(raw)

        if not data.get("name"):
            return None

        return {
            "name": data.get("name", f"{type_a.title()}-{type_b.title()} Fusion"),
            "description": data.get("description", ""),
            "system_flow": data.get("system_flow", ""),
            "capabilities": data.get("capabilities", [type_a, type_b]),
            "target_users": data.get("target_users", []),
            "key_features": data.get("key_features", []),
            "repos_used": data.get("repos_used", []),
        }

    async def _generate_single_type(
        self,
        cap_groups: dict[str, list[dict]],
        cap_types: list[str],
        user_intent: Optional[str],
    ) -> list[dict[str, Any]]:
        """Generate products when only one capability type is available."""
        cap_type = cap_types[0] if cap_types else "general"
        repos = cap_groups.get(cap_type, [])[:3]

        return [{
            "name": f"{cap_type.title()} Platform",
            "description": f"An advanced {cap_type} platform leveraging {', '.join(r.get('name', '') for r in repos[:2])}",
            "system_flow": f"Input → {cap_type} Processing → Output → Feedback Loop",
            "capabilities": [cap_type],
            "target_users": ["Developers", "Technical teams"],
            "key_features": [f"Advanced {cap_type} processing", "API-first design", "Real-time capabilities"],
            "repos_used": [r.get("name", "") for r in repos],
        }]
