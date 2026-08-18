# AI Product Factory v8 — Explainable Open-Source Product Creation

## Core rule

The Factory must never present model confidence as proof that a product is correct. Research produces recommendations. A build becomes **VERIFIED** only after source, license, build, test, security and end-to-end gates pass against pinned versions.

## User flow

1. **Define** — new product or enhancement of an existing product.
2. **Current research** — Product Intelligence + GitHub capability discovery + live multi-source research.
3. **Repository due diligence** — explain what every repo does, where it is strong/weak, its license/security evidence and the capability it contributes.
4. **Composition manager** — produce up to three intentionally different implementation paths:
   - Option A: best evidence-backed foundation.
   - Option B: two-repo/core fusion or expanded core.
   - Option C: alternative stack with minimal overlap when enough candidates exist.
5. **Explain combine** — define adapters/services/dependencies, data flow, custom product-owned code, risks and resulting user product.
6. **Architecture** — approve a strategy, compose repository boundaries and simulate the architecture.
7. **Commercial intelligence** — show current price evidence where available, suggested subscription tiers, implementation/white-label range, modeled COGS/margin/break-even scenarios and the assumptions behind them.
8. **Build** — run the autonomous build pipeline or copy the complete implementation prompt into an IDE agent.
9. **Verify** — clean build, tests, security/license gates, realistic end-to-end workflow and measured cost/latency.
10. **Learn** — persist outcomes to Product Memory/Experience so future recommendations improve.

## Research source matrix

| Source | Use | Mode |
|---|---|---|
| GitHub | repositories, releases, issues, maintenance | core |
| GitLab | public open-source alternatives | live |
| Hugging Face | models, datasets, Spaces | live |
| deps.dev / OpenSSF | project health, license, package mappings, Scorecard | core |
| OSV | vulnerability evidence | on demand |
| Hacker News | current developer launches and interest | live |
| Stack Overflow | implementation pain points and demand | live |
| arXiv | recent technical methods/research | live |
| Docker Hub | container availability | on demand |
| PyPI / npm | package/release metadata | on demand |
| Tavily/web | competitors, pricing, news and product pages | configured |

Product Hunt is intentionally not a default commercial data source because its API documentation restricts commercial API use unless permission is obtained.

## What “combine repositories” means

Do **not** concatenate source trees.

Preferred boundary order:

1. Published dependency/package + internal adapter.
2. Documented SDK/API + typed client adapter.
3. Separate service/container + HTTP/queue/CLI boundary.
4. Reference-only reimplementation when the license or integration contract is unsuitable.

Every external component must be replaceable. Product-owned code includes the domain model, normalized contracts, orchestration, auth/tenant boundaries, UI/API, persistence, observability, cost controls, tests and deployment.

## Accuracy / verification contract

The Factory may report an **estimated fit** or **research confidence**, but never a 100% success guarantee.

Required release gates:

- Source URL + pinned tag/commit verified.
- License and attribution reviewed.
- Clean install + production build pass.
- Adapter contract tests pass, including timeout/upstream failure cases.
- Unit + integration + E2E tests pass.
- Dependency/advisory/security checks pass.
- Target user workflow succeeds on realistic data.
- Cost and latency are measured against product limits.

## Commercial intelligence

Pricing is a hypothesis until validated. v8 exposes:

- competitor numeric price evidence when available,
- Starter / Pro / Business monthly and annual suggestions,
- modeled per-customer COGS,
- modeled gross margin,
- modeled break-even customer count,
- 100- and 500-customer contribution scenarios,
- custom implementation / white-label sale range,
- profit actions such as usage guardrails, annual prepay, enterprise add-ons and model-routing cost controls.

Replace all modeled costs with telemetry from the runnable build before making financial commitments.
