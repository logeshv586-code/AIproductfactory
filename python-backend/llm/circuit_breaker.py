"""Circuit breaker for remote LLM providers.

Without a breaker, a remote provider that is down or badly degraded makes every
request wait for the full timeout before `ProviderPool` / `ResilientProvider`
fall back. Because the Product Factory chains many reasoning calls, one
upstream outage turns into cascading latency across the whole pipeline.

Each breaker moves through three states:

- CLOSED:    requests pass through; consecutive failures are counted.
- OPEN:      after `failure_threshold` consecutive failures, requests are
             rejected immediately with `CircuitOpenError` so callers can fail
             over without waiting for a timeout.
- HALF_OPEN: once `recovery_timeout` seconds have passed, a single probe
             request is let through. Success closes the circuit; failure
             re-opens it for another cooldown period.

Breakers are kept in a process-wide registry keyed by provider and operation
(e.g. ``openai:chat``) because `get_provider()` builds fresh provider wrappers
on every call; per-instance state would be discarded before it could trip.
"""

from __future__ import annotations

import asyncio
import os
import threading
import time
from enum import Enum
from typing import Any, Awaitable, Callable, Optional, TypeVar


T = TypeVar("T")

DEFAULT_FAILURE_THRESHOLD = 3
DEFAULT_RECOVERY_TIMEOUT = 60.0


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitOpenError(RuntimeError):
    """Raised instead of calling a provider whose circuit is open."""

    def __init__(self, name: str, retry_after: float):
        self.name = name
        self.retry_after = retry_after
        super().__init__(f"circuit '{name}' is open; retry in {retry_after:.1f}s")


class CircuitBreaker:
    """Consecutive-failure circuit breaker for one provider operation."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = DEFAULT_FAILURE_THRESHOLD,
        recovery_timeout: float = DEFAULT_RECOVERY_TIMEOUT,
        clock: Callable[[], float] = time.monotonic,
    ):
        if failure_threshold < 1:
            raise ValueError("failure_threshold must be at least 1")
        if recovery_timeout < 0:
            raise ValueError("recovery_timeout must not be negative")
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self._clock = clock
        self._lock = threading.Lock()
        self._state = CircuitState.CLOSED
        self._failures = 0
        self._opened_at = 0.0
        self._probe_in_flight = False

    @property
    def state(self) -> CircuitState:
        with self._lock:
            return self._current_state()

    @property
    def failure_count(self) -> int:
        with self._lock:
            return self._failures

    def retry_after(self) -> float:
        """Seconds until an open circuit will allow a probe request."""
        with self._lock:
            if self._current_state() != CircuitState.OPEN:
                return 0.0
            return max(0.0, self._opened_at + self.recovery_timeout - self._clock())

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "state": self._current_state().value,
                "consecutive_failures": self._failures,
                "failure_threshold": self.failure_threshold,
                "recovery_timeout": self.recovery_timeout,
            }

    def reset(self) -> None:
        with self._lock:
            self._state = CircuitState.CLOSED
            self._failures = 0
            self._opened_at = 0.0
            self._probe_in_flight = False

    async def call(
        self,
        func: Callable[[], Awaitable[T]],
        *,
        timeout: Optional[float] = None,
        is_failure: Optional[Callable[[T], bool]] = None,
    ) -> T:
        """Run `func` through the breaker.

        Raises `CircuitOpenError` without calling `func` when the circuit is
        open (or a half-open probe is already running). Exceptions, timeouts
        and results matching `is_failure` count as failures; the original
        result or exception is always passed back to the caller.
        """
        is_probe = self._acquire()
        try:
            if timeout is None:
                result = await func()
            else:
                result = await asyncio.wait_for(func(), timeout=timeout)
        except asyncio.CancelledError:
            # The caller gave up; that says nothing about provider health.
            # Free the probe slot so the next request can test the provider.
            self._release_probe(is_probe)
            raise
        except Exception:
            self._record(success=False, is_probe=is_probe)
            raise
        self._record(success=not (is_failure and is_failure(result)), is_probe=is_probe)
        return result

    def _current_state(self) -> CircuitState:
        # Caller must hold the lock. OPEN becomes HALF_OPEN lazily once the
        # cooldown has elapsed, so no background timer task is needed.
        if (
            self._state == CircuitState.OPEN
            and self._clock() - self._opened_at >= self.recovery_timeout
        ):
            self._state = CircuitState.HALF_OPEN
            self._probe_in_flight = False
        return self._state

    def _acquire(self) -> bool:
        """Admit a request or raise; returns True when it is the half-open probe."""
        with self._lock:
            state = self._current_state()
            if state == CircuitState.CLOSED:
                return False
            if state == CircuitState.HALF_OPEN and not self._probe_in_flight:
                self._probe_in_flight = True
                return True
            retry_after = max(0.0, self._opened_at + self.recovery_timeout - self._clock())
        raise CircuitOpenError(self.name, retry_after)

    def _release_probe(self, is_probe: bool) -> None:
        if not is_probe:
            return
        with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._probe_in_flight = False

    def _record(self, success: bool, is_probe: bool) -> None:
        with self._lock:
            state = self._current_state()
            if state == CircuitState.HALF_OPEN:
                # Only the probe decides the outcome; late results from
                # requests admitted before the circuit opened are ignored.
                if not is_probe:
                    return
                if success:
                    self._close()
                else:
                    self._trip(f"half-open probe failed; cooling down {self.recovery_timeout:g}s")
                return
            if state == CircuitState.OPEN:
                return
            if success:
                self._failures = 0
                return
            self._failures += 1
            if self._failures >= self.failure_threshold:
                self._trip(
                    f"{self._failures} consecutive failures; "
                    f"cooling down {self.recovery_timeout:g}s"
                )

    def _trip(self, reason: str) -> None:
        self._state = CircuitState.OPEN
        self._opened_at = self._clock()
        self._probe_in_flight = False
        print(f"[CircuitBreaker] {self.name} OPEN: {reason}")

    def _close(self) -> None:
        self._state = CircuitState.CLOSED
        self._failures = 0
        self._probe_in_flight = False
        print(f"[CircuitBreaker] {self.name} CLOSED: provider recovered")


def _env_number(name: str, default: float, cast: Callable[[str], float]) -> float:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        return cast(raw)
    except ValueError:
        print(f"[CircuitBreaker] ignoring invalid {name}={raw!r}; using {default}")
        return default


class CircuitBreakerRegistry:
    """Shares one breaker per name across all provider wrapper instances."""

    def __init__(
        self,
        failure_threshold: Optional[int] = None,
        recovery_timeout: Optional[float] = None,
        clock: Callable[[], float] = time.monotonic,
    ):
        self._failure_threshold = failure_threshold
        self._recovery_timeout = recovery_timeout
        self._clock = clock
        self._lock = threading.Lock()
        self._breakers: dict[str, CircuitBreaker] = {}

    def get(self, name: str) -> CircuitBreaker:
        with self._lock:
            breaker = self._breakers.get(name)
            if breaker is None:
                breaker = CircuitBreaker(
                    name,
                    failure_threshold=self._resolve_threshold(),
                    recovery_timeout=self._resolve_recovery(),
                    clock=self._clock,
                )
                self._breakers[name] = breaker
            return breaker

    def snapshot(self) -> dict[str, dict[str, Any]]:
        with self._lock:
            breakers = list(self._breakers.values())
        return {breaker.name: breaker.snapshot() for breaker in breakers}

    def reset(self) -> None:
        with self._lock:
            self._breakers.clear()

    def _resolve_threshold(self) -> int:
        if self._failure_threshold is not None:
            return self._failure_threshold
        value = int(_env_number("LLM_CIRCUIT_FAILURE_THRESHOLD", DEFAULT_FAILURE_THRESHOLD, int))
        return value if value >= 1 else DEFAULT_FAILURE_THRESHOLD

    def _resolve_recovery(self) -> float:
        if self._recovery_timeout is not None:
            return self._recovery_timeout
        value = _env_number("LLM_CIRCUIT_RECOVERY_SECONDS", DEFAULT_RECOVERY_TIMEOUT, float)
        return value if value >= 0 else DEFAULT_RECOVERY_TIMEOUT


_registry = CircuitBreakerRegistry()


def get_circuit_breaker_registry() -> CircuitBreakerRegistry:
    return _registry
