"""Shared LLM provider contracts and deterministic local embedding fallback."""

from __future__ import annotations

import hashlib
import json
import re
from abc import ABC, abstractmethod
from typing import Any


class LLMProvider(ABC):
    """Minimal provider contract used by all Product Factory agents."""

    @abstractmethod
    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.5,
        max_tokens: int = 1000,
        enable_thinking: bool | None = None,
    ) -> str:
        """Send a chat request and return plain response text."""
        raise NotImplementedError

    @abstractmethod
    async def get_embedding(self, text: str) -> list[float]:
        """Return a numeric embedding for semantic matching."""
        raise NotImplementedError

    def parse_json(self, raw: str) -> Any:
        """Clean markdown fences and parse JSON from a model response."""
        cleaned = re.sub(r"```json\n?", "", raw)
        cleaned = re.sub(r"```\n?", "", cleaned).strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return {}


def deterministic_embedding(text: str, dimensions: int = 1536) -> list[float]:
    """Stable local embedding fallback that never requires another provider key.

    This is intentionally not presented as a semantic-quality replacement for a
    hosted embedding model. It exists so Anthropic-only, NVIDIA-only and offline
    configurations can still execute the Product Factory pipeline without
    silently depending on OpenAI.
    """
    values: list[float] = []
    counter = 0
    while len(values) < dimensions:
        digest = hashlib.sha256(f"{counter}:{text}".encode("utf-8")).digest()
        values.extend(((byte / 255.0) - 0.5) * 2 for byte in digest)
        counter += 1
    return values[:dimensions]
