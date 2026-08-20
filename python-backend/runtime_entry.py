"""Runtime entry point for customer-configured AI Product Factory model sessions.

This module wraps the existing FastAPI app without changing the Product Factory
agents. A customer can choose one supported provider, supply an API key and
model id, test the connection, and receive an opaque runtime session id.

The raw API key is kept only in this Python process memory for the session TTL.
It is never returned by status APIs and is never written to disk by this layer.
Requests carrying ``X-LLM-Session`` make the existing Product Intelligence and
approved-build paths resolve that exact provider/model instead of the server's
default environment configuration.
"""

from __future__ import annotations

import asyncio
import contextvars
import os
import secrets
import time
from dataclasses import dataclass
from typing import Any

import main as base
from fastapi import Header, HTTPException, Request
from pydantic import BaseModel, Field

import intelligence.pi_orchestrator as pi_orchestrator_module
import intelligence.pipeline as legacy_pi_module
from llm.base import LLMProvider
from llm.local_provider import LocalProvider
from llm.provider import (
    AnthropicProvider,
    GeminiProvider,
    NvidiaProvider,
    OpenAIProvider,
    get_provider as environment_get_provider,
)


SESSION_TTL_SECONDS = int(os.environ.get("LLM_RUNTIME_SESSION_TTL_SECONDS", "28800"))
SUPPORTED_PROVIDERS = {"openai", "anthropic", "gemini", "nvidia", "local"}
ALIASES = {"claude": "anthropic", "google": "gemini", "nim": "nvidia", "gpt": "openai"}

DEFAULT_MODELS = {
    "openai": os.environ.get("OPENAI_MODEL", "gpt-5-mini"),
    "anthropic": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
    "gemini": os.environ.get("GEMINI_MODEL", "gemini-3.6-flash"),
    "nvidia": os.environ.get("NVIDIA_MODEL", "openai/gpt-oss-20b"),
    "local": "local-deterministic",
}


@dataclass
class RuntimeModelSession:
    provider: str
    api_key: str
    model: str
    created_at: float
    expires_at: float
    last_used_at: float


class RuntimeModelRequest(BaseModel):
    provider: str = Field(..., description="openai | anthropic | gemini | nvidia | local")
    api_key: str = Field(default="", description="Provider API key; not required for local mode")
    model: str = Field(default="", description="Provider model id")


_sessions: dict[str, RuntimeModelSession] = {}
_current_session_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "ai_product_factory_llm_session",
    default=None,
)


def _canonical_provider(value: str | None) -> str:
    name = (value or "").strip().lower()
    return ALIASES.get(name, name)


def _purge_expired_sessions() -> None:
    now = time.time()
    expired = [session_id for session_id, item in _sessions.items() if item.expires_at <= now]
    for session_id in expired:
        _sessions.pop(session_id, None)


def _session(session_id: str | None) -> RuntimeModelSession | None:
    _purge_expired_sessions()
    if not session_id:
        return None
    item = _sessions.get(session_id)
    if item:
        item.last_used_at = time.time()
    return item


def _provider_for(provider_name: str, api_key: str, model: str) -> LLMProvider:
    name = _canonical_provider(provider_name)
    resolved_model = model.strip() or DEFAULT_MODELS.get(name, "")
    if name == "local":
        return LocalProvider()
    if not api_key.strip():
        raise ValueError("An API key is required for the selected provider.")
    if not resolved_model:
        raise ValueError("A model id is required for the selected provider.")
    if name == "openai":
        return OpenAIProvider(api_key=api_key.strip(), model=resolved_model)
    if name == "anthropic":
        return AnthropicProvider(api_key=api_key.strip(), model=resolved_model)
    if name == "gemini":
        return GeminiProvider(api_key=api_key.strip(), model=resolved_model)
    if name == "nvidia":
        return NvidiaProvider(api_key=api_key.strip(), model=resolved_model)
    raise ValueError(f"Unsupported provider: {provider_name}")


def runtime_get_provider(provider_name: str | None = None) -> LLMProvider:
    """Resolve the request-bound customer provider, or fall back to env config."""
    session_id = _current_session_id.get()
    item = _session(session_id)
    if item:
        return _provider_for(item.provider, item.api_key, item.model)
    return environment_get_provider(provider_name)


# Patch only the provider resolver references used by the existing orchestration
# entry points. The agents themselves remain unchanged and continue to receive a
# normal LLMProvider instance.
base.get_provider = runtime_get_provider
pi_orchestrator_module.get_provider = runtime_get_provider
legacy_pi_module.get_provider = runtime_get_provider

app = base.app


@app.middleware("http")
async def bind_runtime_llm_session(request: Request, call_next):
    session_id = request.headers.get("x-llm-session")
    token = _current_session_id.set(session_id)
    try:
        return await call_next(request)
    finally:
        _current_session_id.reset(token)


async def _test_connection(provider_name: str, api_key: str, model: str) -> str:
    name = _canonical_provider(provider_name)
    if name == "local":
        return "Local deterministic provider is ready."

    provider = _provider_for(name, api_key, model)
    try:
        response = await asyncio.wait_for(
            provider.chat(
                [
                    {"role": "system", "content": "Reply with exactly READY."},
                    {"role": "user", "content": "Connection test."},
                ],
                temperature=0.0,
                max_tokens=16,
            ),
            timeout=45,
        )
    except asyncio.TimeoutError as exc:
        raise HTTPException(
            status_code=408,
            detail="Model connection timed out. Check provider availability and model access.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Model connection failed: {type(exc).__name__}",
        ) from exc

    if not response or not response.strip():
        # Existing provider adapters intentionally swallow SDK details so API
        # keys can never leak through error messages. Keep this message generic.
        raise HTTPException(
            status_code=400,
            detail="The provider returned no response. Check the API key, model id, account quota and model access.",
        )
    return response.strip()[:120]


@app.post("/llm/runtime/configure")
async def configure_runtime_model(request: RuntimeModelRequest):
    provider = _canonical_provider(request.provider)
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported provider. Choose one of: {', '.join(sorted(SUPPORTED_PROVIDERS))}",
        )

    model = request.model.strip() or DEFAULT_MODELS[provider]
    api_key = request.api_key.strip()
    if provider != "local" and not api_key:
        raise HTTPException(status_code=400, detail="API key is required.")

    test_message = await _test_connection(provider, api_key, model)
    now = time.time()
    session_id = secrets.token_urlsafe(32)
    _sessions[session_id] = RuntimeModelSession(
        provider=provider,
        api_key=api_key,
        model=model,
        created_at=now,
        expires_at=now + SESSION_TTL_SECONDS,
        last_used_at=now,
    )

    return {
        "success": True,
        "sessionId": session_id,
        "provider": provider,
        "model": model,
        "tested": True,
        "testMessage": test_message,
        "expiresInSeconds": SESSION_TTL_SECONDS,
        "secretPersistence": "memory-only",
    }


@app.get("/llm/runtime/status")
async def runtime_model_status(x_llm_session: str | None = Header(default=None)):
    item = _session(x_llm_session)
    if not item:
        return {"success": False, "configured": False}
    now = time.time()
    return {
        "success": True,
        "configured": True,
        "provider": item.provider,
        "model": item.model,
        "tested": True,
        "expiresInSeconds": max(0, int(item.expires_at - now)),
        "secretPersistence": "memory-only",
    }


@app.delete("/llm/runtime/session")
async def clear_runtime_model(x_llm_session: str | None = Header(default=None)):
    if x_llm_session:
        _sessions.pop(x_llm_session, None)
    return {"success": True, "configured": False}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PYTHON_BACKEND_PORT", "8001"))
    print(f"[AI Product Builder] Runtime model sessions enabled on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
