"""
Confidence Propagation — every node in the Product Knowledge Graph carries a
confidence, and confidence flows from roots to leaves.

Intent (0.98) → Capability (0.95) → Repository (0.81) → Architecture (0.78).
A child can never be more certain than the weakest thing it depends on. Nodes
below the low-confidence threshold are flagged so the orchestrator can trigger
additional reasoning or research on them.
"""

from __future__ import annotations

from typing import Any

from intelligence.prompt_utils import as_dict, as_list, as_str

# Per-stage confidence weights; overall = weighted combination (sums to 1.0).
_WEIGHTS: dict[str, float] = {
    "intent": 0.08,
    "product_thinking": 0.08,
    "requirements": 0.10,
    "market": 0.08,
    "competitors": 0.08,
    "innovation": 0.08,
    "evolution": 0.06,
    "capabilities": 0.12,
    "repositories": 0.12,
    "strategies": 0.12,
    "review": 0.08,
}

# Capability/repository confidence cannot exceed the intent confidence they
# descend from (a chain can only lose certainty).
_DECAY = 0.97


def _avg(values: list[float], default: float) -> float:
    if not values:
        return default
    return sum(values) / len(values)


def propagate_confidences(graph: dict[str, Any]) -> dict[str, Any]:
    """
    Compute a confidence for every stage and store it on the graph.

    Returns the ``confidences`` dict: ``{stage: confidence, overall: x,
    low_confidence: [stage names below threshold]}``. Deterministic.
    """
    intent = as_dict(graph.get("intent"))
    thinking = as_dict(graph.get("product_thinking"))
    market = as_dict(graph.get("market"))
    capabilities = as_dict(graph.get("capabilities"))
    repo_intel = as_dict(graph.get("repository_intelligence"))
    strategies = as_list(graph.get("strategies"))
    review = as_dict(graph.get("review"))
    competitors = as_list(graph.get("competitors"))

    intent_conf = min(1.0, max(0.0, float(intent.get("confidence") or 0.8)))
    thinking_conf = min(1.0, max(0.0, float(thinking.get("confidence") or 0.7)))
    req_conf = min(1.0, max(0.0, _avg(
        [float(r.get("confidence", 0.7)) for r in as_list(graph.get("requirements")) if isinstance(r, dict)],
        0.7,
    )))
    market_conf = 0.7 if as_list(market.get("existing_products")) else 0.45
    competitor_conf = _avg([float(c.get("confidence", 0.6)) for c in competitors], 0.3 if not competitors else 0.6)
    innovation_conf = min(1.0, max(0.0, float(as_dict(graph.get("innovation")).get("confidence") or 0.6)))
    evolution_conf = min(1.0, max(0.0, float(as_dict(graph.get("evolution")).get("confidence") or 0.6)))
    capability_conf = min(1.0, max(0.0, _avg(
        [float(c.get("confidence", 0.7)) for c in as_list(capabilities.get("capabilities"))],
        0.6,
    )))
    repo_reports = as_list(repo_intel.get("reports"))
    repo_conf = _avg(
        [float(r.get("explainable_score", 0.5)) for r in repo_reports],
        0.4 if not repo_reports else 0.6,
    )
    strategy_conf = _avg([float(s.get("confidence", 0.7)) for s in strategies], 0.5)
    review_conf = min(1.0, max(0.0, float(review.get("overall_confidence") or 0.6)))

    # decay along the reasoning chain: descendants capped by weakest ancestor
    cap = capability_conf * min(1.0, intent_conf * _DECAY)
    repo = repo_conf * min(1.0, cap * _DECAY)
    strat = strategy_conf * min(1.0, repo * _DECAY)

    overall = sum(
        _WEIGHTS.get(stage, 0.1) * conf
        for stage, conf in {
            "intent": intent_conf,
            "product_thinking": thinking_conf,
            "requirements": req_conf,
            "market": market_conf,
            "competitors": competitor_conf,
            "innovation": innovation_conf,
            "evolution": evolution_conf,
            "capabilities": cap,
            "repositories": repo,
            "strategies": strat,
            "review": review_conf,
        }.items()
    )

    confidences = {
        "intent": round(intent_conf, 3),
        "product_thinking": round(thinking_conf, 3),
        "requirements": round(req_conf, 3),
        "market": round(market_conf, 3),
        "competitors": round(competitor_conf, 3),
        "innovation": round(innovation_conf, 3),
        "evolution": round(evolution_conf, 3),
        "capabilities": round(cap, 3),
        "repositories": round(repo, 3),
        "strategies": round(strat, 3),
        "review": round(review_conf, 3),
        "overall": round(overall, 3),
    }
    low = [k for k, v in confidences.items() if v < 0.6 and k != "overall"]
    confidences["low_confidence"] = low
    return confidences


def needs_refinement(confidences: dict[str, Any], threshold: float = 0.6) -> list[str]:
    """Stages below the threshold — candidates for additional reasoning."""
    return as_list(confidences.get("low_confidence"))
