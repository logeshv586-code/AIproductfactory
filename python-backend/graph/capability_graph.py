"""
Capability Graph Engine.

Dynamically connects skills, repos, architectures, frameworks, agents, papers,
memory, and use cases into an engineering intelligence graph.
"""

from typing import Any

from graph.graphify import build_graph, get_graph_stats


SKILL_MDI: dict[str, dict[str, Any]] = {
    "rag": {
        "skill": "RAG",
        "confidence": 91,
        "production_readiness": 88,
        "gpu_requirement": "Low",
        "complexity": "Intermediate",
        "recommended_stack": ["Qdrant", "FastAPI", "Hybrid Search"],
        "best_use_cases": ["Knowledge Assistants", "Enterprise Search", "Support Automation"],
    },
    "graph_rag": {
        "skill": "GraphRAG",
        "confidence": 92,
        "production_readiness": 88,
        "gpu_requirement": "Medium",
        "complexity": "Advanced",
        "recommended_stack": ["Neo4j", "Qdrant", "FastAPI"],
        "best_use_cases": ["Enterprise AI", "Research Systems", "Memory Agents"],
    },
    "memory": {
        "skill": "Memory Intelligence",
        "confidence": 90,
        "production_readiness": 86,
        "gpu_requirement": "Low",
        "complexity": "Intermediate",
        "recommended_stack": ["Graph Store", "Vector DB", "SQLite/Postgres"],
        "best_use_cases": ["Agents", "Personalization", "Feedback Learning"],
    },
    "agent": {
        "skill": "Agent Orchestration",
        "confidence": 89,
        "production_readiness": 84,
        "gpu_requirement": "Medium",
        "complexity": "Advanced",
        "recommended_stack": ["FastAPI", "Tool Calling", "Task DAG"],
        "best_use_cases": ["Automation", "Coding Agents", "Operations Copilots"],
    },
    "realtime": {
        "skill": "Realtime Systems",
        "confidence": 87,
        "production_readiness": 85,
        "gpu_requirement": "Low",
        "complexity": "Advanced",
        "recommended_stack": ["WebSockets", "Redis Streams", "FastAPI"],
        "best_use_cases": ["Trading", "Monitoring", "Collaboration"],
    },
    "vision": {
        "skill": "Vision AI",
        "confidence": 85,
        "production_readiness": 82,
        "gpu_requirement": "Medium",
        "complexity": "Advanced",
        "recommended_stack": ["ONNX Runtime", "Qwen VL", "OpenCV"],
        "best_use_cases": ["Inspection", "Object Detection", "Multimodal Agents"],
    },
    "optimization": {
        "skill": "Inference Optimization",
        "confidence": 86,
        "production_readiness": 83,
        "gpu_requirement": "Optional",
        "complexity": "Advanced",
        "recommended_stack": ["ONNX", "Quantization", "Benchmark Harness"],
        "best_use_cases": ["Edge AI", "CPU Inference", "Cost Reduction"],
    },
    "security": {
        "skill": "Security Engineering",
        "confidence": 84,
        "production_readiness": 87,
        "gpu_requirement": "None",
        "complexity": "Intermediate",
        "recommended_stack": ["OPA", "Vault", "OpenTelemetry"],
        "best_use_cases": ["Enterprise AI", "Compliance", "Risk Analysis"],
    },
}


DOMAIN_PACKS: dict[str, dict[str, Any]] = {
    "trading": {
        "skills": ["realtime", "agent", "memory", "rag", "security"],
        "architectures": ["event_driven", "risk_gated_agents", "streaming_rag"],
        "risks": ["market data latency", "strategy overfitting", "broker API failure"],
        "compliance": ["audit logs", "risk disclaimers", "paper trading mode"],
    },
    "vision_ai": {
        "skills": ["vision", "optimization", "realtime"],
        "architectures": ["edge_inference", "async_batching", "model_gateway"],
        "risks": ["model drift", "hardware variance", "privacy exposure"],
        "compliance": ["data retention policy", "human review workflow"],
    },
    "healthcare": {
        "skills": ["rag", "memory", "security"],
        "architectures": ["retrieval_augmented_decision_support", "audit_first_api"],
        "risks": ["clinical safety", "PHI exposure", "regulatory review"],
        "compliance": ["HIPAA review", "role-based access", "traceable citations"],
    },
    "cybersecurity": {
        "skills": ["agent", "rag", "realtime", "security"],
        "architectures": ["soc_copilot", "event_correlation_graph"],
        "risks": ["false positives", "privileged tool misuse", "alert fatigue"],
        "compliance": ["least privilege", "immutable audit trail"],
    },
    "generic": {
        "skills": ["agent", "rag", "memory"],
        "architectures": ["api_first_agents", "knowledge_graph_memory"],
        "risks": ["scope creep", "integration complexity", "evaluation gaps"],
        "compliance": ["observability", "data governance"],
    },
}


INTENT_SKILL_RULES: dict[str, list[str]] = {
    "realtime": ["realtime", "websocket", "live", "stream", "market feed"],
    "memory": ["memory", "learn", "feedback", "personalized", "persistent"],
    "graph_rag": ["graph rag", "knowledge graph", "capability graph", "relationships"],
    "rag": ["rag", "retrieval", "knowledge", "documents", "search"],
    "agent": ["agent", "autonomous", "tool", "workflow", "planner"],
    "vision": ["vision", "image", "video", "object detection", "multimodal"],
    "optimization": ["onnx", "quantization", "cpu inference", "benchmark", "fps"],
    "security": ["security", "risk", "compliance", "audit", "permissions"],
}


FRAMEWORK_BY_SKILL: dict[str, list[str]] = {
    "agent": ["LangGraph", "CrewAI", "FastAPI"],
    "rag": ["Qdrant", "LlamaIndex", "BM25"],
    "graph_rag": ["Neo4j", "NetworkX", "Graphiti"],
    "memory": ["SQLite", "Postgres", "Vector Store"],
    "realtime": ["WebSockets", "Redis Streams", "Kafka"],
    "vision": ["ONNX Runtime", "OpenCV", "Qwen VL"],
    "optimization": ["ONNX", "TensorRT", "Quantization"],
    "security": ["OPA", "Vault", "OpenTelemetry"],
}


NODE_STYLE_BY_TYPE: dict[str, dict[str, str]] = {
    "request": {"color": "#38bdf8", "icon": "Target"},
    "domain": {"color": "#f59e0b", "icon": "Globe"},
    "skill": {"color": "#22c55e", "icon": "Brain"},
    "framework": {"color": "#a78bfa", "icon": "Code2"},
    "architecture_pattern": {"color": "#fb7185", "icon": "Network"},
    "paper": {"color": "#60a5fa", "icon": "BookOpen"},
    "research_finding": {"color": "#2dd4bf", "icon": "Search"},
    "memory": {"color": "#818cf8", "icon": "Database"},
}


EDGE_COLOR_BY_TYPE: dict[str, str] = {
    "classified_as": "#f59e0b",
    "requires_skill": "#22c55e",
    "recommends_skill": "#84cc16",
    "implemented_by": "#a78bfa",
    "uses_architecture": "#fb7185",
    "enables_architecture": "#60a5fa",
    "informed_by": "#38bdf8",
    "has_finding": "#2dd4bf",
    "stores_memory": "#818cf8",
    "updates_memory": "#6366f1",
}


def find_capability_clusters(graph: dict[str, Any]) -> list[dict[str, Any]]:
    """Find clusters of closely related capabilities in the graph."""
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    adj: dict[str, set[str]] = {}

    for edge in edges:
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        adj.setdefault(src, set()).add(tgt)
        adj.setdefault(tgt, set()).add(src)

    cap_nodes = [n for n in nodes if n.get("type") == "capability"]
    clusters = []
    visited = set()

    for cap in cap_nodes:
        cap_id = cap.get("id", "")
        if cap_id in visited:
            continue

        cluster = [cap]
        visited.add(cap_id)
        queue = [cap_id]

        while queue:
            current = queue.pop(0)
            for neighbor in adj.get(current, set()):
                neighbor_node = next((n for n in nodes if n.get("id") == neighbor), None)
                if neighbor_node and neighbor_node.get("type") == "capability" and neighbor not in visited:
                    visited.add(neighbor)
                    cluster.append(neighbor_node)
                    queue.append(neighbor)

        if len(cluster) > 1:
            clusters.append({
                "name": " + ".join(c.get("label", "") for c in cluster),
                "capabilities": [c.get("capability", "") for c in cluster],
                "size": len(cluster),
            })

    return clusters


def find_product_opportunities(graph: dict[str, Any]) -> list[dict[str, Any]]:
    """Identify product opportunities based on graph structure."""
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    repo_nodes = [n for n in nodes if n.get("type") == "repo"]
    repo_connections: dict[str, int] = {}

    for edge in edges:
        if edge.get("type") == "has":
            src = edge.get("source", "")
            repo_connections[src] = repo_connections.get(src, 0) + 1

    high_value_repos = sorted(
        [n for n in repo_nodes if repo_connections.get(n.get("id", ""), 0) >= 2],
        key=lambda n: repo_connections.get(n.get("id", ""), 0),
        reverse=True,
    )

    product_caps = {edge.get("source", "") for edge in edges if edge.get("type") == "builds"}
    cap_nodes = [n for n in nodes if n.get("type") == "capability"]
    unattached_caps = [c for c in cap_nodes if c.get("id") not in product_caps]

    opportunities = []
    if high_value_repos:
        top_repo = high_value_repos[0]
        opportunities.append({
            "type": "high_value_repo",
            "description": (
                f"Repo '{top_repo.get('label', '')}' has "
                f"{repo_connections.get(top_repo.get('id', ''), 0)} capability links."
            ),
            "repos": [r.get("full_name", "") for r in high_value_repos[:3]],
        })

    if unattached_caps:
        opportunities.append({
            "type": "unused_capability",
            "description": "Capabilities are available but not yet composed into products.",
            "capabilities": [c.get("capability", "") for c in unattached_caps],
        })

    return opportunities


def infer_domain(user_request: str) -> str:
    lowered = user_request.lower()
    if any(term in lowered for term in ("trading", "market", "broker", "stock", "crypto")):
        return "trading"
    if any(term in lowered for term in ("vision", "image", "video", "object detection", "camera")):
        return "vision_ai"
    if any(term in lowered for term in ("health", "clinical", "patient", "medical")):
        return "healthcare"
    if any(term in lowered for term in ("cyber", "soc", "security", "threat")):
        return "cybersecurity"
    return "generic"


def match_required_skills(
    user_request: str,
    capabilities: list[dict[str, Any]] | None = None,
    domain: str | None = None,
) -> list[dict[str, Any]]:
    """Return Skill MDI cards ranked for the current request."""
    lowered = user_request.lower()
    domain_key = domain or infer_domain(user_request)
    matched = set(DOMAIN_PACKS.get(domain_key, DOMAIN_PACKS["generic"])["skills"])

    for skill_key, hints in INTENT_SKILL_RULES.items():
        if any(hint in lowered for hint in hints):
            matched.add(skill_key)

    for cap in capabilities or []:
        cap_name = str(cap.get("capability", "")).lower()
        if cap_name in SKILL_MDI:
            matched.add(cap_name)
        if cap_name == "ui":
            matched.add("agent")

    cards = []
    for skill_key in sorted(matched):
        metadata = SKILL_MDI.get(skill_key)
        if metadata:
            cards.append({**metadata, "id": skill_key})

    cards.sort(key=lambda item: (item["confidence"], item["production_readiness"]), reverse=True)
    return cards


def build_capability_graph_engine(
    user_request: str,
    repos: list[dict[str, Any]] | None = None,
    capabilities: list[dict[str, Any]] | None = None,
    products: list[dict[str, Any]] | None = None,
    research: dict[str, Any] | None = None,
    memory: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the expanded intelligence graph for report and UI consumption."""
    repos = repos or []
    capabilities = capabilities or []
    products = products or []
    research = research or {}
    memory = memory or {}

    base_graph = build_graph(repos, capabilities, products)
    nodes = base_graph["nodes"]
    edges = base_graph["edges"]
    node_ids = {node["id"] for node in nodes}
    edge_ids = {edge["id"] for edge in edges}
    domain = infer_domain(user_request)
    domain_pack = DOMAIN_PACKS.get(domain, DOMAIN_PACKS["generic"])
    skills = match_required_skills(user_request, capabilities, domain)

    def add_node(node_id: str, label: str, node_type: str, **props: Any) -> None:
        if node_id in node_ids:
            return
        node_ids.add(node_id)
        style = NODE_STYLE_BY_TYPE.get(node_type, {"color": "#94a3b8", "icon": "CircleDot"})
        nodes.append({"id": node_id, "label": label, "type": node_type, **style, **props})

    def add_edge(source: str, target: str, edge_type: str, label: str) -> None:
        if source not in node_ids or target not in node_ids:
            return
        edge_id = f"e_{source}_{edge_type}_{target}"
        if edge_id in edge_ids:
            return
        edge_ids.add(edge_id)
        edges.append({
            "id": edge_id,
            "source": source,
            "target": target,
            "type": edge_type,
            "label": label,
            "color": EDGE_COLOR_BY_TYPE.get(edge_type, "#94a3b8"),
            "animated": edge_type in {"requires_skill", "updates_memory", "informed_by"},
        })

    request_id = "request_user_idea"
    domain_id = f"domain_{domain}"
    add_node(request_id, "User Request", "request", description=user_request)
    add_node(domain_id, domain.replace("_", " ").title(), "domain", **domain_pack)
    add_edge(request_id, domain_id, "classified_as", "classified as")

    for skill in skills:
        skill_id = f"skill_{skill['id']}"
        add_node(skill_id, skill["skill"], "skill", **skill)
        add_edge(request_id, skill_id, "requires_skill", "requires")
        add_edge(domain_id, skill_id, "recommends_skill", "recommends")

        for framework in FRAMEWORK_BY_SKILL.get(skill["id"], []):
            framework_id = f"framework_{_safe_id(framework)}"
            add_node(framework_id, framework, "framework")
            add_edge(skill_id, framework_id, "implemented_by", "implemented by")

    for pattern in domain_pack.get("architectures", []):
        pattern_id = f"architecture_{_safe_id(pattern)}"
        add_node(pattern_id, pattern.replace("_", " ").title(), "architecture_pattern")
        add_edge(domain_id, pattern_id, "uses_architecture", "uses")
        for skill in skills[:3]:
            add_edge(f"skill_{skill['id']}", pattern_id, "enables_architecture", "enables")

    for paper in research.get("relevant_papers", [])[:5]:
        title = paper.get("title", "Research Paper")
        paper_id = f"paper_{_safe_id(title)}"
        add_node(paper_id, title, "paper", summary=paper.get("summary", ""), link=paper.get("link", ""))
        add_edge(request_id, paper_id, "informed_by", "informed by")

    for finding in research.get("key_findings", [])[:5]:
        finding_id = f"finding_{_safe_id(finding)}"
        add_node(finding_id, finding[:80], "research_finding", description=finding)
        add_edge(request_id, finding_id, "has_finding", "finding")

    if memory:
        memory_id = "memory_persistent_learning"
        add_node(memory_id, "Persistent Memory", "memory", **memory)
        add_edge(request_id, memory_id, "stores_memory", "stores")
        for skill in skills:
            if skill["id"] in {"memory", "graph_rag", "rag"}:
                add_edge(f"skill_{skill['id']}", memory_id, "updates_memory", "updates")

    graph = {"nodes": nodes, "edges": edges}
    return {
        "nodes": nodes,
        "edges": edges,
        "stats": get_graph_stats(graph),
        "domain": domain,
        "domain_pack": domain_pack,
        "skill_cards": skills,
        "clusters": find_capability_clusters(graph),
        "opportunities": find_product_opportunities(graph),
    }


def dynamic_workspace_tabs(skill_cards: list[dict[str, Any]], domain: str) -> list[str]:
    base_tabs = [
        "Overview",
        "Pipeline",
        "Plan",
        "Execution",
        "Capability Graph",
        "Knowledge",
        "Memory",
        "Research",
        "Skills",
        "Architecture",
        "Risks",
        "Optimization",
    ]
    skill_ids = {card.get("id") for card in skill_cards}
    domain_tabs: list[str] = []

    if "vision" in skill_ids or domain == "vision_ai":
        domain_tabs.extend(["Model Viewer", "Inference Benchmarks", "GPU Analysis", "Quantization"])
    if "rag" in skill_ids or "graph_rag" in skill_ids:
        domain_tabs.extend(["Chunking", "Embeddings", "Reranking", "Knowledge Graph"])
    if "realtime" in skill_ids:
        domain_tabs.extend(["Streams", "Latency", "WebSockets"])
    if domain == "trading":
        domain_tabs.extend(["Market Feeds", "Risk Engine", "Backtesting"])

    tabs = []
    for tab in base_tabs + domain_tabs:
        if tab not in tabs:
            tabs.append(tab)
    return tabs


def _safe_id(text: str) -> str:
    return (
        str(text)
        .lower()
        .replace(" ", "_")
        .replace("/", "_")
        .replace("-", "_")
        .replace(".", "_")
        .replace(":", "_")
    )[:70]
