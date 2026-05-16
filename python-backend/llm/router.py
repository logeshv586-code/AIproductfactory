"""
Provider Intelligence Router.

Routes LLM work by task shape, records lightweight latency/error metrics, and
falls back through cheaper or local providers when a primary model is not
available.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from llm.provider import LLMProvider, get_provider


PROVIDER_STRATEGY: dict[str, list[str]] = {
    "planning": ["claude", "nvidia", "openai", "local"],
    "codegen": ["nvidia", "openai", "claude", "local"],
    "research": ["gemini", "claude", "nvidia", "local"],
    "vision": ["gemini", "nvidia", "local"],
    "fast": ["nvidia", "openai", "local"],
    "long_context": ["gemini", "claude", "nvidia", "local"],
    "local_fallback": ["local"],
    "general": ["nvidia", "openai", "claude", "gemini", "local"],
}


TASK_HINTS: dict[str, tuple[str, ...]] = {
    "planning": ("plan", "architecture", "dag", "roadmap", "execution"),
    "codegen": ("code", "implement", "generate", "refactor", "test"),
    "research": ("research", "paper", "arxiv", "benchmark", "literature"),
    "vision": ("vision", "image", "video", "vlm", "object detection"),
    "fast": ("quick", "classify", "extract", "summarize"),
    "long_context": ("long context", "large repo", "many files", "corpus"),
}


@dataclass
class ProviderMetric:
    provider: str
    task_type: str
    latency_ms: int
    success: bool
    error: str = ""
    ts: int = field(default_factory=lambda: int(time.time() * 1000))


class ProviderRouter:
    """Dynamic provider selection with retry, fallback, cache, and metrics."""

    def __init__(self) -> None:
        self.metrics: list[ProviderMetric] = []
        self.cache: dict[str, str] = {}

    def analyze_complexity(self, prompt: str, task_type: str | None = None) -> dict[str, Any]:
        words = prompt.split()
        inferred_task = task_type or self._infer_task_type(prompt)
        complexity = "low"
        if len(words) > 1200 or inferred_task in {"planning", "research", "long_context"}:
            complexity = "high"
        elif len(words) > 350 or inferred_task in {"codegen", "vision"}:
            complexity = "medium"

        return {
            "task_type": inferred_task,
            "complexity": complexity,
            "input_words": len(words),
            "requires_long_context": len(words) > 1200,
        }

    def select_providers(self, prompt: str, task_type: str | None = None) -> list[str]:
        analysis = self.analyze_complexity(prompt, task_type)
        return PROVIDER_STRATEGY.get(analysis["task_type"], PROVIDER_STRATEGY["general"])

    async def chat(
        self,
        messages: list[dict[str, str]],
        task_type: str | None = None,
        temperature: float = 0.5,
        max_tokens: int = 1000,
        use_cache: bool = True,
    ) -> dict[str, Any]:
        prompt = "\n".join(m.get("content", "") for m in messages)
        analysis = self.analyze_complexity(prompt, task_type)
        cache_key = f"{analysis['task_type']}:{temperature}:{max_tokens}:{prompt}"

        if use_cache and cache_key in self.cache:
            return {
                "text": self.cache[cache_key],
                "provider": "cache",
                "analysis": analysis,
                "cached": True,
            }

        errors: list[dict[str, str]] = []
        for provider_name in self.select_providers(prompt, analysis["task_type"]):
            provider = get_provider(provider_name)
            started = time.perf_counter()
            try:
                text = await provider.chat(messages, temperature=temperature, max_tokens=max_tokens)
                latency_ms = int((time.perf_counter() - started) * 1000)
                success = bool(text)
                self.metrics.append(ProviderMetric(provider_name, analysis["task_type"], latency_ms, success))
                if success:
                    if use_cache:
                        self.cache[cache_key] = text
                    return {
                        "text": text,
                        "provider": provider_name,
                        "analysis": analysis,
                        "cached": False,
                        "latency_ms": latency_ms,
                    }
                errors.append({"provider": provider_name, "error": "empty response"})
            except Exception as exc:
                latency_ms = int((time.perf_counter() - started) * 1000)
                error = str(exc)
                self.metrics.append(ProviderMetric(provider_name, analysis["task_type"], latency_ms, False, error))
                errors.append({"provider": provider_name, "error": error})

        return {
            "text": "",
            "provider": "none",
            "analysis": analysis,
            "cached": False,
            "errors": errors,
        }

    async def get_embedding(self, text: str, preferred_provider: str = "openai") -> list[float]:
        provider = get_provider(preferred_provider)
        try:
            return await provider.get_embedding(text)
        except Exception:
            return await get_provider("local").get_embedding(text)

    def get_metrics(self) -> list[dict[str, Any]]:
        return [metric.__dict__ for metric in self.metrics]

    def _infer_task_type(self, prompt: str) -> str:
        lowered = prompt.lower()
        for task_type, hints in TASK_HINTS.items():
            if any(hint in lowered for hint in hints):
                return task_type
        return "general"


class RoutedProvider(LLMProvider):
    """LLMProvider-compatible adapter backed by ProviderRouter."""

    def __init__(self, router: ProviderRouter | None = None, task_type: str = "general") -> None:
        self.router = router or get_provider_router()
        self.task_type = task_type

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.5,
        max_tokens: int = 1000,
    ) -> str:
        result = await self.router.chat(
            messages,
            task_type=self.task_type,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return result.get("text", "")

    async def get_embedding(self, text: str) -> list[float]:
        return await self.router.get_embedding(text)


_router: ProviderRouter | None = None


def get_provider_router() -> ProviderRouter:
    global _router
    if _router is None:
        _router = ProviderRouter()
    return _router


def get_routed_provider(task_type: str = "general") -> RoutedProvider:
    return RoutedProvider(get_provider_router(), task_type)
