import asyncio
import pytest

from intelligence.prompt_utils import _safe_parse, ask_json, as_dict, as_list, as_str
from llm.base import LLMProvider


class MockProvider(LLMProvider):
    def __init__(self, response_text: str = "", should_raise: bool = False):
        self.response_text = response_text
        self.should_raise = should_raise
        self.calls = 0

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.5,
        max_tokens: int = 1000,
        enable_thinking: bool | None = None,
    ) -> str:
        self.calls += 1
        if self.should_raise:
            raise RuntimeError("API connection failure")
        return self.response_text

    async def get_embedding(self, text: str) -> list[float]:
        return [0.0] * 1536


def test_safe_parse_direct_json_object():
    assert _safe_parse('{"domain": "fintech", "confidence": 0.95}') == {
        "domain": "fintech",
        "confidence": 0.95,
    }


def test_safe_parse_direct_json_array():
    assert _safe_parse('[{"id": "REQ-1"}, {"id": "REQ-2"}]') == [
        {"id": "REQ-1"},
        {"id": "REQ-2"},
    ]


def test_safe_parse_markdown_fenced_object_with_surrounding_prose():
    raw = """Here is the analyzed intent:
```json
{
  "domain": "health",
  "features": ["tracking", "reminders"]
}
```
Please let me know if you need changes."""
    assert _safe_parse(raw) == {
        "domain": "health",
        "features": ["tracking", "reminders"],
    }


def test_safe_parse_markdown_fenced_array_with_surrounding_prose():
    raw = """Below are the required tasks:
```json
[
  {"id": "REQ-001", "title": "Setup database", "priority": "must"},
  {"id": "REQ-002", "title": "Add auth routes", "priority": "should"}
]
```
Done."""
    assert _safe_parse(raw) == [
        {"id": "REQ-001", "title": "Setup database", "priority": "must"},
        {"id": "REQ-002", "title": "Add auth routes", "priority": "should"},
    ]


def test_safe_parse_raw_array_with_commentary():
    raw = 'Sure thing! The requirements are: [{"id": "REQ-101", "points": 5}] - that is all.'
    assert _safe_parse(raw) == [{"id": "REQ-101", "points": 5}]


def test_safe_parse_braces_inside_string_literals():
    raw = 'Prefix notes: {"pattern": "Use {variable} in string", "status": "ok"}'
    parsed = _safe_parse(raw)
    assert parsed == {"pattern": "Use {variable} in string", "status": "ok"}


def test_safe_parse_brackets_and_escaped_quotes_inside_string_literals():
    raw = 'Analysis: {"rule": "Array is [item1, item2] and \\"nested\\"", "valid": true}'
    parsed = _safe_parse(raw)
    assert parsed == {"rule": 'Array is [item1, item2] and "nested"', "valid": True}


def test_safe_parse_empty_and_invalid():
    assert _safe_parse("") is None
    assert _safe_parse("   ") is None
    assert _safe_parse("This contains no JSON at all") is None
    assert _safe_parse("{ unclosed invalid json ") is None
    assert _safe_parse("[ unclosed invalid array ") is None


def test_ask_json_success():
    provider = MockProvider('```json\n{"summary": "test passed"}\n```')
    result = asyncio.run(
        ask_json(provider, "System prompt", "User prompt", fallback={"fallback": True})
    )
    assert result == {"summary": "test passed"}
    assert provider.calls == 1


def test_ask_json_graceful_fallback_on_exception():
    provider = MockProvider(should_raise=True)
    result = asyncio.run(
        ask_json(provider, "System", "User", fallback={"fallback": True})
    )
    assert result == {"fallback": True}
    assert provider.calls == 1


def test_ask_json_graceful_fallback_on_empty_or_empty_dict():
    provider = MockProvider("")
    result = asyncio.run(
        ask_json(provider, "System", "User", fallback={"fallback": True})
    )
    assert result == {"fallback": True}

    provider_empty_dict = MockProvider("{}")
    result_dict = asyncio.run(
        ask_json(provider_empty_dict, "System", "User", fallback={"fallback": True})
    )
    assert result_dict == {"fallback": True}


def test_as_helpers():
    assert as_list([1, 2]) == [1, 2]
    assert as_list("not-a-list", default=[99]) == [99]
    assert as_list(None) == []

    assert as_dict({"a": 1}) == {"a": 1}
    assert as_dict(123, default={"key": "val"}) == {"key": "val"}
    assert as_dict(None) == {}

    assert as_str("valid") == "valid"
    assert as_str("", default="default_str") == "default_str"
    assert as_str(123, default="fallback") == "fallback"
