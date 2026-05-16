"""
Combined Intelligence Report.

Turns pipeline artifacts into the full engineering report that differentiates
the platform from prompt-to-code builders.
"""

from typing import Any

from graph.capability_graph import dynamic_workspace_tabs


def build_intelligence_scores(
    product: dict[str, Any] | None,
    capability_graph: dict[str, Any],
    feasibility: dict[str, Any] | None = None,
) -> dict[str, int]:
    scores = product.get("scores", {}) if product else {}
    feasibility_score = int(feasibility.get("feasibility_score", 0)) if feasibility else 0
    if not feasibility_score:
        feasibility_score = int(scores.get("feasibility", 0.72) * 100)

    graph_stats = capability_graph.get("stats", {})
    node_count = graph_stats.get("total_nodes", 0)
    edge_count = graph_stats.get("total_edges", 0)
    graph_density_bonus = min(12, int((node_count + edge_count) / 8))
    skill_cards = capability_graph.get("skill_cards", [])
    avg_skill_readiness = int(
        sum(card.get("production_readiness", 80) for card in skill_cards) / max(len(skill_cards), 1)
    )

    innovation = int(scores.get("innovation", 0.82) * 100)
    production = round((feasibility_score * 0.5) + (avg_skill_readiness * 0.35) + (graph_density_bonus * 1.5))
    maintainability = min(95, 72 + len(skill_cards) * 2 + graph_density_bonus)

    return {
        "scalability": min(96, production + 4),
        "security": min(94, 78 + (4 if _has_skill(skill_cards, "security") else 0) + graph_density_bonus),
        "production_readiness": min(96, production),
        "gpu_efficiency": _gpu_efficiency(skill_cards),
        "cost_efficiency": min(95, 86 if _requires_gpu(skill_cards) else 92),
        "maintainability": maintainability,
        "innovation_score": min(98, innovation + graph_density_bonus),
    }


def build_combined_intelligence_report(
    user_request: str,
    intent: dict[str, Any],
    selected_repos: list[dict[str, Any]],
    capabilities: list[dict[str, Any]],
    products: list[dict[str, Any]],
    capability_graph: dict[str, Any],
    research: dict[str, Any] | None = None,
    feasibility: dict[str, Any] | None = None,
    execution_plan: dict[str, Any] | None = None,
    timeline: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    top_product = products[0] if products else None
    domain = capability_graph.get("domain", "generic")
    domain_pack = capability_graph.get("domain_pack", {})
    skill_cards = capability_graph.get("skill_cards", [])
    architecture = top_product.get("architecture", {}) if top_product else {}
    scores = build_intelligence_scores(top_product, capability_graph, feasibility)

    summary_name = top_product.get("name") if top_product else _fallback_product_name(user_request, domain)
    summary_description = top_product.get("description") if top_product else user_request

    return {
        "product_summary": {
            "name": summary_name,
            "description": summary_description,
            "domain": domain,
            "core_value": _core_value(domain),
            "system_pattern": top_product.get("system_flow", "") if top_product else "",
            "recommended_stack": _dedupe_stack(skill_cards, architecture),
        },
        "capability_graph": {
            "domain": domain,
            "stats": capability_graph.get("stats", {}),
            "skill_cards": skill_cards,
            "opportunities": capability_graph.get("opportunities", []),
            "clusters": capability_graph.get("clusters", []),
        },
        "knowledge_layer": {
            "intent": intent,
            "research_findings": (research or {}).get("key_findings", []),
            "relevant_papers": (research or {}).get("relevant_papers", []),
            "memory_policy": [
                "Store user prompts and selected architecture decisions",
                "Store execution failures and successful fixes",
                "Update capability graph after every feedback cycle",
            ],
        },
        "skill_layer": {
            "matched_skills": skill_cards,
            "dynamic_routing_rules": [
                "If realtime is required, add WebSocket and stream processing skills",
                "If memory is required, add GraphRAG and vector memory skills",
                "If scale is required, add distributed architecture and caching skills",
                "If local inference is required, add ONNX and quantization skills",
            ],
        },
        "architecture": {
            "design": architecture,
            "patterns": domain_pack.get("architectures", []),
            "repos": selected_repos,
        },
        "research_to_implementation": {
            "research": research or {},
            "repo_validation": _repo_validation(selected_repos),
            "production_plan": execution_plan or _default_execution_plan(skill_cards),
        },
        "risk_analysis": {
            "domain_risks": domain_pack.get("risks", []),
            "compliance": domain_pack.get("compliance", []),
            "feasibility": feasibility or {},
        },
        "execution": {
            "timeline": timeline or [],
            "simulation": _execution_simulation(top_product, skill_cards),
            "feedback_loop": [
                "Capture what worked, failed, and slowed down",
                "Attach outcomes to repos, skills, and architecture nodes",
                "Use success patterns to improve future planning",
            ],
        },
        "dynamic_workspace": {
            "tabs": dynamic_workspace_tabs(skill_cards, domain),
        },
        "intelligence_scores": scores,
    }


def _dedupe_stack(skill_cards: list[dict[str, Any]], architecture: dict[str, Any]) -> list[str]:
    stack: list[str] = []
    for card in skill_cards:
        stack.extend(card.get("recommended_stack", []))
    stack.extend(architecture.get("tech_stack", []))

    deduped = []
    for item in stack:
        if item and item not in deduped:
            deduped.append(item)
    return deduped[:12]


def _repo_validation(repos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    validated = []
    for repo in repos[:8]:
        stars = repo.get("stars", 0)
        validated.append({
            "repo": repo.get("full_name", repo.get("name", "")),
            "role": repo.get("suggested_role", repo.get("capability", "component")),
            "readiness": "high" if stars >= 5000 else "medium" if stars >= 500 else "needs review",
            "reason": repo.get("selection_reasoning", repo.get("reason", "")),
        })
    return validated


def _default_execution_plan(skill_cards: list[dict[str, Any]]) -> dict[str, Any]:
    skill_names = [card["skill"] for card in skill_cards[:5]]
    return {
        "phases": [
            {"name": "Foundation", "tasks": ["Create API shell", "Define data models", "Add observability"]},
            {"name": "Intelligence", "tasks": [f"Integrate {name}" for name in skill_names]},
            {"name": "Validation", "tasks": ["Run feasibility tests", "Simulate workflows", "Collect feedback"]},
        ]
    }


def _execution_simulation(product: dict[str, Any] | None, skill_cards: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "status": "simulated",
        "product": product.get("name", "Generated Product") if product else "Generated Product",
        "expected_bottlenecks": [
            card["skill"] for card in skill_cards if card.get("complexity") == "Advanced"
        ][:4],
        "recommended_first_build": "API-first vertical slice with memory, graph, and feedback instrumentation",
    }


def _fallback_product_name(user_request: str, domain: str) -> str:
    if domain == "trading":
        return "AI Trading Intelligence Platform"
    if domain == "vision_ai":
        return "Multimodal Vision Intelligence Platform"
    return "AI Engineering Intelligence Platform"


def _core_value(domain: str) -> str:
    values = {
        "trading": "Realtime decision support with risk-aware agents and market memory",
        "vision_ai": "Production vision inference with optimization and benchmark intelligence",
        "healthcare": "Traceable, compliant knowledge support with persistent memory",
        "cybersecurity": "Realtime threat understanding with auditable autonomous workflows",
        "generic": "Research-to-implementation engineering intelligence",
    }
    return values.get(domain, values["generic"])


def _requires_gpu(skill_cards: list[dict[str, Any]]) -> bool:
    return any(card.get("gpu_requirement") in {"Medium", "High"} for card in skill_cards)


def _gpu_efficiency(skill_cards: list[dict[str, Any]]) -> int:
    if _has_skill(skill_cards, "optimization"):
        return 88
    if _requires_gpu(skill_cards):
        return 79
    return 93


def _has_skill(skill_cards: list[dict[str, Any]], skill_id: str) -> bool:
    return any(card.get("id") == skill_id for card in skill_cards)
