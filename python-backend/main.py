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
from intelligence.pipeline import ProductIntelligencePipeline
from intelligence.pi_orchestrator import PiOrchestrator
from intelligence.knowledge_graph import ProductKnowledgeGraph, run_path as pi_run_path
from intelligence.live_source_engine import research_live_sources
from execution.execution_agent import get_execution_agent
from execution.autonomous_builder import build_approved_product
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


class StrategizeRequest(BaseModel):
    """Request to run the reasoning-first intelligence stages 1-9."""
    idea: str = Field(..., description="User's product idea description")
    github_token: Optional[str] = Field(default=None, description="Optional GitHub token for richer discovery")
    tavily_key: Optional[str] = Field(default=None, description="Optional Tavily key for web research")


class ApproveRequest(BaseModel):
    """Request to continue from an approved strategy (stages 10-17)."""
    run_id: str = Field(..., description="Run id returned by /pipeline/strategize")
    strategy_id: str = Field(..., description="Strategy id to approve (STRAT-A/B/C)")


# v4 — Product Intelligence Operating System
class PiStrategizeRequest(BaseModel):
    """Request to run the v4 multi-agent reasoning stages 1-13."""
    idea: str = Field(..., description="User's product idea description")
    github_token: Optional[str] = Field(default=None, description="Optional GitHub token")
    tavily_key: Optional[str] = Field(default=None, description="Optional Tavily key")


class PiApproveRequest(BaseModel):
    """Request to continue from an approved v4 strategy."""
    run_id: str = Field(..., description="Run id returned by /pi/strategize")
    strategy_id: str = Field(..., description="Strategy id to approve (STRAT-A/B/C)")


class PiExplainRequest(BaseModel):
    """Request for an explanation of why the recommendation was made."""
    run_id: str = Field(..., description="Run id returned by /pi/strategize")


class PiMemorySearchRequest(BaseModel):
    """Request to search Product Memory for similar past products."""
    idea: str = Field(..., description="User's product idea to match against past products")


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
# v3 Endpoints — Product Intelligence Engine (reasoning-first)
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/pipeline/strategize")
async def strategize_endpoint(request: StrategizeRequest):
    """
    Run reasoning stages 1-9 and stop at the approval gate.

    Returns up to 3 product strategies (with the full Product Knowledge Graph)
    for the user to choose from. Nothing is built until /pipeline/approve is
    called with an approved strategy id.
    """
    if not request.idea or not request.idea.strip():
        raise HTTPException(status_code=400, detail="A product idea is required")

    try:
        pipeline = ProductIntelligencePipeline()
        result = await pipeline.strategize(
            idea=request.idea.strip(),
            github_token=request.github_token or os.environ.get("GITHUB_TOKEN"),
            tavily_key=request.tavily_key or os.environ.get("TAVILY_API_KEY"),
        )
        return {"success": True, **result}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Strategize failed: {e}")


@app.post("/pipeline/approve")
async def approve_endpoint(request: ApproveRequest):
    """
    Continue from an approved strategy through stages 10-17.

    Re-loads the persisted Product Knowledge Graph for ``run_id`` and builds
    deep research, composition plan, architecture, blueprint, engineering setup
    and execution plan from the approved strategy.
    """
    try:
        pipeline = ProductIntelligencePipeline()
        result = await pipeline.approve(run_id=request.run_id, strategy_id=request.strategy_id)
        if not result.get("success", True):
            raise HTTPException(status_code=404, detail=result.get("error", "Approval failed"))
        return {"success": True, **result}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Approve failed: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# v4 Endpoints — Product Intelligence Operating System
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/pi/strategize")
async def pi_strategize_endpoint(request: PiStrategizeRequest):
    """
    Run the v4 multi-agent reasoning stages 1-13 and stop at the Review-gated
    approval screen.

    The 12 agents (Product Thinking → Intent → Requirement → Market →
    Competitor → Innovation → Evolution → Gap → Capability → GitHub →
    Repository → Strategy → Review) communicate exclusively through the Product
    Knowledge Graph. The Review Agent validates the whole graph before the user
    decides; nothing is built until /pi/approve is called.
    """
    if not request.idea or not request.idea.strip():
        raise HTTPException(status_code=400, detail="A product idea is required")

    try:
        orchestrator = PiOrchestrator()
        result = await orchestrator.strategize(
            idea=request.idea.strip(),
            github_token=request.github_token or os.environ.get("GITHUB_TOKEN"),
            tavily_key=request.tavily_key or os.environ.get("TAVILY_API_KEY"),
        )
        return {"success": True, **result}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PI strategize failed: {e}")


@app.post("/pi/approve")
async def pi_approve_endpoint(request: PiApproveRequest):
    """
    Approve a strategy, refresh live multi-source evidence, build the product,
    and return success only when the generated workspace passes verification.

    The reasoning orchestrator still owns architecture/composition/engineering.
    This endpoint adds the missing last mile: live-source evidence is attached
    to deep research, execution-plan milestones are implemented on disk, and a
    deterministic verification report gates the final status.
    """
    try:
        provider = get_provider()
        orchestrator = PiOrchestrator(provider)
        result = await orchestrator.approve(run_id=request.run_id, strategy_id=request.strategy_id)
        if not result.get("success", True):
            raise HTTPException(status_code=404, detail=result.get("error", "PI approval failed"))

        graph_payload = result.get("graph") if isinstance(result.get("graph"), dict) else {}

        try:
            live_sources = await research_live_sources(graph_payload.get("intent", {}))
        except Exception as live_exc:
            live_sources = {
                "signals": [],
                "summary": {"signal_count": 0, "sources_with_results": 0, "source_counts": {}},
                "note": f"Live source research degraded gracefully: {live_exc}",
            }

        stored_graph = ProductKnowledgeGraph.load(pi_run_path(request.run_id))
        if stored_graph is not None:
            stored_graph.set("live_sources", live_sources)
            deep_research = stored_graph.get("deep_research", {})
            if not isinstance(deep_research, dict):
                deep_research = {}
            combined_research = dict(deep_research)
            combined_research["live_source_signals"] = live_sources.get("signals", [])
            combined_research["live_source_summary"] = live_sources.get("summary", {})
            stored_graph.set("deep_research", combined_research)
            stored_graph.add_trace(
                "live_sources",
                "combined GitHub decisions with live non-GitHub evidence",
                f"{live_sources.get('summary', {}).get('signal_count', 0)} signals across "
                f"{live_sources.get('summary', {}).get('sources_with_results', 0)} sources",
            )
            stored_graph.save(pi_run_path(request.run_id))
            graph_payload = stored_graph.to_dict()

        try:
            build = await build_approved_product(
                request.run_id,
                graph_payload,
                provider,
                live_sources=live_sources,
            )
        except Exception as build_exc:
            build = {
                "workspace_id": "",
                "output_path": "",
                "package_path": "",
                "status": "failed",
                "verified": False,
                "error": str(build_exc),
                "verification": {"verified": False, "checks": [], "failed_checks": ["build-runner"]},
            }

        final_status = "complete" if build.get("verified") else "build_failed"
        stored_graph = ProductKnowledgeGraph.load(pi_run_path(request.run_id))
        if stored_graph is not None:
            stored_graph.set("build", build)
            stored_graph.set("_status", final_status)
            stored_graph.add_trace(
                "build",
                "autonomous implementation and verification",
                f"{build.get('status')} · {build.get('verification', {}).get('file_count', 0)} files",
                {"verified": bool(build.get("verified")), "workspace_id": build.get("workspace_id", "")},
            )
            stored_graph.save(pi_run_path(request.run_id))
            graph_payload = stored_graph.to_dict()

        return {
            **result,
            "success": bool(build.get("verified")),
            "status": final_status,
            "graph": graph_payload,
            "live_sources": live_sources,
            "build": build,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PI approve failed: {e}")


@app.post("/pi/explain")
async def pi_explain_endpoint(request: PiExplainRequest):
    """
    Explain *why* a recommendation was made, from the stored evidence.

    v5 Evidence Graph: the graph keeps every decision, the debate it came from,
    the confidence of each node and the self-critique. This endpoint renders
    that traceability as plain English — no new LLM call.
    """
    graph = ProductKnowledgeGraph.load(pi_run_path(request.run_id))
    if graph is None:
        raise HTTPException(status_code=404, detail=f"run_id {request.run_id} not found")

    explanation = graph.explain()
    decisions = graph.get("decisions", [])
    debates = graph.get("debates", [])
    evidence = graph.get("evidence", [])
    confidences = graph.get("confidences", {})
    critique = graph.get("self_critique", {})
    dna = graph.get("product_dna", {})

    return {
        "success": True,
        "run_id": request.run_id,
        "explanation": explanation,
        "decisions": decisions,
        "debates": debates,
        "evidence": evidence,
        "confidences": confidences,
        "self_critique": critique,
        "product_dna": dna,
    }


@app.get("/pi/learning")
async def pi_learning_endpoint():
    """
    v6 · Experience-Based Learning — return everything the system has learned
    across past approved products.

    Surfaces repository success statistics, capability → repository rankings,
    architecture pattern success rates and confidence calibration. This is the
    evidence the orchestrator now uses to bias discovery, debate and strategy
    generation. No LLM call.
    """
    try:
        from intelligence.experience_engine import ExperienceEngine
        evidence = ExperienceEngine().evidence_report()
        return {"success": True, "learning": evidence}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PI learning failed: {e}")


@app.get("/pi/memory")
async def pi_memory_endpoint():
    """
    v6 Phase 6 · Product Memory — return the store of complete past products.

    Each memory is a full record (Product DNA, intent, capabilities,
    repositories, architecture, strategy, debates, confidences, simulation,
    self-critique, learning evidence used). No LLM call.
    """
    try:
        from intelligence.learning_store import get_learning_store
        store = get_learning_store()
        mems = store.product_memories(limit=50)
        return {
            "success": True,
            "count": len(mems),
            "total": store.product_memory_count(),
            "memories": mems,
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PI memory failed: {e}")


@app.post("/pi/memory/search")
async def pi_memory_search_endpoint(request: PiMemorySearchRequest):
    """
    v6 Phase 6 · Product Memory retrieval — find similar past products.

    Drafts a Product DNA from the idea (deterministic, no LLM) and returns the
    most similar stored products as structured guidance: similarity score,
    matching capabilities, shared repositories, shared architecture patterns,
    differences, historical outcome and confidence achieved.
    """
    if not request.idea or not request.idea.strip():
        raise HTTPException(status_code=400, detail="A product idea is required")
    try:
        from intelligence.product_memory import ProductMemory
        retrieval = ProductMemory().search(idea=request.idea.strip())
        return {"success": True, **retrieval}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PI memory search failed: {e}")


@app.get("/pi/tournament")
async def pi_tournament_endpoint(run_id: str):
    """
    v6 Phase 4 · Strategy Tournament — return the full tournament for a run.

    Mirrors /pi/explain: reloads the persisted Product Knowledge Graph for
    ``run_id`` and returns the tournament block — winner, ranking, per-strategy
    dimension scores, pairwise comparisons and the decision report. No LLM call.
    """
    try:
        graph = ProductKnowledgeGraph.load(pi_run_path(run_id))
        if graph is None:
            raise HTTPException(status_code=404, detail=f"run_id {run_id} not found")
        return {"success": True, "run_id": run_id, "tournament": graph.get("tournament", {})}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PI tournament failed: {e}")


# ═══════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PYTHON_BACKEND_PORT", "8001"))
    print(f"[AI Product Builder] Starting on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
