"""
Decision Engine — collaborative reasoning for the Product Intelligence OS.

Instead of every agent returning one answer, agents debate: each states a
position, later agents challenge it, and the Decision Engine synthesizes a
winner with its rationale, evidence and confidence. Every architectural and
repository decision therefore carries reasoning — it is never a single
unquestioned answer.

Also provides the validate → improve → validate feedback-loop primitive so
every major stage can revise its earlier output when confidence is low.
"""

from __future__ import annotations

from typing import Any, Awaitable, Callable

from intelligence.prompt_utils import ask_json, as_dict, as_list, as_str
from llm.provider import LLMProvider

_DEBATE_SYSTEM = """You are the Decision Engine inside an AI product factory.
Multiple specialist agents are debating a product decision. Read every position
and adjudicate: pick the strongest stance, and record each agent's challenge.

Return ONLY valid JSON with EXACTLY these keys:
{
  "winner_agent": "the agent whose stance won",
  "winner_stance": "the winning stance, concretely",
  "winner_argument": "why it wins",
  "rationale": "short synthesis of the debate",
  "confidence": 0.0,
  "rebuttals": [
    {"agent": "agent name", "challenge": "what they challenged", "response": "how it was answered or why it stands"}
  ],
  "adjustments": [
    {"item": "the item being decided", "action": "keep | change | drop", "to": "new value if changed", "reason": "why"}
  ],
  "reasoning": "one sentence on the final call"
}
confidence is 0..1. Be concrete — reference the evidence agents provided.
Do not add or remove keys."""


def _score_position(pos: dict[str, Any]) -> float:
    """Deterministic strength of a position: confidence × evidence weight."""
    raw_conf = pos.get("confidence")
    try:
        conf = float(raw_conf) if raw_conf is not None else 0.5
        conf = max(0.0, min(1.0, conf))
    except (TypeError, ValueError):
        conf = 0.5
    evidence = as_list(pos.get("evidence"))
    metrics = as_dict(pos.get("metrics"))
    metric_bonus = 0.0
    if metrics:
        # e.g. requirements_coverage, explainable_score, integration_complexity(1-low)
        for v in metrics.values():
            if isinstance(v, (int, float)):
                metric_bonus += min(1.0, max(0.0, v))
        metric_bonus = min(0.3, metric_bonus * 0.05)
    return conf + metric_bonus + min(0.2, 0.05 * len(evidence))


def _fallback_debate(topic: str, positions: list[dict[str, Any]]) -> dict[str, Any]:
    """Pick the strongest position deterministically when the LLM is unavailable."""
    ranked = sorted(positions, key=_score_position, reverse=True)
    winner = ranked[0] if ranked else {"agent": "decision", "stance": topic, "argument": "", "confidence": 0.5}
    rebuttals = [
        {
            "agent": as_str(p.get("agent")),
            "challenge": f"Challenged {as_str(winner.get('agent'))}'s stance",
            "response": f"{as_str(p.get('stance'))[:80]}",
        }
        for p in ranked[1:]
    ]
    confidence = round(float(winner.get("confidence", 0.6)) * (1.0 - 0.05 * len(rebuttals)), 3)
    return {
        "topic": topic,
        "winner_agent": as_str(winner.get("agent")),
        "winner_stance": as_str(winner.get("stance")),
        "winner_argument": as_str(winner.get("argument")),
        "rationale": f"Highest evidence-weighted confidence among {len(positions)} positions.",
        "confidence": confidence,
        "rebuttals": rebuttals,
        "adjustments": [],
        "reasoning": "deterministic adjudication (LLM unavailable)",
        "positions": [{k: p.get(k) for k in ("agent", "stance", "confidence")} for p in positions],
    }


async def debate(
    topic: str,
    positions: list[dict[str, Any]],
    provider: LLMProvider,
    max_tokens: int = 1200,
) -> dict[str, Any]:
    """
    Run an agent debate and return the Decision Engine's adjudication.

    ``positions`` is a list of ``{"agent", "stance", "argument", "evidence",
    "confidence", "metrics"}`` dicts. Returns ``{topic, winner_agent,
    winner_stance, winner_argument, rationale, confidence, rebuttals,
    adjustments, reasoning, positions}``. Never raises; falls back to a
    deterministic strength adjudication.
    """
    positions_text = "\n\n".join(
        f"AGENT: {as_str(p.get('agent'))}\n"
        f"STANCE: {as_str(p.get('stance'))}\n"
        f"ARGUMENT: {as_str(p.get('argument'))}\n"
        f"EVIDENCE: {as_list(p.get('evidence'))}\n"
        f"CONFIDENCE: {p.get('confidence')}"
        for p in positions
    )
    data = await ask_json(
        provider,
        _DEBATE_SYSTEM,
        f"DECISION TOPIC: {topic}\n\nPOSITIONS:\n{positions_text}",
        fallback=None,
        temperature=0.4,
        max_tokens=max_tokens,
    )
    if not isinstance(data, dict) or not data.get("winner_stance"):
        return _fallback_debate(topic, positions)

    return {
        "topic": topic,
        "winner_agent": as_str(data.get("winner_agent")) or "decision",
        "winner_stance": as_str(data.get("winner_stance")),
        "winner_argument": as_str(data.get("winner_argument")),
        "rationale": as_str(data.get("rationale")),
        "confidence": min(1.0, max(0.0, float(data.get("confidence", 0.6)))),
        "rebuttals": as_list(data.get("rebuttals")),
        "adjustments": as_list(data.get("adjustments")),
        "reasoning": as_str(data.get("reasoning")),
        "positions": [{k: p.get(k) for k in ("agent", "stance", "confidence")} for p in positions],
    }


async def validate_and_improve(
    value: Any,
    validator: Callable[[Any], list[dict[str, Any]]],
    improve_fn: Callable[[Any, list[dict[str, Any]]], Awaitable[Any]],
    max_iterations: int = 1,
) -> tuple[Any, list[dict[str, Any]]]:
    """
    Run a validate → improve → validate feedback loop.

    ``validator(value)`` returns a list of findings (empty = pass). If findings
    are non-empty, ``improve_fn(value, findings)`` produces a revised value,
    which is re-validated. Iterates at most ``max_iterations`` times. Returns
    ``(final_value, final_findings)``.
    """
    findings = validator(value)
    iterations = 0
    while findings and iterations < max_iterations:
        value = await improve_fn(value, findings)
        findings = validator(value)
        iterations += 1
    return value, findings
