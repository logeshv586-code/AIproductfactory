"""
Product Generator — Generates product ideas by composing capabilities from repos.
Supports multiple strategies: crossPollination, gapAnalysis, trendBased, compositionalAI.
"""

from typing import Any, Optional
from engine.strategies.cross_pollination import CrossPollinationStrategy
from engine.strategies.gap_analysis import GapAnalysisStrategy
from engine.strategies.trend_based import TrendBasedStrategy
from engine.strategies.compositional_ai import CompositionalAIStrategy
from llm.provider import LLMProvider, get_provider


# Strategy registry
STRATEGIES = {
    "crossPollination": CrossPollinationStrategy,
    "gapAnalysis": GapAnalysisStrategy,
    "trendBased": TrendBasedStrategy,
    "compositionalAI": CompositionalAIStrategy,
}


async def generate_products(
    capabilities: list[dict[str, Any]],
    strategy: str = "crossPollination",
    user_intent: Optional[str] = None,
    provider: Optional[LLMProvider] = None,
) -> list[dict[str, Any]]:
    """
    Generate product ideas from mapped capabilities using the specified strategy.

    Args:
        capabilities: List of capability-mapped repos
        strategy: Strategy name (crossPollination, gapAnalysis, trendBased, compositionalAI)
        user_intent: Optional user input to guide generation
        provider: LLM provider instance (optional)

    Returns:
        List of generated product ideas
    """
    if provider is None:
        provider = get_provider()

    strategy_cls = STRATEGIES.get(strategy, CrossPollinationStrategy)
    strategy_instance = strategy_cls(provider)

    products = await strategy_instance.generate(capabilities, user_intent)

    print(f"[ProductGenerator] Generated {len(products)} products using {strategy} strategy")
    return products


async def generate_all_strategies(
    capabilities: list[dict[str, Any]],
    user_intent: Optional[str] = None,
    provider: Optional[LLMProvider] = None,
) -> list[dict[str, Any]]:
    """Generate products using ALL strategies and combine results."""
    if provider is None:
        provider = get_provider()

    all_products = []
    seen_names = set()

    for strategy_name, strategy_cls in STRATEGIES.items():
        try:
            strategy_instance = strategy_cls(provider)
            products = await strategy_instance.generate(capabilities, user_intent)
            for product in products:
                if product["name"] not in seen_names:
                    product["strategy"] = strategy_name
                    all_products.append(product)
                    seen_names.add(product["name"])
        except Exception as e:
            print(f"[ProductGenerator] {strategy_name} error: {e}")

    print(f"[ProductGenerator] Total {len(all_products)} unique products from all strategies")
    return all_products
