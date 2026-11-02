from __future__ import annotations

import asyncio
from types import SimpleNamespace

from llm.base import LLMProvider
from llm.provider import (
    AnthropicProvider,
    CircuitBreaker,
    DeepSeekProvider,
    GeminiProvider,
    NvidiaProvider,
    OpenAIProvider,
    ProviderPool,
    ResilientProvider,
    get_provider,
    get_provider_status,
)


class FakeChatCompletions:
    def __init__(self, text: str):
        self.text = text
        self.calls: list[dict] = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=self.text))]
        )


class FakeEmbeddings:
    def __init__(self, vector: list[float]):
        self.vector = vector
        self.calls: list[dict] = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(data=[SimpleNamespace(embedding=self.vector)])


class FakeOpenAIClient:
    def __init__(self, text: str, vector: list[float] | None = None):
        self.completions = FakeChatCompletions(text)
        self.chat = SimpleNamespace(completions=self.completions)
        self.embeddings = FakeEmbeddings(vector or [0.1, 0.2, 0.3])


class FakeAnthropicMessages:
    def __init__(self):
        self.calls: list[dict] = []

    async def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(content=[SimpleNamespace(text="anthropic-ok")])


class FakeAnthropicClient:
    def __init__(self):
        self.messages = FakeAnthropicMessages()


class FakeGeminiModels:
    def __init__(self):
        self.generate_calls: list[dict] = []
        self.embed_calls: list[dict] = []

    async def generate_content(self, **kwargs):
        self.generate_calls.append(kwargs)
        return SimpleNamespace(text="gemini-ok")

    async def embed_content(self, **kwargs):
        self.embed_calls.append(kwargs)
        return SimpleNamespace(embeddings=[SimpleNamespace(values=[0.4, 0.5, 0.6])])


class FakeGeminiClient:
    def __init__(self):
        self.models = FakeGeminiModels()
        self.aio = SimpleNamespace(models=self.models)


class StubProvider(LLMProvider):
    def __init__(self, text: str = "", embedding: list[float] | None = None):
        self.text = text
        self.embedding = embedding or []

    async def chat(self, messages, temperature=0.5, max_tokens=1000, enable_thinking=None):
        return self.text

    async def get_embedding(self, text: str) -> list[float]:
        return self.embedding


def test_openai_adapter_chat_and_embeddings(monkeypatch):
    monkeypatch.setenv("OPENAI_MODEL", "test-openai-model")
    monkeypatch.setenv("OPENAI_EMBEDDING_MODEL", "test-openai-embedding")
    provider = OpenAIProvider(api_key="test")
    fake = FakeOpenAIClient("openai-ok", [0.1, 0.2])
    provider._client = fake

    async def run():
        text = await provider.chat([{"role": "user", "content": "hello"}], max_tokens=50)
        vector = await provider.get_embedding("hello")
        return text, vector

    text, vector = asyncio.run(run())
    assert text == "openai-ok"
    assert vector == [0.1, 0.2]
    assert fake.completions.calls[0]["model"] == "test-openai-model"
    assert fake.embeddings.calls[0]["model"] == "test-openai-embedding"


def test_anthropic_adapter_is_independent_of_openai(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_MODEL", "test-claude-model")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    provider = AnthropicProvider(api_key="test")
    fake = FakeAnthropicClient()
    provider._client = fake

    async def run():
        text = await provider.chat([
            {"role": "system", "content": "system rules"},
            {"role": "user", "content": "hello"},
        ])
        vector = await provider.get_embedding("hello")
        return text, vector

    text, vector = asyncio.run(run())
    assert text == "anthropic-ok"
    assert len(vector) == 1536
    assert any(value != 0 for value in vector)
    assert fake.messages.calls[0]["model"] == "test-claude-model"
    assert fake.messages.calls[0]["system"] == "system rules"


def test_gemini_adapter_uses_google_genai_chat_and_embedding(monkeypatch):
    monkeypatch.setenv("GEMINI_MODEL", "test-gemini-model")
    monkeypatch.setenv("GEMINI_EMBEDDING_MODEL", "test-gemini-embedding")
    provider = GeminiProvider(api_key="test")
    fake = FakeGeminiClient()
    provider._client = fake

    async def run():
        text = await provider.chat([
            {"role": "system", "content": "system rules"},
            {"role": "user", "content": "hello"},
        ])
        vector = await provider.get_embedding("hello")
        return text, vector

    text, vector = asyncio.run(run())
    assert text == "gemini-ok"
    assert vector == [0.4, 0.5, 0.6]
    assert fake.models.generate_calls[0]["model"] == "test-gemini-model"
    assert fake.models.embed_calls[0]["model"] == "test-gemini-embedding"


def test_nvidia_adapter_is_openai_compatible_without_forcing_thinking(monkeypatch):
    monkeypatch.setenv("NVIDIA_MODEL", "test-nim-model")
    monkeypatch.delenv("NVIDIA_THINKING", raising=False)
    provider = NvidiaProvider(api_key="test")
    fake = FakeOpenAIClient("nvidia-ok")
    provider._client = fake

    async def run():
        text = await provider.chat([{"role": "user", "content": "hello"}])
        vector = await provider.get_embedding("hello")
        return text, vector

    text, vector = asyncio.run(run())
    assert text == "nvidia-ok"
    assert len(vector) == 1536
    assert any(value != 0 for value in vector)
    call = fake.completions.calls[0]
    assert call["model"] == "test-nim-model"
    assert "extra_body" not in call


def test_auto_pool_fails_over_before_local():
    pool = ProviderPool([
        ("first", StubProvider(text="")),
        ("second", StubProvider(text="second-ok", embedding=[0.2, 0.1])),
    ])

    async def run():
        text = await pool.chat([{"role": "user", "content": "hello"}])
        vector = await pool.get_embedding("hello")
        return text, vector

    text, vector = asyncio.run(run())
    assert text == "second-ok"
    assert pool.last_provider == "second"
    assert vector == [0.2, 0.1]


def test_provider_aliases_and_auto_mode(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic-test")
    monkeypatch.setenv("OPENAI_API_KEY", "openai-test")
    monkeypatch.setenv("LLM_PROVIDER_ORDER", "anthropic,openai")

    anthropic = get_provider("anthropic")
    claude = get_provider("claude")
    auto = get_provider("auto")

    assert isinstance(anthropic, ResilientProvider)
    assert isinstance(anthropic.primary, AnthropicProvider)
    assert isinstance(claude, ResilientProvider)
    assert isinstance(claude.primary, AnthropicProvider)
    assert isinstance(auto, ProviderPool)
    assert [name for name, _ in auto.providers] == ["anthropic", "openai"]


def test_deepseek_adapter_chat_and_embeddings(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_MODEL", "test-deepseek-model")
    provider = DeepSeekProvider(api_key="test")
    fake = FakeOpenAIClient("deepseek-ok")
    provider._client = fake

    async def run():
        text = await provider.chat([{"role": "user", "content": "hello"}])
        vector = await provider.get_embedding("hello")
        return text, vector

    text, vector = asyncio.run(run())
    assert text == "deepseek-ok"
    assert len(vector) == 1536
    assert any(value != 0 for value in vector)
    call = fake.completions.calls[0]
    assert call["model"] == "test-deepseek-model"


def test_provider_status_never_exposes_keys(monkeypatch):
    monkeypatch.setenv("DEEPSEEK_API_KEY", "super-secret-deepseek")
    monkeypatch.setenv("NVIDIA_API_KEY", "super-secret-nvidia")
    monkeypatch.setenv("OPENAI_API_KEY", "super-secret-openai")
    monkeypatch.setenv("LLM_PROVIDER", "auto")

    status = get_provider_status()
    rendered = repr(status)

    assert status["mode"] == "auto"
    assert status["providers"]["deepseek"]["configured"] is True
    assert status["providers"]["nvidia"]["configured"] is True
    assert status["providers"]["openai"]["configured"] is True
    assert "super-secret" not in rendered


def test_circuit_breaker_opens_after_consecutive_failures_and_half_opens():
    breaker = CircuitBreaker(failure_threshold=2, reset_timeout_seconds=0)

    async def run():
        assert await breaker.allow_request()
        await breaker.record_failure()
        assert await breaker.allow_request()
        await breaker.record_failure()

        # The cooldown has elapsed, but only one caller may probe.
        first, second = await asyncio.gather(
            breaker.allow_request(),
            breaker.allow_request(),
        )
        assert sorted([first, second]) == [False, True]

        await breaker.record_success()
        assert await breaker.allow_request()
        assert breaker.failure_count == 0
        assert breaker.opened_at is None

    asyncio.run(run())


def test_provider_pool_skips_open_provider_and_uses_next_provider():
    class FailingProvider(LLMProvider):
        def __init__(self):
            self.calls = 0

        async def chat(self, messages, temperature=0.5, max_tokens=1000, enable_thinking=None):
            self.calls += 1
            return ""

        async def get_embedding(self, text):
            return []

    failing = FailingProvider()
    healthy = StubProvider(text="healthy-response")
    pool = ProviderPool(
        [("unhealthy", failing), ("healthy", healthy)],
        failure_threshold=2,
        reset_timeout_seconds=60,
    )

    async def run():
        first = await pool.chat([{"role": "user", "content": "hello"}])
        second = await pool.chat([{"role": "user", "content": "hello again"}])
        third = await pool.chat([{"role": "user", "content": "hello once more"}])
        return first, second, third

    assert asyncio.run(run()) == (
        "healthy-response",
        "healthy-response",
        "healthy-response",
    )
    # Two failures open the first provider; the third request skips it.
    assert failing.calls == 2
    assert pool.last_provider == "healthy"


def test_resilient_provider_falls_back_without_calling_open_primary():
    class FailingProvider(LLMProvider):
        def __init__(self):
            self.calls = 0

        async def chat(self, messages, temperature=0.5, max_tokens=1000, enable_thinking=None):
            self.calls += 1
            return ""

        async def get_embedding(self, text):
            return []

    primary = FailingProvider()
    fallback = StubProvider(text="local-response")
    provider = ResilientProvider(
        primary,
        fallback=fallback,
        failure_threshold=1,
        reset_timeout_seconds=60,
    )

    async def run():
        first = await provider.chat([{"role": "user", "content": "hello"}])
        second = await provider.chat([{"role": "user", "content": "hello again"}])
        return first, second

    assert asyncio.run(run()) == ("local-response", "local-response")
    assert primary.calls == 1


def test_circuit_breaker_reads_environment_defaults(monkeypatch):
    monkeypatch.setenv("LLM_CIRCUIT_BREAKER_FAILURE_THRESHOLD", "4")
    monkeypatch.setenv("LLM_CIRCUIT_BREAKER_RESET_TIMEOUT_SECONDS", "12.5")
    pool = ProviderPool([("remote", StubProvider(text="ok"))])

    breaker = pool.circuit_breakers["remote"]
    assert breaker.failure_threshold == 4
    assert breaker.reset_timeout_seconds == 12.5


def test_circuit_breaker_releases_half_open_slot_after_cancellation():
    breaker = CircuitBreaker(failure_threshold=1, reset_timeout_seconds=0)

    async def run():
        assert await breaker.allow_request()
        await breaker.record_failure()
        assert await breaker.allow_request()
        await breaker.release_probe()
        # A cancelled probe must not leave the provider permanently blocked.
        assert await breaker.allow_request()

    asyncio.run(run())
