"""
AI Product Builder Engine — FastAPI Backend
Main server entry point with all API endpoints.

6-Step Pipeline Protocol:
  1. Intent Extraction & Repo Crawling
  2. Semantic Capability Mapping
  3. Graphify (Knowledge Graph Construction)
  4. Product Composition & Architecture Design
  5. Product Scoring
  6. Starter Repo Generation
"""

import os
import sys
from typing import Any, Optional
from contextlib import asynccontextmanager

# Load .env before any other imports that may need env vars
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from engine.pipeline import run_pipeline, PipelineOrchestrator
from engine.scoring import score_product, rank_products
from engine.starter_repo import generate_starter_repo
from engine.repo_selector import select_best_repos, extract_intent, rank_repos
from graph.graphify import build_graph, get_graph_stats
from agents.repo_analyzer import analyze_repos
from agents.capability_mapper import map_capabilities, map_capabilities_with_embedding
from agents.product_generator import generate_products, generate_all_strategies
from agents.architecture_designer import design_architecture
from llm.provider import get_provider, LLMProvider


# ═══════════════════════════════════════════════════════════════════════════
# Pydantic Models
# ═══════════════════════════════════════════════════════════════════════════

class PipelineRequest(BaseModel):
    """Request to run the full 6-step pipeline."""
    idea: str = Field(..., description="User's product idea description")
    repos: list[dict[str, Any]] = Field(default_factory=list, description="Available GitHub repos")
    strategy: str = Field(default="all", description="Product generation strategy")
    use_embeddings: bool = Field(default=True, description="Use semantic embeddings")
    max_repos: int = Field(default=5, description="Max repos to select")


class IntentRequest(BaseModel):
    """Request to extract intent from user input."""
    user_input: str = Field(..., description="User's natural language input")


class RepoRankRequest(BaseModel):
    """Request to rank repos against an intent."""
    repos: list[dict[str, Any]] = Field(..., description="Repos to rank")
    intent: dict[str, Any] = Field(..., description="Extracted intent")


class ScoreRequest(BaseModel):
    """Request to score products."""
    products: list[dict[str, Any]] = Field(..., description="Products to score")
    repos: list[dict[str, Any]] = Field(default_factory=list)
    capabilities: Optional[list[dict[str, Any]]] = None


class StarterRepoRequest(BaseModel):
    """Request to generate a starter repo blueprint."""
    product: dict[str, Any] = Field(..., description="Product to generate starter for")
    architecture: dict[str, Any] = Field(..., description="System architecture")


class HealthResponse(BaseModel):
    status: str
    version: str
    pipeline_steps: list[str]
    strategies: list[str]
    capabilities: list[str]


# ═══════════════════════════════════════════════════════════════════════════
# App Setup
# ═══════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    print("[AI Product Builder] Starting Python backend...")
    print(f"[AI Product Builder] LLM Provider: {os.environ.get('LLM_PROVIDER', 'local')}")
    print(f"[AI Product Builder] OpenAI Key: {'set' if os.environ.get('OPENAI_API_KEY') else 'not set'}")
    print(f"[AI Product Builder] Anthropic Key: {'set' if os.environ.get('ANTHROPIC_API_KEY') else 'not set'}")
    yield
    print("[AI Product Builder] Shutting down...")


app = FastAPI(
    title="AI Product Builder Engine",
    description="6-step pipeline: Intent → Capability → Graphify → Product → Score → Starter Repo",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════════════
# API Endpoints
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check and system info."""
    return HealthResponse(
        status="running",
        version="2.0.0",
        pipeline_steps=[
            "Intent Extraction",
            "Semantic Capability Mapping",
            "Graphify (Knowledge Graph)",
            "Product Composition & Architecture",
            "Product Scoring",
            "Starter Repo Generation",
        ],
        strategies=["crossPollination", "gapAnalysis", "trendBased", "compositionalAI", "all"],
        capabilities=["memory", "agent", "rag", "ui", "backend", "automation"],
    )


@app.post("/pipeline/run")
async def run_full_pipeline(request: PipelineRequest):
    """
    Run the full 6-step AI Product Builder pipeline.

    Step 1: Intent Extraction & Repo Crawling
    Step 2: Semantic Capability Mapping
    Step 3: Graphify (Knowledge Graph Construction)
    Step 4: Product Composition & Architecture Design
    Step 5: Product Scoring
    Step 6: Starter Repo Generation
    """
    if not request.idea:
        raise HTTPException(status_code=400, detail="A product idea is required")

    try:
        provider = get_provider()
        orchestrator = PipelineOrchestrator(provider)
        result = await orchestrator.run(
            user_input=request.idea,
            repos=request.repos,
            strategy=request.strategy,
            use_embeddings=request.use_embeddings,
        )
        return {"success": True, "data": result}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/intent/extract")
async def extract_user_intent(request: IntentRequest):
    """Extract structured intent from user's natural language input."""
    try:
        provider = get_provider()
        intent = await extract_intent(request.user_input, provider)
        return {"success": True, "intent": intent}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/repos/rank")
async def rank_repos_endpoint(request: RepoRankRequest):
    """Rank repos by relevance to an extracted intent."""
    try:
        provider = get_provider()
        ranked = await rank_repos(request.repos, request.intent, provider)
        return {"success": True, "ranked_repos": ranked}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/repos/analyze")
async def analyze_repos_endpoint(repos: list[dict[str, Any]]):
    """Analyze repos to extract signals (AI, API, complexity, capabilities)."""
    try:
        analyzed = analyze_repos(repos)
        return {"success": True, "analyzed_repos": analyzed, "count": len(analyzed)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/capabilities/map")
async def map_capabilities_endpoint(repos: list[dict[str, Any]], use_embeddings: bool = True):
    """Map repos to capability types using keyword matching or semantic embeddings."""
    try:
        provider = get_provider() if use_embeddings else None
        if use_embeddings and provider:
            capabilities = await map_capabilities_with_embedding(repos, provider)
        else:
            capabilities = map_capabilities(repos)
        return {"success": True, "capabilities": capabilities, "count": len(capabilities)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/products/generate")
async def generate_products_endpoint(
    capabilities: list[dict[str, Any]],
    strategy: str = "all",
    user_intent: Optional[str] = None,
):
    """Generate product ideas from capabilities using specified strategy."""
    try:
        provider = get_provider()
        if strategy == "all":
            products = await generate_all_strategies(capabilities, user_intent, provider)
        else:
            products = await generate_products(capabilities, strategy, user_intent, provider)
        return {"success": True, "products": products, "count": len(products)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/architecture/design")
async def design_architecture_endpoint(
    product: dict[str, Any],
    repo_profiles: Optional[list[dict[str, Any]]] = None,
):
    """Design system architecture for a product."""
    try:
        if repo_profiles is None:
            repo_profiles = []
        provider = get_provider()
        architecture = await design_architecture(product, repo_profiles, provider)
        return {"success": True, "architecture": architecture}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/products/score")
async def score_products_endpoint(request: ScoreRequest):
    """Score and rank products by viability."""
    try:
        ranked = rank_products(request.products, request.repos, request.capabilities)
        return {"success": True, "ranked_products": ranked, "count": len(ranked)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/starter-repo/generate")
async def generate_starter_repo_endpoint(request: StarterRepoRequest):
    """Generate a starter repo blueprint for a product."""
    try:
        provider = get_provider()
        blueprint = await generate_starter_repo(request.product, request.architecture, provider)
        return {"success": True, "blueprint": blueprint}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/graph/build")
async def build_graph_endpoint(
    repos: list[dict[str, Any]],
    capabilities: list[dict[str, Any]],
    products: Optional[list[dict[str, Any]]] = None,
):
    """Build a knowledge graph from repos, capabilities, and products."""
    try:
        if products is None:
            products = []
        graph = build_graph(repos, capabilities, products)
        stats = get_graph_stats(graph)
        return {"success": True, "graph": graph, "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PYTHON_BACKEND_PORT", "8001"))
    print(f"[AI Product Builder] Starting on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
