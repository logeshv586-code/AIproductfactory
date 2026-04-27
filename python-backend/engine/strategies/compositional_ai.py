"""
Compositional AI Strategy — Generates products by composing AI capabilities
into higher-order systems (AI orchestrating AI).
"""

from typing import Any, Optional
from llm.provider import LLMProvider


# Composition patterns for AI systems
COMPOSITION_PATTERNS = {
    "agent_over_agent": "Multi-agent system where agents delegate to other agents",
    "rag_plus_generation": "Retrieval-augmented generation with custom knowledge bases",
    "memory_plus_reasoning": "Long-term memory combined with reasoning and planning",
    "observe_decide_act": "Observe environment → Decide → Act loop with AI at each stage",
    "human_in_loop": "AI system with human-in-the-loop feedback and correction",
    "pipeline_composition": "Sequential AI pipeline where each stage feeds the next",
}


class CompositionalAIStrategy:
    """Generate products by composing AI capabilities into higher-order systems."""

    def __init__(self, provider: LLMProvider):
        self.provider = provider

    async def generate(
        self,
        capabilities: list[dict[str, Any]],
        user_intent: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Generate AI-composed products from available capabilities."""
        # Identify AI-related capabilities
        ai_caps = [c for c in capabilities if c.get("capability") in ("agent", "memory", "rag", "automation")]
        other_caps = [c for c in capabilities if c.get("capability") not in ("agent", "memory", "rag", "automation")]

        if not ai_caps:
            # No AI capabilities — create a simple automation product
            return [{
                "name": "AI-Enhanced Automation Platform",
                "description": "Platform that adds AI capabilities to existing tools and workflows",
                "system_flow": "Input → Rule Engine → AI Enhancement → Output → Learning Loop",
                "capabilities": [c.get("capability", "general") for c in capabilities[:3]],
                "target_users": ["Developers", "DevOps teams"],
                "key_features": ["AI enhancement layer", "Automated workflows", "Learning from feedback"],
                "repos_used": [c.get("name", "") for c in capabilities[:3]],
                "composition_pattern": "pipeline_composition",
            }]

        # Find the best composition pattern
        best_pattern = self._select_pattern(ai_caps, other_caps)

        products = []
        # Generate the main compositional product
        try:
            product = await self._generate_compositional_product(
                best_pattern, ai_caps, other_caps, user_intent
            )
            if product:
                products.append(product)
        except Exception as e:
            print(f"[CompositionalAI] composition error: {e}")

        # Generate a second product with a different pattern
        alt_patterns = [p for p in COMPOSITION_PATTERNS if p != best_pattern]
        if alt_patterns:
            try:
                alt_product = await self._generate_compositional_product(
                    alt_patterns[0], ai_caps, other_caps, user_intent
                )
                if alt_product:
                    products.append(alt_product)
            except Exception as e:
                print(f"[CompositionalAI] alt composition error: {e}")

        return products

    def _select_pattern(
        self,
        ai_caps: list[dict[str, Any]],
        other_caps: list[dict[str, Any]],
    ) -> str:
        """Select the best composition pattern based on available capabilities."""
        cap_types = set(c.get("capability", "") for c in ai_caps + other_caps)

        if "agent" in cap_types and "memory" in cap_types:
            return "memory_plus_reasoning"
        elif "agent" in cap_types and len([c for c in ai_caps if c.get("capability") == "agent"]) > 1:
            return "agent_over_agent"
        elif "rag" in cap_types and "agent" in cap_types:
            return "rag_plus_generation"
        elif "automation" in cap_types:
            return "observe_decide_act"
        else:
            return "pipeline_composition"

    async def _generate_compositional_product(
        self,
        pattern: str,
        ai_caps: list[dict[str, Any]],
        other_caps: list[dict[str, Any]],
        user_intent: Optional[str],
    ) -> Optional[dict[str, Any]]:
        """Generate a product based on a composition pattern."""
        pattern_desc = COMPOSITION_PATTERNS.get(pattern, "")
        all_caps = ai_caps + other_caps
        cap_info = [{"name": c.get("name", ""), "capability": c.get("capability", "")} for c in all_caps[:5]]

        intent_ctx = f"\nUser Intent: {user_intent}" if user_intent else ""

        messages = [
            {
                "role": "system",
                "content": """You are an AI system architect who creates products by composing AI capabilities
into higher-order systems. You design products where AI orchestrates AI.

Return ONLY valid JSON:
{
  "name": "<product name>",
  "description": "<2-3 sentence description>",
  "system_flow": "<step-by-step AI composition flow>",
  "capabilities": ["<cap1>", "<cap2>"],
  "target_users": ["<user1>", "<user2>"],
  "key_features": ["<feature1>", "<feature2>", "<feature3>"],
  "composition_pattern": "<the pattern used>"
}""",
            },
            {
                "role": "user",
                "content": f"""COMPOSITION PATTERN: {pattern} — {pattern_desc}

Available AI capabilities:
{[c for c in cap_info if c['capability'] in ('agent', 'memory', 'rag', 'automation')]}

Available supporting capabilities:
{[c for c in cap_info if c['capability'] not in ('agent', 'memory', 'rag', 'automation')]}{intent_ctx}

Design a product using the {pattern} composition pattern.""",
            },
        ]

        raw = await self.provider.chat(messages, temperature=0.75, max_tokens=600)
        data = self.provider.parse_json(raw)

        if not data.get("name"):
            return None

        return {
            "name": data.get("name", f"{pattern.replace('_', ' ').title()} System"),
            "description": data.get("description", ""),
            "system_flow": data.get("system_flow", ""),
            "capabilities": data.get("capabilities", [c.get("capability", "") for c in all_caps]),
            "target_users": data.get("target_users", []),
            "key_features": data.get("key_features", []),
            "repos_used": [c.get("name", "") for c in all_caps[:3]],
            "composition_pattern": data.get("composition_pattern", pattern),
        }
