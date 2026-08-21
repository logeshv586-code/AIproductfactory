# Local AI with Ollama and LM Studio

AI Product Factory can run its reasoning model locally through **Ollama** or **LM Studio**. Normal Studio users do not need to edit `.env` files or paste an API key.

## What the Studio does

1. You choose **Ollama** or **LM Studio** on `/studio`.
2. The Studio connects to the local OpenAI-compatible endpoint.
3. It reads `/v1/models` to discover the models already available on that machine.
4. It ranks those installed models for:
   - **Research & reasoning**
   - **Product building**
   - **Balanced** use
5. You choose a model (or accept the recommended installed model).
6. The Studio runs a real connection test before opening the Product Factory.
7. That local provider is bound to the runtime session and powers the same Product Intelligence and approved-build flow as a hosted provider.

The ranking is a convenience heuristic over **models actually installed on the local server**. It is not presented as a universal benchmark or a guarantee of correctness.

---

## Ollama

Default OpenAI-compatible base URL:

```text
http://127.0.0.1:11434/v1
```

Ollama documents OpenAI-compatible chat, model listing and embeddings endpoints under `/v1`. Once Ollama is installed and running, the Product Factory can discover models from that endpoint.

Example model installs:

```bash
ollama pull gpt-oss:20b
ollama pull qwen3:8b
ollama pull qwen2.5-coder:7b
```

Useful starting roles:

| Model | Good starting use |
|---|---|
| `gpt-oss:20b` | deeper reasoning, agentic/product work when the machine has enough memory |
| `qwen3:8b` | lighter balanced reasoning/general use |
| `qwen2.5-coder:7b` | code-heavy product implementation work |

These are starting suggestions only. The Studio will prefer the actual models it discovers on your machine and lets you choose any returned model ID.

Official references:

- https://docs.ollama.com/api/openai-compatibility
- https://docs.ollama.com/api/tags
- https://ollama.com/library/gpt-oss
- https://ollama.com/library/qwen3
- https://ollama.com/library/qwen2.5-coder

---

## LM Studio

Default OpenAI-compatible base URL:

```text
http://127.0.0.1:1234/v1
```

In LM Studio:

1. Download/load the local model(s) you want.
2. Open the **Developer** tab.
3. Start the local server.
4. Return to AI Product Factory and choose **LM Studio**.
5. Click **Discover local models**.

LM Studio exposes an OpenAI-compatible `/v1/models` endpoint, so the Product Factory can populate the model chooser automatically instead of requiring users to know the model ID.

Official references:

- https://lmstudio.ai/docs/developer/core/server
- https://lmstudio.ai/docs/developer/openai-compat
- https://lmstudio.ai/docs/developer/openai-compat/models

---

## Safety: localhost by default

AI Product Factory accepts Ollama and LM Studio endpoints on loopback addresses by default:

```text
localhost
127.0.0.1
::1
```

This prevents the local-model discovery feature from becoming a general server-side URL fetcher.

If an operator intentionally runs a trusted model server on the LAN, they can opt in:

```env
LOCAL_LLM_ALLOW_REMOTE_BASE_URLS=1
```

Only enable this when you control and trust the target network/server.

Optional defaults:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_MODEL=
LMSTUDIO_BASE_URL=http://127.0.0.1:1234/v1
LMSTUDIO_MODEL=
```

Leaving the model empty is supported in the runtime API: the Studio can discover available models and choose the highest-ranked balanced installed option.

---

## Privacy boundary

Using Ollama or LM Studio keeps **LLM inference** on the local model server. It does not automatically make every Product Factory feature offline: live research can still query configured public sources such as GitHub, GitLab, Hugging Face and other research sources. Disable/replace those integrations separately when you need a fully disconnected deployment.

The built-in `local-deterministic` provider remains available for CI/offline workflow validation, but it is intentionally labeled **Offline test mode** in the customer UI so it is not confused with a high-quality local reasoning model.
