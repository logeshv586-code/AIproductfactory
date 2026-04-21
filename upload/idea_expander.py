"""
Idea Expansion — Market · Users · Features · USP · Risks
"""
from __future__ import annotations
import json
from dataclasses import dataclass, field
from anthropic import Anthropic


@dataclass
class ExpandedIdea:
    original: str
    market: str
    target_users: list[str]
    features: list[str]
    usp: str
    risks: list[str]
    suggested_stack: list[str]
    raw: dict = field(default_factory=dict)


class IdeaExpander:
    SYSTEM = """You are a product strategist inside an AI product factory.
Given a raw product idea (and optional probability score), expand it into a structured brief.

Return ONLY valid JSON:
{
  "market": "<market description>",
  "target_users": ["<user1>", "<user2>"],
  "features": ["<feature1>", "<feature2>", "<feature3>", "<feature4>", "<feature5>"],
  "usp": "<unique selling proposition>",
  "risks": ["<risk1>", "<risk2>", "<risk3>"],
  "suggested_stack": ["<tech1>", "<tech2>", "<tech3>"]
}
Be concrete and specific. Features should be implementable."""

    def __init__(self, client: Anthropic):
        self._client = client

    def expand(self, idea: str, prob_score=None) -> ExpandedIdea:
        prob_ctx = ""
        if prob_score:
            prob_ctx = (f"\nProbability scores: feasibility={prob_score.feasibility}, "
                        f"novelty={prob_score.novelty}, demand={prob_score.demand}\n"
                        f"Planner directives: {prob_score.directives}")
        user_msg = f"IDEA:\n{idea}{prob_ctx}"
        resp = self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            system=self.SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw_text = resp.content[0].text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        data = json.loads(raw_text)
        expanded = ExpandedIdea(
            original=idea,
            market=data["market"],
            target_users=data["target_users"],
            features=data["features"],
            usp=data["usp"],
            risks=data["risks"],
            suggested_stack=data.get("suggested_stack", []),
            raw=data,
        )
        print(f"[IdeaExpander] USP: {expanded.usp}")
        print(f"[IdeaExpander] Features: {expanded.features}")
        return expanded
