from __future__ import annotations

from capabilities.offline_catalog import capability_by_id, resolve_capabilities
from capabilities.offline_policy import factory_offline_only, network_allowed
from capabilities.online_extensions import match_online_extensions
from capabilities.product_blueprints import match_product_blueprints


def test_offline_policy_blocks_public_network(monkeypatch):
    monkeypatch.setenv("FACTORY_OFFLINE_ONLY", "1")
    assert factory_offline_only() is True
    assert network_allowed("http://127.0.0.1:11434/v1/models") is True
    assert network_allowed("http://localhost:1234/v1/models") is True
    assert network_allowed("file:///tmp/corpus.json") is True
    assert network_allowed("https://api.github.com/repos/a/b") is False


def test_catalog_resolves_rag_and_voice():
    matches = resolve_capabilities("Build a private voice support RAG over PDF manuals")
    ids = {item["id"] for item in matches}
    assert "voice_pipeline" in ids
    assert "rag_basic" in ids or "rag_hybrid" in ids


def test_blueprint_matches_recruitment():
    matches = match_product_blueprints("screen resumes and prepare candidate interviews")
    assert matches[0]["id"] == "recruitment_copilot"
    assert matches[0]["offline_ready"] is True


def test_known_capability_contains_local_stack():
    item = capability_by_id("codebase_intelligence")
    assert item is not None
    assert "git CLI" in item.local_components


def test_online_extensions_are_opt_in_and_keep_fallbacks():
    extensions = match_online_extensions("Use GitHub repo issues and latest web research")
    ids = {item["id"] for item in extensions}
    assert "github_mcp" in ids
    assert "web_research" in ids
    assert all(item["offline_fallback"] for item in extensions)
    assert all(item["approval_required"] is True for item in extensions)
