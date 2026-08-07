"""
v6 Phase 4 · Strategy Tournament — unit tests.

Covers the deterministic core of the tournament engine: the 8-dimension
scorer, challenger synthesis, pairwise comparisons, ranking/tie-break
determinism, cold-start behavior, and the Learning Store tournament
persistence round-trip (including the legacy-file setdefault path).
"""

import asyncio
import os
import tempfile

from intelligence.learning_store import LearningStore
from intelligence.strategy_tournament import (
    build_decision_report,
    run_strategy_tournament,
    score_strategy,
    synthesize_challenger,
)

# A minimal but well-formed strategy set, mirroring _normalize_llm output.
STRATS = [
    {
        "id": "STRAT-A", "name": "Fast MVP", "complexity": "low", "risk_level": "low",
        "features": ["a", "b"], "architecture": "single service", "estimated_cost": "$2k - $5k",
        "innovation_score": 0.3, "feasibility": 0.9, "market_opportunity": 0.7,
        "confidence": 0.85, "risks": ["scope"],
        "repository_map": {"Search": "algolia/algoliasearch-client-python"},
        "capabilities": ["CAP-1"], "description": "mvp", "tagline": "t", "why": "fast",
        "differentiation": "d", "timeline": "2w",
    },
    {
        "id": "STRAT-B", "name": "Balanced Product", "complexity": "medium", "risk_level": "medium",
        "features": ["a", "b", "c", "d"], "architecture": "api + ai service with vector store and job queue",
        "estimated_cost": "$8k - $15k", "innovation_score": 0.55, "feasibility": 0.75,
        "market_opportunity": 0.8, "confidence": 0.75, "risks": ["llm cost", "prompt brittleness"],
        "repository_map": {"Search": "opensearch-project/OpenSearch", "AI Assistant": "langchain-ai/langchain"},
        "capabilities": ["CAP-1", "CAP-2"], "description": "balanced", "tagline": "t", "why": "ai",
        "differentiation": "d", "timeline": "5w",
    },
    {
        "id": "STRAT-C", "name": "Enterprise Platform", "complexity": "high", "risk_level": "high",
        "features": ["a", "b", "c", "d", "e", "f"], "architecture": "event-driven microservices: gateway, workers, stream broker, analytics lake, observability",
        "estimated_cost": "$25k - $50k", "innovation_score": 0.7, "feasibility": 0.6,
        "market_opportunity": 0.75, "confidence": 0.65, "risks": ["operational complexity", "time to value", "infra cost"],
        "repository_map": {"Search": "elastic/elasticsearch", "AI Assistant": "huggingface/transformers", "Analytics": "apache/airflow"},
        "capabilities": ["CAP-1", "CAP-2", "CAP-3"], "description": "enterprise", "tagline": "t", "why": "scale",
        "differentiation": "d", "timeline": "10w",
    },
]


def test_score_strategy_returns_eight_dimensions():
    score = score_strategy(STRATS[1], [], {}, {})
    assert {d["id"] for d in score["dimensions"]} == {
        "feasibility", "repository_confidence", "historical_success", "innovation",
        "technical_risk", "maintainability", "cost_complexity", "confidence",
    }
    for d in score["dimensions"]:
        assert 0 <= d["value"] <= 100
        assert 0 <= d["confidence"] <= 1
        assert d["evidence"]
    assert 0 <= score["aggregate"] <= 100
    assert 0 <= score["confidence"] <= 1


def test_score_strategy_integrates_experience_and_memory():
    """Repo + historical evidence must lift the corresponding dimensions."""
    evidence = {
        "repositories": {
            "opensearch-project/OpenSearch": {"used_in": 5, "approved": 5, "failures": 0, "success_rate": 0.9},
            "langchain-ai/langchain": {"used_in": 3, "approved": 3, "failures": 0, "success_rate": 0.9},
        },
        "capability_rankings": {
            "Search": {"best_repo": "opensearch-project/OpenSearch", "successes": 4, "failures": 0, "success_rate": 0.9, "evidence_count": 4},
        },
    }
    retrieval = {
        "matches": [
            {
                "similarity": 0.8,
                "historical_outcome": {
                    "approved_strategy": "STRAT-B", "strategy_name": "Balanced Product",
                    "final_score": 0.9, "self_critique_passed": True, "self_critique_score": 92,
                },
            }
        ]
    }
    scored = score_strategy(STRATS[1], [], evidence, retrieval)
    dims = {d["id"]: d for d in scored["dimensions"]}
    assert dims["repository_confidence"]["value"] >= 85
    assert dims["historical_success"]["value"] >= 70


def test_score_strategy_cold_start_neutral():
    """No experience, no memory → Repository/Historical dims must be neutral, not crash."""
    score = score_strategy(STRATS[0], [], {}, {})
    dims = {d["id"]: d for d in score["dimensions"]}
    assert dims["repository_confidence"]["value"] == 50.0
    assert dims["historical_success"]["value"] == 50.0


def test_synthesize_challenger_shape():
    challenger, rationale = synthesize_challenger(STRATS, [], {}, {})
    assert challenger["id"] == "STRAT-D"
    assert challenger["name"] == "Challenger"
    assert challenger["challenger"] is True
    # frozen strategy contract honored
    assert isinstance(challenger["repository_map"], dict)
    assert isinstance(challenger["capabilities"], list)
    assert challenger["innovation_score"] >= 0
    assert rationale["based_on"] in {s["id"] for s in STRATS}


def test_synthesize_challenger_swaps_to_proven_repos():
    """Challenger should replace an unproven repo with a proven one from experience."""
    evidence = {
        "capability_rankings": {
            "Search": {"best_repo": "zincsearch/zincsearch", "successes": 3, "failures": 0},
        }
    }
    challenger, rationale = synthesize_challenger(STRATS, [], evidence, {})
    assert challenger["repository_map"]["Search"] == "zincsearch/zincsearch"
    assert rationale["swapped_repositories"], "expected at least one repo swap"


def test_run_tournament_ranks_all_candidates():
    result = asyncio.run(run_strategy_tournament(STRATS, [], {}, {}))
    ids = [e["id"] for e in result["ranking"]]
    assert set(ids) == {"STRAT-A", "STRAT-B", "STRAT-C", "STRAT-D"}
    assert result["ranking"][0]["rank"] == 1
    assert result["winner"]["id"] == ids[0]
    # ranks strictly increase
    assert [e["rank"] for e in result["ranking"]] == [1, 2, 3, 4]
    # aggregate scores strictly non-increasing down the ranking
    aggs = [e["aggregate"] for e in result["ranking"]]
    assert aggs == sorted(aggs, reverse=True)
    # round-robin: every pair compared
    assert len(result["comparisons"]) == 6  # 4 choose 2
    assert result["challenger"] is not None


def test_run_tournament_deterministic():
    r1 = asyncio.run(run_strategy_tournament(STRATS, [], {}, {}))
    r2 = asyncio.run(run_strategy_tournament(STRATS, [], {}, {}))
    assert r1["ranking"] == r2["ranking"]
    assert r1["comparisons"] == r2["comparisons"]


def test_run_tournament_without_challenger():
    result = asyncio.run(run_strategy_tournament(STRATS, [], {}, {}, include_challenger=False))
    assert result["challenger"] is None
    assert len(result["ranking"]) == 3
    assert len(result["comparisons"]) == 3  # 3 choose 2


def test_decision_report_covers_winner_and_rejected():
    result = asyncio.run(run_strategy_tournament(STRATS, [], {}, {}))
    report = result["decision_report"]
    assert report["winner_reason"]
    assert report["reasons"]
    assert set(report["rejected"]) == {e["id"] for e in result["ranking"][1:]}
    assert result["rejected"], "expected at least one rejected strategy"


def test_tournament_with_empty_strategies_is_safe():
    result = asyncio.run(run_strategy_tournament([], [], {}, {}))
    assert result["ranking"] == []
    assert result["winner"] == {}


def test_learning_store_tournament_persistence_roundtrip(tmp_path):
    store = LearningStore(str(tmp_path / "learning.json"))
    t = {"winner": {"id": "STRAT-B"}, "ranking": [{"id": "STRAT-B"}]}
    store.record_tournament("run-1", t)
    assert store.tournament_count() == 1
    toks = store.tournaments()
    assert toks[0]["tournament_id"] == "run-1"
    assert toks[0]["ts"]
    # dedupe on same tournament_id
    store.record_tournament("run-1", {"winner": {"id": "STRAT-A"}})
    assert store.tournament_count() == 1
    assert store.tournaments()[0]["winner"]["id"] == "STRAT-A"
    # cap at 50
    for i in range(60):
        store.record_tournament(f"run-{i}", {"winner": {"id": "STRAT-A"}})
    assert store.tournament_count() == 50


def test_learning_store_legacy_file_gets_tournaments_key(tmp_path):
    """A pre-existing learning.json without 'tournaments' must not crash on record."""
    path = os.path.join(tmp_path, "learning.json")
    with open(path, "w", encoding="utf-8") as f:
        f.write('{"repository_quality": {}, "product_memories": []}')
    store = LearningStore(path)
    store.record_tournament("r", {"winner": {"id": "STRAT-B"}})
    assert store.tournament_count() == 1


def test_summary_includes_tournaments():
    store = LearningStore(os.path.join(tempfile.gettempdir(), f"t-{os.getpid()}.json"))
    store._data["tournaments"] = [{"tournament_id": "x"}]
    s = store.summary()
    assert s["tournaments"] == 1
    assert s["product_memories"] == 0


def test_legacy_file_without_product_memories_does_not_crash(tmp_path):
    """Pre-Phase-6 learning.json files lack product_memories; accessors must not raise."""
    path = os.path.join(tmp_path, "learning.json")
    with open(path, "w", encoding="utf-8") as f:
        f.write('{"repository_quality": {}, "user_approvals": [], "capability_mappings": {}}')
    store = LearningStore(path)
    assert store.product_memories() == []
    assert store.product_memory_count() == 0
    store.record_product_memory("r1", {"idea": "x"})  # must setdefault, not KeyError
    assert store.product_memory_count() == 1
    store.record_tournament("r1", {"winner": {"id": "STRAT-A"}})
    assert store.tournament_count() == 1
