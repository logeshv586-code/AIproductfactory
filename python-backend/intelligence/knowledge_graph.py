"""
Product Knowledge Graph — the single source of truth for the Product
Intelligence Engine.

Every engine reads from and writes to this graph instead of passing raw
prompts down the pipeline. It is JSON-serializable so a run can be persisted
to disk between the ``strategize`` (stage 1-9) and ``approve`` (stage 10-17)
phases, which are separate HTTP requests.
"""

from __future__ import annotations

import json
import os
from typing import Any

# All top-level sections. Each maps to a python type:
#   dict sections: intent, market, capabilities, approved_strategy, deep_research,
#                  composition_plan, architecture, blueprint, engineering, execution_plan,
#                  product_thinking, innovation, evolution, repository_intelligence,
#                  review, learning
#   list sections: requirements, existing_products, gaps, repos, capability_mappings,
#                  strategies, competitors, evidence, decisions, timeline, trace
#   scalar:        opportunity_statement, idea, domain
SECTIONS: list[str] = [
    "intent",
    "requirements",
    "market",
    "existing_products",
    "gaps",
    "capabilities",
    "repos",
    "capability_mappings",
    "strategies",
    "approved_strategy",
    "deep_research",
    "composition_plan",
    "architecture",
    "blueprint",
    "engineering",
    "execution_plan",
    # ── v2 (Product Intelligence Operating System) ──────────────────────────
    "product_thinking",
    "competitors",
    "innovation",
    "evolution",
    "repository_intelligence",
    "review",
    "learning",
    "evidence",
    "decisions",
    "opportunity_statement",
    "idea",
    "domain",
    "timeline",
    "trace",
    # ── v3 (Collaborative Reasoning & Evidence Graph) ───────────────────────
    "confidences",
    "debates",
    "product_dna",
    "self_critique",
    "architecture_simulation",
    # ── v6 (Experience-Based Learning) ──────────────────────────────────────
    "learning_evidence",
    "product_memory",
    # ── v6 Phase 4 (Strategy Tournament) ────────────────────────────────────
    "tournament",
]

_LIST_SECTIONS = {
    "requirements",
    "existing_products",
    "gaps",
    "repos",
    "capability_mappings",
    "strategies",
    "competitors",
    "evidence",
    "decisions",
    "debates",
    "timeline",
    "trace",
}


class ProductKnowledgeGraph:
    """Structured, traceable product intelligence state."""

    def __init__(self, idea: str = "", domain: str = ""):
        self._data: dict[str, Any] = {s: ([] if s in _LIST_SECTIONS else {}) for s in SECTIONS}
        self._data["idea"] = idea
        self._data["domain"] = domain
        self._data["capabilities"] = {"capabilities": [], "edges": [], "domain": domain}

    # ── Generic access ─────────────────────────────────────────────────────
    def set(self, section: str, value: Any) -> None:
        self._data[section] = value

    def get(self, section: str, default: Any = None) -> Any:
        return self._data.get(section, default)

    def get_idea(self) -> str:
        return str(self._data.get("idea", ""))

    # ── Structured writers ─────────────────────────────────────────────────
    def add_requirement(self, req: dict[str, Any]) -> None:
        self._data["requirements"].append(req)

    def add_existing_product(self, product: dict[str, Any]) -> None:
        self._data["existing_products"].append(product)

    def add_gap(self, gap: dict[str, Any]) -> None:
        self._data["gaps"].append(gap)

    def add_capability(self, capability: dict[str, Any]) -> None:
        caps = self._data["capabilities"].setdefault("capabilities", [])
        caps.append(capability)

    def add_capability_edge(self, edge: dict[str, Any]) -> None:
        edges = self._data["capabilities"].setdefault("edges", [])
        edges.append(edge)

    def add_repo(self, repo: dict[str, Any]) -> None:
        self._data["repos"].append(repo)

    def add_mapping(self, mapping: dict[str, Any]) -> None:
        self._data["capability_mappings"].append(mapping)

    def add_strategy(self, strategy: dict[str, Any]) -> None:
        self._data["strategies"].append(strategy)

    def set_approved_strategy(self, strategy: dict[str, Any] | None) -> None:
        self._data["approved_strategy"] = strategy or {}

    # ── v2 writers ──────────────────────────────────────────────────────────
    def add_competitor(self, competitor: dict[str, Any]) -> None:
        self._data["competitors"].append(competitor)

    def add_evidence(
        self,
        stage: str,
        claim: str,
        confidence: float = 0.5,
        source: str = "",
        detail: str = "",
    ) -> None:
        """Record a traceable evidence item backing a claim in this stage."""
        import time

        self._data["evidence"].append(
            {
                "stage": stage,
                "claim": claim,
                "confidence": round(min(1.0, max(0.0, float(confidence))), 3),
                "source": source,
                "detail": detail,
                "ts": int(time.time() * 1000),
            }
        )

    def add_decision(
        self,
        stage: str,
        decision: str,
        rationale: str,
        confidence: float = 0.5,
        evidence_refs: list[str] | None = None,
    ) -> None:
        """Record an explainable decision with its rationale and confidence."""
        import time

        self._data["decisions"].append(
            {
                "stage": stage,
                "decision": decision,
                "rationale": rationale,
                "confidence": round(min(1.0, max(0.0, float(confidence))), 3),
                "evidence_refs": evidence_refs or [],
                "ts": int(time.time() * 1000),
            }
        )

    # ── v3 (Collaborative Reasoning & Evidence Graph) ───────────────────────
    def set_confidence(self, stage: str, confidence: float) -> None:
        """Record the propagated confidence of a stage on the graph."""
        current = self._data.get("confidences")
        current = current if isinstance(current, dict) else {}
        self._data["confidences"] = {**current, stage: round(min(1.0, max(0.0, float(confidence))), 3)}

    def set_confidences(self, confidences: dict[str, Any]) -> None:
        self._data["confidences"] = confidences

    def add_debate(self, debate: dict[str, Any]) -> None:
        """Record an agent debate (positions, rebuttals, winner, reasoning)."""
        self._data["debates"].append(debate)

    def add_product_dna(self, dna: dict[str, Any]) -> None:
        self._data["product_dna"] = dna

    def explain(self, topic: str = "recommendation") -> str:
        """
        Generate a plain-English explanation of why the current product
        recommendations were made, drawing on the stored evidence, decisions,
        debates, and the review. Fully deterministic (no LLM).
        """
        lines: list[str] = [f"Why this {topic}"]
        decisions = self._data.get("decisions", [])
        if decisions:
            last = decisions[-1]
            lines.append(f"• {last.get('decision')} — {last.get('rationale')} (confidence {last.get('confidence')})")
        debates = self._data.get("debates", [])
        if debates:
            for d in debates[-3:]:
                lines.append(
                    f"• Agent debate on {d.get('topic')}: {d.get('winner_agent')} won — {d.get('winner_stance')}"
                )
        evidence = self._data.get("evidence", [])
        if evidence:
            lines.append("Evidence backing these choices:")
            for e in evidence[-5:]:
                lines.append(f"  - [{e.get('stage')}] {e.get('claim')} (confidence {e.get('confidence')})")
        review = self._data.get("review", {})
        if review:
            lines.append(f"• Review score {review.get('score')}/100, verdict {review.get('verdict')}")
        dna = self._data.get("product_dna", {})
        if dna:
            lines.append(f"• Product DNA: {dna.get('summary')}")
        return "\n".join(lines)

    # ── Traceability ───────────────────────────────────────────────────────
    def add_trace(
        self,
        stage: str,
        action: str,
        detail: str = "",
        evidence: dict[str, Any] | None = None,
    ) -> None:
        import time

        self._data["trace"].append(
            {
                "stage": stage,
                "action": action,
                "detail": detail,
                "evidence": evidence or {},
                "ts": int(time.time() * 1000),
            }
        )

    def add_timeline(self, step: str, detail: str) -> None:
        import time

        self._data["timeline"].append(
            {"step": step, "detail": detail, "ts": int(time.time() * 1000)}
        )

    def get_trace(self) -> list[dict[str, Any]]:
        return self._data["trace"]

    # ── Serialization ──────────────────────────────────────────────────────
    def to_dict(self) -> dict[str, Any]:
        return json.loads(json.dumps(self._data))  # deep copy, JSON-safe

    def save(self, path: str) -> None:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)

    @classmethod
    def load(cls, path: str) -> "ProductKnowledgeGraph | None":
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            return None
        graph = cls(idea=data.get("idea", ""), domain=data.get("domain", ""))
        for section in SECTIONS:
            if section in data:
                graph._data[section] = data[section]
        return graph


def default_run_dir() -> str:
    """Directory where strategize/approve run state is persisted."""
    base = os.environ.get("PI_RUNS_DIR", "")
    if base:
        return base
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output", "pi_runs")


def run_path(run_id: str) -> str:
    return os.path.join(default_run_dir(), f"{run_id}.json")
