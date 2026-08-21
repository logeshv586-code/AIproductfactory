import asyncio

import pytest
from fastapi import HTTPException

import runtime_entry as runtime
from llm.local_provider import LocalProvider


def test_local_runtime_session_binds_provider_and_hides_secret():
    request = runtime.RuntimeModelRequest(
        provider="local",
        api_key="",
        model="local-deterministic",
    )
    configured = asyncio.run(runtime.configure_runtime_model(request))

    assert configured["success"] is True
    assert configured["provider"] == "local"
    assert configured["model"] == "local-deterministic"
    assert configured["localExecution"] is True
    assert configured["secretPersistence"] == "memory-only"
    assert "api_key" not in configured
    assert "apiKey" not in configured

    session_id = configured["sessionId"]
    token = runtime._current_session_id.set(session_id)
    try:
        provider = runtime.runtime_get_provider()
        assert isinstance(provider, LocalProvider)
    finally:
        runtime._current_session_id.reset(token)

    status = asyncio.run(runtime.runtime_model_status(session_id))
    assert status["configured"] is True
    assert status["provider"] == "local"
    assert status["model"] == "local-deterministic"
    assert "api_key" not in status
    assert "apiKey" not in status

    asyncio.run(runtime.clear_runtime_model(session_id))
    cleared = asyncio.run(runtime.runtime_model_status(session_id))
    assert cleared == {"success": False, "configured": False}


def test_remote_runtime_session_requires_api_key():
    request = runtime.RuntimeModelRequest(
        provider="openai",
        api_key="",
        model="gpt-5-mini",
    )

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(runtime.configure_runtime_model(request))

    assert exc_info.value.status_code == 400
    assert "API key" in str(exc_info.value.detail)


def test_ollama_runtime_session_needs_no_api_key_and_keeps_local_url(monkeypatch):
    async def fake_test_connection(provider_name, api_key, model, base_url=""):
        assert provider_name == "ollama"
        assert api_key == ""
        assert model == "qwen3:8b"
        assert base_url == "http://127.0.0.1:11434/v1"
        return "READY"

    monkeypatch.setattr(runtime, "_test_connection", fake_test_connection)
    request = runtime.RuntimeModelRequest(
        provider="ollama",
        model="qwen3:8b",
        base_url="http://127.0.0.1:11434",
    )
    configured = asyncio.run(runtime.configure_runtime_model(request))

    assert configured["success"] is True
    assert configured["provider"] == "ollama"
    assert configured["model"] == "qwen3:8b"
    assert configured["baseUrl"] == "http://127.0.0.1:11434/v1"
    assert configured["localExecution"] is True
    assert "apiKey" not in configured

    token = runtime._current_session_id.set(configured["sessionId"])
    try:
        provider = runtime.runtime_get_provider()
        assert isinstance(provider, runtime.OpenAICompatibleLocalProvider)
        assert provider.provider_name == "ollama"
        assert provider.model == "qwen3:8b"
        assert provider.base_url == "http://127.0.0.1:11434/v1"
    finally:
        runtime._current_session_id.reset(token)
        asyncio.run(runtime.clear_runtime_model(configured["sessionId"]))


def test_lm_studio_alias_and_default_port_are_supported(monkeypatch):
    async def fake_test_connection(provider_name, api_key, model, base_url=""):
        assert provider_name == "lmstudio"
        assert api_key == ""
        assert model == "local/reasoning-model"
        assert base_url == "http://127.0.0.1:1234/v1"
        return "READY"

    monkeypatch.setattr(runtime, "_test_connection", fake_test_connection)
    request = runtime.RuntimeModelRequest(
        provider="lm-studio",
        model="local/reasoning-model",
        base_url="http://127.0.0.1:1234/v1/",
    )
    configured = asyncio.run(runtime.configure_runtime_model(request))

    assert configured["provider"] == "lmstudio"
    assert configured["baseUrl"] == "http://127.0.0.1:1234/v1"
    assert configured["localExecution"] is True
    asyncio.run(runtime.clear_runtime_model(configured["sessionId"]))


def test_local_model_url_blocks_non_loopback_by_default(monkeypatch):
    monkeypatch.delenv("LOCAL_LLM_ALLOW_REMOTE_BASE_URLS", raising=False)
    with pytest.raises(ValueError) as exc_info:
        runtime._normalize_local_base_url("ollama", "http://192.168.1.25:11434/v1")
    assert "localhost/loopback" in str(exc_info.value)


def test_local_model_url_can_allow_trusted_lan_when_explicit(monkeypatch):
    monkeypatch.setenv("LOCAL_LLM_ALLOW_REMOTE_BASE_URLS", "1")
    result = runtime._normalize_local_base_url("lmstudio", "http://192.168.1.25:1234")
    assert result == "http://192.168.1.25:1234/v1"


def test_local_model_recommendations_rank_reasoning_and_coding_models():
    recommendations = runtime._recommend_local_models([
        "tiny-general-model",
        "qwen2.5-coder:7b",
        "qwen3:8b",
        "gpt-oss:20b",
    ])
    by_role = {item["role"]: item["model"] for item in recommendations}

    assert by_role["Research & reasoning"] == "gpt-oss:20b"
    assert by_role["Product building"] == "qwen2.5-coder:7b"
    assert by_role["Balanced"] in {"qwen3:8b", "gpt-oss:20b"}
