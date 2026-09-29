# Offline Capability Factory

This design turns reusable patterns from `Shubhamsaboo/awesome-llm-apps` into
native AI Product Factory capabilities. Runtime product generation does **not**
depend on the upstream repository or on cloud APIs.

## Goal

A customer should be able to provide a product idea while disconnected from the
internet and receive a product plan, source code, tests and verification using:

- a local model server (Ollama or LM Studio),
- local files/databases,
- local embeddings and retrieval,
- local speech/vision tools,
- local MCP/tool servers,
- the existing Product Factory approval, build and verification pipeline.

Set:

```env
FACTORY_OFFLINE_ONLY=1
LLM_PROVIDER=local
OFFLINE_CORPUS_DIR=./offline-data
```

The runtime model session can still be Ollama or LM Studio on localhost.

## What was extracted as reusable patterns

The upstream repository is useful as an architecture/reference library rather
than something to copy wholesale. The Product Factory normalizes its patterns
into stable capability primitives:

1. local LLM reasoning and coding,
2. single-agent execution,
3. multi-agent planning/specialist/reviewer teams,
4. trust/approval gates and audit evidence,
5. critique -> repair -> verification loops,
6. local RAG,
7. hybrid lexical + vector RAG,
8. agentic RAG,
9. knowledge-graph RAG with citations,
10. multimodal/vision RAG,
11. persistent memory,
12. CSV/Excel/local-database analysis,
13. resume/job matching,
14. codebase intelligence,
15. dependency and RAG diagnostics,
16. generative UI,
17. chat-to-dashboard composition,
18. local MCP/tool routing,
19. browser/RPA automation for local/intranet systems,
20. scheduled/event-driven local agents,
21. offline voice pipelines,
22. offline image/video intelligence,
23. local content/media pipelines,
24. local fine-tuning/LoRA workflows,
25. context/token optimization.

The source paths are stored as provenance in
`python-backend/capabilities/offline_catalog.py`.

## Offline adaptation rule

Not every upstream demo is naturally offline. The Factory classifies each
pattern as either:

- **native** — works completely with local files/models/tools,
- **adapted** — useful architecture, but cloud/live-data pieces are replaced.

Examples:

| Upstream idea | Offline Product Factory replacement |
|---|---|
| OpenAI/Claude/Gemini agent | Ollama/LM Studio model |
| hosted embedding API | sentence-transformers / local embedding model |
| Pinecone/hosted vector DB | FAISS, Chroma or local Qdrant |
| web search / Firecrawl | preloaded local corpus / imported snapshots |
| Gmail/Notion/GitHub MCP | local MCP server, exported data, local git repo |
| live voice API | Whisper/whisper.cpp + local LLM + Piper/Kokoro |
| cloud VLM | local VLM + OpenCV/FFmpeg |
| internet release monitor | local manifest/folder watcher; online refresh is separate |
| browser agent on public web | Playwright against localhost/intranet allowlist |

A feature that requires fresh external information cannot truthfully be
air-gapped. The offline product uses local snapshots; refresh/sync is a separate
connected operation.

## Product blueprints now available

The backend exposes reusable product recipes for:

- Private Knowledge Assistant
- Offline Research Workspace
- Recruitment Copilot
- Local Data Analyst
- Codebase Copilot
- Private Customer Support AI
- Offline Voice Support AI
- Document Intelligence
- AI Dashboard Builder
- Local Tool/MCP Agent
- Private AI Tutor
- Local RPA Agent
- Visual Inspection AI
- Offline Content Studio
- Domain Model Lab

These are defined in
`python-backend/capabilities/product_blueprints.py`.

## Offline core + opt-in online extensions

The default product mode is **offline-first**. Every product should compose its
primary behavior from local models, local retrieval, local storage and local
tools whenever technically feasible.

When the user explicitly enables connected mode, the Factory may attach
optional extension adapters such as:

- live web research / browser MCP,
- GitHub MCP,
- SaaS MCP connectors,
- mail/calendar connectors,
- live finance/travel/maps/business-data APIs,
- remote browser automation,
- cloud real-time voice,
- cloud multimodal/VLM services.

These are **extensions, not foundations**. The intended runtime shape is:

```text
Local product core
  ├─ local LLM
  ├─ local RAG / memory
  ├─ local DB/files
  ├─ local UI / agents
  └─ local tools
       |
       +-- optional online extension gateway
             ├─ MCP
             ├─ live web
             ├─ GitHub
             ├─ SaaS
             ├─ mail/calendar
             └─ domain APIs
```

If an extension is unavailable, the product should keep running and use its
declared local fallback: cached/imported data, local git, local files, local
speech/vision, or a manual action export.

The extension registry lives in
`python-backend/capabilities/online_extensions.py`.

## How it plugs into the existing Product Factory

The existing Product Factory remains the system of record:

```text
Idea
 -> product reasoning / three plans
 -> exact approval contract
 -> offline capability resolver
 -> product blueprint composition
 -> architecture/tasks
 -> source generation
 -> isolated build/test
 -> independent acceptance checks
 -> evidence + source ZIP
```

The capability catalog is not a second framework. It feeds the current product
reasoning/build pipeline with reusable, local-first implementation choices.

## API

`GET /offline/status`

Shows whether air-gap enforcement is active.

`GET /offline/capabilities`

Returns every normalized offline capability, local stack and upstream
provenance.

`GET /offline/products`

Returns the reusable product blueprints.

`POST /offline/plan`

Example:

```json
{"idea":"Build a private voice support agent over PDF manuals"}
```

Returns the best matching local capabilities and product blueprints before the
normal Product Factory approval/build flow continues.

## Network enforcement

When `FACTORY_OFFLINE_ONLY=1`:

- Product Intelligence requests through `intelligence/http_client.py` cannot
  call public HTTP/HTTPS hosts.
- Provider routing cannot fall through to hosted LLMs.
- localhost / loopback remains legal for Ollama, LM Studio and local services.

This is the first enforcement boundary. Generated products should also be
tested in an isolated container with network disabled before they are labelled
"offline verified".

## Next hardening stages

The following are the next implementation stages for full production-grade
air-gap verification:

1. run generated-product acceptance containers with Docker network disabled;
2. add local embedding provider discovery beside local chat-model discovery;
3. create a local artifact/model registry with checksums and licenses;
4. add offline OCR/VLM/ASR/TTS adapters behind common interfaces;
5. add local vector-store profiles (FAISS/Chroma/Qdrant);
6. expose blueprint selection in Studio UI;
7. include an "offline proof" section in generated ZIP manifests;
8. reject generated dependencies that attempt runtime downloads;
9. add SBOM/license output for vendored models/libraries;
10. add optional connected "refresh station" that downloads models/corpora and
    exports signed offline bundles.

## Licensing

The upstream Awesome LLM Apps repository declares Apache-2.0. The Product
Factory catalog stores architecture provenance rather than importing the entire
repository. If source files are later vendored, preserve their license notices
and separately review the licenses/terms of each model, dataset and dependency.
