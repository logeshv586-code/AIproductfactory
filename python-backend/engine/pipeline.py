"""
Pipeline Orchestrator — 6-Step System Protocol
  Step 1: Intent Extraction & Repo Crawling
  Step 2: Semantic Capability Mapping
  Step 3: Graphify (Knowledge Graph Construction)
  Step 4: Product Composition & Architecture Design
  Step 5: Product Scoring
  Step 6: Starter Repo Generation

This is the main entry point for the Python backend pipeline.
"""

import time
from typing import Any, Optional, Callable

from llm.provider import LLMProvider, get_provider
from agents.repo_analyzer import analyze_repos
from agents.capability_mapper import map_capabilities, map_capabilities_with_embedding
from agents.product_generator import generate_products, generate_all_strategies
from agents.architecture_designer import design_architecture
from engine.repo_selector import select_best_repos
from engine.scoring import score_product, rank_products
from engine.starter_repo import generate_starter_repo
from execution.execution_agent import get_execution_agent
from execution.product_builder import build_product_delivery
from graph.graphify import build_graph, get_graph_stats
from graph.capability_graph import build_capability_graph_engine
from memory.vector_memory import get_vector_memory
from memory.graph_memory import get_graph_memory
from agents.research_agent import conduct_research
from agents.planner import generate_plan
from intelligence.feasibility_engine import evaluate_feasibility
from intelligence.combined_report import build_combined_intelligence_report


class PipelineOrchestrator:
    """Orchestrates the full 6-step AI Product Builder pipeline."""

    def __init__(self, provider: Optional[LLMProvider] = None):
        self.provider = provider or get_provider()
        self.timeline: list[dict[str, Any]] = []

    def _log(self, step: str, detail: str = ""):
        """Log a pipeline step."""
        entry = {"step": step, "ts": int(time.time() * 1000), "detail": detail}
        self.timeline.append(entry)
        print(f"[Pipeline] -> {step}{' - ' + detail if detail else ''}")

    async def run(
        self,
        user_input: str,
        repos: list[dict[str, Any]],
        strategy: str = "all",
        use_embeddings: bool = True,
        on_progress: Optional[Callable[[dict[str, Any]], None]] = None,
    ) -> dict[str, Any]:
        """Run the full Product Factory pipeline and return build + delivery evidence."""
        self.timeline = []

        self._log("IntentExtraction", "Extracting user intent and selecting best repos")
        selection_result = await select_best_repos(user_input, repos, self.provider)
        intent = selection_result["intent"]
        selected_repos = selection_result["selected_repos"]

        if on_progress:
            on_progress({"step": "intent_extraction", "status": "complete", "intent": intent})

        self._log("RepoAnalysis", f"Analyzing {len(selected_repos)} repos")
        analyzed_repos = analyze_repos(selected_repos)

        self._log("CapabilityMapping", "Mapping capabilities with semantic similarity")
        if use_embeddings:
            capabilities = await map_capabilities_with_embedding(analyzed_repos, self.provider)
        else:
            capabilities = map_capabilities(analyzed_repos)

        if on_progress:
            on_progress({"step": "capability_mapping", "status": "complete", "capabilities": capabilities})

        self._log("Graphify", "Building capability knowledge graph")
        initial_graph = build_graph(analyzed_repos, capabilities, [])
        graph_stats = get_graph_stats(initial_graph)

        if on_progress:
            on_progress({"step": "graphify", "status": "complete", "stats": graph_stats})

        self._log("ProductComposition", f"Generating products with {strategy} strategy")
        if strategy == "all":
            raw_products = await generate_all_strategies(capabilities, user_input, self.provider)
        else:
            raw_products = await generate_products(capabilities, strategy, user_input, self.provider)

        products_with_arch = []
        for product in raw_products:
            self._log("ArchitectureDesign", f"Designing architecture for {product.get('name', '')}")
            try:
                architecture = await design_architecture(product, capabilities, self.provider)
                product["architecture"] = architecture
            except Exception as e:
                print(f"[Pipeline] Architecture design error: {e}")
                product["architecture"] = None
            products_with_arch.append(product)

        if on_progress:
            on_progress({"step": "product_composition", "status": "complete", "product_count": len(products_with_arch)})

        self._log("Scoring", "Scoring and ranking products")
        ranked_products = rank_products(products_with_arch, selected_repos, capabilities)
        final_graph = build_graph(analyzed_repos, capabilities, ranked_products)
        graph_stats = get_graph_stats(final_graph)

        if on_progress:
            on_progress({
                "step": "scoring",
                "status": "complete",
                "top_score": ranked_products[0]["scores"]["final_score"] if ranked_products else 0,
            })

        self._log("ResearchIntelligence", "Extracting research-to-implementation signals")
        research_report: dict[str, Any] = {}
        feasibility_report: dict[str, Any] = {}
        execution_plan: dict[str, Any] = {}

        try:
            domain_hint = "generic"
            if any(term in user_input.lower() for term in ["trading", "market", "stock", "crypto"]):
                domain_hint = "trading"
            elif any(term in user_input.lower() for term in ["vision", "image", "video", "object detection"]):
                domain_hint = "vision_ai"
            research_report = await conduct_research(user_input, domain_hint, self.provider)
        except Exception as e:
            self._log("ResearchIntelligence", f"Research fallback used: {e}")

        if ranked_products and ranked_products[0].get("architecture"):
            try:
                self._log("FeasibilityAnalysis", "Evaluating real-world architecture viability")
                feasibility_report = await evaluate_feasibility(ranked_products[0]["architecture"], self.provider)
            except Exception as e:
                self._log("FeasibilityAnalysis", f"Feasibility fallback used: {e}")

            try:
                self._log("ExecutionPlanning", "Generating production execution plan")
                execution_plan = await generate_plan(
                    user_input,
                    ranked_products[0]["architecture"],
                    selected_repos,
                    self.provider,
                )
            except Exception as e:
                self._log("ExecutionPlanning", f"Plan fallback used: {e}")

        self._log("CapabilityGraphEngine", "Expanding graph with skills, research, memory, and architecture")
        memory_summary = {
            "stores": ["prompts", "failures", "successful_architectures", "repo_scores", "execution_outcomes"],
            "feedback_loop": "Execution outcomes update skill confidence and architecture recommendations.",
        }
        capability_engine = build_capability_graph_engine(
            user_request=user_input,
            repos=analyzed_repos,
            capabilities=capabilities,
            products=ranked_products,
            research=research_report,
            memory=memory_summary,
        )

        self._log("StarterRepoGeneration", "Generating starter repo blueprint")
        starter_blueprints = []
        for product in ranked_products[:3]:
            try:
                if product.get("architecture"):
                    blueprint = await generate_starter_repo(product, product["architecture"], self.provider)
                    product["starter_blueprint"] = blueprint
                    starter_blueprints.append({"product_name": product.get("name", ""), "blueprint": blueprint})
            except Exception as e:
                print(f"[Pipeline] Starter repo error: {e}")

        if on_progress:
            on_progress({"step": "starter_repo", "status": "complete", "blueprints_generated": len(starter_blueprints)})

        # The old implementation only wrote three files and accidentally put generated Python
        # in a legacy docker_compose_yaml field. The verified builder now creates a runnable
        # source tree, lets engineering agents extend it from the execution plan, performs
        # deterministic verification/repair passes, generates a demo, and packages the result.
        delivery: dict[str, Any] | None = None
        if ranked_products and ranked_products[0].get("starter_blueprint") and ranked_products[0].get("architecture"):
            self._log("Engineering", "Implementing the approved product plan into full source code")
            try:
                top_product = ranked_products[0]
                workspace_id = f"build_{int(time.time() * 1000)}"
                agent = get_execution_agent(workspace_id, self.provider)
                delivery = await build_product_delivery(
                    product=top_product,
                    architecture=top_product["architecture"],
                    blueprint=top_product["starter_blueprint"],
                    execution_plan=execution_plan,
                    selected_repos=selected_repos,
                    agent=agent,
                )
                top_product["delivery"] = delivery
                self._log("Execution", f"Full source for '{top_product['name']}' saved to output/{workspace_id}")
                self._log(
                    "ExecutionVerification",
                    f"Build verification {'passed' if delivery.get('verification', {}).get('passed') else 'needs attention'} "
                    f"at {delivery.get('verification', {}).get('score', 0)}%",
                )
            except Exception as e:
                self._log("Execution", f"Automatic full-source build failed: {e}")

        self._log("KnowledgePersistence", "Indexing results into Graph and Vector memory")
        try:
            v_memory = get_vector_memory()
            g_memory = get_graph_memory()

            repo_docs = []
            for repo in selected_repos:
                repo_id = repo.get("full_name", repo.get("name", ""))
                repo_docs.append({
                    "text": f"Repository: {repo_id}. Description: {repo.get('description')}. Capability: {repo.get('capability')}",
                    "metadata": {"id": repo_id, "type": "repo", "name": repo_id},
                })
                g_memory.add_node(repo_id, repo_id, "repo", {"description": repo.get("description")})

            product_docs = []
            for product in ranked_products:
                prod_id = f"prod_{product['name'].replace(' ', '_')}"
                product_docs.append({
                    "text": f"Product Idea: {product['name']}. Description: {product['description']}. Strategy: {product.get('strategy')}",
                    "metadata": {"id": prod_id, "type": "product", "name": product["name"]},
                })
                g_memory.add_node(prod_id, product["name"], "product", {"description": product["description"]})
                for repo in selected_repos:
                    repo_id = repo.get("full_name", repo.get("name", ""))
                    g_memory.add_edge(prod_id, repo_id, "USES", "uses_repo")

            await v_memory.add_documents(repo_docs + product_docs)
        except Exception as e:
            print(f"[Pipeline] Knowledge persistence error: {e}")

        combined_report = build_combined_intelligence_report(
            user_request=user_input,
            intent=intent,
            selected_repos=selected_repos,
            capabilities=capabilities,
            products=ranked_products,
            capability_graph=capability_engine,
            research=research_report,
            feasibility=feasibility_report,
            execution_plan=execution_plan,
            timeline=self.timeline,
        )

        self._log("COMPLETE", f"Pipeline finished: {len(ranked_products)} products, {capability_engine['stats']['total_nodes']} graph nodes")

        result = {
            "intent": intent,
            "selected_repos": [
                {
                    "name": r.get("full_name", r.get("name", "")),
                    "description": r.get("description", ""),
                    "capability": r.get("capability", ""),
                    "selection_reasoning": r.get("selection_reasoning", r.get("reason", "")),
                    "suggested_role": r.get("suggested_role", ""),
                    "stars": r.get("stars", 0),
                    "language": r.get("language", ""),
                    "relevance_score": r.get("relevance_score", 0),
                }
                for r in selected_repos
            ],
            "graphify_nodes_and_edges": final_graph,
            "graph_stats": graph_stats,
            "capability_graph_engine": capability_engine,
            "combined_intelligence_report": combined_report,
            "research_report": research_report,
            "feasibility_report": feasibility_report,
            "execution_plan": execution_plan,
            "composed_products": ranked_products,
            "delivery": delivery,
            "timeline": self.timeline,
            "capabilities": capabilities,
        }
        return result


async def run_pipeline(
    user_input: str,
    repos: list[dict[str, Any]],
    strategy: str = "all",
    provider: Optional[LLMProvider] = None,
    on_progress: Optional[Callable[[dict[str, Any]], None]] = None,
) -> dict[str, Any]:
    """Convenience function to run the full pipeline."""
    orchestrator = PipelineOrchestrator(provider)
    return await orchestrator.run(user_input, repos, strategy, True, on_progress)
