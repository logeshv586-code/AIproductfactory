"""Integration bridge that upgrades PiOrchestrator approval into a real build.

Kept outside ``intelligence.pi_orchestrator`` to keep the cognitive orchestrator
focused on graph reasoning while the execution package owns code generation and
verification. ``install_pi_build_bridge`` is idempotent.
"""

from __future__ import annotations

from typing import Any

_INSTALLED = False


def install_pi_build_bridge() -> None:
    global _INSTALLED
    if _INSTALLED:
        return

    import intelligence.pi_orchestrator as pi_module
    from intelligence.knowledge_graph import ProductKnowledgeGraph, run_path
    from intelligence.live_source_engine import research_live_sources

    original_approve = pi_module.PiOrchestrator.approve
    original_deep_research = pi_module.deep_research

    async def deep_research_with_live_sources(
        intent: dict[str, Any],
        strategy: dict[str, Any],
        capability_mappings: list[dict[str, Any]],
        provider: Any,
    ) -> dict[str, Any]:
        research = await original_deep_research(intent, strategy, capability_mappings, provider)
        try:
            live = await research_live_sources(intent)
        except Exception as exc:
            live = {
                "signals": [],
                "summary": {"signal_count": 0, "sources_with_results": 0},
                "note": f"Live source research degraded: {exc}",
            }
        merged = dict(research or {})
        merged["live_sources"] = live.get("signals", [])
        merged["live_source_summary"] = live.get("summary", {})
        merged["live_source_catalog"] = live.get("source_catalog", [])
        return merged

    async def approve_with_build(self: Any, run_id: str, strategy_id: str) -> dict[str, Any]:
        result = await original_approve(self, run_id, strategy_id)
        if not result.get("success", True):
            return result

        graph_path = run_path(run_id)
        graph = ProductKnowledgeGraph.load(graph_path)
        if graph is None:
            return {**result, "success": False, "status": "build_failed", "error": f"run_id {run_id} graph disappeared before build"}

        strategy = graph.get("approved_strategy", {}) or result.get("approved_strategy", {})
        execution_plan = graph.get("execution_plan", {})
        blueprint = graph.get("blueprint", {})
        engineering = graph.get("engineering", {})
        architecture = graph.get("architecture", {})
        composition_plan = graph.get("composition_plan", {})

        # Import lazily to avoid a module cycle: build_engine imports ExecutionAgent.
        from execution.build_engine import build_approved_product

        graph.set("_status", "building")
        graph.add_trace("build", "autonomous build started", f"output/{run_id}")
        graph.save(graph_path)

        build = await build_approved_product(
            run_id=run_id,
            strategy=strategy,
            execution_plan=execution_plan,
            blueprint=blueprint,
            engineering=engineering,
            architecture=architecture,
            composition_plan=composition_plan,
            provider=self.provider,
        )

        graph.set("build", build)
        graph.set("verification", build.get("verification", {}))
        graph.add_trace(
            "build",
            "generated implementation files",
            f"{build.get('tasks_completed', 0)}/{build.get('tasks_total', 0)} tasks · "
            f"{len(build.get('verification', {}).get('files', []))} files",
        )
        graph.add_trace(
            "verification",
            "verified generated repository",
            f"score {build.get('verification', {}).get('score', 0)} · "
            f"passed {build.get('verification', {}).get('passed', False)}",
        )

        completed = bool(build.get("success"))
        graph.set("_status", "complete" if completed else "build_failed")
        graph.save(graph_path)

        return {
            **result,
            "success": completed,
            "graph": graph.to_dict(),
            "build": build,
            "verification": build.get("verification", {}),
            "output_path": build.get("output_path"),
            "status": "complete" if completed else "build_failed",
        }

    # Patch the module-level function used by PiOrchestrator.approve, then the
    # approval method itself. The class object imported by FastAPI sees the same
    # method replacement, so /pi/approve automatically gains the build phase.
    pi_module.deep_research = deep_research_with_live_sources
    pi_module.PiOrchestrator.approve = approve_with_build
    _INSTALLED = True
