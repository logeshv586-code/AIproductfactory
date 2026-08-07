"""
Product Intelligence Pipeline — the reasoning-first orchestrator.

Phase 1 (``strategize``) runs stages 1-9 of the 17-stage protocol into the
Product Knowledge Graph and stops at the approval gate, returning up to 3
product strategies for the user to choose from.

Phase 2 (``approve``) reloads the persisted graph, continues from the approved
strategy through stages 10-17 (deep research, composition, architecture,
blueprint, engineering, execution plan) and returns the complete blueprint.

Every stage writes a trace entry so the reasoning behind each step is
explainable. The graph is the single source of truth passed between phases.
"""

from __future__ import annotations

import os
import uuid
from typing import Any

from intelligence.capability_engine import build_capability_graph
from intelligence.composition_engine import (
    build_architecture,
    build_blueprint,
    build_composition_plan,
    build_engineering,
    build_execution_plan,
    deep_research,
)
from intelligence.gap_engine import analyze_gaps
from intelligence.github_engine import discover_repos_and_mappings
from intelligence.intent_engine import analyze_intent
from intelligence.knowledge_graph import ProductKnowledgeGraph, run_path
from intelligence.market_engine import analyze_market
from intelligence.requirement_engine import extract_requirements
from intelligence.strategy_engine import generate_strategies
from llm.provider import LLMProvider, get_provider


class ProductIntelligencePipeline:
    """Reasoning-first product intelligence, one graph, two phases."""

    def __init__(self, provider: LLMProvider | None = None):
        self.provider = provider or get_provider()

    # ── Phase 1: stages 1-9 (stops at the approval gate) ─────────────────────
    async def strategize(
        self,
        idea: str,
        github_token: str | None = None,
        tavily_key: str | None = None,
    ) -> dict[str, Any]:
        """Run intent → requirements → market → gaps → capabilities → GitHub →
        strategies, persist the graph, and return run_id + strategies."""
        graph = ProductKnowledgeGraph(idea=idea)

        # 1. Intent Intelligence
        intent = await analyze_intent(idea, self.provider)
        graph.set("intent", intent)
        graph.set("domain", intent.get("domain", ""))
        graph.add_trace("intent", "interpreted idea", intent.get("summary", ""), {"confidence": intent.get("confidence")})

        # 2. Requirement Intelligence
        requirements = await extract_requirements_safe(intent, self.provider)
        graph.set("requirements", requirements)
        graph.add_trace("requirements", "extracted requirements", f"{len(requirements)} requirements")

        # 3. Market Intelligence (+ existing product discovery)
        market = await analyze_market(intent, self.provider, tavily_key)
        graph.set("market", market)
        graph.set("existing_products", market.get("existing_products", []))
        graph.add_trace("market", "analyzed market", f"{len(market.get('existing_products', []))} existing products")

        # 4. Gap Analysis
        gaps = await analyze_gaps(intent, requirements, market, self.provider)
        graph.set("gaps", gaps.get("gaps", []))
        graph.set("opportunity_statement", gaps.get("opportunity_statement", ""))
        graph.add_trace("gaps", "identified gaps", gaps.get("opportunity_statement", ""))

        # 5. Capability Intelligence (feature dependency graph)
        capabilities = await build_capability_graph(intent, requirements, gaps.get("gaps", []), self.provider)
        graph.set("capabilities", capabilities)
        graph.add_trace("capabilities", "built capability graph", f"{len(capabilities.get('capabilities', []))} capabilities")

        # 6. GitHub Intelligence (per-capability discovery + mapping)
        github = await discover_repos_and_mappings(capabilities, intent, github_token)
        graph.set("repos", github.get("repos", []))
        graph.set("capability_mappings", github.get("capability_mappings", []))
        note = github.get("note")
        graph.add_trace(
            "github", "discovered repos per capability",
            f"{len(github.get('repos', []))} repos across {len(github.get('capability_mappings', []))} capabilities",
            {"note": note},
        )

        # 7. Product Strategy Generator (stops here — approval gate)
        strategies = await generate_strategies(
            intent, requirements, capabilities, github.get("capability_mappings", []), market, self.provider
        )
        graph.set("strategies", strategies)
        graph.add_trace("strategy", "generated strategies", f"{len(strategies)} strategies for approval")

        run_id = str(uuid.uuid4())[:8]
        graph.set("_run_id", run_id)
        graph.save(run_path(run_id))

        return {
            "run_id": run_id,
            "graph": graph.to_dict(),
            "strategies": strategies,
            "status": "awaiting_approval",
        }

    # ── Phase 2: stages 10-17 (from the approved strategy) ───────────────────
    async def approve(self, run_id: str, strategy_id: str) -> dict[str, Any]:
        """Continue from the approved strategy through deep research,
        composition, architecture, blueprint, engineering and execution plan."""
        path = run_path(run_id)
        graph = ProductKnowledgeGraph.load(path)
        if graph is None:
            return {"success": False, "error": f"run_id {run_id} not found"}

        strategies = graph.get("strategies", [])
        strategy = next((s for s in strategies if s.get("id") == strategy_id), None)
        if strategy is None:
            strategy = next((s for s in strategies if s.get("name") == strategy_id), None)
        if strategy is None:
            return {"success": False, "error": f"strategy {strategy_id} not found"}

        intent = graph.get("intent", {})
        requirements = graph.get("requirements", [])
        capability_mappings = graph.get("capability_mappings", [])

        graph.set_approved_strategy(strategy)
        graph.add_trace("approval", "strategy approved", strategy.get("id", ""), {"name": strategy.get("name")})

        # 8. Deep Research
        research = await deep_research(intent, strategy, capability_mappings, self.provider)
        graph.set("deep_research", research)
        graph.add_trace("research", "deep research", f"{len(research.get('technologies', []))} technologies")

        # 9. Repository Composition
        composition_plan = build_composition_plan(strategy, capability_mappings)
        graph.set("composition_plan", composition_plan)
        graph.add_trace("composition", "built composition plan", f"{len(composition_plan.get('services', []))} services")

        # 10. Architecture Intelligence
        architecture = await build_architecture(strategy, capability_mappings, composition_plan, self.provider)
        graph.set("architecture", architecture)
        graph.add_trace("architecture", "designed architecture", f"{len(architecture.get('components', []))} components")

        # 11. Product Blueprint
        blueprint = build_blueprint(strategy, architecture, capability_mappings)
        graph.set("blueprint", blueprint)
        graph.add_trace("blueprint", "built blueprint", blueprint.get("product_name", ""))

        # 12. Engineering Intelligence
        engineering = build_engineering(strategy, blueprint, architecture)
        graph.set("engineering", engineering)
        graph.add_trace("engineering", "built engineering setup", f"{len(engineering.get('config_files', []))} config files")

        # 13. Execution Planner
        execution_plan = build_execution_plan(strategy, architecture, requirements)
        graph.set("execution_plan", execution_plan)
        graph.add_trace("execution", "built execution plan", f"{len(execution_plan.get('milestones', []))} milestones")

        graph.set("_status", "complete")
        graph.save(path)

        return {
            "success": True,
            "run_id": run_id,
            "graph": graph.to_dict(),
            "approved_strategy": strategy,
            "status": "complete",
        }


async def extract_requirements_safe(intent: dict[str, Any], provider: LLMProvider) -> list[dict[str, Any]]:
    """Wrapper so a requirement-engine failure never aborts the pipeline."""
    try:
        return await extract_requirements(intent, provider)
    except Exception as e:
        print(f"[Pipeline] requirement extraction degraded: {e}")
        return []
