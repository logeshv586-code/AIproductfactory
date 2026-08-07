"""
Self-Critique Engine — the last check before a product is presented.

Before returning results the AI asks itself the questions a tough reviewer
would: did I misunderstand the user? did I miss an existing competitor? is
there a better architecture? is another repository stronger? did I overlook an
integration risk? can I simplify the solution? Only after passing these checks
is the product presented; concerns are recorded as traceable evidence.
"""

from __future__ import annotations

from typing import Any

from intelligence.prompt_utils import ask_json, as_dict, as_list, as_str
from llm.provider import LLMProvider

_CRITIQUE_SYSTEM = """You are a ruthless self-critique engine inside an AI product factory.
Before the product is presented to the user, question the entire reasoning.

Answer EVERY checklist question with a concrete finding (or state it passed).
Return ONLY valid JSON with EXACTLY these keys:
{
  "passed": true,
  "score": 0,
  "concerns": [
    {"question": "did I misunderstand the user?", "finding": "...", "severity": "critical | warning | info", "action": "what would fix it"}
  ],
  "improvements": ["concrete improvement"],
  "reasoning": "short overall verdict"
}
score is 0-100 (higher = more self-confident the product is sound). Include a
concern entry for every question that is NOT fully satisfied — silence is not
allowed on a real gap. Do not add or remove keys."""

# Local deterministic checklist mirrors the same questions when the LLM is off.
_LOCAL_CHECKS = [
    ("did I misunderstand the user?", lambda g: len(as_list(g.get("requirements"))) == 0, "No requirements extracted — the plan has no functional grounding."),
    ("did I miss an existing competitor?", lambda g: len(as_list(g.get("competitors"))) < 2, "Fewer than 2 competitors analyzed — competitive gaps may be unseen."),
    ("is there a better architecture?", lambda g: not as_dict(g.get("architecture")), "No architecture designed — the plan cannot be evaluated for soundness."),
    ("is another repository stronger?", lambda g: len(as_list(g.get("repository_intelligence", {}).get("reports"))) == 0, "No repository intelligence — repo choices are unranked."),
    ("did I overlook an integration risk?", lambda g: any(not as_str(m.get("selected")) for m in as_list(g.get("capability_mappings"))), "At least one capability has no selected repository — an integration gap."),
    ("can I simplify the solution?", lambda g: len(as_list(g.get("capabilities", {}).get("capabilities"))) > 12, "Capability set is large — check for scope creep and simplification."),
]


def _local_critique(graph: dict[str, Any]) -> dict[str, Any]:
    concerns: list[dict[str, Any]] = []
    for question, check, finding in _LOCAL_CHECKS:
        if check(graph):
            concerns.append({
                "question": question,
                "finding": finding,
                "severity": "warning",
                "action": "Address in a refinement pass before presenting.",
            })
    score = max(0, 100 - 20 * len(concerns))
    return {
        "passed": len([c for c in concerns if c["severity"] == "critical"]) == 0,
        "score": score,
        "concerns": concerns,
        "improvements": [c["action"] for c in concerns],
        "reasoning": "deterministic self-review (LLM unavailable)",
    }


def _normalize(data: Any, graph: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(data, dict) or not data:
        return _local_critique(graph)
    concerns = []
    for c in as_list(data.get("concerns")):
        cd = as_dict(c)
        severity = as_str(cd.get("severity"))
        concerns.append({
            "question": as_str(cd.get("question")),
            "finding": as_str(cd.get("finding")),
            "severity": severity if severity in ("critical", "warning", "info") else "warning",
            "action": as_str(cd.get("action")),
        })
    if not concerns:
        concerns = [c for c in as_list(_local_critique(graph).get("concerns"))]
    return {
        "passed": bool(data.get("passed", True)),
        "score": int(data.get("score", 80)),
        "concerns": concerns,
        "improvements": as_list(data.get("improvements")),
        "reasoning": as_str(data.get("reasoning")),
    }


async def self_critique(graph: dict[str, Any], provider: LLMProvider) -> dict[str, Any]:
    """
    Critique the whole product reasoning before presentation.

    Returns ``{passed, score, concerns, improvements, reasoning}``. Never
    raises; falls back to a deterministic checklist.
    """
    local = _local_critique(graph)
    # Compact digest — the full graph can be 100KB+ and make the model think
    # for >60s; the critique only needs the decision-relevant facts.
    summary = {
        "domain": as_str(graph.get("domain")),
        "idea": as_str(graph.get("idea"))[:200],
        "requirements": [as_str(r.get("title")) or as_str(r.get("id")) for r in as_list(graph.get("requirements")) if isinstance(r, dict)][:12],
        "competitors": [as_str(c.get("name")) for c in as_list(graph.get("competitors")) if isinstance(c, dict)][:8],
        "capabilities": [as_str(c.get("name")) for c in as_list(as_dict(graph.get("capabilities")).get("capabilities"))][:12],
        "strategies": [as_str(s.get("id")) for s in as_list(graph.get("strategies"))],
        "repositories_ranked": len(as_dict(graph.get("repository_intelligence")).get("reports", [])),
        "review_score": as_dict(graph.get("review")).get("score"),
        "product_thinking_confidence": as_dict(graph.get("product_thinking")).get("confidence"),
    }
    data = await ask_json(
        provider,
        _CRITIQUE_SYSTEM,
        f"PRODUCT KNOWLEDGE GRAPH SUMMARY:\n{summary}",
        fallback=None,
        temperature=0.4,
        max_tokens=1200,
    )
    result = _normalize(data, graph)
    # deterministic concerns always merged so nothing silent slips through
    seen = {c["question"] for c in result["concerns"]}
    for c in local["concerns"]:
        if c["question"] not in seen:
            result["concerns"].append(c)
    if any(c["severity"] == "critical" for c in result["concerns"]):
        result["passed"] = False
    return result
