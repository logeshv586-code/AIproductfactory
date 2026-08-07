"""
Composition Engine — the post-approval half of the pipeline.

Six functions that turn an approved strategy into concrete engineering output:
deep research, repository composition plan, architecture, blueprint, engineering
setup and execution plan. Deep research and architecture use the LLM (with a
deterministic fallback); composition, blueprint, engineering and execution are
deterministic — they assemble the strategy, capability mappings and architecture
into structured plans. Never raises.
"""

from __future__ import annotations

from typing import Any

from agents.architecture_designer import design_architecture
from intelligence.prompt_utils import ask_json, as_dict, as_list, as_str
from llm.provider import LLMProvider


def _caps_by_name(capability_mappings: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {as_str(m.get("capability_name")): as_dict(m) for m in capability_mappings if as_str(m.get("capability_name"))}


# ── 8a: Deep Research ────────────────────────────────────────────────────────
_DEEP_RESEARCH_SYSTEM = """You are a deep-research engineer inside an AI product factory.
A product strategy has been approved. Research the specific technologies and
repositories in its repository map.

Return ONLY valid JSON with EXACTLY these keys:
{
  "technologies": [{"name": "tech", "why": "why chosen", "best_for": "what it's best at"}],
  "integration_patterns": ["pattern"],
  "best_practices": ["practice"],
  "api_notes": ["note"],
  "sources": ["url"]
}
Be concrete about the repos in the map. Do not add or remove keys."""


async def deep_research(
    intent: dict[str, Any],
    strategy: dict[str, Any],
    capability_mappings: list[dict[str, Any]],
    provider: LLMProvider,
) -> dict[str, Any]:
    data = await ask_json(
        provider,
        _DEEP_RESEARCH_SYSTEM,
        f"INTENT:\n{intent}\n\nAPPROVED STRATEGY:\n{strategy}\n\nREPOSITORY MAP:\n{capability_mappings}",
        fallback=None,
        temperature=0.4,
        max_tokens=1200,
    )
    if isinstance(data, dict) and data.get("technologies"):
        return {
            "technologies": as_list(data.get("technologies")),
            "integration_patterns": as_list(data.get("integration_patterns")),
            "best_practices": as_list(data.get("best_practices")),
            "api_notes": as_list(data.get("api_notes")),
            "sources": as_list(data.get("sources")),
        }
    # fallback: derive from the selected repos' languages + capability technologies
    technologies: list[dict[str, str]] = []
    seen: set[str] = set()
    for m in capability_mappings:
        md = as_dict(m)
        selected = as_str(md.get("selected"))
        name = as_str(md.get("capability_name"))
        if selected and selected not in seen:
            seen.add(selected)
            technologies.append(
                {"name": selected, "why": f"Selected for {name}", "best_for": name}
            )
    if not technologies:
        technologies = [{"name": "Python", "why": "Default runtime", "best_for": "backend"}]
    return {
        "technologies": technologies,
        "integration_patterns": ["HTTP APIs between services", "Shared event bus for domain events"],
        "best_practices": ["Keep each selected repo's public API as the integration boundary", "Wrap upstream repos behind adapters"],
        "api_notes": ["Prefer the documented interfaces over internals of selected repos"],
        "sources": [],
    }


# ── 8b: Composition Plan (deterministic) ─────────────────────────────────────
_MODULE_MAP = [
    ("crawl", ["crawler", "spiders", "scraper"]),
    ("matching", ["matcher", "normalizer", "align"]),
    ("search", ["search", "indexer", "index"]),
    ("recommend", ["recommender", "recsys", "recommendation"]),
    ("notif", ["notifications", "notify", "alerts"]),
    ("analytics", ["analytics", "metrics", "stats"]),
    ("auth", ["auth", "identity"]),
    ("payment", ["payments", "billing"]),
    ("llm", ["llm", "agents", "orchestrator"]),
    ("memory", ["memory", "store"]),
    ("workflow", ["workflow", "engine", "orchestrator"]),
    ("schedule", ["scheduler", "scheduling", "cron"]),
    ("api", ["api", "server", "backend"]),
    ("ui", ["ui", "frontend", "web"]),
    ("monitor", ["monitoring", "health", "metrics"]),
    ("observ", ["telemetry", "tracing", "observability"]),
]


def _modules_for_capability(name: str) -> list[str]:
    lowered = name.lower()
    for key, modules in _MODULE_MAP:
        if key in lowered:
            return modules
    return ["core"]


def build_composition_plan(strategy: dict[str, Any], capability_mappings: list[dict[str, Any]]) -> dict[str, Any]:
    repo_map = as_dict(strategy.get("repository_map"))
    by_name = _caps_by_name(capability_mappings)

    services: list[dict[str, Any]] = []
    reuse_map: dict[str, Any] = {}
    for cap_name, repo in repo_map.items():
        if not repo or not cap_name:
            continue
        modules = _modules_for_capability(cap_name)
        service_name = "".join(w.lower().capitalize() for w in cap_name.split() if w) or "service"
        service_name = service_name[0].lower() + service_name[1:] if service_name else "service"
        services.append(
            {
                "name": service_name,
                "capability": cap_name,
                "repo": repo,
                "module": ", ".join(modules),
                "purpose": f"Reuse the {cap_name.lower()} modules from {repo}",
            }
        )
        reuse_map[cap_name] = {"repo": repo, "modules": modules}

    # v2: Repository Composition Blueprint — module-level reuse decisions,
    # APIs to expose, files to reuse/isolate, adapters, conflicts, replacements.
    blueprint = {
        "services": services,
        "reuse_map": reuse_map,
        "integration_boundaries": [
            "Each selected repo contributes modules only — wrap them behind the service's public API",
            "Shared contracts (models/DTOs) live in a common package",
        ],
        "required_modifications": [
            "Strip repo-specific demo/example code",
            "Add configuration and secrets wiring for the composed service",
        ],
        "potential_conflicts": [
            "Dependency version clashes between selected repos — resolve in the lockfile",
            "Duplicate utility modules across repos — consolidate in shared package",
        ],
    }

    # v2 blueprint additions: per-repo modules to reuse, APIs to expose,
    # files to reuse, files to isolate, required adapters, replacement candidates.
    for svc in services:
        cap = svc["capability"]
        repo = svc["repo"]
        modules = svc["module"].split(", ")
        svc["files_to_reuse"] = [f"{m}/**" for m in modules]
        svc["files_to_isolate"] = [
            "tests/", "examples/", "demo/", "scripts/", "config/",
            f"{repo.split('/')[-1]}/README.md",
        ]
        svc["apis_to_expose"] = [
            f"{cap.lower().replace(' ', '_')}_api",
        ]
        svc["required_adapters"] = [
            f"{cap.lower().replace(' ', '_')}_adapter",
        ]
        svc["replacement_candidates"] = [
            f"Alternative {cap.lower()} repos from the capability mapping",
        ]

    blueprint["reuse_map"] = {
        cap: {
            "repo": info["repo"],
            "modules": info["modules"],
        }
        for cap, info in reuse_map.items()
    }

    return blueprint


# ── 8c: Architecture ─────────────────────────────────────────────────────────
_ARCH_SYSTEM = """You are a senior software architect inside an AI product factory.
Design the architecture from the capability graph and repository composition plan
(NOT a static template).

Return ONLY valid JSON with EXACTLY these keys:
{
  "components": [{"name": "name", "role": "role", "tech": "tech", "interface": "api|cli|lib|ui"}],
  "data_flows": [{"from": "component", "to": "component", "data": "what flows"}],
  "tech_stack": ["tech"],
  "deployment": "docker-compose | k8s | serverless",
  "diagram_description": "text description of the architecture"
}
Production-ready with separation of concerns. Do not add or remove keys."""


async def build_architecture(
    strategy: dict[str, Any],
    capability_mappings: list[dict[str, Any]],
    composition_plan: dict[str, Any],
    provider: LLMProvider,
) -> dict[str, Any]:
    data = await ask_json(
        provider,
        _ARCH_SYSTEM,
        f"APPROVED STRATEGY:\n{strategy}\n\nREPOSITORY MAP:\n{capability_mappings}\n\nCOMPOSITION PLAN:\n{composition_plan}",
        fallback=None,
        temperature=0.4,
        max_tokens=1400,
    )
    if isinstance(data, dict) and as_list(data.get("components")):
        return {
            "components": as_list(data.get("components")),
            "data_flows": as_list(data.get("data_flows")),
            "tech_stack": as_list(data.get("tech_stack")),
            "deployment": as_str(data.get("deployment")) or "docker-compose",
            "diagram_description": as_str(data.get("diagram_description")),
        }
    # fallback: reuse the existing architecture designer with a minimal product dict
    product = {
        "name": as_str(strategy.get("name")) or "Product",
        "description": as_str(strategy.get("description")),
        "system_flow": "User → API → Capabilities → Output",
        "capabilities": [as_str(c) for c in as_list(strategy.get("capabilities"))],
    }
    repo_profiles = [
        {
            "full_name": as_str(m.get("selected")),
            "capability": as_str(m.get("capability_name")),
            "language": as_str(m.get("language")) or "unknown",
            "stars": int(m.get("coverage_score", 0) * 1000),
        }
        for m in capability_mappings
        if as_str(m.get("selected"))
    ]
    return await design_architecture(product, repo_profiles, provider)


# ── 8c v2: Multi-view Architecture Intelligence ──────────────────────────────
_ARCH_VIEWS_SYSTEM = """You are a senior software architect inside an AI product factory.
Given the approved strategy, capability graph and composition plan, produce the
ARCHITECTURE INTELLIGENCE with MULTIPLE VIEWS.

Return ONLY valid JSON with EXACTLY these keys:
{
  "logical_architecture": {"modules": ["module"], "layers": ["layer"], "boundaries": ["boundary"]},
  "physical_architecture": {"services": ["service"], "hosts": ["host"], "network": "topology"},
  "deployment_architecture": {"environment": "environment", "infrastructure": ["infra"], "scaling": "strategy"},
  "capability_graph": {"nodes": ["capability ids"], "edges": [["src","dst","type"]]},
  "dependency_graph": {"nodes": ["component"], "edges": [["src","dst"]]},
  "data_flow": {"flows": [{"from": "component", "to": "component", "data": "what"}]},
  "sequence_flow": [{"step": "step name", "actor": "actor", "action": "action", "system": "system"}],
  "service_boundaries": ["service boundary"],
  "infrastructure_diagram": "ascii text diagram"
}
Base every decision on the provided capability graph and composition plan.
Do not add or remove keys."""


def _derive_views(strategy: dict[str, Any], capabilities: dict[str, Any], composition_plan: dict[str, Any]) -> dict[str, Any]:
    """Deterministic multi-view architecture derived from the graph."""
    cap_list = as_list(capabilities.get("capabilities"))
    cap_names = [as_str(c.get("name")) or as_str(c.get("id")) for c in cap_list]
    services = as_list(composition_plan.get("services"))
    service_names = [as_str(s.get("name")) for s in services if as_str(s.get("name"))] or cap_names

    components = ["API Gateway"] + service_names + ["Data Layer", "Observability"]
    flows = []
    for svc in services:
        flows.append({"from": "API Gateway", "to": as_str(svc.get("name")) or "service", "data": "requests"})
    if flows:
        flows.append({"from": "Data Layer", "to": "Observability", "data": "metrics & logs"})

    # edges: capability requires relationships from the graph
    edges = [[e.get("source"), e.get("target"), e.get("type", "requires")] for e in as_list(capabilities.get("edges"))]

    lines = ["                  ┌─────────────┐", "                  │  API Gateway │", "                  └──────┬──────┘"]
    for svc in services[:4]:
        name = as_str(svc.get("name")) or "service"
        lines.append(f"      ┌─────────────┬────┴───┐")
        lines.append(f"      │   {name[:12].ljust(12)}   │")
    lines.append("      └──────┬──────┘  │")
    lines.append("             │  Data Layer")
    lines.append("      ┌──────┴──────┐")
    lines.append("      │ Observability│")
    lines.append("      └─────────────┘")

    return {
        "logical_architecture": {
            "modules": cap_names,
            "layers": ["Presentation", "Application", "Domain", "Infrastructure"],
            "boundaries": ["HTTP API boundary", "Message boundary between services"],
        },
        "physical_architecture": {
            "services": service_names,
            "hosts": ["api-host", "worker-pool", "db-host"],
            "network": "private subnet with a public ingress",
        },
        "deployment_architecture": {
            "environment": "staging + production",
            "infrastructure": ["docker-compose", "managed database", "object storage"],
            "scaling": "horizontal workers behind the API",
        },
        "capability_graph": {
            "nodes": cap_names,
            "edges": edges,
        },
        "dependency_graph": {
            "nodes": components,
            "edges": [[f, t] for f, t in [(c, c2) for c in components for c2 in components if c != c2][:12]],
        },
        "data_flow": {"flows": flows},
        "sequence_flow": [
            {"step": "User request", "actor": "User", "action": "calls the API", "system": "API Gateway"},
            {"step": "Route", "actor": "API Gateway", "action": "routes to capability service", "system": service_names[0] if service_names else "Service"},
            {"step": "Process", "actor": "Service", "action": "executes the capability", "system": "Core"},
            {"step": "Persist", "actor": "Service", "action": "writes state", "system": "Data Layer"},
        ],
        "service_boundaries": [f"{s} owns its data and exposes a contract" for s in service_names[:6]],
        "infrastructure_diagram": "\n".join(lines),
    }


async def build_architecture_views(
    strategy: dict[str, Any],
    capabilities: dict[str, Any],
    composition_plan: dict[str, Any],
    provider: LLMProvider,
) -> dict[str, Any]:
    """
    Produce the multi-view Architecture Intelligence.

    Returns a dict with logical/physical/deployment architecture, capability
    and dependency graphs, data flow, sequence flow, service boundaries and an
    infrastructure diagram. Never raises; falls back to a deterministic
    derivation from the graph.
    """
    fallback = _derive_views(strategy, capabilities, composition_plan)
    data = await ask_json(
        provider,
        _ARCH_VIEWS_SYSTEM,
        f"APPROVED STRATEGY:\n{strategy}\n\nCAPABILITY GRAPH:\n{capabilities}\n\nCOMPOSITION PLAN:\n{composition_plan}",
        fallback=None,
        temperature=0.4,
        max_tokens=1800,
    )
    if not isinstance(data, dict) or not data:
        return fallback
    # merge: keep any view the LLM produced, fill the rest from the fallback
    merged = {}
    for key in fallback.keys():
        value = data.get(key)
        merged[key] = value if value else fallback[key]
    return merged


# ── 8d: Blueprint (deterministic) ────────────────────────────────────────────
def build_blueprint(
    strategy: dict[str, Any],
    architecture: dict[str, Any],
    capability_mappings: list[dict[str, Any]],
) -> dict[str, Any]:
    repo_map = as_dict(strategy.get("repository_map"))
    by_name = _caps_by_name(capability_mappings)
    folder_structure = ["apps/api", "apps/web", "packages/shared"]
    module_breakdown: list[dict[str, Any]] = []
    for cap_name, repo in repo_map.items():
        if not cap_name:
            continue
        folder_structure.append(f"services/{cap_name.lower().replace(' ', '-')}")
        module_breakdown.append(
            {
                "name": cap_name,
                "purpose": f"Composed from {repo} modules",
                "repo": repo,
            }
        )

    return {
        "product_name": as_str(strategy.get("name")) or "Product",
        "problem": as_str(strategy.get("description")) or "",
        "solution": as_str(strategy.get("tagline")) or "",
        "folder_structure": folder_structure,
        "technology_stack": as_list(architecture.get("tech_stack")),
        "module_breakdown": module_breakdown,
    }


# ── 8e: Engineering setup (deterministic) ────────────────────────────────────
def build_engineering(strategy: dict[str, Any], blueprint: dict[str, Any], architecture: dict[str, Any]) -> dict[str, Any]:
    product_name = as_str(blueprint.get("product_name")) or "product"
    stack = as_list(architecture.get("tech_stack"))
    tree = "\n".join(f"  {f}" for f in as_list(blueprint.get("folder_structure")))
    starter_readme = (
        f"# {product_name}\n\n"
        f"{as_str(blueprint.get('solution'))}\n\n"
        f"## Quickstart\n\n"
        f"```bash\ncp .env.example .env\nmake install\ndocker compose up -d\nmake dev\n```\n\n"
        f"## Folder structure\n\n```\n{tree}\n```\n"
    )
    return {
        "starter_readme": starter_readme,
        "config_files": [".env.example", "docker-compose.yml", "Dockerfile", ".github/workflows/ci.yml"],
        "ci_cd": {
            "provider": "GitHub Actions",
            "steps": ["lint", "test", "build", "docker push"],
        },
        "docker": True,
        "testing": ["unit", "integration", "end-to-end smoke"],
        "monitoring": ["health endpoint", "structured logs", "error tracking"],
        "documentation": ["README quickstart", "architecture diagram", "API reference"],
    }


# ── 8f: Execution plan (deterministic) ───────────────────────────────────────
def build_execution_plan(strategy: dict[str, Any], architecture: dict[str, Any], requirements: list[dict[str, Any]]) -> dict[str, Any]:
    components = as_list(architecture.get("components"))
    tasks = []
    for c in components[:6]:
        cd = as_dict(c)
        name = as_str(cd.get("name")) or "component"
        tasks.append(f"Build {name} ({as_str(cd.get('role'))})")

    high_prio = [as_str(r.get("title")) for r in requirements if as_str(r.get("priority")) == "must"]
    tasks = [f"Deliver: {t}" for t in high_prio[:4]] + tasks

    milestones = [
        {"title": "Foundation", "timeframe": "Week 1", "tasks": tasks[:3]},
        {"title": "Core features", "timeframe": "Week 2-3", "tasks": tasks[3:6]},
        {"title": "Integration & polish", "timeframe": "Week 4", "tasks": tasks[6:] or ["Integrate services", "Write smoke tests"]},
    ]
    return {
        "milestones": milestones,
        "sprint_plan": [
            {"sprint": "Sprint 1", "goals": [m["title"] for m in milestones[:2]], "tasks": milestones[0]["tasks"] + milestones[1]["tasks"]},
            {"sprint": "Sprint 2", "goals": [m["title"] for m in milestones[2:]], "tasks": milestones[2]["tasks"]},
        ],
        "risks": ["Integration complexity across composed repos", "Upstream repo API drift"],
        "dependencies": [as_str(c.get("name")) for c in components[:4]],
        "timeline": as_str(strategy.get("timeline")) or "4 weeks",
    }
