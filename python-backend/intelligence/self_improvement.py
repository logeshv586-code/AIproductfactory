"""
Self-Improvement Agent — Iterative architectural refinement.
"""

from typing import Any, Optional
from llm.provider import LLMProvider, get_provider

async def suggest_improvements(
    product: dict[str, Any],
    feasibility: dict[str, Any],
    provider: Optional[LLMProvider] = None,
) -> dict[str, Any]:
    """
    Analyze product and feasibility report to suggest refinements.
    """
    if provider is None:
        provider = get_provider()

    messages = [
        {
            "role": "system",
            "content": """You are an AI Architecture Refinement Agent. Your goal is to improve 
the quality and feasibility of an AI product.

Analyze the product details and its feasibility report. Identify 3 critical 
improvements to the architecture that would increase its feasibility score 
or reduce its cost/risk.

Return ONLY valid JSON:
{
  "suggested_changes": [
    {
      "component": "Component Name",
      "change": "Describe the change",
      "impact": "Cost reduction | Security boost | Performance gain",
      "rationale": "..."
    }
  ],
  "improved_architecture_diff": {
    "additions": [...],
    "modifications": [...]
  }
}""",
        },
        {
            "role": "user",
            "content": f"PRODUCT:\n{product}\n\nFEASIBILITY REPORT:\n{feasibility}",
        },
    ]

    raw = await provider.chat(messages, temperature=0.3, max_tokens=1200)
    data = provider.parse_json(raw)
    
    return data
