"""
Capability Intelligence — the feature dependency graph.

Decomposes the product into 6-12 independent capabilities, each with a priority,
dependencies (by id), complexity and candidate technologies. Produces the
capability graph (capabilities + edges) that later engines consume. Degrades to
a curated domain-keyword catalog when the LLM is unavailable.
"""

from __future__ import annotations

from typing import Any

from intelligence.prompt_utils import ask_json, as_dict, as_list, as_str
from llm.provider import LLMProvider

_SYSTEM_PROMPT = """You are a product architect inside an AI product factory.
Decompose the product into independent capabilities and produce a capability
dependency graph.

Return ONLY valid JSON with EXACTLY these keys:
{
  "domain": "the domain",
  "capabilities": [
    {
      "id": "CAP-001",
      "name": "capability name, e.g. Web Crawling",
      "description": "what it does",
      "priority": "core" | "important" | "nice",
      "dependencies": ["CAP-002"],
      "complexity": "low" | "medium" | "high",
      "technologies": ["e.g. Scrapy, Playwright"],
      "confidence": 0.0,
      "required_apis": ["apis this capability needs"],
      "required_models": ["ML models if any"],
      "required_infrastructure": ["infra, e.g. redis, workers"],
      "integration_complexity": "low" | "medium" | "high",
      "testing_strategy": ["unit", "integration", "e2e"],
      "deployment_requirements": ["deployment notes"]
    }
  ],
  "edges": [
    {"source": "CAP-001", "target": "CAP-002", "type": "requires"}
  ]
}
6-12 capabilities. Each capability lists its dependencies, and every dependency
must also appear as an edge with type "requires" (mirror them exactly). Do not
add or remove keys."""

# Curated domain -> capability catalog for the no-LLM fallback.
# Each entry: (name, description, priority, complexity, technologies, deps_by_index,
#             required_apis, required_models, required_infrastructure, integration_complexity,
#             testing_strategy, deployment_requirements)
_CATALOGS: dict[str, list[tuple[str, str, str, str, list[str], list[int], list[str], list[str], list[str], str, list[str], list[str]]]] = {
    "e-commerce": [
        ("Web Crawling", "Fetch product data from retailer sites", "core", "high", ["Scrapy", "Playwright"], [],
         ["retailer site scraping"], [], ["worker pool", "proxy rotation"], "high",
         ["unit", "integration"], ["runs as background workers"]),
        ("Product Matching", "Match/normalize products across sources", "core", "high", ["rapidfuzz", "pandas"], [0],
         ["product feed ingest"], ["embedding model (optional)"], ["batch job"], "medium",
         ["unit", "golden-set evaluation"], ["scheduled batch"]),
        ("Search", "Full-text and faceted product search", "core", "medium", ["Meilisearch", "Elasticsearch"], [1],
         ["search index API"], [], ["search server"], "medium",
         ["integration", "relevance eval"], ["search service container"]),
        ("Recommendation Engine", "Personalized product recommendations", "important", "medium", ["lightfm", "implicit"], [1],
         ["recs API"], ["collaborative filtering model"], ["model store"], "high",
         ["offline eval", "A/B test"], ["served via API"]),
        ("Notifications", "Price alerts and updates", "important", "low", ["resend", "celery"], [1],
         ["email/SMS provider"], [], ["queue"], "low",
         ["unit"], ["outbound notifications"]),
        ("Analytics", "Usage and price-history analytics", "important", "medium", ["ClickHouse", "Grafana"], [],
         ["analytics ingest"], [], ["OLAP store"], "medium",
         ["integration"], ["read replica / warehouse"]),
        ("Payments", "Subscriptions and checkout", "nice", "medium", ["Stripe", "Paddle"], [5],
         ["payment gateway API"], [], ["PCI-scope controls"], "high",
         ["unit", "compliance review"], ["isolated payment service"]),
    ],
    "agent": [
        ("LLM Orchestration", "Multi-step LLM agent loops", "core", "medium", ["langchain", "openai"], [],
         ["LLM provider API"], ["chat model"], ["GPU/API quota"], "medium",
         ["unit", "prompt eval"], ["API service"]),
        ("Memory", "Persistent conversation/task memory", "core", "medium", ["sqlite-vec", "redis"], [0],
         ["vector store"], ["embedding model"], ["vector DB"], "medium",
         ["unit", "integration"], ["stateful service"]),
        ("Tool Execution", "Sandboxed tool/function calling", "core", "high", ["pydantic", "docker"], [0],
         ["function schema"], [], ["sandbox runtime"], "high",
         ["unit", "sandbox e2e"], ["isolated runner"]),
        ("Retrieval (RAG)", "Ground answers in user documents", "important", "medium", ["chromadb", "txtai"], [1],
         ["embedding API", "chunking"], ["embedding model"], ["vector DB"], "medium",
         ["retrieval eval"], ["RAG service"]),
        ("Observability", "Traces, logs, token accounting", "important", "low", ["opentelemetry", "langfuse"], [0],
         ["trace export"], [], ["telemetry backend"], "low",
         ["unit"], ["sidecar / exporter"]),
    ],
    "automation": [
        ("Workflow Engine", "Define and run multi-step workflows", "core", "medium", ["temporal", "prefect"], [],
         ["workflow API"], [], ["durable-execution cluster"], "medium",
         ["unit", "workflow replay"], ["workflow cluster"]),
        ("Execution Runner", "Execute steps with retries", "core", "medium", ["celery", "docker"], [0],
         ["task queue"], [], ["queue + workers"], "medium",
         ["unit", "integration"], ["worker deployment"]),
        ("Scheduling", "Time/trigger-based scheduling", "important", "low", ["apscheduler", "cron"], [0],
         ["cron API"], [], [], "low",
         ["unit"], ["scheduler process"]),
        ("Error Handling", "Retries, dead-letter, alerting", "important", "low", ["tenacity", "sentry"], [1],
         ["error reporting API"], [], [], "low",
         ["unit"], ["alert integration"]),
        ("Audit Logging", "Immutable action history", "important", "low", ["sqlite", "postgres"], [1],
         ["audit write API"], [], ["append-only store"], "low",
         ["unit"], ["log pipeline"]),
    ],
    "general": [
        ("Backend API", "REST/GraphQL service layer", "core", "medium", ["FastAPI", "Express"], [],
         ["REST/GraphQL"], [], ["API host"], "medium",
         ["unit", "integration"], ["API service"]),
        ("Frontend UI", "Web interface for users", "core", "medium", ["React", "Next.js"], [0],
         ["browser"], [], ["static host"], "medium",
         ["e2e"], ["CDN/static"]),
        ("Authentication", "User identity and access control", "core", "medium", ["Auth.js", "jwt"], [0],
         ["OAuth/OIDC"], [], ["session store"], "medium",
         ["unit", "security review"], ["auth service"]),
        ("Data Store", "Persistence layer", "core", "low", ["PostgreSQL", "SQLite"], [0],
         ["SQL/ORM"], [], ["database"], "low",
         ["unit"], ["managed DB"]),
        ("Analytics", "Usage metrics and dashboards", "important", "medium", ["ClickHouse", "Metabase"], [0],
         ["analytics ingest"], [], ["OLAP store"], "medium",
         ["integration"], ["read replica"]),
        ("Notifications", "Email/in-app user notifications", "important", "low", ["resend", "webhooks"], [0],
         ["email provider"], [], ["queue"], "low",
         ["unit"], ["outbound notifications"]),
        ("Search", "Search over primary content", "important", "medium", ["Meilisearch", "Tantivy"], [3],
         ["search index API"], [], ["search server"], "medium",
         ["integration"], ["search container"]),
        ("Monitoring", "Health checks and alerting", "nice", "low", ["Prometheus", "Grafana"], [0],
         ["metrics scrape"], [], ["metrics backend"], "low",
         ["unit"], ["monitoring stack"]),
    ],
}

# e-commerce/agent/automation catalogs need base infrastructure; add the common
# platform capabilities when a specific catalog is selected.
_COMMON_PLATFORM = [
    ("Backend API", "REST service layer exposing the product's capabilities", "core", "medium", ["FastAPI", "Fastify"], [],
     ["REST/GraphQL"], [], ["API host"], "medium", ["unit", "integration"], ["API service"]),
    ("Frontend UI", "Web interface for users", "core", "medium", ["React", "Next.js"], [0],
     ["browser"], [], ["static host"], "medium", ["e2e"], ["CDN/static"]),
    ("Authentication", "User identity and access control", "core", "medium", ["Auth.js", "jwt"], [0],
     ["OAuth/OIDC"], [], ["session store"], "medium", ["unit", "security review"], ["auth service"]),
    ("Data Store", "Persistence for primary entities", "core", "low", ["PostgreSQL", "SQLite"], [0],
     ["SQL/ORM"], [], ["database"], "low", ["unit"], ["managed DB"]),
]


def _detect_catalog(domain: str) -> str:
    lowered = domain.lower()
    for key in ("e-commerce", "price", "shop", "retail"):
        if key in lowered:
            return "e-commerce"
    if "agent" in lowered or "assistant" in lowered or "llm" in lowered:
        return "agent"
    for key in ("automation", "workflow", "schedule"):
        if key in lowered:
            return "automation"
    return "general"


def _fallback_catalog(domain: str) -> list[dict[str, Any]]:
    catalog_key = _detect_catalog(domain)
    catalog = list(_CATALOGS.get(catalog_key, _CATALOGS["general"]))
    if catalog_key != "general":
        # merge in the common platform capabilities (dedup by name)
        names = {c[0] for c in catalog}
        for item in _COMMON_PLATFORM:
            if item[0] not in names:
                catalog.append(item)

    caps: list[dict[str, Any]] = []
    for i, entry in enumerate(catalog, start=1):
        name, desc, priority, complexity, techs, dep_indices = entry[:6]
        required_apis, required_models, required_infra = entry[6], entry[7], entry[8]
        integration_complexity, testing, deployment = entry[9], entry[10], entry[11]
        deps = [f"CAP-{idx + 1:03d}" for idx in dep_indices]
        caps.append(
            {
                "id": f"CAP-{i:03d}",
                "name": name,
                "description": desc,
                "priority": priority,
                "dependencies": deps,
                "complexity": complexity,
                "technologies": techs,
                "confidence": 0.7,
                "required_apis": required_apis,
                "required_models": required_models,
                "required_infrastructure": required_infra,
                "integration_complexity": integration_complexity,
                "testing_strategy": testing,
                "deployment_requirements": deployment,
            }
        )
    return caps


def _build_edges(caps: list[dict[str, Any]]) -> list[dict[str, str]]:
    edges: list[dict[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for c in caps:
        cid = c["id"]
        for dep in c.get("dependencies", []):
            key = (cid, dep)
            if key not in seen:
                seen.add(key)
                edges.append({"source": cid, "target": dep, "type": "requires"})
    return edges


def _normalize(data: Any, domain: str) -> dict[str, Any] | None:
    if not isinstance(data, dict) or not data:
        return None
    caps: list[dict[str, Any]] = []
    for i, item in enumerate(as_list(data.get("capabilities")), start=1):
        d = as_dict(item)
        priority = as_str(d.get("priority"))
        if priority not in ("core", "important", "nice"):
            priority = "important"
        complexity = as_str(d.get("complexity"))
        if complexity not in ("low", "medium", "high"):
            complexity = "medium"
        ic = as_str(d.get("integration_complexity"))
        if ic not in ("low", "medium", "high"):
            ic = "medium"
        caps.append(
            {
                "id": as_str(d.get("id")) or f"CAP-{i:03d}",
                "name": as_str(d.get("name")) or f"Capability {i}",
                "description": as_str(d.get("description")),
                "priority": priority,
                "dependencies": as_list(d.get("dependencies")),
                "complexity": complexity,
                "technologies": as_list(d.get("technologies")),
                "confidence": min(1.0, max(0.0, float(d.get("confidence", 0.7)))),
                "required_apis": as_list(d.get("required_apis")),
                "required_models": as_list(d.get("required_models")),
                "required_infrastructure": as_list(d.get("required_infrastructure")),
                "integration_complexity": ic,
                "testing_strategy": as_list(d.get("testing_strategy")),
                "deployment_requirements": as_list(d.get("deployment_requirements")),
            }
        )
    if not caps:
        return None
    edges = []
    for e in as_list(data.get("edges")):
        ed = as_dict(e)
        source = as_str(ed.get("source"))
        target = as_str(ed.get("target"))
        if source and target:
            edges.append({"source": source, "target": target, "type": as_str(ed.get("type")) or "requires"})
    if not edges:
        edges = _build_edges(caps)
    return {"domain": as_str(data.get("domain")) or domain, "capabilities": caps, "edges": edges}


async def build_capability_graph(
    intent: dict[str, Any],
    requirements: list[dict[str, Any]],
    gaps: list[dict[str, Any]],
    provider: LLMProvider,
) -> dict[str, Any]:
    """
    Build the capability dependency graph for the product.

    Returns a dict with keys ``domain``, ``capabilities``, ``edges``. Never
    raises; falls back to a curated domain-keyword catalog.
    """
    domain = as_str(intent.get("domain")) or "general"
    data = await ask_json(
        provider,
        _SYSTEM_PROMPT,
        f"DOMAIN: {domain}\n\nREQUIREMENTS:\n{requirements}\n\nGAP ANALYSIS:\n{gaps}",
        fallback=None,
        temperature=0.4,
        max_tokens=1800,
    )
    normalized = _normalize(data, domain)
    if normalized is not None:
        return normalized
    caps = _fallback_catalog(domain)
    return {"domain": domain, "capabilities": caps, "edges": _build_edges(caps)}
