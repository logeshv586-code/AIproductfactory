"""
Product Intelligence Pipeline — reasoning, approval, autonomous build, verification.

Phase 1 (``strategize``) creates evidence-backed product strategies and stops at
an explicit approval gate. Phase 2 (``approve``) performs deep research,
architecture/composition, creates the execution plan, turns that plan into a
real codebase under ``output/<run_id>``, and verifies the generated repository.
"""

from __future__ import annotations

import uuid
from typing import Any

from execution.build_engine import build_approved_product
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
from intelligence.live_source_engine import research_live_sources
from intelligence.market_engine import analyze_market
from intelligence.requirement_engine import extract_requirements
from intelligence.strategy_engine import generate_strategies
from llm.provider import LLMProvider, get_provider


class ProductIntelligencePipeline:
    """Reasoning-first product intelligence with an approval-gated build phase."""

    def __init__(self, provider: LLMProvider | None = None):
        self.provider = provider or get_provider()

    async def strategize(
        self,
        idea: str,
        github_token: str | None = None,
        tavily_key: str | None = None,
    ) -> dict[str, Any]:
        """Run discovery and strategy generation, persist graph, stop for approval."""
        graph = ProductKnowledgeGraph(idea=idea)

        intent = await analyze_intent(idea, self.provider)
        graph.set("intent", intent)
        graph.set("domain", intent.get("domain", ""))
        graph.add_trace("intent", "interpreted idea", intent.get("summary", ""), {"confidence": intent.get("confidence")})

        requirements = await extract_requirements_safe(intent, self.provider)
        graph.set("requirements", requirements)
        graph.add_trace("requirements", "extracted requirements", f"{len(requirements)} requirements")

        market = await analyze_market(intent, self.provider, tavily_key)
        graph.set("market", market)
        graph.set("existing_products", market.get("existing_products", []))
        graph.add_trace("market", "analyzed market", f"{len(market.get('existing_products', []))} existing products")

        gaps = await analyze_gaps(intent, requirements, market, self.provider)
        graph.set("gaps", gaps.get("gaps", []))
        graph.set("opportunity_statement", gaps.get("opportunity_statement", ""))
        graph.add_trace("gaps", "identified gaps", gaps.get("opportunity_statement", ""))

        capabilities = await build_capability_graph(intent, requirements, gaps.get("gaps", []), self.provider)
        graph.set("capabilities", capabilities)
        graph.add_trace("capabilities", "built capability graph", f"{len(capabilities.get('capabilities', []))} capabilities")

        github = await discover_repos_and_mappings(capabilities, intent, github_token)
        graph.set("repos", github.get("repos", []))
        graph.set("capability_mappings", github.get("capability_mappings", []))
        graph.add_trace(
            "github",
            "discovered repos per capability",
            f"{len(github.get('repos', []))} repos across {len(github.get('capability_mappings', []))} capabilities",
            {"note": github.get("note")},
        )

        # Non-GitHub live evidence now participates before strategy generation.
        live_sources = await research_live_sources(intent)
        graph.set("live_sources", live_sources)
        graph.add_trace(
            "live_sources",
            "researched GitLab, Hugging Face, Hacker News, Stack Overflow and arXiv",
            f"{live_sources.get('summary', {}).get('signal_count', 0)} signals from "
            f"{live_sources.get('summary', {}).get('sources_with_results', 0)} sources",
        )

        market_with_live = dict(market)
        market_with_live["live_source_signals"] = live_sources.get("signals", [])
        market_with_live["live_source_summary"] = live_sources.get("summary", {})

        strategies = await generate_strategies(
            intent,
            requirements,
            capabilities,
            github.get("capability_mappings", []),
            market_with_live,
            self.provider,
        )
        graph.set("strategies", strategies)
        graph.add_trace("strategy", "generated strategies", f"{len(strategies)} strategies for approval")

        run_id = str(uuid.uuid4())[:8]
        graph.set("_run_id", run_id)
        graph.set("_status", "awaiting_approval")
        graph.save(run_path(run_id))

        return {
            "run_id": run_id,
            "graph": graph.to_dict(),
            "strategies": strategies,
            "live_sources": live_sources,
            "status": "awaiting_approval",
        }

    async def approve(self, run_id: str, strategy_id: str) -> dict[str, Any]:
        """Approve a strategy, generate its codebase, and verify the result."""
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

        # Deep research uses both the existing reasoning engine and live sources.
        research = await deep_research(intent, strategy, capability_mappings, self.provider)
        live_sources = graph.get("live_sources", {}) or await research_live_sources(intent)
        research = dict(research)
        research["live_sources"] = live_sources.get("signals", [])
        research["live_source_summary"] = live_sources.get("summary", {})
        graph.set("deep_research", research)
        graph.set("live_sources", live_sources)
        graph.add_trace(
            "research",
            "deep research with live-source evidence",
            f"{len(research.get('technologies', []))} technologies · "
            f"{live_sources.get('summary', {}).get('signal_count', 0)} external signals",
        )

        composition_plan = build_composition_plan(strategy, capability_mappings)
        graph.set("composition_plan", composition_plan)
        graph.add_trace("composition", "built composition plan", f"{len(composition_plan.get('services', []))} services")

        architecture = await build_architecture(strategy, capability_mappings, composition_plan, self.provider)
        graph.set("architecture", architecture)
        graph.add_trace("architecture", "designed architecture", f"{len(architecture.get('components', []))} components")

        blueprint = build_blueprint(strategy, architecture, capability_mappings)
        graph.set("blueprint", blueprint)
        graph.add_trace("blueprint", "built blueprint", blueprint.get("product_name", ""))

        engineering = build_engineering(strategy, blueprint, architecture)
        graph.set("engineering", engineering)
        graph.add_trace("engineering", "built engineering setup", f"{len(engineering.get('config_files', []))} config files")

        execution_plan = build_execution_plan(strategy, architecture, requirements)
        graph.set("execution_plan", execution_plan)
        graph.add_trace("execution", "built execution plan", f"{len(execution_plan.get('milestones', []))} milestones")

        graph.set("_status", "building")
        graph.save(path)

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
        graph.save(path)

        return {
            "success": completed,
            "run_id": run_id,
            "graph": graph.to_dict(),
            "approved_strategy": strategy,
            "build": build,
            "verification": build.get("verification", {}),
            "output_path": build.get("output_path"),
            "status": "complete" if completed else "build_failed",
        }


async def extract_requirements_safe(intent: dict[str, Any], provider: LLMProvider) -> list[dict[str, Any]]:
    """Wrapper so a requirement-engine failure never aborts the pipeline."""
    try:
        return await extract_requirements(intent, provider)
    except Exception as e:
        print(f"[Pipeline] requirement extraction degraded: {e}")
        return []
