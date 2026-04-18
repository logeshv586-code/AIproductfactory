"""
Signal Collection — Web signals (Firecrawl) · GitHub repos · RAG retrieval
"""
from __future__ import annotations
import json
from dataclasses import dataclass, field
from anthropic import Anthropic
from mcp_registry import MCPRegistry


@dataclass
class RepoCandidate:
    full_name: str
    stars: int
    description: str
    url: str
    clone_url: str
    relevance_score: float = 0.0
    reason: str = ""


@dataclass
class SignalBundle:
    web_signals: list[dict]
    repo_candidates: list[RepoCandidate]
    rag_context: list[dict]


class SignalCollector:
    """
    Orchestrates all three signal channels and ranks results.
    """

    RANK_SYSTEM = """You are a repo selection agent. Given an expanded product idea and a list
of GitHub repos, rank them by relevance. For each repo return a score 0-1 and a one-line reason.

Return ONLY valid JSON:
{
  "rankings": [
    {"full_name": "<owner/repo>", "score": <0-1>, "reason": "<why relevant>"},
    ...
  ]
}"""

    def __init__(self, registry: MCPRegistry, client: Anthropic, memory=None):
        self._registry = registry
        self._client = client
        self._memory = memory

    # ── web signals ──────────────────────────────────────────────────────────
    def collect_web_signals(self, idea: str, expanded=None) -> list[dict]:
        queries = [idea]
        if expanded:
            queries.append(f"{expanded.market} trends")
            queries.append(f"{expanded.usp} competitors")
        results = []
        for q in queries[:3]:
            try:
                r = self._registry.mcp_runner("web_search", query=q, max_results=3)
                results.extend(r.get("results", []))
            except Exception as e:
                print(f"[SignalCollector] web_search error: {e}")
        print(f"[SignalCollector] web signals: {len(results)} results")
        return results

    # ── GitHub repo search ───────────────────────────────────────────────────
    def collect_github_repos(self, expanded) -> list[RepoCandidate]:
        all_items = []
        queries = expanded.suggested_stack[:3] if expanded.suggested_stack else [expanded.original]
        for tech in queries:
            try:
                r = self._registry.mcp_runner("github_search", query=tech, sort="stars", per_page=5)
                all_items.extend(r.get("items", []))
            except Exception as e:
                print(f"[SignalCollector] github_search error: {e}")
        # deduplicate
        seen = set()
        unique = []
        for item in all_items:
            if item["full_name"] not in seen:
                seen.add(item["full_name"])
                unique.append(item)
        candidates = [RepoCandidate(**{k: v for k, v in item.items()}) for item in unique]
        # rank with LLM
        candidates = self._rank_repos(expanded, candidates)
        print(f"[SignalCollector] github repos: {len(candidates)} ranked candidates")
        return candidates

    def _rank_repos(self, expanded, candidates: list[RepoCandidate]) -> list[RepoCandidate]:
        if not candidates:
            return candidates
        repo_list = [{"full_name": c.full_name, "stars": c.stars,
                      "description": c.description} for c in candidates]
        prompt = (f"IDEA:\n{expanded.original}\nFEATURES:\n{expanded.features}\n\n"
                  f"REPOS:\n{json.dumps(repo_list, indent=2)}")
        try:
            resp = self._client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=600,
                system=self.RANK_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = resp.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            rankings = json.loads(raw)["rankings"]
            rank_map = {r["full_name"]: r for r in rankings}
            for c in candidates:
                if c.full_name in rank_map:
                    c.relevance_score = rank_map[c.full_name]["score"]
                    c.reason = rank_map[c.full_name]["reason"]
            candidates.sort(key=lambda c: -c.relevance_score)
        except Exception as e:
            print(f"[SignalCollector] ranking error: {e}")
        return candidates

    # ── RAG retrieval ─────────────────────────────────────────────────────────
    def collect_rag_context(self, idea: str) -> list[dict]:
        if not self._memory:
            return []
        try:
            r = self._registry.mcp_runner("rag_query", query=idea, top_k=5)
            print(f"[SignalCollector] RAG hits: {len(r.get('hits', []))}")
            return r.get("hits", [])
        except Exception as e:
            print(f"[SignalCollector] rag_query error: {e}")
            return []

    # ── combined ──────────────────────────────────────────────────────────────
    def collect_all(self, idea: str, expanded=None) -> SignalBundle:
        return SignalBundle(
            web_signals=self.collect_web_signals(idea, expanded),
            repo_candidates=self.collect_github_repos(expanded or type("E", (), {"original": idea,
                "suggested_stack": [], "features": [], "market": idea, "usp": idea})()),
            rag_context=self.collect_rag_context(idea),
        )
