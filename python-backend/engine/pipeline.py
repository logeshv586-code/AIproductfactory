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
from graph.graphify import build_graph, get_graph_stats
from memory.vector_memory import get_vector_memory
from memory.graph_memory import get_graph_memory


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
        """
        Run the full 6-step pipeline.

        Args:
            user_input: User's product idea description
            repos: List of available repos (from GitHub search)
            strategy: Product generation strategy (crossPollination, gapAnalysis, trendBased, compositionalAI, all)
            use_embeddings: Whether to use semantic embeddings for capability mapping
            on_progress: Optional callback for progress updates

        Returns:
            Complete pipeline result with intent, repos, graph, products, scores, and starter blueprint
        """
        self.timeline = []

        # ═══════════════════════════════════════════════════════════════════
        # STEP 1: Intent Extraction & Repo Selection
        # ═══════════════════════════════════════════════════════════════════
        self._log("IntentExtraction", "Extracting user intent and selecting best repos")
        selection_result = await select_best_repos(user_input, repos, self.provider)
        intent = selection_result["intent"]
        selected_repos = selection_result["selected_repos"]

        if on_progress:
            on_progress({"step": "intent_extraction", "status": "complete", "intent": intent})

        # ═══════════════════════════════════════════════════════════════════
        # STEP 2: Repo Analysis & Capability Mapping
        # ═══════════════════════════════════════════════════════════════════
        self._log("RepoAnalysis", f"Analyzing {len(selected_repos)} repos")
        analyzed_repos = analyze_repos(selected_repos)

        self._log("CapabilityMapping", "Mapping capabilities with semantic similarity")
        if use_embeddings:
            capabilities = await map_capabilities_with_embedding(analyzed_repos, self.provider)
        else:
            capabilities = map_capabilities(analyzed_repos)

        if on_progress:
            on_progress({"step": "capability_mapping", "status": "complete", "capabilities": capabilities})

        # ═══════════════════════════════════════════════════════════════════
        # STEP 3: Graphify (Knowledge Graph Construction)
        # ═══════════════════════════════════════════════════════════════════
        self._log("Graphify", "Building capability knowledge graph")
        # Build initial graph with just repos and capabilities (products added after scoring)
        initial_graph = build_graph(analyzed_repos, capabilities, [])
        graph_stats = get_graph_stats(initial_graph)

        if on_progress:
            on_progress({"step": "graphify", "status": "complete", "stats": graph_stats})

        # ═══════════════════════════════════════════════════════════════════
        # STEP 4: Product Composition & Architecture Design
        # ═══════════════════════════════════════════════════════════════════
        self._log("ProductComposition", f"Generating products with {strategy} strategy")
        if strategy == "all":
            raw_products = await generate_all_strategies(capabilities, user_input, self.provider)
        else:
            raw_products = await generate_products(capabilities, strategy, user_input, self.provider)

        # Design architecture for each product
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
            on_progress({"step": "product_composition", "status": "complete",
                        "product_count": len(products_with_arch)})

        # ═══════════════════════════════════════════════════════════════════
        # STEP 5: Product Scoring & Ranking
        # ═══════════════════════════════════════════════════════════════════
        self._log("Scoring", "Scoring and ranking products")
        ranked_products = rank_products(products_with_arch, selected_repos, capabilities)

        # Rebuild graph with scored products
        final_graph = build_graph(analyzed_repos, capabilities, ranked_products)
        graph_stats = get_graph_stats(final_graph)

        if on_progress:
            on_progress({"step": "scoring", "status": "complete",
                        "top_score": ranked_products[0]["scores"]["final_score"] if ranked_products else 0})

        # ═══════════════════════════════════════════════════════════════════
        # STEP 6: Starter Repo Generation
        # ═══════════════════════════════════════════════════════════════════
        self._log("StarterRepoGeneration", "Generating starter repo blueprint")
        starter_blueprints = []
        for product in ranked_products[:3]:  # Top 3 products get full blueprints
            try:
                if product.get("architecture"):
                    blueprint = await generate_starter_repo(
                        product, product["architecture"], self.provider
                    )
                    product["starter_blueprint"] = blueprint
                    starter_blueprints.append({
                        "product_name": product.get("name", ""),
                        "blueprint": blueprint,
                    })
            except Exception as e:
                print(f"[Pipeline] Starter repo error: {e}")

        if on_progress:
            on_progress({"step": "starter_repo", "status": "complete",
                        "blueprints_generated": len(starter_blueprints)})

        # ═══════════════════════════════════════════════════════════════════
        # STEP 7: Knowledge Persistence (Memory Indexing)
        # ═══════════════════════════════════════════════════════════════════
        self._log("KnowledgePersistence", "Indexing results into Graph and Vector memory")
        try:
            v_memory = get_vector_memory()
            g_memory = get_graph_memory()

            # Index Repos
            repo_docs = []
            for repo in selected_repos:
                repo_id = repo.get("full_name", repo.get("name", ""))
                repo_docs.append({
                    "text": f"Repository: {repo_id}. Description: {repo.get('description')}. Capability: {repo.get('capability')}",
                    "metadata": {"id": repo_id, "type": "repo", "name": repo_id}
                })
                g_memory.add_node(repo_id, repo_id, "repo", {"description": repo.get("description")})

            # Index Products
            product_docs = []
            for product in ranked_products:
                prod_id = f"prod_{product['name'].replace(' ', '_')}"
                product_docs.append({
                    "text": f"Product Idea: {product['name']}. Description: {product['description']}. Strategy: {product.get('strategy')}",
                    "metadata": {"id": prod_id, "type": "product", "name": product["name"]}
                })
                g_memory.add_node(prod_id, product["name"], "product", {"description": product["description"]})
                
                # Link product to repos it uses
                for repo in selected_repos:
                    repo_id = repo.get("full_name", repo.get("name", ""))
                    g_memory.add_edge(prod_id, repo_id, "USES", "uses_repo")

            await v_memory.add_documents(repo_docs + product_docs)
            
        except Exception as e:
            print(f"[Pipeline] Knowledge persistence error: {e}")

        self._log("COMPLETE", f"Pipeline finished: {len(ranked_products)} products, {graph_stats['total_nodes']} graph nodes")

        # ── Build final result ───────────────────────────────────────────
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
            "composed_products": ranked_products,
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
