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
