# Product Reasoning Core: implementation map

This document describes the implemented path replacing the Studio's legacy build flow. The [architecture proposal](./PRODUCT_REASONING_ARCHITECTURE.md) remains the broader design target; its original repository findings describe the pre-implementation baseline.

## Code ownership

| Responsibility | Implementation |
|---|---|
| Brief, source, experience, task and acceptance schemas | `python-backend/factory_core/models.py` |
| Bounded provenance-aware retrieval | `python-backend/factory_core/research.py` |
| Model-independent synthesis and validation feedback | `python-backend/factory_core/reasoning.py` |
| Durable owned contracts, approvals, leases and outcomes | `python-backend/factory_core/store.py` |
| Canonical planning, approval, asynchronous build and artifact API | `python-backend/factory_core/api.py` |
| File-scoped engineering, dependency scheduling, repairs and packaging | `python-backend/execution/contract_builder.py` |
| Docker execution boundary | `python-backend/execution/isolated_runner.py` |
| Trusted build and separate HTTP/Playwright evaluator | `python-backend/execution/runner/` |
| Browser-owned backend proxy | `src/lib/factory/core-proxy.ts` |
| Product review and build progress | `src/components/factory/FactoryStudioCore.tsx` |

## Invariants enforced in code

- Three plans share one run and preserve the user's platform/privacy constraints. Each requirement links to implementation and acceptance criteria; tasks form an acyclic dependency graph. Duplicate IDs, traversal paths and edits to controller-owned evidence/bootstrap files fail validation.
- Approval references a stored plan and its canonical SHA-256 hash. The build accepts `runId`, `approvalId`, `contractHash` and `idempotencyKey`; it does not accept a caller-supplied replacement idea or repository list. An old approval superseded by another selection cannot start a new job.
- `queued → building → verifying → ready/blocked/failed` is persisted with repair, cancellation and explicit-resume transitions. Duplicate enqueue does not create duplicate work. Worker leases prevent a cancelled or superseded worker from publishing a result. Restart recovery preserves task checkpoints and spent budgets; it requires reconnecting a provider and pressing Resume.
- All declared tasks are scheduled; there is no eight-task truncation. Files are validated as a batch before writes. The model cannot rewrite the contract or evaluator to make its own tests pass.
- Source and contract digests bind observations to a build. The source digest covers build inputs before controller reports are added; the ZIP digest additionally covers the packaged reports. Missing acceptance observations, missing runtime proof, incomplete tasks, missing declared files, fixture mode and manual/native checks block verified status.
- Approval records preference. Recent `acceptance_passed` outcomes scoped to the same browser owner and platform are the only history used by new planning. This is retrieval of measured outcomes, not neural-network training.

## Isolation and checks

The controller does not execute generated code on its own host. A Docker application container has an internal network, resource limits, an unprivileged user, dropped capabilities, a read-only root and writable temporary work space. It receives only the generated source. A separate container receives the server-owned acceptance contract and runs HTTP/browser observations; generated tests do not determine the final label. Browser previews are captured images, not generated JavaScript embedded in the Studio origin.

The image is provisioned with pinned Python and web dependencies. Builds do not fetch packages from the public network. Unsupported dependencies block the build and need an operator-provisioned runner. Browser and API checks use the generated application's internal address. External credentials, Internet services and native operating systems are outside this runner's evidence.

Desktop scaffolds use a custom local protocol, context isolation, sandboxed renderers, disabled Node integration and denied new windows/permissions. These defaults follow [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security); they do not replace a product-specific security or native launch test. Containerized browser execution follows the [Playwright Docker deployment model](https://playwright.dev/python/docs/docker), with the container as the execution boundary.

## Migration

`/studio` now uses the Core after existing model onboarding. Next.js `/api/factory/core/*` proxies the owned backend `/factory/*` API. `/api/factory/build/approved` is a compatibility entry to the new build request shape. Old artifact URLs require ownership and refer to Core job IDs; old unowned archives are not exposed. The legacy `/execution/run_task` endpoint returns 409 and directs callers to approved builds. Legacy pipeline research remains available but no longer starts the old product builder automatically.

Earlier deep-research/strategy tools remain useful diagnostic modules. Their scores and historical demo media are not proof of the new contract's acceptance. Existing legacy state is not imported as approved Core state; create fresh plans in the Studio.

## Current limits

- The search is bounded to at most four repository candidates plus selected discovery sources. Representative code samples are not an exhaustive repository audit. Source references and quoted context remain untrusted input.
- Model-generated criteria need user review: passing them cannot establish correctness for unstated requirements or prove universal novelty. Real model product quality needs separately recorded evaluations with actual model access.
- React/FastAPI is the supported execution substrate. Desktop and automation have contract-aware profiles, but desktop installers, Python sidecar distribution, external workflow services and production credentials require additional platform evidence. Native checks intentionally prevent a desktop build from being labelled verified by Linux web tests alone.
- SQLite supports a durable single-host service. There is no distributed worker queue or cross-machine scheduling; migrate transaction boundaries to PostgreSQL/queue infrastructure before scaling that way.
- Ownership uses a 30-day opaque browser token. There is no account recovery, organization membership, SSO or per-user compute quota. Those remain deployment work before an Internet-facing multi-tenant release.
- Planning has a 540-second overall timeout. Engineering enforces checkpoints against wall time, call count and repair rounds. In-flight model/runner operations have their own bounded timeouts; cancelling a job revokes publication immediately but an in-flight container can continue until its bounded run ends.
- Custom dependency sets, native release attestations, adoption feedback and offline neural-network training are not implemented by this change. They must not be inferred from the architecture diagram.

## Regression coverage

Python tests cover contract validity, hash changes, exact plan B, ownership, superseded approval, idempotency, worker leases, cancellation, recovery, privacy, file boundaries, missing/stale evidence and truthful fixture packaging. A real Docker test rejects a scaffold before accepting an implemented calculation; CI requires the image so this check cannot silently skip there. Playwright exercises the hydrated Studio, locked selection, forged-hash rejection, duplicate build requests, ZIP download, reload recovery and unauthenticated denial.

## Validation of this implementation

Local validation: 66 Python tests passed; one real-container test skipped because Docker is unavailable in the editing environment. Lint, TypeScript and the production build passed. A Playwright browser run exercised the complete offline Studio/approval/download flow. These tests validate the Factory and fixture behavior, not real-model generation quality or native desktop installation.

Next.js and its lint configuration were updated to 16.3.5; Playwright is pinned to 1.55.1 in both test and runner tooling. The dependency audit now reports zero critical findings. It still reports seven high and seven moderate findings in other dependencies; this change does not claim a clean dependency audit. Relevant patch references: [Next.js image optimization advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) and [Playwright download advisory](https://github.com/advisories/GHSA-7mvr-c777-76hp).
