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
from graph.capability_graph import build_capability_graph_engine, match_required_skills, dynamic_workspace_tabs
from agents.repo_analyzer import analyze_repos
from agents.capability_mapper import map_capabilities, map_capabilities_with_embedding
from agents.product_generator import generate_products, generate_all_strategies
from agents.architecture_designer import design_architecture
from agents.planner import generate_plan
from agents.research_agent import conduct_research
from core.skill_engine import get_skill_engine
from core.graph_rag import get_graph_rag
from intelligence.feasibility_engine import evaluate_feasibility
from intelligence.self_improvement import suggest_improvements
from execution.execution_agent import get_execution_agent
from llm.provider import get_provider, LLMProvider
from llm.router import get_provider_router


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


class CapabilityGraphRequest(BaseModel):
    idea: str
    repos: list[dict[str, Any]] = Field(default_factory=list)
    capabilities: list[dict[str, Any]] = Field(default_factory=list)
    products: list[dict[str, Any]] = Field(default_factory=list)
    research: dict[str, Any] = Field(default_factory=dict)
    memory: dict[str, Any] = Field(default_factory=dict)


class ProviderRouteRequest(BaseModel):
    messages: list[dict[str, str]]
    task_type: Optional[str] = None
    temperature: float = 0.5
    max_tokens: int = 1000
    use_cache: bool = True


# ═══════════════════════════════════════════════════════════════════════════
# App Setup
# ═══════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    print("[AI Product Builder] Starting Python backend...")
    print(f"[AI Product Builder] LLM Provider: {os.environ.get('LLM_PROVIDER', 'local')}")
    print(f"[AI Product Builder] NVIDIA Key: {'set' if os.environ.get('NVIDIA_API_KEY') else 'not set'}")
    print(f"[AI Product Builder] OpenAI Key: {'set' if os.environ.get('OPENAI_API_KEY') else 'not set'}")
    print(f"[AI Product Builder] Anthropic Key: {'set' if os.environ.get('ANTHROPIC_API_KEY') else 'not set'}")
    print(f"[AI Product Builder] Gemini Key: {'set' if os.environ.get('GEMINI_API_KEY') else 'not set'}")
    print(f"[AI Product Builder] GitHub Token: {'set' if os.environ.get('GITHUB_TOKEN') else 'not set'}")
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


@app.post("/graph/capability-engine")
async def capability_graph_engine_endpoint(request: CapabilityGraphRequest):
    """Build the expanded capability graph with skills, research, memory, and domain packs."""
    try:
        graph = build_capability_graph_engine(
            user_request=request.idea,
            repos=request.repos,
            capabilities=request.capabilities,
            products=request.products,
            research=request.research,
            memory=request.memory,
        )
        return {"success": True, "graph": graph}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/skills/match")
async def match_skills_endpoint(request: CapabilityGraphRequest):
    """Return Skill MDI cards and dynamic workspace tabs for a request."""
    try:
        skill_cards = match_required_skills(request.idea, request.capabilities)
        domain = build_capability_graph_engine(request.idea, request.repos, request.capabilities).get("domain", "generic")
        return {
            "success": True,
            "skills": skill_cards,
            "workspace_tabs": dynamic_workspace_tabs(skill_cards, domain),
            "domain": domain,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/llm/route")
async def route_llm_endpoint(request: ProviderRouteRequest):
    """Route an LLM request through provider intelligence with fallback and metrics."""
    try:
        router = get_provider_router()
        result = await router.chat(
            request.messages,
            task_type=request.task_type,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
            use_cache=request.use_cache,
        )
        return {"success": True, "result": result, "metrics": router.get_metrics()[-10:]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/llm/metrics")
async def provider_metrics_endpoint():
    """Return provider routing metrics."""
    try:
        return {"success": True, "metrics": get_provider_router().get_metrics()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════════════
# v2 Endpoints
# ═══════════════════════════════════════════════════════════════════════════

class ResearchRequest(BaseModel):
    idea: str
    domain: str

class PlanRequest(BaseModel):
    idea: str
    architecture: dict[str, Any]
    repos: list[dict[str, Any]]

@app.post("/research/conduct")
async def conduct_research_endpoint(request: ResearchRequest):
    """Conduct deep intelligence research on an idea."""
    try:
        provider = get_provider()
        research = await conduct_research(request.idea, request.domain, provider)
        return {"success": True, "research": research}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/plan/generate")
async def generate_plan_endpoint(request: PlanRequest):
    """Generate a structured implementation plan."""
    try:
        provider = get_provider()
        plan = await generate_plan(request.idea, request.architecture, request.repos, provider)
        return {"success": True, "plan": plan}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/skills/list")
async def list_skills_endpoint():
    """List all available AI skills."""
    try:
        engine = get_skill_engine()
        return {"success": True, "skills": engine.list_skills()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/skills/{name}")
async def get_skill_endpoint(name: str):
    """Get details of a specific skill."""
    try:
        engine = get_skill_engine()
        skill = engine.get_skill(name)
        if not skill:
            raise HTTPException(status_code=404, detail="Skill not found")
        return {"success": True, "skill": skill}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ChatRequest(BaseModel):
    message: str

@app.post("/knowledge/chat")
async def knowledge_chat_endpoint(request: ChatRequest):
    """Chat with the AI's persistent knowledge memory."""
    try:
        rag = get_graph_rag()
        response = await rag.query(request.message)
        return {"success": True, "response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class FeasibilityRequest(BaseModel):
    architecture: dict[str, Any]

class ImprovementRequest(BaseModel):
    product: dict[str, Any]
    feasibility: dict[str, Any]

@app.post("/intelligence/feasibility")
async def evaluate_feasibility_endpoint(request: FeasibilityRequest):
    """Evaluate the feasibility of a product architecture."""
    try:
        provider = get_provider()
        report = await evaluate_feasibility(request.architecture, provider)
        return {"success": True, "report": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/intelligence/improve")
async def suggest_improvements_endpoint(request: ImprovementRequest):
    """Suggest architectural refinements for a product."""
    try:
        provider = get_provider()
        refinements = await suggest_improvements(request.product, request.feasibility, provider)
        return {"success": True, "refinements": refinements}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ExecutionRequest(BaseModel):
    workspace_id: str
    task: dict[str, Any]

@app.post("/execution/run_task")
async def run_task_endpoint(request: ExecutionRequest):
    """Run a specific implementation task autonomously."""
    try:
        agent = get_execution_agent(request.workspace_id)
        result = await agent.execute_task(request.task)
        return {"success": True, "result": result, "logs": agent.get_logs()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/execution/logs/{workspace_id}")
async def get_execution_logs_endpoint(workspace_id: str):
    """Get the execution logs for a workspace."""
    try:
        agent = get_execution_agent(workspace_id)
        return {"success": True, "logs": agent.get_logs()}
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
