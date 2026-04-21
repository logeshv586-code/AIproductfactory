"""
Probability Engine — Feasibility · Novelty · Demand → Planner directives
"""
from __future__ import annotations
import json
from dataclasses import dataclass
from anthropic import Anthropic


@dataclass
class ProbabilityScore:
    feasibility: float   # 0-1  Can we build this with known repos / tools?
    novelty: float       # 0-1  How differentiated is the idea?
    demand: float        # 0-1  Market demand signal
    composite: float     # weighted combination
    directives: list[str] = None   # guidance passed to planner
    rationale: str = ""


WEIGHT = {"feasibility": 0.4, "novelty": 0.3, "demand": 0.3}


class ProbabilityEngine:
    """
    Scores an idea on three axes and emits planner directives.
    Weights are stored in RAG and updated by the feedback loop.
    """

    SYSTEM = """You are a probability scoring engine for an AI product factory.
Given an idea and optional market / repo context, score it on three axes (0.0-1.0):
  - feasibility: can this be built with existing open-source repos and AI tools?
  - novelty: how differentiated / non-commoditised is this idea?
  - demand: how strong is the market demand signal?

Return ONLY valid JSON:
{
  "feasibility": <float>,
  "novelty": <float>,
  "demand": <float>,
  "directives": ["<directive1>", "<directive2>", ...],
  "rationale": "<one paragraph>"
}
Directives are short instructions for the planner (e.g. "prefer repos with MIT licence",
"focus on API-first architecture", "add competitor-analysis step").
"""

    def __init__(self, client: Anthropic, memory=None):
        self._client = client
        self._memory = memory

    def _weights(self) -> dict:
        if self._memory:
            stored = self._memory.get_prob_weights()
            if stored:
                return stored
        return WEIGHT

    def score(self, idea: str, context: str = "") -> ProbabilityScore:
        weights = self._weights()
        user_msg = f"IDEA:\n{idea}\n\nCONTEXT:\n{context or 'none'}"
        resp = self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=512,
            system=self.SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = resp.content[0].text.strip()
        # strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        composite = sum(data[k] * weights[k] for k in ("feasibility", "novelty", "demand"))
        score = ProbabilityScore(
            feasibility=data["feasibility"],
            novelty=data["novelty"],
            demand=data["demand"],
            composite=round(composite, 3),
            directives=data.get("directives", []),
            rationale=data.get("rationale", ""),
        )
        print(f"[ProbabilityEngine] composite={score.composite:.2f}  "
              f"F={score.feasibility} N={score.novelty} D={score.demand}")
        return score

    def update_weights(self, feedback: dict):
        """Called by feedback loop to adapt weights from build outcomes."""
        w = self._weights()
        for k in ("feasibility", "novelty", "demand"):
            if k in feedback:
                w[k] = round(0.8 * w[k] + 0.2 * feedback[k], 4)
        # normalise
        total = sum(w.values())
        w = {k: round(v / total, 4) for k, v in w.items()}
        if self._memory:
            self._memory.store_prob_weights(w)
        return w
