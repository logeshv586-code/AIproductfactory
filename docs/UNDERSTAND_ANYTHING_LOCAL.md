# Understand Anything — Project-local integration

AI Product Factory can install [Egonex-AI/Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) locally for repository understanding without requiring a global plugin installation.

## Why it is included

Understand Anything builds a code/knowledge graph for a repository and gives coding agents a stronger picture of files, functions, classes, dependencies, business domains and change impact. This is useful when AI Product Factory itself is being improved, debugged or extended.

It is **not** used as a substitute for natural-language product intent understanding. Customer prompts are interpreted by the Product Factory intent/capability pipeline; Understand Anything supplies local codebase context for engineering agents.

## Install locally

```bash
npm run understand:install
```

The installer:

1. checks out `Egonex-AI/Understand-Anything` under `.tools/understand-anything`;
2. uses a pinned upstream commit for reproducible behavior;
3. links the upstream skills into this repository's `.agents/skills` directory;
4. works with project-local links/junctions rather than requiring the user's global agent configuration;
5. writes local provenance to `.understand-anything.local.json`;
6. keeps the checkout, linked skills and generated `.ua` graph out of Git.

## Use it

After installation, restart/reload the coding agent if it does not immediately discover the project-local skills.

- Codex/compatible agents: `$understand`
- Claude Code native plugin style: `/understand`
- Plain-language fallback: `Use the understand skill to analyze this project.`

The generated graph is stored locally at:

```text
.ua/knowledge-graph.json
```

Useful upstream skills include project analysis, chat/search over the graph, explanations, diff-impact analysis, onboarding and domain/business-flow extraction.

## Check status

```bash
npm run understand:status
```

## Update intentionally

```bash
npm run understand:update
```

`understand:update` fetches the current upstream `main` revision and records the exact commit locally. Review upstream changes before relying on a newly updated skill set in release workflows.

## Accuracy role inside Product Factory

The responsibilities are intentionally separated:

```text
Customer language
      ↓
Product intent + capability extraction
      ↓
Capability-aware live research
      ↓
Relevance / maintenance / license / integration scoring
      ↓
3 customer-friendly product plans
      ↓
Human approval + source lock
      ↓
Implementation agent
      ↕
Understand Anything local code graph
      ↓
Build + tests + security + outcome verification
```

This keeps a codebase-understanding tool from being mistaken for a general customer-intent model while still giving coding agents deep local project context.

## Upstream license

Understand Anything is distributed under the MIT license. The local installer clones the upstream repository rather than copying its source into AI Product Factory, and the pinned upstream revision remains separately attributable to `Egonex-AI/Understand-Anything`.
