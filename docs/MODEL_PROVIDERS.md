# AI Product Factory — Model Providers

AI Product Factory supports the same Product Intelligence and autonomous build flow with DeepSeek, NVIDIA, OpenAI, Anthropic Claude, Google Gemini, or deterministic local execution.

## Studio runtime setup — recommended for customers

The `/studio` experience starts with a simple model connection screen. A customer can:

1. choose DeepSeek, OpenAI, Anthropic, Google Gemini, NVIDIA NIM, or Local mode;
2. paste their provider API key;
3. enter the exact model ID available to their provider account;
4. click **Test model & start**;
5. continue into the Product Factory only after the connection succeeds.

A successful test creates an opaque runtime model session. The raw provider key is kept only in Python process memory for that session, is not returned to the browser after setup, and is not written to disk by the runtime-session layer. The browser retains only the opaque session id in `sessionStorage` so a page refresh can restore the active session while the backend is still running.

Requests in the Product Factory carry that session id through the Next.js proxy. The same runtime provider/model is then resolved for:

- Product Thinking and Intent Intelligence;
- Requirement, Market, Competitor, Innovation and Gap Intelligence;
- Capability and Repository Intelligence;
- Strategy Tournament and Review;
- approved Deep Research, Composition, Architecture and Simulation;
- Blueprint, Engineering and Execution planning;
- the approved repository-locked Product Factory build pipeline.

The live-source research collector and deterministic Final Manager do not need an LLM call; they continue to use their existing source/data logic while the reasoning agents use the selected runtime model.

Runtime model sessions expire after 8 hours by default. Override this local-server behavior with:

```env
LLM_RUNTIME_SESSION_TTL_SECONDS=28800
```

## Recommended server mode: automatic failover

For unattended/server deployments, environment configuration remains supported:

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

The values above are defaults/examples. If your account exposes a different model, enter that model ID in Studio or set the corresponding environment variable rather than editing Python code.

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

Remote providers are wrapped with timeout + local fallback in explicit environment-provider mode. `auto` mode tries configured providers in order before using local fallback. The provider router can also select different providers for planning, code generation, research, vision-oriented reasoning, fast extraction, and long-context work.

A customer-created Studio runtime session is different: it intentionally pins the selected provider and model so the run does not silently switch to a different paid provider.

## Test coverage

`python-backend/tests/test_provider_matrix.py` validates request/response adapters for all four remote providers with mocked SDK clients, model environment overrides, Anthropic independence from OpenAI, NVIDIA OpenAI-compatible requests, Gemini native embeddings, provider aliases, automatic failover, and secret-safe status metadata.

The full Product Factory HTTP E2E remains provider-independent and verifies the Studio → strategize → research → manager → approve → final manager → approved repository build flow.

Live paid-provider requests require valid API keys, account quota, and a model name available to that provider account. CI intentionally does not store or print real provider secrets.
