"""
Feasibility Engine — Evaluating architectural production-readiness.
"""

from typing import Any, Optional
from llm.provider import LLMProvider, get_provider

async def evaluate_feasibility(
    architecture: dict[str, Any],
    provider: Optional[LLMProvider] = None,
) -> dict[str, Any]:
    """
    Score the feasibility of a given architecture.
    """
    if provider is None:
        provider = get_provider()

    messages = [
        {
            "role": "system",
            "content": """You are an AI Site Reliability Engineer and Security Architect. 
Evaluate the provided architecture for real-world feasibility.

Consider:
- Cost: Estimated monthly cloud bill
- Infrastructure: Hardware requirements (e.g. GPUs, memory)
- Security: Potential vulnerabilities (CVEs, logic flaws)
- Complexity: Integration risks

Return ONLY valid JSON:
{
  "feasibility_score": 0-100,
  "estimated_monthly_cost": "...",
  "hardware_requirements": ["Requirement 1", "Requirement 2"],
  "security_risks": [
    {"risk": "...", "severity": "low|medium|high", "mitigation": "..."}
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}""",
        },
        {
            "role": "user",
            "content": f"ARCHITECTURE:\n{architecture}",
        },
    ]

    raw = await provider.chat(messages, temperature=0.2, max_tokens=1000)
    data = provider.parse_json(raw)
    
    return data
