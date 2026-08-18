# AI Product Factory v7 — Manager-First Product Studio

## Purpose

The v7 Studio turns the existing Product Intelligence OS into a clearer product-creation workflow without replacing the v5/v6 intelligence stack.

The user flow is:

1. **Define** — describe a new product or an enhancement to an existing product.
2. **Research** — run Product Thinking, requirement, market, competitor, capability, GitHub, repository, debate, tournament, review and self-critique stages.
3. **Decide** — score practical 1-, 2- and 3-repository compositions. The final manager picks one and clearly shows fit, coverage, compatibility, license signal and integration risk.
4. **Architect** — approve a strategy and run composition, architecture, simulation, blueprint and engineering stages.
5. **Build** — optionally call the existing full autonomous build route immediately after approval.
6. **Export** — provide direct GitHub links plus an IDE-ready implementation prompt with source-provenance and quality gates.

Open `/studio` to use the new workflow. The existing root dashboard remains available at `/`.

## Why the manager layer is deterministic

Repository composition is deliberately calculated in code instead of asking an LLM to invent a percentage. The manager considers:

- capability coverage, weighted by capability priority;
- repository relevance/quality scores already produced by GitHub Intelligence;
- license metadata;
- maintenance score;
- language/API compatibility;
- integration risk from repository count, language boundaries and missing license metadata;
- Product Intelligence review, propagated confidence, self-critique and architecture simulation signals.

`fitPercentage` and `estimatedFeasibility` are **evidence-based estimates**, not guarantees. The generated IDE prompt explicitly requires a runnable proof-of-concept and fresh inspection of each repository before integration.

## Open-source composition policy

AI Product Factory must not blindly copy and merge unrelated GitHub source trees.

Preferred order:

1. official package/dependency;
2. documented API/SDK;
3. isolated service;
4. adapter around a repository module;
5. reimplementation behind the same interface when licensing or architecture makes direct reuse unsafe.

Before copying source, verify the repository license. Preserve copyright/license notices and create `THIRD_PARTY_NOTICES.md`. Missing or incompatible license metadata means **do not copy the source** until a human verifies permission.

## Frontend

New route:

- `src/app/studio/page.tsx`

The page owns the workflow state and calls only server routes:

- `POST /api/factory/pi/strategize`
- `POST /api/factory/manager`
- `POST /api/factory/pi/approve`
- `POST /api/factory/build` when auto-build is enabled

This keeps credentials and GitHub access server-side.

## Backend manager

New modules:

- `src/lib/factory/manager.ts`
- `src/app/api/factory/manager/route.ts`

Input:

```json
{
  "idea": "product brief",
  "runId": "optional PI run id",
  "graph": { "...": "Product Knowledge Graph" }
}
```

Output:

- recommended strategy;
- top three practical repository portfolios;
- final manager verdict (`GO`, `GO_WITH_GUARDS`, `RESEARCH_MORE`);
- estimated feasibility and manager confidence;
- architecture preview;
- explicit seven-stage build flow;
- direct repository URLs and clone commands;
- IDE-ready implementation prompt;
- source-provenance policy.

## Environment configuration

The Studio reuses the current environment variables; do not place tokens in browser code.

Recommended production configuration:

```bash
# GitHub research (higher API rate limit and richer discovery)
GITHUB_TOKEN=...

# Python Product Intelligence backend
PYTHON_BACKEND_URL=http://127.0.0.1:8001
PYTHON_BACKEND_PORT=8001

# Optional external research
TAVILY_API_KEY=...

# Choose/configure the LLM provider already supported by the project
LLM_PROVIDER=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
GEMINI_API_KEY=...
NVIDIA_API_KEY=...

# Existing full-build quality gate
MIN_ACCEPTABLE_PRODUCT_SCORE=0.4
```

Use only the provider keys you actually need. In production, restrict CORS on the Python service and keep it private behind the Next.js server/proxy.

## Scalability guidance

For multi-user production deployment:

- move long Product Intelligence/build runs to a durable job queue;
- store run state in the existing database rather than browser state;
- stream stage events using SSE/WebSocket instead of holding a single request open for many minutes;
- cache GitHub metadata by repository + commit and capability search query;
- rate-limit user-triggered research/build endpoints;
- use per-workspace output directories and sandbox autonomous execution;
- pin repository commits used by a build so results are reproducible;
- persist artifact provenance (source URL, commit SHA, license, adapter version);
- run generated code/tests in an isolated container, never directly on the host;
- add OpenTelemetry traces for every agent stage and external API call;
- enforce tenant/workspace authorization before exposing stored runs or generated files.

## Architecture direction

The Product Knowledge Graph remains the shared state between specialized agents. The new Manager is a decision layer after agent reasoning, not another unconstrained agent. This gives the system a strong separation of responsibilities:

- **LLM agents:** understand, research, critique, design and explain.
- **Deterministic engines:** rank repositories, calculate coverage/risk, validate graphs, simulate architecture and enforce thresholds.
- **Manager:** converts evidence into a small number of buildable choices and an implementation contract.
- **Execution:** generates/changes code only after a decision gate.
- **Learning:** records approved outcomes and feeds evidence into later runs.

This structure is safer and more scalable than letting one model research GitHub, choose code, merge it and declare success in a single prompt.
