"""
v6 Phase 4 — Strategy Tournament Framework.

Instead of presenting three strategies and letting the user pick from an
undifferentiated list, this engine makes the candidates *compete*: every
strategy is scored across eight weighted dimensions (feasibility, repository
confidence, historical success, innovation, technical risk, maintainability,
cost/complexity, confidence), a Challenger strategy is synthesized to question
the prevailing assumptions, and the Decision Engine adjudicates every
head-to-head pair. The result is a ranked list, a winner, why it won, and why
each alternative lost — all persisted for future learning.

Design decisions:

- **The pairwise winner is the Decision Engine's.** Each pair is debated via
  ``decision_engine.debate`` (LLM when a real provider is configured, with the
  same deterministic ``_fallback_debate`` strength adjudication otherwise) —
  exactly like every other decision in this codebase. The aggregate score is
  the deterministic tie-break and the ranking's secondary key.
- **The Challenger is synthesized post-normalize.** ``generate_strategies``
  must keep its exactly-3 STRAT-A/B/C contract, so the 4th candidate (id
  ``STRAT-D``) is built here from the weakest primary: proven repositories from
  the Experience Engine, a simpler architecture, trimmed features and a higher
  innovation bet. It exists purely to escape local optima.
- **Cold-start safe.** With no stored experience (``learning_evidence`` empty)
  and no Product Memory (no matches), Repository Confidence and Historical
  Success default to neutral (0.5) and the tournament still produces a
  deterministic ranking. It never raises.
- **``graph[\"strategies\"]`` is never mutated.** The tournament emits its own
  per-strategy scores and ranking inside the returned dict.
"""

from __future__ import annotations

import asyncio
import re
from typing import Any

from intelligence.decision_engine import debate
from intelligence.prompt_utils import as_dict, as_list, as_str
from llm.provider import LLMProvider

# The eight dimensions a strategy is judged on. ``weight`` sums to 1.0 so the
# aggregate score is a true weighted average of the 0..100 dimension values.
DIMENSIONS: list[dict[str, Any]] = [
    {"id": "feasibility", "label": "Feasibility", "weight": 0.18, "source": "Strategy Engine"},
    {"id": "repository_confidence", "label": "Repository Confidence", "weight": 0.15, "source": "Experience Engine"},
    {"id": "historical_success", "label": "Historical Success", "weight": 0.12, "source": "Product Memory"},
    {"id": "innovation", "label": "Innovation", "weight": 0.13, "source": "Strategy Engine"},
    {"id": "technical_risk", "label": "Technical Risk", "weight": 0.15, "source": "Architecture Simulation"},
    {"id": "maintainability", "label": "Maintainability", "weight": 0.08, "source": "Architecture Agent"},
    {"id": "cost_complexity", "label": "Cost / Complexity", "weight": 0.09, "source": "Capability Graph"},
    {"id": "confidence", "label": "Confidence", "weight": 0.10, "source": "Decision Engine"},
]
_WEIGHTS = {d["id"]: float(d["weight"]) for d in DIMENSIONS}

# Heuristic anchors used where the strategy dict has no numeric field.
_RISK_TO_SCORE = {"low": 90.0, "medium": 70.0, "high": 45.0}
_COMPLEXITY_TO_MAINTAINABILITY = {"low": 85.0, "medium": 70.0, "high": 55.0}
_COMPLEXITY_TO_COST_PENALTY = {"low": 0.0, "medium": -8.0, "high": -15.0}
_MAX_REPOSITORIES = 12.0  # normalization denominators (12 capabilities ≈ max)


# ── Small helpers ───────────────────────────────────────────────────────────

def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, value))


def _clamp01(value: float) -> float:
    return _clamp(value, 0.0, 1.0)


def _cost_to_score(strategy: dict[str, Any]) -> float:
    """Invert the estimated cost (USD) into a 0..100 score, adjusted by complexity.

    Higher cost and complexity score lower (a cheaper, simpler strategy is
    easier to ship). The midpoint of a stated range is used, normalized on a
    $100k scale. Parses 'k'/'m' suffixes and removes commas/currency symbols.
    """
    cost_text = as_str(strategy.get("estimated_cost"))
    # Remove currency symbols, commas, whitespace
    cleaned = re.sub(r"[^\dkKmM\.]", "", cost_text)
    # Expand k/K/m/M suffixes to full numbers, adding a space separator so
    # adjacent values (e.g. "$25k - $50k" → "25k50k") don't concatenate.
    def expand(match):
        val = float(match.group(1))
        suffix = match.group(2).lower() if match.group(2) else ""
        if suffix == "k":
            return f"{val * 1000:.0f} "
        elif suffix == "m":
            return f"{val * 1000000:.0f} "
        return f"{val:.0f} "
    # Match numbers with optional k/m suffix
    cleaned = re.sub(r"(\d+(?:\.\d+)?)([kKmM])", expand, cleaned)
    # Extract all numbers (now space-separated)
    nums = [float(n) for n in re.findall(r"\d+(?:\.\d+)?", cleaned)]
    cost = sum(nums) / len(nums) if nums else 5000.0  # 5k default when unspecified
    score = 100.0 - 100.0 * (cost / 100000.0)
    score += _COMPLEXITY_TO_COST_PENALTY.get(as_str(strategy.get("complexity")), 0.0)
    return _clamp(score)


# ── Per-strategy scoring ────────────────────────────────────────────────────

def score_strategy(
    strategy: dict[str, Any],
    capability_mappings: list[dict[str, Any]],
    learning_evidence: dict[str, Any] | None,
    retrieval: dict[str, Any] | None,
    review: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Score one strategy across the eight weighted dimensions.

    Every dimension returns ``{value (0..100), confidence (0..1), evidence
    (list[str]), source}``. Deterministic, no LLM. Cold-start safe: dimensions
    without historical data fall back to a neutral 0.5.
    """
    learning_evidence = as_dict(learning_evidence)
    retrieval = as_dict(retrieval)
    dims: list[dict[str, Any]] = []

    # 1. Feasibility — Strategy Engine
    feas = _clamp01(float(strategy.get("feasibility", 0.7)))
    dims.append({
        "id": "feasibility", "label": "Feasibility", "source": "Strategy Engine",
        "value": round(feas * 100, 1), "confidence": 0.8,
        "evidence": [f"feasibility {feas:.2f}"],
    })

    # 2. Repository Confidence — Experience Engine (per repo in the map)
    repo_stats = as_dict(learning_evidence.get("repositories"))
    repo_rankings = as_dict(learning_evidence.get("capability_rankings"))
    repo_values: list[float] = []
    repo_evidence: list[str] = []
    repo_confidence = 0.5
    for cap, repo in as_dict(strategy.get("repository_map")).items():
        entry = as_dict(repo_stats.get(repo))
        if entry:
            rate = float(entry.get("success_rate", 0.5))
            repo_values.append(rate)
            repo_evidence.append(
                f"{repo}: {int(entry.get('used_in', 0))} prior uses · {round(rate * 100)}% success"
            )
            repo_confidence = _clamp01(repo_confidence + 0.1)
        elif cap in repo_rankings and as_str(as_dict(repo_rankings[cap]).get("best_repo")) == repo:
            r = as_dict(repo_rankings[cap])
            rate = float(r.get("success_rate", 0.5))
            repo_values.append(rate)
            repo_evidence.append(
                f"{repo}: proven for {cap} ({int(r.get('successes', 0))}s/{int(r.get('failures', 0))}f)"
            )
            repo_confidence = _clamp01(repo_confidence + 0.1)
        else:
            repo_values.append(0.5)  # neutral — no history for this repo
    if not repo_evidence:
        repo_evidence.append("no repository history — neutral")
    repo_value = sum(repo_values) / len(repo_values) if repo_values else 0.5
    dims.append({
        "id": "repository_confidence", "label": "Repository Confidence",
        "source": "Experience Engine", "value": round(repo_value * 100, 1),
        "confidence": round(repo_confidence, 3), "evidence": repo_evidence[:6],
    })

    # 3. Historical Success — Product Memory (most similar past product)
    hist_value, hist_confidence = 0.5, 0.4
    hist_evidence: list[str] = []
    matches = as_list(retrieval.get("matches"))
    if matches:
        top = as_dict(matches[0])
        outcome = as_dict(top.get("historical_outcome"))
        sim = float(top.get("similarity", 0))
        final = outcome.get("final_score")
        crit_passed = bool(outcome.get("self_critique_passed"))
        base = sim if final is None else 0.5 * sim + 0.5 * float(final)
        if crit_passed:
            base = _clamp01(base + 0.05)
        # Directly matching the past winner's strategy is strong precedent.
        past_id = as_str(outcome.get("approved_strategy"))
        if past_id and past_id == as_str(strategy.get("id")):
            base = _clamp01(base + 0.1)
        hist_value = base
        hist_confidence = 0.7
        hist_evidence.append(f"most similar past product: similarity {sim:.2f}")
        if past_id:
            hist_evidence.append(f"past winner: {past_id} ({outcome.get('strategy_name')})")
        if final is not None:
            hist_evidence.append(f"historical final score {float(final):.2f}")
        if outcome.get("self_critique_score") is not None:
            hist_evidence.append(f"self-critique {'passed' if crit_passed else 'failed'}")
    else:
        hist_evidence.append("no similar past products — neutral")
    dims.append({
        "id": "historical_success", "label": "Historical Success",
        "source": "Product Memory", "value": round(hist_value * 100, 1),
        "confidence": hist_confidence, "evidence": hist_evidence[:6],
    })

    # 4. Innovation — Strategy Engine
    inno = _clamp01(float(strategy.get("innovation_score", 0.5)))
    dims.append({
        "id": "innovation", "label": "Innovation", "source": "Strategy Engine",
        "value": round(inno * 100, 1), "confidence": 0.7,
        "evidence": [f"innovation_score {inno:.2f}"],
    })

    # 5. Technical Risk — inverse risk_level + risks, minus review hotspots
    tech_value = _RISK_TO_SCORE.get(as_str(strategy.get("risk_level")), 70.0)
    tech_value -= 4.0 * len(as_list(strategy.get("risks")))
    tech_evidence = [
        f"risk_level {strategy.get('risk_level')}",
        f"{len(as_list(strategy.get('risks')))} risks listed",
    ]
    if review:
        hotspots = as_list(as_dict(review).get("risk_hotspots"))
        if hotspots:
            tech_value -= 8.0 * len(hotspots)
            tech_evidence.append(f"{len(hotspots)} review risk hotspots")
    dims.append({
        "id": "technical_risk", "label": "Technical Risk", "source": "Architecture Simulation",
        "value": round(_clamp(tech_value), 1), "confidence": 0.6,
        "evidence": tech_evidence[:6],
    })

    # 6. Maintainability — derived heuristic (complexity, feature surface, arch length)
    maint = _COMPLEXITY_TO_MAINTAINABILITY.get(as_str(strategy.get("complexity")), 70.0)
    maint -= 2.0 * len(as_list(strategy.get("features")))
    if len(as_str(strategy.get("architecture"))) > 200:
        maint -= 3.0
    dims.append({
        "id": "maintainability", "label": "Maintainability", "source": "Architecture Agent",
        "value": round(_clamp(maint), 1), "confidence": 0.55,
        "evidence": [
            f"complexity {strategy.get('complexity')}",
            f"{len(as_list(strategy.get('features')))} features",
        ],
    })

    # 7. Cost / Complexity — Capability Graph (inverted cost + complexity)
    dims.append({
        "id": "cost_complexity", "label": "Cost / Complexity", "source": "Capability Graph",
        "value": round(_cost_to_score(strategy), 1), "confidence": 0.6,
        "evidence": [
            f"estimated_cost {strategy.get('estimated_cost')}",
            f"complexity {strategy.get('complexity')}",
        ],
    })

    # 8. Confidence — Decision Engine
    conf = _clamp01(float(strategy.get("confidence", 0.7)))
    dims.append({
        "id": "confidence", "label": "Confidence", "source": "Decision Engine",
        "value": round(conf * 100, 1), "confidence": conf,
        "evidence": [f"strategy confidence {conf:.2f}"],
    })

    aggregate = sum(d["value"] * _WEIGHTS[d["id"]] for d in dims)
    aggregate_conf = sum(d["confidence"] * _WEIGHTS[d["id"]] for d in dims)
    return {
        "dimensions": dims,
        "aggregate": round(aggregate, 1),
        "confidence": round(aggregate_conf, 3),
    }


# ── Challenger synthesis ────────────────────────────────────────────────────

def synthesize_challenger(
    strategies: list[dict[str, Any]],
    capability_mappings: list[dict[str, Any]],
    learning_evidence: dict[str, Any] | None,
    retrieval: dict[str, Any] | None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    Build a 4th, contrarian strategy (id ``STRAT-D``) from the weakest primary.

    It challenges the prevailing assumptions by:
      - swapping every repository for a historically *proven* one (Experience
        Engine capability rankings), where one exists;
      - simplifying the architecture style when the base is enterprise-grade;
      - trimming features to the core;
      - raising the innovation bet.

    Returns ``(challenger_dict, rationale_dict)``. Deterministic, no LLM. The
    output honors the frozen strategy shape (``repository_map`` keyed by
    capability name, ``capabilities`` as a capability-id list).
    """
    learning_evidence = as_dict(learning_evidence)
    primaries = [s for s in strategies if as_str(s.get("id")) != "STRAT-D"]
    base = min(primaries or strategies, key=lambda s: (float(s.get("confidence", 0.7)), as_str(s.get("id"))))
    base = dict(base)

    # Proven repos from experience: capability_rankings best_repo where the
    # track record is net-positive.
    rankings = as_dict(learning_evidence.get("capability_rankings"))
    new_repo_map: dict[str, str] = {}
    swapped: list[list[str]] = []
    for cap, repo in as_dict(base.get("repository_map")).items():
        entry = as_dict(rankings.get(cap))
        proven = as_str(entry.get("best_repo"))
        if proven and proven != as_str(repo) and int(entry.get("successes", 0)) > int(entry.get("failures", 0)):
            new_repo_map[cap] = proven
            swapped.append([as_str(repo), proven])
        else:
            new_repo_map[cap] = as_str(repo)

    # Simplify the architecture when the base is enterprise-scale.
    arch_text = as_str(base.get("architecture")).lower()
    if any(k in arch_text for k in ("microservice", "event", "distributed", "worker", "stream", "enterprise")):
        challenger_arch = "Lean API + datastore with a thin job queue — no event streaming or microservice mesh."
        arch_simplified = True
    else:
        challenger_arch = as_str(base.get("architecture"))
        arch_simplified = False

    features = as_list(base.get("features"))[:4]
    innovation = _clamp01(float(base.get("innovation_score", 0.5)) + 0.15)

    # When architecture is simplified, override complexity and estimated_cost
    # so the leaner build is reflected in maintainability and cost dimensions.
    if arch_simplified:
        challenger_complexity = "low" if as_str(base.get("complexity")) == "high" else "medium"
        challenger_cost = "$3k - $8k"
    else:
        challenger_complexity = as_str(base.get("complexity")) or "medium"
        challenger_cost = as_str(base.get("estimated_cost")) or "$25k"

    challenger: dict[str, Any] = {
        **base,
        "id": "STRAT-D",
        "name": "Challenger",
        "tagline": "Questions the status quo with proven repos and a leaner build.",
        "description": (
            f"A challenger derived from {base.get('id')} {base.get('name')}: it replaces unproven "
            "repositories with historically successful ones, simplifies the architecture, trims scope, "
            "and raises the innovation bet. Built to escape local optima."
        ),
        "features": features,
        "architecture": challenger_arch,
        "complexity": challenger_complexity,
        "estimated_cost": challenger_cost,
        "innovation_score": round(innovation, 2),
        "risk_level": "low" if as_str(base.get("complexity")) == "high" else as_str(base.get("risk_level")) or "medium",
        "risks": ["Contrarian pick", "Reduced feature breadth"],
        "repository_map": new_repo_map,
        "differentiation": "Challenges the weakest assumptions of the primary strategies.",
        "why": "Mixes historical repo evidence, a simpler architecture and higher innovation to avoid local optima.",
        "confidence": round(_clamp01(float(base.get("confidence", 0.7)) + 0.05), 3),
        "challenger": True,
    }
    rationale = {
        "based_on": as_str(base.get("id")),
        "swapped_repositories": swapped,
        "architecture_simplified": arch_simplified,
        "features_trimmed": len(as_list(base.get("features"))) - len(features),
        "innovation_delta": round(innovation - _clamp01(float(base.get("innovation_score", 0.5))), 2),
        "assumption": "unproven repositories, heavy architecture and low innovation",
    }
    return challenger, rationale


# ── Pairwise comparisons ────────────────────────────────────────────────────

def _build_position(strategy: dict[str, Any], score: dict[str, Any]) -> dict[str, Any]:
    """Turn a candidate + its score into a Decision Engine position."""
    return {
        "agent": as_str(strategy.get("id")),
        "stance": (
            f"{as_str(strategy.get('id'))} {as_str(strategy.get('name'))} should win — "
            f"aggregate {score['aggregate']:.0f}/100."
        ),
        "argument": as_str(strategy.get("description"))[:200],
        "evidence": [
            f"{d['label']} {d['value']:.0f}/100 ({round(d.get('confidence', 0.5) * 100)}% conf)"
            for d in score["dimensions"]
        ],
        "confidence": round(score["confidence"], 3),
        "metrics": {d["id"]: round(d["value"] / 100.0, 3) for d in score["dimensions"]},
    }


def _head_to_head_rationale(
    a: dict[str, Any], b: dict[str, Any],
    sa: dict[str, Any], sb: dict[str, Any],
) -> str:
    a_leads: list[str] = []
    b_leads: list[str] = []
    for da in sa["dimensions"]:
        db = next((x for x in sb["dimensions"] if x["id"] == da["id"]), None)
        if not db:
            continue
        if da["value"] > db["value"] + 0.5:
            a_leads.append(f"{da['label']} +{round(da['value'] - db['value'])}")
        elif db["value"] > da["value"] + 0.5:
            b_leads.append(f"{db['label']} +{round(db['value'] - da['value'])}")
    return (
        f"{as_str(a.get('id'))} leads on {', '.join(a_leads) or 'nothing'} · "
        f"{as_str(b.get('id'))} leads on {', '.join(b_leads) or 'nothing'}."
    )


def _pairwise_compare(
    a: dict[str, Any], b: dict[str, Any],
    scores: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Deterministic head-to-head: higher aggregate wins; confidence then id break ties."""
    sa, sb = scores[a["id"]], scores[b["id"]]
    if sa["aggregate"] > sb["aggregate"]:
        winner, loser = a, b
    elif sb["aggregate"] > sa["aggregate"]:
        winner, loser = b, a
    elif sa["confidence"] > sb["confidence"]:
        winner, loser = a, b
    elif sb["confidence"] > sa["confidence"]:
        winner, loser = b, a
    else:
        winner, loser = (a, b) if as_str(a.get("id")) < as_str(b.get("id")) else (b, a)
    rationale = _head_to_head_rationale(a, b, sa, sb)
    return {
        "a": as_str(a.get("id")), "b": as_str(b.get("id")),
        "score_a": sa["aggregate"], "score_b": sb["aggregate"],
        "winner_id": as_str(winner.get("id")), "loser_id": as_str(loser.get("id")),
        "winner_name": as_str(winner.get("name")), "loser_name": as_str(loser.get("name")),
        "margin": round(abs(sa["aggregate"] - sb["aggregate"]), 1),
        "confidence": round(max(sa["confidence"], sb["confidence"]), 3),
        "rationale": rationale,
        "judge_comment": rationale,
        "rebuttals": [],
        "source": "deterministic scoring",
    }


async def _pairwise_debate(
    a: dict[str, Any], b: dict[str, Any],
    scores: dict[str, dict[str, Any]],
    provider: LLMProvider,
) -> dict[str, Any]:
    """
    Head-to-head adjudicated by the Decision Engine (LLM), falling back to the
    deterministic comparison. The aggregate score is the authoritative tie-break
    and ranking key, so the fallback winner is always the higher-aggregate
    candidate; when the LLM disagrees, its rationale is kept but the confidence
    is gated to only override when the LLM is genuinely decisive (confidence
    >= 0.65). This prevents a low-confidence LLM from flipping wins away from
    the aggregate ranking.
    """
    base = _pairwise_compare(a, b, scores)
    try:
        result = await debate(
            f"Which strategy wins head-to-head: {as_str(a.get('id'))} {as_str(a.get('name'))} "
            f"vs {as_str(b.get('id'))} {as_str(b.get('name'))}?",
            [_build_position(a, scores[a["id"]]), _build_position(b, scores[b["id"]])],
            provider,
            max_tokens=700,
        )
    except Exception:
        result = None

    llm_winner = as_str(result.get("winner_agent")) if result else ""
    llm_matches_a = llm_winner == as_str(a.get("id"))
    llm_matches_b = llm_winner == as_str(b.get("id"))

    # Default: deterministic winner is authoritative (aggregate-based).
    winner, loser = (a, b) if base["winner_id"] == as_str(a.get("id")) else (b, a)
    score_winner, score_loser = (base["score_a"], base["score_b"]) if winner is a else (base["score_b"], base["score_a"])
    conf = base["confidence"]
    judge_comment = base["rationale"]

    if llm_matches_a or llm_matches_b:
        # The LLM agreed with one candidate; check whether it was decisive.
        llm_conf = None
        if result:
            try:
                llm_conf = float(result.get("confidence"))
            except (TypeError, ValueError):
                pass
        # Only override the winner + confidence when the LLM is confident enough
        # to challenge the aggregate score. This keeps wins consistent with the
        # ranking's aggregate-based primary sort key.
        if llm_conf is not None and llm_conf >= 0.65:
            winner, loser = (a, b) if llm_matches_a else (b, a)
            score_winner, score_loser = (base["score_a"], base["score_b"]) if winner is a else (base["score_b"], base["score_a"])
            conf = _clamp01(llm_conf)
        judge_comment = (
            as_str(result.get("rationale"))
            or as_str(result.get("winner_argument"))
            or base["rationale"]
        )

    return {
        "a": as_str(a.get("id")), "b": as_str(b.get("id")),
        "score_a": base["score_a"], "score_b": base["score_b"],
        "winner_id": as_str(winner.get("id")), "loser_id": as_str(loser.get("id")),
        "winner_name": as_str(winner.get("name")), "loser_name": as_str(loser.get("name")),
        "margin": round(abs(score_winner - score_loser), 1),
        "confidence": conf,
        "rationale": base["rationale"],
        "judge_comment": judge_comment,
        "rebuttals": as_list(result.get("rebuttals")) if result else [],
        "llm_rationale": as_str(result.get("reasoning")) if result else "",
        "source": "decision engine",
    }


# ── Decision report ─────────────────────────────────────────────────────────

def build_decision_report(
    ranked: list[dict[str, Any]],
    scores: dict[str, dict[str, Any]],
    wins: dict[str, int] | None = None,
) -> dict[str, Any]:
    """
    Explain the tournament outcome: why the winner won and why each loser lost,
    in terms a user (and a future run) can read.
    """
    wins = wins or {}
    if not ranked:
        return {"winner_reason": "", "reasons": {}, "rejected": {}}
    winner_entry = ranked[0]
    winner_score = scores.get(winner_entry["id"], {})

    reasons: list[str] = []
    # Dimensions where the winner beats every other candidate.
    for d in winner_score["dimensions"]:
        others_max = max(
            (
                next((x for x in scores[e["id"]]["dimensions"] if x["id"] == d["id"]), {"value": -1.0})["value"]
                for e in ranked[1:]
            ),
            default=-1.0,
        )
        if d["value"] >= others_max - 0.5:
            reasons.append(f"strongest {d['label']} ({round(d['value'])}/100)")
    reasons.append(f"won {winner_entry['wins']} of {len(ranked) - 1} pairwise comparisons")
    # Evidence-backed highlights (skip neutral cold-start strings).
    for d in winner_score["dimensions"]:
        if d["id"] in ("repository_confidence", "historical_success"):
            for line in as_list(d.get("evidence")):
                if line and "neutral" not in line:
                    reasons.append(f"{d['label']}: {line}")
                    break

    # Build a rationale for EVERY ranked entry (winner + losers), not just the
    # winner. The UI calls `decision_report["reasons"].get(entry["id"], [])` for
    # every entry, so missing keys result in empty rationale cards.
    all_reasons: dict[str, list[str]] = {}
    # Winner rationale
    all_reasons[winner_entry["id"]] = reasons

    rejected: dict[str, str] = {}
    for e in ranked[1:]:
        loser_score = scores[e["id"]]
        weak: list[str] = []
        for dl in loser_score["dimensions"]:
            dw = next((x for x in winner_score["dimensions"] if x["id"] == dl["id"]), None)
            if dw and dw["value"] > dl["value"] + 5.0:
                weak.append(f"{dl['label']} ({round(dw['value'])} vs {round(dl['value'])})")
        loser_reasons = []
        loser_reasons.append(("lost on " + ", ".join(weak[:4])) if weak else "lower aggregate score")
        loser_reasons.append(f"wins {wins.get(e['id'], 0)}/{len(ranked) - 1} pairwise comparisons")
        loser_reasons.append(f"aggregate {e['aggregate']:.1f}/100 vs winner {winner_entry['aggregate']:.1f}/100")
        all_reasons[e["id"]] = loser_reasons
        rejected[e["id"]] = loser_reasons[0]

    return {
        "winner_reason": "; ".join(reasons),
        "reasons": all_reasons,
        "rejected": rejected,
    }


# ── Tournament entry point ──────────────────────────────────────────────────

async def run_strategy_tournament(
    strategies: list[dict[str, Any]],
    capability_mappings: list[dict[str, Any]],
    learning_evidence: dict[str, Any] | None,
    retrieval: dict[str, Any] | None,
    provider: LLMProvider | None = None,
    *,
    include_challenger: bool = True,
    run_debates: bool = True,
    review: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Run the full tournament: score every candidate across the 8 dimensions,
    synthesize a Challenger, adjudicate every head-to-head pair, rank, and
    produce the decision report.

    Returns a JSON-serializable dict: ``{challenger, challenger_rationale,
    scores, ranking, comparisons, decision_report, winner, rejected,
    confidence, methodology}``. Never raises; every step degrades to a
    deterministic default.
    """
    primaries = [as_dict(s) for s in strategies if isinstance(s, dict)]
    challenger: dict[str, Any] | None = None
    challenger_rationale: dict[str, Any] | None = None
    candidates = list(primaries)

    if include_challenger and len(primaries) >= 2:
        try:
            challenger, challenger_rationale = synthesize_challenger(
                primaries, capability_mappings, learning_evidence, retrieval
            )
            candidates.append(challenger)
        except Exception:
            challenger, challenger_rationale = None, None

    scores: dict[str, dict[str, Any]] = {}
    for c in candidates:
        cid = as_str(c.get("id"))
        if not cid:
            continue
        scores[cid] = score_strategy(c, capability_mappings, learning_evidence, retrieval, review)

    comparisons: list[dict[str, Any]] = []
    if len(candidates) >= 2:
        pairs = [(a, b) for i, a in enumerate(candidates) for b in candidates[i + 1:]]
        if run_debates and provider is not None:
            results = await asyncio.gather(
                *[_pairwise_debate(a, b, scores, provider) for a, b in pairs]
            )
            comparisons = [r for r in results if r]
        else:
            comparisons = [_pairwise_compare(a, b, scores) for a, b in pairs]

    wins: dict[str, int] = {as_str(c.get("id")): 0 for c in candidates if as_str(c.get("id"))}
    for cmp in comparisons:
        wid = as_str(cmp.get("winner_id"))
        if wid:
            wins[wid] = wins.get(wid, 0) + 1

    def _sort_key(c):
        cid = as_str(c.get("id"))
        return (
            -wins.get(cid, 0),
            -scores.get(cid, {}).get("aggregate", 0),
            -scores.get(cid, {}).get("confidence", 0),
            cid,
        )

    ranking_order = sorted(candidates, key=_sort_key)
    ranked: list[dict[str, Any]] = []
    for i, c in enumerate(ranking_order):
        cid = as_str(c.get("id"))
        if not cid:
            continue
        sc = scores.get(cid, {})
        ranked.append({
            "rank": i + 1,
            "id": cid,
            "name": as_str(c.get("name")),
            "wins": wins.get(cid, 0),
            "losses": max(0, len(candidates) - 1 - wins.get(cid, 0)),
            "aggregate": sc.get("aggregate", 0),
            "confidence": sc.get("confidence", 0),
            "dimensions": sc.get("dimensions", []),
        })

    decision_report = build_decision_report(ranked, scores, wins)
    for entry in ranked:
        entry["rationale"] = " ".join(decision_report["reasons"].get(entry["id"], []))

    winner = ranked[0] if ranked else {}
    rejected = [
        {
            "id": e["id"], "name": e["name"],
            "reason": decision_report["rejected"].get(e["id"], "lower aggregate score"),
            "confidence": e["confidence"],
        }
        for e in ranked[1:]
    ]

    return {
        "challenger": challenger,
        "challenger_rationale": challenger_rationale,
        "scores": {
            cid: {k: v for k, v in sc.items() if k != "dimensions"} | {"dimensions": sc["dimensions"]}
            for cid, sc in scores.items()
        },
        "ranking": ranked,
        "comparisons": comparisons,
        "decision_report": decision_report,
        "winner": winner,
        "rejected": rejected,
        "confidence": round(float(winner.get("confidence") or 0.5), 3) if winner else 0.5,
        "methodology": {
            "dimensions": DIMENSIONS,
            "candidates": len(candidates),
            "pairwise_comparisons": len(comparisons),
            "challenger_included": challenger is not None,
            "deterministic_adjudication": provider is None or not run_debates,
        },
    }
