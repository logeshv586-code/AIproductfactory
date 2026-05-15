"""
Planner Agent — Decomposes product vision into structured engineering tasks.
"""

from typing import Any, Optional
from llm.provider import LLMProvider, get_provider

async def generate_plan(
    idea: str,
    architecture: dict[str, Any],
    repos: list[dict[str, Any]],
    provider: Optional[LLMProvider] = None,
) -> dict[str, Any]:
    """
    Generate a step-by-step implementation plan.
    """
    if provider is None:
        provider = get_provider()

    messages = [
        {
            "role": "system",
            "content": """You are an AI CTO and Product Architect. Your task is to take a product idea, 
a system architecture, and a set of reference repositories, and generate a detailed implementation plan.

The plan should be broken down into sequential phases, with each phase containing specific tasks.
Each task should have:
- title: Brief name of the task
- description: Detailed instructions
- reference_repo: Which repo to use as a baseline (if any)
- estimated_complexity: low, medium, high

Return ONLY valid JSON:
{
  "phases": [
    {
      "name": "Phase Name",
      "tasks": [
        {"title": "...", "description": "...", "reference_repo": "...", "complexity": "..."}
      ]
    }
  ]
}""",
        },
        {
            "role": "user",
            "content": f"""PRODUCT IDEA:
{idea}

ARCHITECTURE:
{architecture}

REFERENCE REPOS:
{[{ 'name': r.get('full_name'), 'role': r.get('suggested_role') } for r in repos]}""",
        },
    ]

    raw = await provider.chat(messages, temperature=0.3, max_tokens=1500)
    data = provider.parse_json(raw)
    
    return data
