import asyncio

from graph.capability_graph import (
    build_capability_graph_engine,
    dynamic_workspace_tabs,
    infer_domain,
    match_required_skills,
)
from intelligence.combined_report import build_combined_intelligence_report
from llm.router import ProviderRouter


def test_trading_request_matches_realtime_memory_and_risk_skills():
    idea = "Build autonomous trading AI with live market feeds, RAG memory, and risk analysis"

    assert infer_domain(idea) == "trading"

    skills = match_required_skills(idea)
    skill_ids = {skill["id"] for skill in skills}

    assert {"realtime", "memory", "rag", "security", "agent"}.issubset(skill_ids)


def test_capability_graph_engine_adds_dynamic_intelligence_nodes():
    graph = build_capability_graph_engine(
        user_request="Build Gemma ONNX object detection system with CPU inference",
        repos=[{"name": "onnxruntime", "full_name": "microsoft/onnxruntime", "stars": 12000}],
        capabilities=[{"repo": "microsoft/onnxruntime", "capability": "optimization", "confidence": 0.9}],
        products=[{"name": "Vision Edge AI", "capabilities": ["vision", "optimization"], "scores": {"final_score": 0.8}}],
        research={"relevant_papers": [{"title": "Efficient Vision Transformers", "summary": "Optimization patterns"}]},
        memory={"stores": ["execution outcomes"]},
    )

    node_types = graph["stats"]["node_types"]

    assert graph["domain"] == "vision_ai"
    assert node_types["skill"] >= 2
    assert node_types["framework"] >= 2
    assert node_types["paper"] == 1
    assert any(tab == "Quantization" for tab in dynamic_workspace_tabs(graph["skill_cards"], graph["domain"]))


def test_combined_report_contains_scores_and_workspace_tabs():
    capability_graph = build_capability_graph_engine(
        user_request="Build GraphRAG engineering intelligence platform",
        capabilities=[{"capability": "rag", "confidence": 0.91}],
        products=[{"name": "Engineering OS", "description": "Report driven builder", "capabilities": ["rag", "memory"], "scores": {"innovation": 0.9, "feasibility": 0.82}}],
    )

    report = build_combined_intelligence_report(
        user_request="Build GraphRAG engineering intelligence platform",
        intent={"domain": "developer tools"},
        selected_repos=[],
        capabilities=[],
        products=[{"name": "Engineering OS", "description": "Report driven builder", "capabilities": ["rag", "memory"], "scores": {"innovation": 0.9, "feasibility": 0.82}}],
        capability_graph=capability_graph,
    )

    assert report["product_summary"]["name"] == "Engineering OS"
    assert report["intelligence_scores"]["innovation_score"] >= 90
    assert "Knowledge" in report["dynamic_workspace"]["tabs"]
    assert report["skill_layer"]["matched_skills"]


def test_provider_router_local_fallback_caches_response():
    router = ProviderRouter()
    messages = [{"role": "user", "content": "quick classify this request"}]

    first = asyncio.run(router.chat(messages, task_type="local_fallback"))
    second = asyncio.run(router.chat(messages, task_type="local_fallback"))

    assert first["provider"] == "local"
    assert second["provider"] == "cache"
    assert first["text"]
