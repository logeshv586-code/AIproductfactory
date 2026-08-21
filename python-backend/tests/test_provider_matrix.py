from __future__ import annotations

import asyncio
from types import SimpleNamespace

from llm.base import LLMProvider
from llm.provider import (
    AnthropicProvider,
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
