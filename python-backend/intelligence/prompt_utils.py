"""
Prompt Utilities — safe LLM JSON interaction for the Product Intelligence engines.

All engines must obtain structured JSON from an ``LLMProvider`` through
``ask_json`` so that every engine degrades gracefully: on any error or empty
response the caller-provided deterministic fallback is returned.
"""

from __future__ import annotations

import json
from typing import Any

from llm.provider import LLMProvider


def _safe_parse(raw: str) -> Any:
    """Best-effort JSON parse: strip markdown fences, find first {...} block."""
    if not raw:
        return None
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass
    # fall back to extracting the first balanced JSON object
    start = cleaned.find("{")
    if start >= 0:
        depth = 0
        for i in range(start, len(cleaned)):
            if cleaned[i] == "{":
                depth += 1
            elif cleaned[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(cleaned[start : i + 1])
                    except Exception:
                        break
    return None


async def ask_json(
    provider: LLMProvider,
    system_prompt: str,
    user_prompt: str,
    fallback: Any = None,
    temperature: float = 0.5,
    max_tokens: int = 1200,
) -> Any:
    """
    Send a chat request and return parsed JSON.

    Returns ``fallback`` whenever the provider returns empty/garbage JSON or
    raises. Never raises.
    """
    try:
        raw = await provider.chat(
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
            max_tokens=max_tokens,
            # Structured JSON generation doesn't need chain-of-thought; it is
            # far faster (and just as reliable) without the thinking prefix.
            enable_thinking=False,
        )
        data = _safe_parse(raw)
        if data is not None and data != {}:
            return data
    except Exception:
        pass
    return fallback


def as_list(value: Any, default: list[Any] | None = None) -> list[Any]:
    if isinstance(value, list):
        return value
    return default or []


def as_dict(value: Any, default: dict[str, Any] | None = None) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return default or {}


def as_str(value: Any, default: str = "") -> str:
    if isinstance(value, str) and value:
        return value
    return default
