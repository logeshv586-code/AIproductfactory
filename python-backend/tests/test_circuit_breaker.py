from __future__ import annotations

import asyncio
import time

import pytest

from llm.base import LLMProvider
from llm.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerRegistry,
    CircuitOpenError,
    CircuitState,
    get_circuit_breaker_registry,
)
from llm.provider import ProviderPool, ResilientProvider, get_provider_status


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


class CountingProvider(LLMProvider):
    """Stub remote provider that records calls and can fail, hang or succeed."""

    def __init__(self, text: str = "", embedding: list[float] | None = None, hang: bool = False):
        self.text = text
        self.embedding = embedding or []
        self.hang = hang
        self.chat_calls = 0
        self.embedding_calls = 0

    async def chat(self, messages, temperature=0.5, max_tokens=1000, enable_thinking=None):
        self.chat_calls += 1
        if self.hang:
            await asyncio.sleep(3600)
        return self.text

    async def get_embedding(self, text: str) -> list[float]:
        self.embedding_calls += 1
        if self.hang:
            await asyncio.sleep(3600)
        return self.embedding


class StaticFallback(LLMProvider):
    async def chat(self, messages, temperature=0.5, max_tokens=1000, enable_thinking=None):
        return "local-fallback"

    async def get_embedding(self, text: str) -> list[float]:
        return [9.0]


async def _ok():
    return "ok"


async def _boom():
    raise RuntimeError("upstream down")


def _fail(breaker: CircuitBreaker, times: int) -> None:
    async def run():
        for _ in range(times):
            with pytest.raises(RuntimeError):
                await breaker.call(_boom)

    asyncio.run(run())


MESSAGES = [{"role": "user", "content": "hello"}]


@pytest.fixture(autouse=True)
def _isolate_global_registry():
    get_circuit_breaker_registry().reset()
    yield
    get_circuit_breaker_registry().reset()


def test_opens_after_consecutive_failures_and_fast_fails():
    clock = FakeClock()
    breaker = CircuitBreaker("svc", failure_threshold=3, recovery_timeout=60, clock=clock)

    _fail(breaker, 2)
    assert breaker.state == CircuitState.CLOSED
    assert breaker.failure_count == 2

    _fail(breaker, 1)
    assert breaker.state == CircuitState.OPEN

    called = False

    async def should_not_run():
        nonlocal called
        called = True
        return "ok"

    with pytest.raises(CircuitOpenError) as info:
        asyncio.run(breaker.call(should_not_run))
    assert called is False
    assert info.value.retry_after == pytest.approx(60)


def test_success_resets_consecutive_failure_count():
    breaker = CircuitBreaker("svc", failure_threshold=3, clock=FakeClock())

    _fail(breaker, 2)
    assert asyncio.run(breaker.call(_ok)) == "ok"
    _fail(breaker, 2)

    assert breaker.state == CircuitState.CLOSED
    assert breaker.failure_count == 2


def test_full_cycle_open_cooldown_half_open_success_closed():
    clock = FakeClock()
    breaker = CircuitBreaker("svc", failure_threshold=3, recovery_timeout=60, clock=clock)
    _fail(breaker, 3)
    assert breaker.state == CircuitState.OPEN

    clock.advance(59.9)
    assert breaker.state == CircuitState.OPEN
    assert breaker.retry_after() == pytest.approx(0.1)

    clock.advance(0.1)
    assert breaker.state == CircuitState.HALF_OPEN

    assert asyncio.run(breaker.call(_ok)) == "ok"
    assert breaker.state == CircuitState.CLOSED
    assert breaker.failure_count == 0


def test_half_open_probe_failure_reopens_for_a_fresh_cooldown():
    clock = FakeClock()
    breaker = CircuitBreaker("svc", failure_threshold=3, recovery_timeout=60, clock=clock)
    _fail(breaker, 3)
    clock.advance(60)
    assert breaker.state == CircuitState.HALF_OPEN

    _fail(breaker, 1)
    assert breaker.state == CircuitState.OPEN
    assert breaker.retry_after() == pytest.approx(60)

    clock.advance(30)
    with pytest.raises(CircuitOpenError):
        asyncio.run(breaker.call(_ok))


def test_half_open_allows_only_a_single_probe():
    clock = FakeClock()
    breaker = CircuitBreaker("svc", failure_threshold=1, recovery_timeout=10, clock=clock)
    _fail(breaker, 1)
    clock.advance(10)

    async def run():
        release = asyncio.Event()

        async def slow_probe():
            await release.wait()
            return "ok"

        probe = asyncio.create_task(breaker.call(slow_probe))
        await asyncio.sleep(0)
        with pytest.raises(CircuitOpenError):
            await breaker.call(_ok)
        release.set()
        return await probe

    assert asyncio.run(run()) == "ok"
    assert breaker.state == CircuitState.CLOSED


def test_cancelled_probe_frees_the_half_open_slot():
    clock = FakeClock()
    breaker = CircuitBreaker("svc", failure_threshold=1, recovery_timeout=10, clock=clock)
    _fail(breaker, 1)
    clock.advance(10)

    async def run():
        probe = asyncio.create_task(breaker.call(lambda: asyncio.sleep(3600)))
        await asyncio.sleep(0)
        probe.cancel()
        with pytest.raises(asyncio.CancelledError):
            await probe
        assert breaker.state == CircuitState.HALF_OPEN
        return await breaker.call(_ok)

    assert asyncio.run(run()) == "ok"
    assert breaker.state == CircuitState.CLOSED


def test_timeouts_and_failure_results_count_as_failures():
    breaker = CircuitBreaker("svc", failure_threshold=2, clock=FakeClock())

    async def run():
        with pytest.raises(asyncio.TimeoutError):
            await breaker.call(lambda: asyncio.sleep(3600), timeout=0.01)

        async def empty():
            return ""

        result = await breaker.call(empty, is_failure=lambda text: not text)
        return result

    assert asyncio.run(run()) == ""
    assert breaker.state == CircuitState.OPEN


def test_late_results_from_requests_admitted_before_opening_are_ignored():
    clock = FakeClock()
    breaker = CircuitBreaker("svc", failure_threshold=1, recovery_timeout=10, clock=clock)

    async def run():
        release = asyncio.Event()

        async def slow_success():
            await release.wait()
            return "ok"

        straggler = asyncio.create_task(breaker.call(slow_success))
        await asyncio.sleep(0)
        with pytest.raises(RuntimeError):
            await breaker.call(_boom)
        assert breaker.state == CircuitState.OPEN
        release.set()
        await straggler

    asyncio.run(run())
    assert breaker.state == CircuitState.OPEN


def test_pool_skips_open_provider_without_waiting_for_timeout():
    registry = CircuitBreakerRegistry(failure_threshold=3, recovery_timeout=60, clock=FakeClock())
    hanging = CountingProvider(hang=True)
    healthy = CountingProvider(text="second-ok")
    pool = ProviderPool(
        [("first", hanging), ("second", healthy)],
        timeout_seconds=0.05,
        breakers=registry,
    )

    async def run():
        for _ in range(3):
            assert await pool.chat(MESSAGES) == "second-ok"
        started = time.perf_counter()
        for _ in range(20):
            assert await pool.chat(MESSAGES) == "second-ok"
        return time.perf_counter() - started

    elapsed = asyncio.run(run())
    assert hanging.chat_calls == 3
    assert healthy.chat_calls == 23
    assert registry.get("first:chat").state == CircuitState.OPEN
    # 20 requests at a 50ms timeout would take >= 1s without the breaker.
    assert elapsed < 0.5
    assert pool.last_provider == "second"


def test_pool_probes_recovered_provider_after_cooldown():
    clock = FakeClock()
    registry = CircuitBreakerRegistry(failure_threshold=2, recovery_timeout=60, clock=clock)
    flaky = CountingProvider(text="")
    pool = ProviderPool([("first", flaky)], fallback=StaticFallback(), breakers=registry)

    async def run():
        for _ in range(3):
            assert await pool.chat(MESSAGES) == "local-fallback"
        assert flaky.chat_calls == 2

        clock.advance(60)
        flaky.text = "first-ok"
        return await pool.chat(MESSAGES)

    assert asyncio.run(run()) == "first-ok"
    assert registry.get("first:chat").state == CircuitState.CLOSED


def test_resilient_provider_shares_breaker_state_across_instances():
    # get_provider() builds a new ResilientProvider per call, so breaker state
    # must survive the wrapper being recreated.
    registry = CircuitBreakerRegistry(failure_threshold=3, recovery_timeout=60, clock=FakeClock())
    primary = CountingProvider(hang=True)

    def build() -> ResilientProvider:
        return ResilientProvider(
            primary,
            fallback=StaticFallback(),
            timeout_seconds=0.05,
            name="openai",
            breakers=registry,
        )

    async def run():
        return [await build().chat(MESSAGES) for _ in range(6)]

    assert asyncio.run(run()) == ["local-fallback"] * 6
    assert primary.chat_calls == 3


def test_chat_and_embedding_breakers_are_independent():
    # Several adapters compute embeddings locally, so embedding successes must
    # not reset the failure count of a broken chat endpoint.
    registry = CircuitBreakerRegistry(failure_threshold=2, recovery_timeout=60, clock=FakeClock())
    provider = CountingProvider(text="", embedding=[0.3, 0.4])
    wrapped = ResilientProvider(provider, fallback=StaticFallback(), name="anthropic", breakers=registry)

    async def run():
        for _ in range(2):
            await wrapped.chat(MESSAGES)
            assert await wrapped.get_embedding("hello") == [0.3, 0.4]

    asyncio.run(run())
    assert registry.get("anthropic:chat").state == CircuitState.OPEN
    assert registry.get("anthropic:embedding").state == CircuitState.CLOSED


def test_registry_reads_env_configuration(monkeypatch):
    monkeypatch.setenv("LLM_CIRCUIT_FAILURE_THRESHOLD", "5")
    monkeypatch.setenv("LLM_CIRCUIT_RECOVERY_SECONDS", "12.5")
    breaker = CircuitBreakerRegistry().get("svc")
    assert breaker.failure_threshold == 5
    assert breaker.recovery_timeout == 12.5

    monkeypatch.setenv("LLM_CIRCUIT_FAILURE_THRESHOLD", "not-a-number")
    monkeypatch.setenv("LLM_CIRCUIT_RECOVERY_SECONDS", "-1")
    breaker = CircuitBreakerRegistry().get("svc")
    assert breaker.failure_threshold == 3
    assert breaker.recovery_timeout == 60.0


def test_provider_status_reports_circuit_state(monkeypatch):
    monkeypatch.setenv("LLM_CIRCUIT_FAILURE_THRESHOLD", "1")
    _fail(get_circuit_breaker_registry().get("openai:chat"), 1)

    status = get_provider_status()

    assert status["providers"]["openai"]["circuit"] == {"chat": "open", "embedding": "closed"}
    assert status["providers"]["gemini"]["circuit"] == {"chat": "closed", "embedding": "closed"}
