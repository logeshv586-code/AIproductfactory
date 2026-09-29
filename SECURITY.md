# Security Policy

AI Product Factory executes models, tools and generated code. Treat security boundaries as product features.

## Reporting a vulnerability

Please do **not** publish exploit details in a public issue if the problem could expose credentials, escape a sandbox, execute unintended code, bypass ownership, alter protected acceptance criteria or enable unauthorized remote actions.

Use GitHub's private security reporting for this repository when available. If private reporting is unavailable, contact the repository owner through an appropriate private channel before disclosure.

Include:

- affected commit / version
- attack prerequisites
- reproduction steps
- expected vs actual behavior
- impact
- suggested mitigation if known

## High-risk areas

Security review is especially important for:

- generated-code execution
- Docker / isolated runner boundaries
- MCP and remote tool execution
- browser automation
- model/provider credentials
- artifact ownership and download authorization
- source ZIP integrity
- path traversal / file manifests
- dependency installation
- runtime downloads
- prompt injection through retrieved content
- webhooks / external actions
- local network access

## Security principles

- never expose provider/API secrets to generated products
- keep local-model URLs restricted to loopback by default
- require explicit user enablement for connected extensions
- keep tool scopes and destinations allowlisted
- treat retrieved text/code as untrusted data, not instructions
- bind verification evidence to exact generated source
- fail closed on authorization ambiguity
- keep offline mode from silently reaching public hosts

A verified product result is evidence for the checks that ran; it is not a universal security certification.
