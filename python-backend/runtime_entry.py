"""Runtime entry point for customer-configured AI Product Factory model sessions.

This module wraps the existing FastAPI app without changing the Product Factory
agents. Customers can choose a hosted provider, Ollama, LM Studio, or the
built-in deterministic local fallback, test the connection, and receive an
opaque runtime session id.

Hosted provider API keys are kept only in this Python process memory for the
session TTL. They are never returned by status APIs and are never written to
disk by this layer. Ollama and LM Studio do not require API keys.
"""

from __future__ import annotations

import asyncio
import contextvars
import ipaddress
import os
import secrets
import time
from dataclasses import dataclass
from urllib.parse import urlparse, urlunparse

import httpx
import main as base
from fastapi import Header, HTTPException, Query, Request
from pydantic import BaseModel, Field

import intelligence.pi_orchestrator as pi_orchestrator_module
import intelligence.pipeline as legacy_pi_module
from llm.base import LLMProvider, deterministic_embedding
from llm.local_provider import LocalProvider
from llm.provider import (
    AnthropicProvider,
    DeepSeekProvider,
    GeminiProvider,
    NvidiaProvider,
    OpenAIProvider,
    get_provider as environment_get_provider,
)


SESSION_TTL_SECONDS = int(os.environ.get("LLM_RUNTIME_SESSION_TTL_SECONDS", "28800"))
LOCAL_SERVER_PROVIDERS = {"ollama", "lmstudio"}
SUPPORTED_PROVIDERS = {
    "openai",
    "anthropic",
    "gemini",
    "nvidia",
    "deepseek",
    "ollama",
    "lmstudio",
    "local",
}
ALIASES = {
    "claude": "anthropic",
    "google": "gemini",
    "nim": "nvidia",
    "gpt": "openai",
    "deepseek-ai": "deepseek",
    "r1": "deepseek",
    "lm-studio": "lmstudio",
    "lm studio": "lmstudio",
}

DEFAULT_MODELS = {
    "deepseek": os.environ.get("DEEPSEEK_MODEL", "deepseek-chat"),
    "openai": os.environ.get("OPENAI_MODEL", "gpt-5-mini"),
    "anthropic": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
    "gemini": os.environ.get("GEMINI_MODEL", "gemini-3.6-flash"),
    "nvidia": os.environ.get("NVIDIA_MODEL", "openai/gpt-oss-20b"),
    "ollama": os.environ.get("OLLAMA_MODEL", ""),
    "lmstudio": os.environ.get("LMSTUDIO_MODEL", ""),
    "local": "local-deterministic",
}

DEFAULT_BASE_URLS = {
    "ollama": os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1"),
    "lmstudio": os.environ.get("LMSTUDIO_BASE_URL", "http://127.0.0.1:1234/v1"),
}


@dataclass
class RuntimeModelSession:
    provider: str
    api_key: str
    model: str
    base_url: str
    created_at: float
    expires_at: float
    last_used_at: float


class RuntimeModelRequest(BaseModel):
    provider: str = Field(
        ...,
        description="openai | anthropic | gemini | nvidia | deepseek | ollama | lmstudio | local",
    )
    api_key: str = Field(default="", description="Provider API key; not required for local providers")
    model: str = Field(default="", description="Provider model id")
    base_url: str = Field(default="", description="Optional local OpenAI-compatible base URL")


class OpenAICompatibleLocalProvider(LLMProvider):
    """Ollama/LM Studio provider through their OpenAI-compatible endpoints."""

    def __init__(self, provider_name: str, model: str, base_url: str):
        self.provider_name = provider_name
        self.model = model
        self.base_url = base_url.rstrip("/")
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from openai import AsyncOpenAI

            # OpenAI SDK requires a key string. Ollama ignores it and LM Studio
            # does not require one unless the user explicitly enabled auth.
            self._client = AsyncOpenAI(
                api_key="local-ai-product-factory",
                base_url=self.base_url,
            )
        return self._client

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.5,
        max_tokens: int = 1000,
        enable_thinking: bool | None = None,
    ) -> str:
        try:
            kwargs = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            response = await self.client.chat.completions.create(**kwargs)
            choice = response.choices[0] if response.choices else None
            if not choice:
                return ""
            message = choice.message
            content = getattr(message, "content", None)
            if not content:
                content = getattr(message, "reasoning_content", None)
            if not content and getattr(message, "model_extra", None):
                content = message.model_extra.get("reasoning_content") or message.model_extra.get("reasoning")
            return (content or "").strip()
        except Exception as exc:
            print(f"[{self.provider_name}] local chat error: {exc}")
            return ""

    async def get_embedding(self, text: str) -> list[float]:
        # A chat model is not guaranteed to expose embeddings. Keep local model
        # execution self-contained while preserving the existing deterministic
        # semantic fallback used by the Product Factory.
        return deterministic_embedding(text)


_sessions: dict[str, RuntimeModelSession] = {}
_current_session_id: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "ai_product_factory_llm_session",
    default=None,
)


def _canonical_provider(value: str | None) -> str:
    name = (value or "").strip().lower()
    return ALIASES.get(name, name)


def _allow_remote_local_llm() -> bool:
    return os.environ.get("LOCAL_LLM_ALLOW_REMOTE_BASE_URLS", "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _is_loopback_host(hostname: str) -> bool:
    if hostname.lower() == "localhost":
        return True
    try:
        return ipaddress.ip_address(hostname).is_loopback
    except ValueError:
        return False


def _normalize_local_base_url(provider_name: str, value: str | None) -> str:
    provider = _canonical_provider(provider_name)
    if provider not in LOCAL_SERVER_PROVIDERS:
        return ""

    raw = (value or DEFAULT_BASE_URLS[provider]).strip().rstrip("/")
    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("Local model base URL must be a valid http:// or https:// URL.")
    if parsed.username or parsed.password:
        raise ValueError("Credentials are not allowed inside the local model base URL.")
    if not _allow_remote_local_llm() and not _is_loopback_host(parsed.hostname):
        raise ValueError(
            "For safety, Ollama and LM Studio URLs must use localhost/loopback. "
            "Set LOCAL_LLM_ALLOW_REMOTE_BASE_URLS=1 only when you intentionally trust a LAN server."
        )

    path = parsed.path.rstrip("/")
    if not path:
        path = "/v1"
    normalized = parsed._replace(path=path, params="", query="", fragment="")
    return urlunparse(normalized).rstrip("/")


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


def _model_role_scores(model_name: str) -> tuple[int, int, int]:
    name = model_name.lower()
    reasoning = 0
    building = 0

    for token, score in (
        ("gpt-oss", 100),
        ("deepseek-r1", 96),
        ("qwen3", 92),
        ("qwq", 90),
        ("reason", 84),
        ("llama", 74),
        ("gemma3", 70),
    ):
        if token in name:
            reasoning = max(reasoning, score)

    for token, score in (
        ("qwen3-coder", 100),
        ("qwen2.5-coder", 98),
        ("devstral", 97),
        ("deepseek-coder", 96),
        ("gpt-oss", 94),
        ("coder", 90),
        ("codestral", 90),
    ):
        if token in name:
            building = max(building, score)

    balanced = round((reasoning * 0.55) + (building * 0.45))
    if balanced == 0:
        balanced = 50
    return reasoning, building, balanced


def _recommend_local_models(models: list[str]) -> list[dict[str, str]]:
    clean = list(dict.fromkeys(model.strip() for model in models if model and model.strip()))
    if not clean:
        return []

    scored = [(model, *_model_role_scores(model)) for model in clean]
    roles = [
        ("Research & reasoning", 1, "Best installed match for deeper research synthesis and multi-step reasoning."),
        ("Product building", 2, "Best installed match for architecture, implementation planning and code-heavy product work."),
        ("Balanced", 3, "Best installed all-round choice for research plus product creation."),
    ]

    output: list[dict[str, str]] = []
    used: set[str] = set()
    for role, score_index, why in roles:
        ranked = sorted(scored, key=lambda item: (item[score_index], item[3], item[0]), reverse=True)
        selected = next((item[0] for item in ranked if item[0] not in used), ranked[0][0])
        used.add(selected)
        output.append({"role": role, "model": selected, "why": why})
    return output


async def _list_local_models(provider_name: str, base_url: str) -> list[str]:
    provider = _canonical_provider(provider_name)
    normalized = _normalize_local_base_url(provider, base_url)
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            response = await client.get(f"{normalized}/models")
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Could not reach {provider}. Start the local server and try again. "
                f"({type(exc).__name__})"
            ),
        ) from exc

    data = payload.get("data", []) if isinstance(payload, dict) else []
    models = [str(item.get("id", "")).strip() for item in data if isinstance(item, dict)]
    return [model for model in models if model]


def _provider_for(provider_name: str, api_key: str, model: str, base_url: str = "") -> LLMProvider:
    name = _canonical_provider(provider_name)
    resolved_model = model.strip() or DEFAULT_MODELS.get(name, "")
    if name == "local":
        return LocalProvider()
    if name in LOCAL_SERVER_PROVIDERS:
        if not resolved_model:
            raise ValueError("Choose an installed local model before continuing.")
        normalized_base_url = _normalize_local_base_url(name, base_url)
        return OpenAICompatibleLocalProvider(name, resolved_model, normalized_base_url)
    if not api_key.strip():
        raise ValueError("An API key is required for the selected provider.")
    if not resolved_model:
        raise ValueError("A model id is required for the selected provider.")
    if name == "deepseek":
        return DeepSeekProvider(api_key=api_key.strip(), model=resolved_model)
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
        return _provider_for(item.provider, item.api_key, item.model, item.base_url)
    return environment_get_provider(provider_name)


# Patch only the provider resolver references used by the existing orchestration
# entry points. Agents continue to receive the same LLMProvider abstraction.
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


async def _test_connection(provider_name: str, api_key: str, model: str, base_url: str = "") -> str:
    name = _canonical_provider(provider_name)
    if name == "local":
        return "Local deterministic provider is ready."

    provider = _provider_for(name, api_key, model, base_url)
    try:
        response = await asyncio.wait_for(
            provider.chat(
                [
                    {"role": "system", "content": "Reply with exactly READY."},
                    {"role": "user", "content": "Connection test."},
                ],
                temperature=0.0,
                max_tokens=128,
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
        if name in LOCAL_SERVER_PROVIDERS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"{name} returned no response. Confirm the local server is running and the selected model is loaded."
                ),
            )
        raise HTTPException(
            status_code=400,
            detail="The provider returned no response. Check the API key, model id, account quota and model access.",
        )
    return response.strip()[:120]


@app.get("/llm/runtime/models")
async def list_runtime_models(
    provider: str = Query(...),
    base_url: str = Query(default=""),
):
    name = _canonical_provider(provider)
    if name not in LOCAL_SERVER_PROVIDERS:
        raise HTTPException(status_code=400, detail="Model discovery is available for Ollama and LM Studio only.")
    normalized_base_url = _normalize_local_base_url(name, base_url)
    models = await _list_local_models(name, normalized_base_url)
    return {
        "success": True,
        "provider": name,
        "baseUrl": normalized_base_url,
        "models": models,
        "recommendations": _recommend_local_models(models),
        "count": len(models),
    }


@app.post("/llm/runtime/configure")
async def configure_runtime_model(request: RuntimeModelRequest):
    provider = _canonical_provider(request.provider)
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported provider. Choose one of: {', '.join(sorted(SUPPORTED_PROVIDERS))}",
        )

    api_key = request.api_key.strip()
    base_url = _normalize_local_base_url(provider, request.base_url) if provider in LOCAL_SERVER_PROVIDERS else ""
    model = request.model.strip() or DEFAULT_MODELS[provider]

    if provider in LOCAL_SERVER_PROVIDERS and not model:
        models = await _list_local_models(provider, base_url)
        if not models:
            raise HTTPException(
                status_code=400,
                detail="No local models were found. Download/load a model, then click Discover models again.",
            )
        recommendations = _recommend_local_models(models)
        balanced = next((item["model"] for item in recommendations if item["role"] == "Balanced"), "")
        model = balanced or models[0]

    if provider not in LOCAL_SERVER_PROVIDERS and provider != "local" and not api_key:
        raise HTTPException(status_code=400, detail="API key is required.")

    test_message = await _test_connection(provider, api_key, model, base_url)
    now = time.time()
    session_id = secrets.token_urlsafe(32)
    _sessions[session_id] = RuntimeModelSession(
        provider=provider,
        api_key=api_key,
        model=model,
        base_url=base_url,
        created_at=now,
        expires_at=now + SESSION_TTL_SECONDS,
        last_used_at=now,
    )

    return {
        "success": True,
        "sessionId": session_id,
        "provider": provider,
        "model": model,
        "baseUrl": base_url or None,
        "localExecution": provider in LOCAL_SERVER_PROVIDERS or provider == "local",
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
        "baseUrl": item.base_url or None,
        "localExecution": item.provider in LOCAL_SERVER_PROVIDERS or item.provider == "local",
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
