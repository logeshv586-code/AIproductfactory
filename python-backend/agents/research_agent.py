"""
Research Agent — Gathers deep intelligence from research papers and repositories.
"""

from typing import Any, Optional
from llm.provider import LLMProvider, get_provider

async def conduct_research(
    idea: str,
    domain: str,
    provider: Optional[LLMProvider] = None,
) -> dict[str, Any]:
    """
    Search for architectural patterns and research insights related to the idea.
    """
    if provider is None:
        provider = get_provider()

    # In a real-world scenario, this would call arXiv / PapersWithCode APIs.
    # For this version, we use the LLM's internal knowledge to simulate research extraction.
    
    messages = [
        {
            "role": "system",
            "content": """You are an AI Research Engineer. Given a product idea and domain, identify 
state-of-the-art architectural patterns, relevant research papers (simulated or real), 
and common pitfalls in this space.

Return ONLY valid JSON:
{
  "key_findings": ["Finding 1", "Finding 2"],
  "recommended_patterns": [
    {"name": "Pattern Name", "description": "...", "benefit": "..."}
  ],
  "relevant_papers": [
    {"title": "Paper Title", "summary": "...", "link": "https://arxiv.org/..."}
  ],
  "risks": ["Risk 1", "Risk 2"]
}""",
        },
        {
            "role": "user",
            "content": f"IDEA: {idea}\nDOMAIN: {domain}",
        },
    ]

    raw = await provider.chat(messages, temperature=0.2, max_tokens=1000)
    data = provider.parse_json(raw)
    
    return data
