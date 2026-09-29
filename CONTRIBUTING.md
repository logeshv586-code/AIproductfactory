# Contributing to AI Product Factory

Thanks for helping build a more capable, verifiable and offline-first AI product-engineering system.

## Start with the layer, not the size of the PR

The best contributions usually strengthen one clear layer:

- capability primitives
- product blueprints
- local model / embedding adapters
- RAG and memory
- MCP / connector gateways
- voice or vision
- isolated verification
- security / SBOM / sandboxing
- deployment adapters
- evaluation and benchmarks
- Studio UX and accessibility
- docs, examples and installation reliability

For large ideas, open a **Capability Request** first. Describe what problem it unlocks, whether it works offline, what connected services are optional, and how it can be verified.

## Architecture rules

Please preserve these invariants:

1. **Offline-first is the default.** A capability should not require public internet when a practical local implementation exists.
2. **Online features are adapters.** MCP, web, SaaS and domain APIs should be explicit, user-enabled and replaceable.
3. **Approval is authoritative.** Build agents cannot silently change the approved contract.
4. **Acceptance is protected.** Implementation code cannot redefine its own success criteria.
5. **Evidence beats confidence.** If a behavior cannot be tested, mark the limitation instead of claiming success.
6. **No hidden runtime downloads.** Offline-labelled products must not fetch models/packages/data at runtime without an explicit connected step.
7. **Open-source provenance matters.** Do not copy third-party code without reviewing and preserving its license obligations.

## Development setup

Requirements:

- Node.js 22+
- Python 3.12+
- npm
- Docker for isolated verification

```bash
npm ci
python3 -m venv .venv
.venv/bin/pip install -r python-backend/requirements.txt
```

Run the Studio:

```bash
npm run dev:all
```

## Before opening a PR

Run the relevant checks:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build

cd python-backend
../.venv/bin/python -m pytest -q
```

If your change affects generated-product verification, also exercise the isolated runner.

## PR expectations

A strong PR explains:

- **Problem:** what is missing or unreliable?
- **Layer:** capability, blueprint, extension, verification, UX, etc.
- **Offline behavior:** what works with no public network?
- **Connected behavior:** what optional online adapter is added?
- **Fallback:** what happens when the connected service is unavailable?
- **Verification:** how do we prove the behavior?
- **Compatibility:** what existing paths could be affected?
- **Docs:** what needs to be discoverable by contributors/users?

Keep changes focused. Avoid unrelated dependency churn.

## Capability contribution shape

A reusable capability should ideally provide:

- stable ID and category
- clear responsibility
- local implementation path
- optional online adapters
- explicit dependencies
- failure/fallback behavior
- tests or measurable acceptance
- documentation / example product use

## Product blueprint contribution shape

A blueprint should describe a useful composition, not a copied template.

Include:

- target problem
- intended users
- capabilities required
- local stack
- optional online extensions
- expected product outputs
- verification ideas

## Security-sensitive changes

For sandboxing, authentication, secrets, supply chain, model execution or remote tool access, read [SECURITY.md](./SECURITY.md) and prefer a focused reviewable PR.

## Good first contributions

- improve installation detection
- add capability matching tests
- add a local adapter
- improve offline fallbacks
- create a new blueprint from existing capabilities
- add verification coverage
- improve contributor docs
- add accessibility fixes to Studio
- add reproducible examples

Thank you for building the missing layers with us.
