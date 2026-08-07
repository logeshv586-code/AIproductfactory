"""
Experience-Based Learning — the v6 Phase 1 "close the loop" engine.

The Learning Store records outcomes (approvals, repo success/failure, capability
mappings, architecture decisions). This engine is the *read side* that turns
those records into usable evidence:

  - repository success scoring   (used / approved / failures / success rate)
  - capability → repository ranking from historical outcomes
  - architecture pattern success statistics
  - confidence calibration based on past prediction accuracy
  - recommendation boost   (how much history should move a repo's score)

Everything here is deterministic code (no LLM) so the same history produces the
same evidence. It is the retrieval half of the loop; the orchestrator applies
the evidence to discovery and strategy generation.
"""

from __future__ import annotations

from typing import Any

from intelligence.learning_store import LearningStore, get_learning_store
from intelligence.prompt_utils import as_dict, as_list, as_str

# How strongly historical success should move a repo's weighted score.
_MAX_REPO_BOOST = 0.20        # a proven repo can be lifted up to +0.20
_REPO_QUALITY_HYSTERESIS = 0.5  # below this quality score, past success stops helping
_CONFIDENCE_MAX_CALIBRATION = 0.15
_PRIOR = 0.6  # prior probability of success before we have data


def _beta_mean(successes: float, failures: float, prior: float = _PRIOR, strength: float = 2.0) -> float:
    """Posterior mean of a Beta(successes + prior*strength, failures + (1-prior)*strength)."""
    return (successes + prior * strength) / (successes + failures + strength)


def _success_rate(successes: float, failures: float) -> float:
    """Empirical success rate with Beta smoothing toward the prior."""
    return round(_beta_mean(successes, failures), 3)


class ExperienceEngine:
    """Deterministic read-side engine over the Learning Store."""

    def __init__(self, store: LearningStore | None = None):
        self.store = store or get_learning_store()

    # ── Repository success scoring ─────────────────────────────────────────
    def repository_stats(self) -> dict[str, Any]:
        """
        Per-repo historical stats:
        {full_name: {used_in, approved, failures, success_rate, quality_score, boosted, learned_score}}
        """
        out: dict[str, Any] = {}
        data = self.store.to_dict()
        for full_name, entry in as_dict(data.get("repository_quality")).items():
            e = as_dict(entry)
            used = int(e.get("used_in", 0))
            approved = int(e.get("approved", 0))
            failures = int(e.get("failures", 0))
            quality = float(e.get("quality_score", 0.6))
            rate = _success_rate(approved, failures) if (approved + failures) else 0.0
            boosted = quality - 0.6  # repo_hint: how far above/below the default prior
            # learned_score = raw GitHub evidence (quality) plus historical success
            # signal, so a proven repo climbs and a failing repo is penalized.
            learned_score = min(1.0, max(0.0, quality + (rate - _PRIOR) * 0.4))
            out[full_name] = {
                "used_in": used,
                "approved": approved,
                "failures": failures,
                "success_rate": rate,
                "quality_score": round(quality, 3),
                "boosted": round(min(1.0, max(-1.0, boosted)), 3),
                "learned_score": round(learned_score, 3),
            }
        return out

    def repo_boost(self, full_name: str) -> float:
        """How much a repository's score should be moved by history (-0.3..+0.3)."""
        stats = self.repository_stats().get(full_name)
        if not stats:
            return 0.0
        if stats["quality_score"] < _REPO_QUALITY_HYSTERESIS:
            return min(0.0, stats["boosted"])  # past failures outweigh low raw quality
        return max(-0.3, min(_MAX_REPO_BOOST, stats["boosted"]))

    # ── Capability → repository ranking ────────────────────────────────────
    def capability_rankings(self) -> dict[str, Any]:
        """
        Per-capability learned ranking: which repo has historically done best.
        {capability_name: {best_repo, successes, failures, success_rate, evidence_count}}
        """
        out: dict[str, Any] = {}
        data = self.store.to_dict()
        for cap, entry in as_dict(data.get("capability_mappings")).items():
            e = as_dict(entry)
            successes = int(e.get("successes", 0))
            failures = int(e.get("failures", 0))
            best = as_str(e.get("best_repo"))
            out[cap] = {
                "best_repo": best,
                "successes": successes,
                "failures": failures,
                "success_rate": _success_rate(successes, failures) if (successes + failures) else 0.0,
                "evidence_count": successes + failures,
            }
        return out

    def best_repo_for(self, capability_name: str, *, min_evidence: int = 1) -> str | None:
        """Learned best repo for a capability, if enough evidence exists."""
        ranking = self.capability_rankings().get(capability_name)
        if not ranking or ranking["evidence_count"] < min_evidence:
            return None
        return ranking["best_repo"]

    # ── Architecture pattern statistics ────────────────────────────────────
    def architecture_stats(self) -> dict[str, Any]:
        """
        Per-deployment-pattern success stats across historical products.
        {pattern: {outcome, outcomes: {accepted|rejected: n}, count, success_rate}}
        """
        out: dict[str, Any] = {}
        for d in as_list(self.store.to_dict().get("architecture_decisions")):
            pattern = as_str(d.get("pattern")) or "unknown"
            outcome = as_str(d.get("outcome")) or "accepted"
            entry = out.setdefault(pattern, {"outcomes": {"accepted": 0, "rejected": 0}, "count": 0})
            entry["count"] += 1
            entry["outcomes"][outcome] = entry["outcomes"].get(outcome, 0) + 1
        for pattern, entry in out.items():
            acc = entry["outcomes"].get("accepted", 0)
            rej = entry["outcomes"].get("rejected", 0)
            entry["success_rate"] = _success_rate(acc, rej)
            entry["outcome"] = "accepted" if acc > rej else ("rejected" if rej > acc else "mixed")
        return out

    # ── Confidence calibration ─────────────────────────────────────────────
    def confidence_calibration(self) -> dict[str, Any]:
        """
        Compare predicted vs observed outcome.

        Every approval carries the strategy's confidence (prediction). We compare
        it against the observed success/failure for the repos it selected. This
        yields a correction that future recommendations should apply, and a
        `reliability` measure (how well predictions tracked reality).
        """
        data = self.store.to_dict()
        approvals = as_list(data.get("user_approvals"))
        repo_stats = self.repository_stats()
        if not approvals:
            return {"count": 0, "correction": 0.0, "reliability": 1.0, "note": "not enough approvals to calibrate"}

        paired: list[float] = []
        observed_values: list[float] = []
        raw_repo_entries = as_dict(data.get("repository_quality"))
        for a in approvals:
            strategy_id = as_str(a.get("strategy_id"))
            predicted = float(a.get("confidence", 0.7))
            # locate the strategy's repo selections to derive observed outcome
            observed = _observed_from_approval(a, repo_stats, raw_repo_entries)
            if observed is None:
                continue
            paired.append(predicted)
            observed_values.append(observed)
        if not paired:
            return {"count": len(approvals), "correction": 0.0, "reliability": 1.0, "note": "no repo outcomes to calibrate against"}

        mean_prediction = sum(paired) / len(paired)
        mean_observed = sum(observed_values) / len(observed_values)
        mean_error = mean_observed - mean_prediction
        errors = [o - p for o, p in zip(observed_values, paired)]
        correction = min(_CONFIDENCE_MAX_CALIBRATION, max(-_CONFIDENCE_MAX_CALIBRATION, mean_error))
        # reliability = how well prediction tracked reality (mean squared error)
        mse = sum(e * e for e in errors) / len(errors)
        reliability = round(max(0.0, min(1.0, 1.0 - mse)), 3)
        return {
            "count": len(paired),
            "mean_prediction": round(mean_prediction, 3),
            "mean_observed": round(mean_observed, 3),
            "correction": round(correction, 3),
            "reliability": reliability,
            "note": f"based on {len(paired)} approved strategies with repo outcomes",
        }

    # ── Full evidence report (what the UI shows) ───────────────────────────
    def evidence_report(self) -> dict[str, Any]:
        repo_stats = self.repository_stats()
        cap_rankings = self.capability_rankings()
        arch_stats = self.architecture_stats()
        calibration = self.confidence_calibration()
        summary = self.store.summary()

        top_repos = sorted(
            repo_stats.items(),
            key=lambda kv: (kv[1]["learned_score"], kv[1]["used_in"]),
            reverse=True,
        )[:10]
        return {
            "repositories": {k: v for k, v in top_repos},
            "repository_count": len(repo_stats),
            "capability_rankings": cap_rankings,
            "capability_count": len(cap_rankings),
            "architecture_stats": arch_stats,
            "architecture_count": len(arch_stats),
            "confidence_calibration": calibration,
            "store_summary": summary,
            "has_evidence": bool(repo_stats or cap_rankings or arch_stats),
        }


def _observed_from_approval(
    approval: dict[str, Any],
    repo_stats: dict[str, Any],
    raw_repo_entries: dict[str, Any],
) -> float | None:
    """
    Aggregate observed success (0..1) for the repos selected by an approval.

    The approval dict stores only strategy_id/name, so the observed outcome is
    derived from the repo outcomes recorded in the *same* approval run. Both are
    written by ``approve()`` with the same ``ts``, so we match by timestamp
    proximity: take the repo outcomes whose timestamp is within ~90s of the
    approval. Each approval's own repos therefore contribute, not a global mean.
    """
    approval_ts = float(approval.get("ts") or 0)
    if not approval_ts or not repo_stats or not raw_repo_entries:
        return None
    matched: list[float] = []
    for full_name, entry in raw_repo_entries.items():
        entry = as_dict(entry)
        repo_ts = float(entry.get("ts", 0) or 0)
        if repo_ts and abs(repo_ts - approval_ts) <= 90_000 and full_name in repo_stats:
            stats = repo_stats[full_name]
            if stats["used_in"] > 0:
                matched.append(stats["success_rate"])
    if not matched:
        return None
    return sum(matched) / len(matched)


# Singleton so the orchestrator and endpoints share one engine over the store.
_default_engine: ExperienceEngine | None = None


def get_experience_engine(store: LearningStore | None = None) -> ExperienceEngine:
    global _default_engine
    if _default_engine is None or store is not None:
        _default_engine = ExperienceEngine(store)
    return _default_engine
