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
    """Best-effort JSON parse for raw, fenced, object or array responses."""
    if not raw:
        return None
    cleaned = raw.strip()

    try:
        return json.loads(cleaned)
    except Exception:
        pass

    fence_match = re.search(r"```(?:json)?\\s*([\\s\\S]*?)\\s*```", raw, re.IGNORECASE)
    if fence_match:
        fenced = fence_match.group(1).strip()
        try:
            return json.loads(fenced)
        except Exception:
            cleaned = fenced

    candidates: list[tuple[int, str, str]] = []
    for opener, closer in (("{", "}"), ("[", "]")):
        pos = cleaned.find(opener)
        if pos >= 0:
            candidates.append((pos, opener, closer))
    candidates.sort(key=lambda item: item[0])

    for start_at, opener, closer in candidates:
        depth = 0
        in_string = False
        escape = False
        for index in range(start_at, len(cleaned)):
            char = cleaned[index]
            if escape:
                escape = False
                continue
            if char == "\\" and in_string:
                escape = True
                continue
            if char == '"':
                in_string = not in_string
                continue
            if in_string:
                continue
            if char == opener:
                depth += 1
            elif char == closer:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(cleaned[start_at:index + 1])
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
