"""
Prompt Utilities — safe LLM JSON interaction for the Product Intelligence engines.

All engines must obtain structured JSON from an ``LLMProvider`` through
``ask_json`` so that every engine degrades gracefully: on any error or empty
response the caller-provided deterministic fallback is returned.
"""

from __future__ import annotations

import json
import re
from typing import Any

from llm.provider import LLMProvider


def _safe_parse(raw: str) -> Any:
    """Best-effort JSON parse: handles markdown fences, JSON arrays, and embedded JSON objects."""
    if not raw:
        return None
    cleaned = raw.strip()

    # 1. Direct parse attempt
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # 2. Extract from markdown code fence (```json ... ``` or ``` ... ```)
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw, re.IGNORECASE)
    if fence_match:
        fenced_content = fence_match.group(1).strip()
        try:
            return json.loads(fenced_content)
        except Exception:
            pass
        cleaned = fenced_content

    # 3. Fall back to extracting the first balanced JSON object {...} or array [...]
    start_brace = cleaned.find("{")
    start_bracket = cleaned.find("[")

    candidates: list[tuple[int, str, str]] = []
    if start_brace >= 0:
        candidates.append((start_brace, "{", "}"))
    if start_bracket >= 0:
        candidates.append((start_bracket, "[", "]"))

    # Sort to evaluate whichever opening delimiter appears earlier in the text
    candidates.sort(key=lambda x: x[0])

    for start, open_char, close_char in candidates:
        depth = 0
        in_string = False
        escape = False
        for i in range(start, len(cleaned)):
            c = cleaned[i]
            if escape:
                escape = False
                continue
            if c == "\\":
                escape = True
                continue
            if c == '"':
                in_string = not in_string
                continue
            if not in_string:
                if c == open_char:
                    depth += 1
                elif c == close_char:
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
