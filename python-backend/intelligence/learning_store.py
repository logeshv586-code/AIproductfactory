"""
Learning System — persists successful knowledge so future executions improve.

Learns repository quality, capability mappings, architecture decisions, user
approvals, successful integrations and failed strategies. The store is a
JSON file that survives across runs. Future orchestrations read it back as
prior-knowledge hints to bias their decisions.
"""

from __future__ import annotations

import json
import os
from typing import Any

from intelligence.prompt_utils import as_dict


def default_learning_path() -> str:
    base = os.environ.get("PI_LEARNING_DIR", "")
    if base:
        return os.path.join(base, "learning.json")
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "output",
        "learning",
        "learning.json",
    )


class LearningStore:
    """JSON-file-backed persistent knowledge store."""

    def __init__(self, path: str | None = None):
        self.path = path or default_learning_path()
        self._data: dict[str, Any] = self._load()

    def _load(self) -> dict[str, Any]:
        try:
            if os.path.exists(self.path):
                with open(self.path, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass
        return {
            "repository_quality": {},     # full_name -> {"quality_score", "used_in", "approved", "failures"}
            "capability_mappings": {},    # capability_name -> {"best_repo", "successes", "failures"}
            "architecture_decisions": [], # {"pattern", "domain", "outcome", "confidence"}
            "user_approvals": [],         # {"strategy_id", "name", "domain", "ts"}
            "successful_integrations": [],# {"capabilities", "repos", "outcome", "ts"}
            "failed_strategies": [],      # {"strategy_id", "reason", "ts"}
            "repo_notes": {},             # full_name -> {"notes": str}
            "product_memories": [],       # full product records (v6 Phase 6)
            "tournaments": [],            # strategy tournament records (v6 Phase 4)
        }

    # ── Persistence ─────────────────────────────────────────────────────────
    def save(self) -> None:
        try:
            os.makedirs(os.path.dirname(self.path) or ".", exist_ok=True)
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[LearningStore] save failed: {e}")

    def to_dict(self) -> dict[str, Any]:
        import copy
        return copy.deepcopy(self._data)

    # ── Learning records ────────────────────────────────────────────────────
    def record_approval(self, strategy: dict[str, Any], domain: str = "") -> None:
        import time
        self._data["user_approvals"].append(
            {
                "strategy_id": strategy.get("id", ""),
                "name": strategy.get("name", ""),
                "domain": domain,
                "confidence": round(min(1.0, max(0.0, float(strategy.get("confidence", 0.7)))), 3),
                "ts": int(time.time() * 1000),
            }
        )
        self._data["user_approvals"] = self._data["user_approvals"][-100:]
        self.save()

    def record_repository_outcome(self, full_name: str, *, approved: bool = True, failure: str = "") -> None:
        import time
        entry = self._data["repository_quality"].setdefault(full_name, {
            "quality_score": 0.6, "used_in": 0, "approved": 0, "failures": 0,
        })
        entry["used_in"] += 1
        if approved and not failure:
            entry["approved"] += 1
            entry["quality_score"] = min(1.0, entry["quality_score"] + 0.05)
        if failure:
            entry["failures"] += 1
            entry["quality_score"] = max(0.1, entry["quality_score"] - 0.15)
        entry["ts"] = int(time.time() * 1000)  # for outcome↔approval matching
        self.save()

    def record_capability_mapping(self, capability_name: str, repo: str, *, success: bool = True) -> None:
        entry = self._data["capability_mappings"].setdefault(capability_name, {
            "best_repo": repo, "successes": 0, "failures": 0,
        })
        entry["successes" if success else "failures"] += 1
        if success:
            entry["best_repo"] = repo
        self.save()

    def record_architecture_decision(self, pattern: str, domain: str, outcome: str = "accepted", confidence: float = 0.6) -> None:
        import time
        self._data["architecture_decisions"].append(
            {
                "pattern": pattern,
                "domain": domain,
                "outcome": outcome,
                "confidence": round(min(1.0, max(0.0, confidence)), 3),
                "ts": int(time.time() * 1000),
            }
        )
        self._data["architecture_decisions"] = self._data["architecture_decisions"][-100:]
        self.save()

    def record_successful_integration(self, capabilities: list[str], repos: list[str]) -> None:
        import time
        self._data["successful_integrations"].append(
            {
                "capabilities": capabilities,
                "repos": repos,
                "outcome": "success",
                "ts": int(time.time() * 1000),
            }
        )
        self._data["successful_integrations"] = self._data["successful_integrations"][-100:]
        self.save()

    def record_failed_strategy(self, strategy_id: str, reason: str) -> None:
        import time
        self._data["failed_strategies"].append(
            {
                "strategy_id": strategy_id,
                "reason": reason,
                "ts": int(time.time() * 1000),
            }
        )
        self._data["failed_strategies"] = self._data["failed_strategies"][-100:]
        self.save()

    # ── Product Memory (v6 Phase 6) ─────────────────────────────────────────
    def record_product_memory(self, run_id: str, memory: dict[str, Any]) -> None:
        """
        Persist a complete product record (DNA, intent, capabilities,
        repositories, architecture, strategy, debates, confidences, simulation,
        self-critique, learning evidence used, outcome). Replaces any prior
        record with the same run_id and keeps the newest 50.
        """
        self._data.setdefault("product_memories", [])  # legacy files lack the key
        record = dict(memory)
        record["run_id"] = run_id
        mems = [m for m in self._data["product_memories"] if as_dict(m).get("run_id") != run_id]
        mems.append(record)
        self._data["product_memories"] = mems[-50:]
        self.save()

    def product_memories(self, limit: int = 0) -> list[dict[str, Any]]:
        """All stored product records, newest first. ``limit`` = 0 returns all."""
        mems = list(self._data.get("product_memories", []))
        mems.reverse()
        return mems[:limit] if limit else mems

    def product_memory_count(self) -> int:
        return len(self._data.get("product_memories", []))

    # ── Strategy Tournament (v6 Phase 4) ────────────────────────────────────
    def record_tournament(self, tournament_id: str, tournament: dict[str, Any]) -> None:
        """
        Persist a completed strategy tournament — winner, runner-up, full
        ranking, per-strategy dimension scores, pairwise comparisons and the
        decision report — so future tournaments (and the Product Memory) can
        learn from this decision. Replaces any prior record with the same
        tournament_id and keeps the newest 50.
        """
        import time
        self._data.setdefault("tournaments", [])  # legacy files lack the key
        record = dict(tournament)
        record["tournament_id"] = tournament_id
        record["ts"] = int(time.time() * 1000)
        toks = [t for t in self._data["tournaments"] if as_dict(t).get("tournament_id") != tournament_id]
        toks.append(record)
        self._data["tournaments"] = toks[-50:]
        self.save()

    def tournaments(self, limit: int = 0) -> list[dict[str, Any]]:
        """All stored tournaments, newest first. ``limit`` = 0 returns all."""
        toks = list(self._data.get("tournaments", []))
        toks.reverse()
        return toks[:limit] if limit else toks

    def tournament_count(self) -> int:
        return len(self._data.get("tournaments", []))

    # ── Retrieval (hints for future runs) ───────────────────────────────────
    def repo_hint(self, full_name: str) -> float | None:
        """Return a learned quality boost (-0.3..+0.3) for a repo, if known."""
        entry = self._data["repository_quality"].get(full_name)
        if not entry:
            return None
        return round(entry["quality_score"] - 0.6, 3)

    def best_repo_for(self, capability_name: str) -> str | None:
        entry = self._data["capability_mappings"].get(capability_name)
        if entry and entry.get("successes", 0) > entry.get("failures", 0):
            return entry.get("best_repo")
        return None

    def summary(self) -> dict[str, Any]:
        return {
            "repositories_learned": len(self._data["repository_quality"]),
            "mappings_learned": len(self._data["capability_mappings"]),
            "approvals": len(self._data["user_approvals"]),
            "successful_integrations": len(self._data["successful_integrations"]),
            "failed_strategies": len(self._data["failed_strategies"]),
            "architecture_decisions": len(self._data["architecture_decisions"]),
            "tournaments": len(self._data.get("tournaments", [])),
            "product_memories": len(self._data.get("product_memories", [])),
        }


_default_store: LearningStore | None = None


def get_learning_store(path: str | None = None) -> LearningStore:
    """Module-level singleton so the orchestrator and endpoints share state."""
    global _default_store
    if _default_store is None or path is not None:
        _default_store = LearningStore(path)
    return _default_store
