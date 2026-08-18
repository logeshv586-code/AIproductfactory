"""Unified LLM providers for AI Product Factory.

Supported runtime providers:
- NVIDIA NIM / NVIDIA hosted OpenAI-compatible APIs
- OpenAI
- Anthropic Claude
- Google Gemini (Google GenAI SDK)
- deterministic local fallback for CI/offline development

`LLM_PROVIDER=auto` enables provider failover using `LLM_PROVIDER_ORDER`.
Explicit provider values are also supported: nvidia, openai, anthropic/claude,
gemini, local.
"""

from __future__ import annotations

import asyncio
import os
from typing import Any, Optional

from llm.base import LLMProvider, deterministic_embedding
from llm.local_provider import LocalProvider


PROVIDER_ALIASES = {
    "claude": "anthropic",
    "anthropic": "anthropic",
    "google": "gemini",
    "gemini": "gemini",
    "gpt": "openai",
    "openai": "openai",
    "nim": "nvidia",
    "nvidia": "nvidia",
    "local": "local",
    "auto": "auto",
}

PROVIDER_ENV = {
    "nvidia": "NVIDIA_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "gemini": "GEMINI_API_KEY",
}

DEFAULT_PROVIDER_ORDER = ["nvidia", "openai", "anthropic", "gemini"]


def _canonical_provider_name(name: str | None) -> str:
    value = (name or "").strip().lower()
    return PROVIDER_ALIASES.get(value, value or "local")


def _configured(provider_name: str) -> bool:
    env_name = PROVIDER_ENV.get(provider_name)
    return provider_name == "local" or bool(env_name and os.environ.get(env_name))


def _provider_order() -> list[str]:
    configured_order = os.environ.get("LLM_PROVIDER_ORDER", "")
    candidates = configured_order.split(",") if configured_order else DEFAULT_PROVIDER_ORDER
    output: list[str] = []
    for candidate in candidates:
        name = _canonical_provider_name(candidate)
        if name in PROVIDER_ENV and name not in output:
            output.append(name)
    return output or list(DEFAULT_PROVIDER_ORDER)


class OpenAIProvider(LLMProvider):
    """OpenAI chat + native embeddings."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        self.model = model or os.environ.get("OPENAI_MODEL", "gpt-5-mini")
        self.embedding_model = os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
        self.base_url = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url or None,
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
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            print(f"[OpenAI] chat error: {exc}")
            return ""

    async def get_embedding(self, text: str) -> list[float]:
        try:
            response = await self.client.embeddings.create(
                model=self.embedding_model,
                input=text,
            )
            vector = list(response.data[0].embedding)
            return vector if vector else deterministic_embedding(text)
        except Exception as exc:
            print(f"[OpenAI] embedding fallback: {exc}")
            return deterministic_embedding(text)


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider with provider-independent local embeddings."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY", "")
        self.model = model or os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
        self.base_url = os.environ.get("ANTHROPIC_BASE_URL", "")
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from anthropic import AsyncAnthropic

            kwargs: dict[str, Any] = {"api_key": self.api_key}
            if self.base_url:
                kwargs["base_url"] = self.base_url
            self._client = AsyncAnthropic(**kwargs)
        return self._client

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.5,
        max_tokens: int = 1000,
        enable_thinking: bool | None = None,
    ) -> str:
        try:
            system_parts: list[str] = []
            user_messages: list[dict[str, str]] = []
            for message in messages:
                role = message.get("role", "user")
                content = message.get("content", "")
                if role == "system":
                    if content:
                        system_parts.append(content)
                    continue
                user_messages.append({
                    "role": "assistant" if role == "assistant" else "user",
                    "content": content,
                })

            kwargs: dict[str, Any] = {
                "model": self.model,
                "messages": user_messages or [{"role": "user", "content": "Continue."}],
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if system_parts:
                kwargs["system"] = "\n\n".join(system_parts)

            response = await self.client.messages.create(**kwargs)
            chunks = [getattr(block, "text", "") for block in (response.content or [])]
            return "".join(chunk for chunk in chunks if chunk)
        except Exception as exc:
            print(f"[Anthropic] chat error: {exc}")
            return ""

    async def get_embedding(self, text: str) -> list[float]:
        # Anthropic does not expose a native embeddings API. Do not silently
        # require an OpenAI key: keep Anthropic-only deployments self-contained.
        return deterministic_embedding(text)


# Backward-compatible class name used by older code/configuration.
ClaudeProvider = AnthropicProvider


class GeminiProvider(LLMProvider):
    """Google Gemini provider using the current Google GenAI SDK."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY", "")
        self.model = model or os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
        self.embedding_model = os.environ.get("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from google import genai

            self._client = genai.Client(api_key=self.api_key)
        return self._client

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.5,
        max_tokens: int = 1000,
        enable_thinking: bool | None = None,
    ) -> str:
        try:
            from google.genai import types

            system_parts = [
                message.get("content", "")
                for message in messages
                if message.get("role") == "system" and message.get("content")
            ]
            contents = [
                types.Content(
                    role="model" if message.get("role") == "assistant" else "user",
                    parts=[types.Part(text=message.get("content", ""))],
                )
                for message in messages
                if message.get("role") != "system"
            ]
            config = types.GenerateContentConfig(
                system_instruction="\n\n".join(system_parts) if system_parts else None,
                temperature=temperature,
                max_output_tokens=max_tokens,
            )
            response = await self.client.aio.models.generate_content(
                model=self.model,
                contents=contents or "Continue.",
                config=config,
            )
            return response.text or ""
        except Exception as exc:
            print(f"[Gemini] chat error: {exc}")
            return ""

    async def get_embedding(self, text: str) -> list[float]:
        try:
            from google.genai import types

            result = await self.client.aio.models.embed_content(
                model=self.embedding_model,
                contents=text,
                config=types.EmbedContentConfig(
                    task_type="RETRIEVAL_DOCUMENT",
                    output_dimensionality=1536,
                ),
            )
            embeddings = getattr(result, "embeddings", None) or []
            if embeddings:
                vector = list(getattr(embeddings[0], "values", None) or [])
                if vector:
                    return vector
        except Exception as exc:
            print(f"[Gemini] embedding fallback: {exc}")
        return deterministic_embedding(text)


class NvidiaProvider(LLMProvider):
    """NVIDIA NIM/hosted provider through its OpenAI-compatible chat API."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or os.environ.get("NVIDIA_API_KEY", "")
        self.model = model or os.environ.get("NVIDIA_MODEL", "openai/gpt-oss-20b")
        self.base_url = os.environ.get("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        return self._client

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.5,
        max_tokens: int = 1000,
        enable_thinking: bool | None = None,
    ) -> str:
        try:
            kwargs: dict[str, Any] = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "top_p": 1,
            }
            thinking_env = os.environ.get("NVIDIA_THINKING", "").strip().lower()
            thinking: bool | None = enable_thinking
            if thinking is None and thinking_env in {"1", "true", "yes", "on"}:
                thinking = True
            elif thinking is None and thinking_env in {"0", "false", "no", "off"}:
                thinking = False
            # Do not send NVIDIA/model-specific chat-template flags unless the
            # operator explicitly requests them. This keeps generic NIM models
            # compatible with the same provider implementation.
            if thinking is not None:
                kwargs["extra_body"] = {
                    "chat_template_kwargs": {
                        "enable_thinking": thinking,
                        "clear_thinking": False,
                    }
                }

            response = await self.client.chat.completions.create(**kwargs)
            return response.choices[0].message.content or ""
        except Exception as exc:
            print(f"[NVIDIA] chat error: {exc}")
            return ""

    async def get_embedding(self, text: str) -> list[float]:
        # NIM chat deployments do not universally expose an embedding endpoint.
        # Keep the Product Factory executable with a provider-independent local
        # fallback rather than returning an all-zero vector.
        return deterministic_embedding(text)


class ResilientProvider(LLMProvider):
    """Wrap one remote provider with timeout and deterministic local fallback."""

    def __init__(
        self,
        primary: LLMProvider,
        fallback: Optional[LLMProvider] = None,
        timeout_seconds: float = 90.0,
    ):
        self.primary = primary
        self.fallback = fallback or LocalProvider()
        self.timeout_seconds = timeout_seconds

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.5,
        max_tokens: int = 1000,
        enable_thinking: bool | None = None,
    ) -> str:
        try:
            text = await asyncio.wait_for(
                self.primary.chat(
                    messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    enable_thinking=enable_thinking,
                ),
                timeout=self.timeout_seconds,
            )
            if text:
                return text
        except Exception as exc:
            print(f"[ResilientProvider] primary chat fallback: {exc}")
        return await self.fallback.chat(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            enable_thinking=enable_thinking,
        )

    async def get_embedding(self, text: str) -> list[float]:
        try:
            vector = await asyncio.wait_for(
                self.primary.get_embedding(text),
                timeout=self.timeout_seconds,
            )
            if vector and any(value != 0 for value in vector):
                return vector
        except Exception as exc:
            print(f"[ResilientProvider] primary embedding fallback: {exc}")
        return await self.fallback.get_embedding(text)


class ProviderPool(LLMProvider):
    """Automatic failover across every configured remote provider."""

    def __init__(
        self,
        providers: list[tuple[str, LLMProvider]],
        fallback: Optional[LLMProvider] = None,
        timeout_seconds: float = 90.0,
    ):
        self.providers = providers
        self.fallback = fallback or LocalProvider()
        self.timeout_seconds = timeout_seconds
        self.last_provider = "local"

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.5,
        max_tokens: int = 1000,
        enable_thinking: bool | None = None,
    ) -> str:
        for name, provider in self.providers:
            try:
                text = await asyncio.wait_for(
                    provider.chat(
                        messages,
                        temperature=temperature,
                        max_tokens=max_tokens,
                        enable_thinking=enable_thinking,
                    ),
                    timeout=self.timeout_seconds,
                )
                if text:
                    self.last_provider = name
                    return text
            except Exception as exc:
                print(f"[ProviderPool] {name} chat failed: {exc}")
        self.last_provider = "local"
        return await self.fallback.chat(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            enable_thinking=enable_thinking,
        )

    async def get_embedding(self, text: str) -> list[float]:
        # Prefer native embedding providers first regardless of chat order.
        native_first = sorted(
            self.providers,
            key=lambda item: 0 if item[0] in {"openai", "gemini"} else 1,
        )
        for name, provider in native_first:
            try:
                vector = await asyncio.wait_for(
                    provider.get_embedding(text),
                    timeout=self.timeout_seconds,
                )
                if vector and any(value != 0 for value in vector):
                    self.last_provider = name
                    return vector
            except Exception as exc:
                print(f"[ProviderPool] {name} embedding failed: {exc}")
        self.last_provider = "local"
        return await self.fallback.get_embedding(text)


def _build_remote(provider_name: str) -> LLMProvider:
    name = _canonical_provider_name(provider_name)
    if name == "nvidia":
        return NvidiaProvider()
    if name == "openai":
        return OpenAIProvider()
    if name == "anthropic":
        return AnthropicProvider()
    if name == "gemini":
        return GeminiProvider()
    raise ValueError(f"Unsupported remote provider: {provider_name}")


def get_provider_status() -> dict[str, Any]:
    """Return configuration/model metadata without exposing any API keys."""
    models = {
        "nvidia": os.environ.get("NVIDIA_MODEL", "openai/gpt-oss-20b"),
        "openai": os.environ.get("OPENAI_MODEL", "gpt-5-mini"),
        "anthropic": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
        "gemini": os.environ.get("GEMINI_MODEL", "gemini-3.6-flash"),
    }
    return {
        "mode": _canonical_provider_name(os.environ.get("LLM_PROVIDER", "auto")),
        "order": _provider_order(),
        "providers": {
            name: {
                "configured": _configured(name),
                "model": models[name],
                "chat": True,
                "native_embeddings": name in {"openai", "gemini"},
                "local_embedding_fallback": True,
            }
            for name in ["nvidia", "openai", "anthropic", "gemini"]
        },
    }


def get_provider(provider_name: Optional[str] = None) -> LLMProvider:
    """Return the configured provider or an automatic multi-provider pool."""
    name = _canonical_provider_name(provider_name or os.environ.get("LLM_PROVIDER", "auto"))

    if name == "auto":
        providers = [
            (candidate, _build_remote(candidate))
            for candidate in _provider_order()
            if _configured(candidate)
        ]
        return ProviderPool(providers) if providers else LocalProvider()

    if name == "local":
        return LocalProvider()

    if name in PROVIDER_ENV:
        if not _configured(name):
            return LocalProvider()
        return ResilientProvider(_build_remote(name))

    return LocalProvider()
