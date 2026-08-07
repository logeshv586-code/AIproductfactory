"""
Architecture Simulator — run the architecture before approving it.

Asks the questions a senior architect would: missing services, circular
dependencies, single points of failure, scalability concerns, bottlenecks and
security concerns. Produces a simulation score, applies deterministic revisions
(missing service added, replica added, security control added) and re-runs the
simulation until it passes or the revision budget is exhausted. Fully
deterministic — never calls the LLM.
"""

from __future__ import annotations

from typing import Any

from intelligence.prompt_utils import as_dict, as_list, as_str

_MAX_REVISION_ROUNDS = 2


def _detect_cycle(edges: list[dict[str, Any]]) -> list[str] | None:
    """Return the cycle nodes if the capability edge graph is cyclic."""
    graph: dict[str, list[str]] = {}
    for e in edges:
        src = as_str(e.get("source"))
        dst = as_str(e.get("target"))
        if src and dst:
            graph.setdefault(src, []).append(dst)

    WHITE: list[str] = []
    GREY: set[str] = set()
    BLACK: set[str] = set()
    cycle: list[str] = []

    def dfs(node: str, stack: list[str]) -> bool:
        GREY.add(node)
        stack.append(node)
        for nxt in graph.get(node, []):
            if nxt in GREY:
                i = stack.index(nxt)
                cycle[:] = stack[i:] + [nxt]
                return True
            if nxt not in BLACK:
                if dfs(nxt, stack):
                    return True
        stack.pop()
        GREY.discard(node)
        BLACK.add(node)
        return False

    for n in graph:
        if n not in BLACK:
            if dfs(n, []):
                return cycle
    return None


def _run_checks(
    strategy: dict[str, Any],
    capability_mappings: list[dict[str, Any]],
    composition_plan: dict[str, Any],
    architecture: dict[str, Any],
    architecture_views: dict[str, Any],
) -> list[dict[str, Any]]:
    """All deterministic architecture checks. Each: {severity, category, message}."""
    findings: list[dict[str, Any]] = []

    services = as_list(composition_plan.get("services"))
    service_caps = {as_str(s.get("capability")).lower() for s in services if as_str(s.get("capability"))}
    caps = as_list(strategy.get("capabilities"))
    caps_meta = {as_str(c.get("id")): c for c in as_list(composition_plan.get("_capabilities_meta"))}
    views = architecture_views

    # 1. Missing services — strategy capabilities with no composed service
    missing = [cid for cid in caps if cid and cid.lower() not in service_caps and not caps_meta.get(cid)]
    if missing:
        findings.append({
            "severity": "critical",
            "category": "missing_service",
            "message": f"No service composed for {len(missing)} capability(s): {missing}",
            "revision": "add_service",
            "items": missing,
        })

    # 2. Circular dependencies in the capability graph
    edges = as_list(composition_plan.get("_capability_edges"))
    cycle = _detect_cycle(edges)
    if cycle:
        findings.append({
            "severity": "warning",
            "category": "circular_dependency",
            "message": f"Circular dependency detected: {' → '.join(cycle)}",
            "revision": "record_topological_order",
            "items": cycle,
        })

    # 3. Single points of failure
    deploy = as_dict(architecture.get("deployment"))
    if len(services) <= 1:
        findings.append({
            "severity": "warning",
            "category": "single_point_of_failure",
            "message": "Single service — no redundancy; a crash takes the whole product down.",
            "revision": "add_redundancy",
        })
    if deploy and deploy in ("single_host", "monolith"):
        findings.append({
            "severity": "warning",
            "category": "single_point_of_failure",
            "message": f"Deployment is a {deploy} — add horizontal replicas behind a load balancer.",
            "revision": "add_redundancy",
        })

    # 4. Scalability — enterprise/scale capabilities need worker infra
    infra_need = {"worker", "queue", "event", "stream", "distributed"}
    caps_list = as_list(composition_plan.get("_capabilities_meta"))
    deploy_infra = " ".join(as_list(as_dict(views.get("deployment_architecture")).get("infrastructure"))).lower()
    has_worker = any(
        any(k in as_str(s.get("module", "")).lower() for k in ("worker", "queue", "stream"))
        for s in services
    ) or any(k in deploy_infra for k in ("worker pool", "task queue", "message queue", "worker"))
    for c in caps_list:
        infra = " ".join(as_list(c.get("required_infrastructure"))).lower()
        priority = as_str(c.get("priority"))
        if priority == "core" and any(k in infra for k in infra_need):
            if not has_worker:
                findings.append({
                    "severity": "warning",
                    "category": "scalability",
                    "message": f"{as_str(c.get('name'))} needs worker/queue infrastructure but none is composed.",
                    "revision": "add_worker_infra",
                })
                break

    # 5. Bottlenecks — high fan-in capabilities (many dependents)
    dependents: dict[str, int] = {}
    for e in edges:
        dst = as_str(e.get("target"))
        if dst:
            dependents[dst] = dependents.get(dst, 0) + 1
    for c, count in sorted(dependents.items(), key=lambda kv: kv[1], reverse=True)[:2]:
        if count >= 3:
            findings.append({
                "severity": "info",
                "category": "bottleneck",
                "message": f"{c} is depended on by {count} capabilities — a hot spot; isolate and cache it.",
                "revision": "note_bottleneck",
            })

    # 6. Security concerns — only flag when the controls are NOT already deployed.
    cap_names = " ".join(as_str(c.get("name")) for c in caps_list).lower()
    deployed_sec = " ".join(
        as_list(as_dict(views.get("deployment_architecture")).get("security_controls"))
    ).lower()
    has_pci = "pci" in deployed_sec or "tokenization" in deployed_sec
    has_auth = "auth" in deployed_sec or "rate limit" in deployed_sec
    for svc in services:
        svc_name = as_str(svc.get("capability", "")).lower()
        if ("payment" in svc_name or "billing" in svc_name) and not has_pci:
            findings.append({
                "severity": "warning",
                "category": "security",
                "message": "Payment capability — require PCI-scope isolation and tokenization.",
                "revision": "add_security_controls",
            })
    if any(k in cap_names for k in ("auth", "authentication", "identity")) and "auth" not in cap_names and not has_auth:
        findings.append({
            "severity": "warning",
            "category": "security",
            "message": "Product exposes user data but no Authentication capability is composed.",
            "revision": "add_security_controls",
        })

    return findings


def _apply_revisions(
    findings: list[dict[str, Any]],
    strategy: dict[str, Any],
    capability_mappings: list[dict[str, Any]],
    composition_plan: dict[str, Any],
    architecture: dict[str, Any],
    architecture_views: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, Any], list[str]]:
    """Deterministically revise the plan/architecture from the findings."""
    plan = json_clone(composition_plan)
    views = json_clone(architecture_views)
    notes: list[str] = []

    services = as_list(plan.get("services"))
    by_name = {
        as_str(m.get("capability_name")).lower(): as_dict(m)
        for m in capability_mappings if as_str(m.get("capability_name"))
    }
    caps_meta = {as_str(c.get("id")): c for c in as_list(plan.get("_capabilities_meta"))}

    for f in findings:
        revision = as_str(f.get("revision"))
        if revision == "add_service":
            for cid in as_list(f.get("items")):
                meta = caps_meta.get(cid) or {}
                name = as_str(meta.get("name")) or cid
                repo = as_str(by_name.get(name.lower(), {}).get("selected")) or "community/repo"
                service_name = "".join(w.lower().capitalize() for w in name.split() if w) or "service"
                service_name = service_name[0].lower() + service_name[1:] if service_name else "service"
                services.append({
                    "name": service_name,
                    "capability": name,
                    "repo": repo,
                    "module": "core",
                    "purpose": f"Simulation-added service for missing capability {name}",
                    "simulation_added": True,
                })
                notes.append(f"Added missing service for {name}")
            plan["services"] = services
        elif revision == "add_redundancy":
            infra = as_list(as_dict(views.get("deployment_architecture")).get("infrastructure"))
            if "replica set" not in " ".join(infra).lower():
                infra = infra + ["replica set behind load balancer"]
                views["deployment_architecture"] = {
                    **as_dict(views.get("deployment_architecture")),
                    "infrastructure": infra,
                }
            notes.append("Added replicas behind a load balancer (SPOF mitigation)")
        elif revision == "add_worker_infra":
            infra = as_list(as_dict(views.get("deployment_architecture")).get("infrastructure"))
            if "worker pool" not in " ".join(infra).lower():
                infra = infra + ["worker pool + task queue"]
                views["deployment_architecture"] = {
                    **as_dict(views.get("deployment_architecture")),
                    "infrastructure": infra,
                }
            notes.append("Added worker pool + task queue for core scale capability")
        elif revision == "add_security_controls":
            sec = as_list(as_dict(views.get("deployment_architecture")).get("security_controls")) or []
            for ctrl in ("PCI-scope isolation for payments", "Authentication + rate limiting", "Secrets via vault"):
                if ctrl not in sec:
                    sec.append(ctrl)
            views["deployment_architecture"] = {
                **as_dict(views.get("deployment_architecture")),
                "security_controls": sec,
            }
            notes.append("Added security controls (payments/auth/secrets)")
        elif revision in ("record_topological_order", "note_bottleneck"):
            notes.append(as_str(f.get("message")))

    return plan, views, notes


def json_clone(value: Any) -> Any:
    import json

    return json.loads(json.dumps(value))


def simulate_architecture(
    strategy: dict[str, Any],
    capability_mappings: list[dict[str, Any]],
    composition_plan: dict[str, Any],
    architecture: dict[str, Any],
    architecture_views: dict[str, Any],
    capability_edges: list[dict[str, Any]] | None = None,
    capabilities_meta: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Simulate the architecture and auto-revise it until it passes.

    Runs the checks, applies deterministic revisions, then re-runs (bounded by
    ``_MAX_REVISION_ROUNDS``). Returns ``{score, passed, checks, findings,
    simulation_rounds, revised_composition_plan, revised_architecture_views,
    revision_summary}``. Fully deterministic; never raises.
    """
    plan = json_clone(composition_plan)
    if capabilities_meta is not None:
        plan["_capabilities_meta"] = json_clone(capabilities_meta)
    if capability_edges is not None:
        plan["_capability_edges"] = json_clone(capability_edges)

    views = json_clone(architecture_views)
    rounds: list[dict[str, Any]] = []
    revision_summary: list[str] = []
    # A finding (by its category+message signature) may only be revised once —
    # prevents duplicate notes from re-firing every round on non-convergent checks.
    revised_signatures: set[tuple[str, str]] = set()

    for round_no in range(1, _MAX_REVISION_ROUNDS + 2):
        findings = _run_checks(strategy, capability_mappings, plan, architecture, views)
        score = max(0, 100 - 30 * sum(1 for f in findings if f["severity"] == "critical")
                    - 12 * sum(1 for f in findings if f["severity"] == "warning")
                    - 5 * sum(1 for f in findings if f["severity"] == "info"))
        rounds.append({
            "round": round_no,
            "score": score,
            "findings": len(findings),
            "revisions_applied": len(revision_summary),
        })
        # Any finding with a revision action triggers an auto-revision — not
        # just critical ones (scalability/security/bottleneck warnings too).
        fresh = [f for f in findings if f.get("revision") and (f["category"], f.get("message", "")) not in revised_signatures]
        if not fresh or round_no > _MAX_REVISION_ROUNDS:
            break
        plan, views, notes = _apply_revisions(fresh, strategy, capability_mappings, plan, architecture, views)
        if notes:
            for f in fresh:
                revised_signatures.add((f["category"], f.get("message", "")))
            revision_summary.extend(notes)
        else:
            break  # no actual change produced — stop before spinning

    final_findings = _run_checks(strategy, capability_mappings, plan, architecture, views)
    final_score = max(0, 100 - 30 * sum(1 for f in final_findings if f["severity"] == "critical")
                      - 12 * sum(1 for f in final_findings if f["severity"] == "warning")
                      - 5 * sum(1 for f in final_findings if f["severity"] == "info"))
    plan.pop("_capabilities_meta", None)
    plan.pop("_capability_edges", None)

    return {
        "score": final_score,
        "passed": not any(f["severity"] == "critical" for f in final_findings),
        "checks": [
            {
                "name": "missing_service",
                "status": "fail" if any(f["category"] == "missing_service" for f in final_findings) else "pass",
                "detail": "every strategy capability maps to a composed service",
            },
            {
                "name": "circular_dependency",
                "status": "fail" if any(f["category"] == "circular_dependency" for f in final_findings) else "pass",
                "detail": "capability graph is acyclic",
            },
            {
                "name": "single_point_of_failure",
                "status": "fail" if any(f["category"] == "single_point_of_failure" for f in final_findings) else "pass",
                "detail": "redundancy exists for critical services",
            },
            {
                "name": "scalability",
                "status": "fail" if any(f["category"] == "scalability" for f in final_findings) else "pass",
                "detail": "core scale capabilities have worker/queue infrastructure",
            },
            {
                "name": "bottleneck",
                "status": "fail" if any(f["category"] == "bottleneck" for f in final_findings) else "pass",
                "detail": "no capability is a single hot spot with many dependents",
            },
            {
                "name": "security",
                "status": "fail" if any(f["category"] == "security" for f in final_findings) else "pass",
                "detail": "payments/auth/security controls present where needed",
            },
        ],
        "findings": final_findings,
        "simulation_rounds": rounds,
        "revised_composition_plan": plan,
        "revised_architecture_views": views,
        "revision_summary": revision_summary,
    }
