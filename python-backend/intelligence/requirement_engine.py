"""
Requirement Intelligence — structured, prioritized, traceable requirements.

Given the analyzed intent, extract 8-12 requirements (functional + non-functional)
each with a unique id, user story, testable acceptance criteria, priority,
dependencies and risks. Falls back to deriving requirements from the intent's
user goals when the LLM is unavailable.
"""

from __future__ import annotations

from typing import Any

from intelligence.prompt_utils import ask_json, as_list, as_str
from llm.provider import LLMProvider

_SYSTEM_PROMPT = """You are a requirements engineer inside an AI product factory.
Given the product intent, extract structured, prioritized, TRACEABLE requirements.

Return ONLY valid JSON — an array of exactly 8-12 objects, each with EXACTLY these keys:
{
  "id": "REQ-001",
  "type": "functional" | "non-functional",
  "title": "short title",
  "description": "detailed description",
  "user_story": "As a <user> I want <goal> so that <value>",
  "acceptance_criteria": ["testable criterion 1", "testable criterion 2"],
  "priority": "must" | "should" | "could",
  "dependencies": ["REQ-002"],
  "assumptions": ["assumption"],
  "risks": ["risk"]
}
Mix functional and non-functional requirements (security, performance, scalability,
UX, compliance). IDs must be sequential REQ-001, REQ-002, ... Acceptance criteria must
be testable. Do not add or remove keys."""

# Deterministic non-functional requirements always present in the fallback.
_NFR_FALLBACKS: list[dict[str, Any]] = [
    {
        "id": "REQ-NF1",
        "type": "non-functional",
        "title": "Performance",
        "description": "The system responds within acceptable latency for interactive operations.",
        "user_story": "As a user I want fast responses so that the product feels responsive",
        "acceptance_criteria": ["P95 latency under 500ms for core operations", "Handles 100 concurrent users"],
        "priority": "should",
        "dependencies": [],
        "assumptions": ["Moderate load at launch"],
        "risks": ["Inefficient queries degrade latency"],
    },
    {
        "id": "REQ-NF2",
        "type": "non-functional",
        "title": "Security",
        "description": "Authentication and data protection are enforced by default.",
        "user_story": "As a user I want my data protected so that I can trust the product",
        "acceptance_criteria": ["Authentication enforced on all private endpoints", "Sensitive fields encrypted at rest"],
        "priority": "must",
        "dependencies": [],
        "assumptions": ["Standard auth model"],
        "risks": ["Exposed credentials"],
    },
    {
        "id": "REQ-NF3",
        "type": "non-functional",
        "title": "Availability",
        "description": "The service remains available during normal operation windows.",
        "user_story": "As a user I want the service available so that I can rely on it",
        "acceptance_criteria": ["99.5% uptime", "Graceful degradation on dependency failure"],
        "priority": "should",
        "dependencies": [],
        "assumptions": ["Single region at launch"],
        "risks": ["Dependency outages"],
    },
    {
        "id": "REQ-NF4",
        "type": "non-functional",
        "title": "User Experience",
        "description": "The interface is intuitive and accessible.",
        "user_story": "As a user I want an intuitive interface so that I complete tasks without training",
        "acceptance_criteria": ["Core flows usable with zero training", "Keyboard navigable"],
        "priority": "should",
        "dependencies": [],
        "assumptions": ["Web-first interface"],
        "risks": ["Scope creep on UI features"],
    },
    {
        "id": "REQ-NF5",
        "type": "non-functional",
        "title": "Observability",
        "description": "System health and errors are observable.",
        "user_story": "As an operator I want logs and metrics so that I can diagnose issues",
        "acceptance_criteria": ["Structured logs on key operations", "Health endpoint exposed"],
        "priority": "could",
        "dependencies": [],
        "assumptions": ["Basic monitoring tooling"],
        "risks": ["Silent failures"],
    },
]


def _fallback(intent: dict[str, Any]) -> list[dict[str, Any]]:
    requirements: list[dict[str, Any]] = []
    goals = as_list(intent.get("user_goals")) or as_list(intent.get("desired_outcomes")) or ["Solve the core problem"]
    targets = as_list(intent.get("target_users")) or ["users"]
    target = targets[0] if targets else "users"

    for i, goal in enumerate(goals, start=1):
        req_id = f"REQ-{i:03d}"
        requirements.append(
            {
                "id": req_id,
                "type": "functional",
                "title": as_str(goal) or f"Functional requirement {i}",
                "description": f"Deliver the capability that {as_str(goal).lower()}.",
                "user_story": f"As a {target} I want {as_str(goal).lower()} so that the core problem is solved",
                "acceptance_criteria": [f"The system provides {as_str(goal).lower()}", "Result is verifiable by the user"],
                "priority": "must",
                "dependencies": [] if i == 1 else [f"REQ-{i-1:03d}"],
                "assumptions": ["Core capability is feasible with available tooling"],
                "risks": [f"Underestimating complexity of {as_str(goal)}"],
            }
        )

    # Append non-functional requirements with offset ids.
    offset = len(requirements) + 1
    for j, nfr in enumerate(_NFR_FALLBACKS, start=offset):
        nfr = dict(nfr)
        nfr["id"] = f"REQ-{j:03d}"
        requirements.append(nfr)
    return requirements


def _normalize_llm(value: Any) -> list[dict[str, Any]] | None:
    """Validate/normalize LLM output into clean requirement dicts."""
    if not isinstance(value, list) or not value:
        return None
    out: list[dict[str, Any]] = []
    for i, item in enumerate(value, start=1):
        if not isinstance(item, dict):
            continue
        out.append(
            {
                "id": as_str(item.get("id")) or f"REQ-{i:03d}",
                "type": as_str(item.get("type")) if as_str(item.get("type")) in ("functional", "non-functional") else "functional",
                "title": as_str(item.get("title")) or f"Requirement {i}",
                "description": as_str(item.get("description")) or "",
                "user_story": as_str(item.get("user_story")) or "",
                "acceptance_criteria": as_list(item.get("acceptance_criteria")),
                "priority": as_str(item.get("priority")) if as_str(item.get("priority")) in ("must", "should", "could") else "must",
                "dependencies": as_list(item.get("dependencies")),
                "assumptions": as_list(item.get("assumptions")),
                "risks": as_list(item.get("risks")),
            }
        )
    return out if out else None


async def extract_requirements(intent: dict[str, Any], provider: LLMProvider) -> list[dict[str, Any]]:
    """
    Extract structured, prioritized requirements from the analyzed intent.

    Returns a list of 8-12 requirement dicts. Never raises; falls back to
    deriving requirements from the intent's user goals.
    """
    data = await ask_json(
        provider,
        _SYSTEM_PROMPT,
        f"Product intent:\n{intent}",
        fallback=None,
        temperature=0.4,
        max_tokens=1600,
    )
    normalized = _normalize_llm(data)
    if normalized is not None and len(normalized) >= 4:
        return normalized
    return _fallback(intent)
