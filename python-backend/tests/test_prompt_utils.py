import asyncio

from intelligence.prompt_utils import _safe_parse, ask_json
from llm.base import LLMProvider


class MockProvider(LLMProvider):
    def __init__(self, response_text: str = "", should_raise: bool = False):
        self.response_text = response_text
        self.should_raise = should_raise
        self.calls = 0

    async def chat(self, messages, temperature=0.5, max_tokens=1000, enable_thinking=None):
        self.calls += 1
        if self.should_raise:
            raise RuntimeError("provider failure")
        return self.response_text

    async def get_embedding(self, text: str) -> list[float]:
        return [0.0] * 1536


def test_safe_parse_object_and_array():
    assert _safe_parse('{"ok": true}') == {"ok": True}
    assert _safe_parse('[{"id": 1}, {"id": 2}]') == [{"id": 1}, {"id": 2}]


def test_safe_parse_fenced_and_embedded_json():
    assert _safe_parse('before ```json\n{"ok": true}\n``` after') == {"ok": True}
    assert _safe_parse('Result: [{"id": "REQ-1"}] done') == [{"id": "REQ-1"}]


def test_safe_parse_delimiters_inside_strings():
    raw = 'prefix {"pattern": "Use {value} and [item]", "quoted": "\\\"ok\\\""}'
    assert _safe_parse(raw) == {"pattern": "Use {value} and [item]", "quoted": '"ok"'}


def test_safe_parse_invalid_returns_none():
    assert _safe_parse("") is None
    assert _safe_parse("not json") is None
    assert _safe_parse("{broken") is None


def test_ask_json_uses_fallback_on_provider_failure():
    provider = MockProvider(should_raise=True)
    result = asyncio.run(ask_json(provider, "system", "user", fallback={"fallback": True}))
    assert result == {"fallback": True}
    assert provider.calls == 1
