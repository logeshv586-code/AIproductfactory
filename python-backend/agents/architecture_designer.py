"""
Architecture Designer — Designs system architecture from product composition.
Creates components, data flows, tech stack recommendations, and deployment plans.
"""

from typing import Any, Optional
from llm.provider import LLMProvider, get_provider


async def design_architecture(
    product: dict[str, Any],
    repo_profiles: list[dict[str, Any]],
    provider: Optional[LLMProvider] = None,
) -> dict[str, Any]:
    """
    Design a complete system architecture for a product.

    Returns a dict with:
      - components: list of system components with name, role, tech, interface
      - data_flows: list of data flow descriptions
      - tech_stack: recommended technologies
      - deployment: deployment strategy
      - diagram_description: text description of the architecture
    """
    if provider is None:
        provider = get_provider()

    repos_summary = []
    for r in repo_profiles[:5]:
        repos_summary.append({
            "name": r.get("full_name", r.get("name", "")),
            "capability": r.get("capability", "general"),
            "language": r.get("language", "unknown"),
            "stars": r.get("stars", 0),
        })

    messages = [
        {
            "role": "system",
            "content": """You are a senior software architect inside an AI product factory.
Given a product composition and available repos, design the complete system architecture.

Return ONLY valid JSON:
{
  "components": [
    {"name": "<name>", "role": "<role>", "tech": "<technology>", "interface": "<api/cli/lib>"}
  ],
  "data_flows": [
    {"from": "<component>", "to": "<component>", "data": "<what flows>"}
  ],
  "tech_stack": ["<tech1>", "<tech2>"],
  "deployment": "<docker-compose | k8s | serverless | ...>",
  "diagram_description": "<text description of the architecture>"
}

Design a production-ready, scalable architecture with proper separation of concerns.""",
        },
        {
            "role": "user",
            "content": f"""PRODUCT:
Name: {product.get('name', '')}
Description: {product.get('description', '')}
System Flow: {product.get('system_flow', '')}
Capabilities: {', '.join(product.get('capabilities', []))}

AVAILABLE REPOS:
{repos_summary}""",
        },
    ]

    raw = await provider.chat(messages, temperature=0.6, max_tokens=1000)
    data = provider.parse_json(raw)

    architecture = {
        "components": data.get("components", [
            {"name": "Core Engine", "role": "Main processing pipeline", "tech": "Python", "interface": "api"},
            {"name": "API Gateway", "role": "Request routing and auth", "tech": "FastAPI", "interface": "rest"},
            {"name": "Data Layer", "role": "Persistence and caching", "tech": "PostgreSQL", "interface": "lib"},
            {"name": "AI Service", "role": "LLM orchestration", "tech": "Python", "interface": "api"},
        ]),
        "data_flows": data.get("data_flows", [
            {"from": "API Gateway", "to": "Core Engine", "data": "Requests"},
            {"from": "Core Engine", "to": "AI Service", "data": "Prompts"},
            {"from": "Core Engine", "to": "Data Layer", "data": "State"},
        ]),
        "tech_stack": data.get("tech_stack", ["Python", "FastAPI", "PostgreSQL", "Docker"]),
        "deployment": data.get("deployment", "docker-compose"),
        "diagram_description": data.get("diagram_description", ""),
    }

    print(f"[ArchitectureDesigner] {len(architecture['components'])} components designed")
    return architecture
