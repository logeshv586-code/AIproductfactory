
"""
Planner Agent — Decomposes product vision into structured engineering tasks.
"""

import json
from typing import Any, Optional

from llm.provider import LLMProvider, get_provider


async def generate_plan(
    idea: str,
    architecture: dict[str, Any],
    repos: list[dict[str, Any]],
    provider: Optional[LLMProvider] = None,
) -> dict[str, Any]:
    """
    Generate a structured, step-by-step implementation plan.
    """

    # Validate inputs
    if not isinstance(idea, str) or not idea.strip():
        raise ValueError("Product idea must be a non-empty string.")

    if not isinstance(architecture, dict):
        raise TypeError("Architecture must be a dictionary.")

    if not isinstance(repos, list):
        raise TypeError("Repositories must be a list.")

    if provider is None:
        provider = get_provider()

    # Prepare repository information
    reference_repos = [
        {
            "name": repo.get("full_name"),
            "role": repo.get("suggested_role"),
        }
        for repo in repos
        if isinstance(repo, dict)
    ]

    messages = [
        {
            "role": "system",
            "content": """
You are an AI CTO and Product Architect.

Your task is to convert a product idea, system architecture,
and reference repositories into a detailed engineering plan.

Requirements:
1. Divide the implementation into sequential phases.
2. Each phase must contain specific, actionable tasks.
3. Tasks must follow a logical implementation order.
4. Avoid duplicate or unnecessary tasks.
5. Use reference repositories only when relevant.
6. Each task must include:
   - title: Short task name.
   - description: Detailed implementation instructions.
   - reference_repo: Repository name or null.
   - complexity: low, medium, or high.

Return ONLY valid JSON using this exact structure:

{
    "phases": [
        {
            "name": "Phase Name",
            "tasks": [
                {
                    "title": "Task Title",
                    "description": "Task Description",
                    "reference_repo": null,
                    "complexity": "medium"
                }
            ]
        }
    ]
}

Do not include Markdown, code fences, or additional explanations.
""",
        },
        {
            "role": "user",
            "content": f"""
PRODUCT IDEA:
{idea}

ARCHITECTURE:
{json.dumps(architecture, indent=2, default=str)}

REFERENCE REPOSITORIES:
{json.dumps(reference_repos, indent=2, default=str)}
""",
        },
    ]

    # Generate implementation plan
    raw = await provider.chat(
        messages,
        temperature=0.3,
        max_tokens=3000,
    )

    if not raw:
        raise ValueError("LLM provider returned an empty response.")

    # Parse JSON response
    try:
        data = provider.parse_json(raw)
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise ValueError(
            f"Failed to parse implementation plan JSON: {exc}"
        ) from exc

    # Validate response structure
    if not isinstance(data, dict):
        raise ValueError("Generated plan must be a JSON object.")

    phases = data.get("phases")

    if not isinstance(phases, list) or not phases:
        raise ValueError("Generated plan must contain at least one phase.")

    for phase_index, phase in enumerate(phases):
        if not isinstance(phase, dict):
            raise ValueError(
                f"Phase {phase_index + 1} must be an object."
            )

        if not isinstance(phase.get("name"), str) or not phase["name"].strip():
            raise ValueError(
                f"Phase {phase_index + 1} must have a valid name."
            )

        tasks = phase.get("tasks")

        if not isinstance(tasks, list) or not tasks:
            raise ValueError(
                f"Phase '{phase['name']}' must contain at least one task."
            )

        for task_index, task in enumerate(tasks):
            if not isinstance(task, dict):
                raise ValueError(
                    f"Task {task_index + 1} in phase '{phase['name']}' must be an object."
                )

            for field in ("title", "description"):
                if not isinstance(task.get(field), str) or not task[field].strip():
                    raise ValueError(
                        f"Task {task_index + 1} in phase '{phase['name']}' "
                        f"must have a valid {field}."
                    )

            if task.get("complexity") not in ("low", "medium", "high"):
                raise ValueError(
                    f"Invalid complexity in task '{task['title']}'."
                )

            if task.get("reference_repo") is not None and not isinstance(
                task["reference_repo"], str
            ):
                raise ValueError(
                    f"Invalid reference_repo in task '{task['title']}'."
                )

    return data

