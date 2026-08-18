# AI Product Factory — Model Providers

AI Product Factory supports the same Product Intelligence and autonomous build flow with NVIDIA, OpenAI, Anthropic Claude, Google Gemini, or deterministic local execution.

## Recommended mode: automatic failover

```env
LLM_PROVIDER=auto
LLM_PROVIDER_ORDER=nvidia,openai,anthropic,gemini
```

Add any provider keys you own. The factory tries only configured remote providers and falls back to local deterministic behavior if every remote provider is unavailable.

```env
NVIDIA_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
```

No provider key is exposed by provider-status metadata or test logs.

## Explicit provider modes

Use one of:

```env
LLM_PROVIDER=nvidia
LLM_PROVIDER=openai
LLM_PROVIDER=anthropic
LLM_PROVIDER=claude
LLM_PROVIDER=gemini
LLM_PROVIDER=local
```

`anthropic` and `claude` are aliases for the same Anthropic adapter.

## Models

Every model is configurable without code changes:

```env
OPENAI_MODEL=gpt-5-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_BASE_URL=https://api.openai.com/v1

ANTHROPIC_MODEL=claude-sonnet-4-20250514
ANTHROPIC_BASE_URL=

GEMINI_MODEL=gemini-3.6-flash
GEMINI_EMBEDDING_MODEL=gemini-embedding-001

NVIDIA_MODEL=openai/gpt-oss-20b
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_THINKING=
```

The values above are defaults/examples. If your account exposes a different model, set the corresponding environment variable rather than editing Python code.

## Embeddings

- OpenAI: native OpenAI embeddings.
- Gemini: native Gemini embeddings through the Google GenAI SDK.
- Anthropic: deterministic local embedding fallback because Anthropic does not expose a native embedding API in this integration.
- NVIDIA: deterministic local embedding fallback because a generic NIM chat endpoint does not guarantee an embedding endpoint.

This means an Anthropic-only or NVIDIA-only installation no longer secretly requires an OpenAI API key.

## NVIDIA compatibility

NVIDIA NIM exposes an OpenAI-compatible chat-completions API. AI Product Factory therefore uses the OpenAI Python client against `NVIDIA_BASE_URL`.

`NVIDIA_THINKING` is intentionally blank by default. Some models accept `chat_template_kwargs.enable_thinking`, while generic NIM models may not. Set it to `1` or `0` only when the chosen model supports that option.

## Google Gemini SDK

The backend uses Google's current `google-genai` SDK rather than the legacy `google-generativeai` package.

## Reliability behavior

Remote providers are wrapped with timeout + local fallback in explicit-provider mode. `auto` mode tries configured providers in order before using local fallback. The provider router can also select different providers for planning, code generation, research, vision-oriented reasoning, fast extraction, and long-context work.

## Test coverage

`python-backend/tests/test_provider_matrix.py` validates request/response adapters for all four remote providers with mocked SDK clients, model environment overrides, Anthropic independence from OpenAI, NVIDIA OpenAI-compatible requests, Gemini native embeddings, provider aliases, automatic failover, and secret-safe status metadata.

The full Product Factory HTTP E2E remains provider-independent and verifies the Studio → strategize → research → manager → approve → final manager → approved repository build flow.

Live paid-provider requests require valid API keys, account quota, and a model name available to that provider account. CI intentionally does not store or print real provider secrets.
