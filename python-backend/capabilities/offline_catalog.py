"""Normalized offline capability catalog.

The catalog distills reusable architecture patterns from open-source LLM app
examples into Product Factory primitives. It intentionally does not depend on
an upstream repo at runtime.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Iterable


@dataclass(frozen=True)
class OfflineCapability:
    id: str
    category: str
    pattern: str
    source_examples: tuple[str, ...]
    local_components: tuple[str, ...]
    offline_grade: str
    network_only_parts: tuple[str, ...] = ()
    product_uses: tuple[str, ...] = ()
    keywords: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


OFFLINE_CAPABILITIES: tuple[OfflineCapability, ...] = (
    OfflineCapability(
        "local_llm_reasoning", "model", "Local OpenAI-compatible reasoning/code generation",
        ("starter_ai_agents/ai_reasoning_agent", "advanced_llm_apps/cursor_ai_experiments/local_chatgpt_clone"),
        ("Ollama or LM Studio", "Qwen/Llama/DeepSeek/Gemma family models"),
        "native",
        product_uses=("all local AI products",),
        keywords=("llm", "reasoning", "local model", "offline ai", "code generation"),
    ),
    OfflineCapability(
        "single_agent", "agent", "Single agent with structured tools and outputs",
        ("starter_ai_agents", "ai_agent_framework_crash_course"),
        ("local LLM", "Pydantic schemas", "Python tool registry"),
        "native",
        product_uses=("assistant", "analyst", "planner"),
        keywords=("agent", "assistant", "planner"),
    ),
    OfflineCapability(
        "multi_agent_orchestration", "agent", "Planner/specialist/reviewer multi-agent workflow",
        ("starter_ai_agents/mixture_of_agents", "advanced_ai_agents/multi_agent_apps/agent_teams"),
        ("local LLM", "deterministic router", "SQLite checkpoints"),
        "native",
        product_uses=("research team", "recruitment team", "engineering team"),
        keywords=("multi-agent", "team", "orchestration", "specialist", "reviewer"),
    ),
    OfflineCapability(
        "trust_gated_agents", "agent", "Approval gates, audit evidence, bounded tool execution",
        ("advanced_ai_agents/multi_agent_apps/trust_gated_agent_team", "advanced_ai_agents/single_agent_apps/ai_agent_governance"),
        ("Product Factory approval contracts", "hash/evidence store", "sandbox"),
        "native",
        product_uses=("enterprise agents", "regulated workflows", "automation"),
        keywords=("approval", "audit", "governance", "trust", "evidence"),
    ),
    OfflineCapability(
        "critique_improvement_loop", "agent", "Generate, critique, repair, verify loop",
        ("advanced_llm_apps/gpt_oss_critique_improvement_loop", "agent_skills/self-improving-agent-skills"),
        ("local LLM", "acceptance tests", "bounded repair budget"),
        "native",
        product_uses=("code generation", "document generation", "agent optimization"),
        keywords=("critique", "repair", "self improve", "verify"),
    ),
    OfflineCapability(
        "rag_basic", "rag", "Local document retrieval augmented generation",
        ("rag_tutorials/local_rag_agent", "rag_tutorials/llama3.1_local_rag", "rag_tutorials/qwen_local_rag"),
        ("local embeddings", "FAISS/Chroma/Qdrant-local", "local LLM"),
        "native",
        product_uses=("knowledge assistant", "document copilot", "support bot"),
        keywords=("rag", "document", "knowledge", "pdf", "search"),
    ),
    OfflineCapability(
        "rag_hybrid", "rag", "Dense + lexical hybrid retrieval with reranking",
        ("rag_tutorials/local_hybrid_search_rag", "rag_tutorials/hybrid_search_rag"),
        ("sentence-transformers", "BM25/SQLite FTS5", "local reranker"),
        "native",
        product_uses=("enterprise search", "policy assistant", "technical support"),
        keywords=("hybrid", "search", "rerank", "bm25"),
    ),
    OfflineCapability(
        "rag_agentic", "rag", "Agent chooses retrieval/query strategy and validates evidence",
        ("rag_tutorials/agentic_rag_with_reasoning", "rag_tutorials/autonomous_rag", "rag_tutorials/agentic_typed_rag_pydanticai"),
        ("local LLM", "typed tool calls", "local indexes"),
        "native",
        product_uses=("research workspace", "knowledge explorer"),
        keywords=("agentic rag", "autonomous rag", "evidence"),
    ),
    OfflineCapability(
        "rag_graph", "rag", "Knowledge-graph retrieval with citations",
        ("rag_tutorials/knowledge_graph_rag_citations",),
        ("NetworkX or local graph DB", "local embeddings", "citation store"),
        "native",
        product_uses=("legal knowledge", "SOP intelligence", "dependency reasoning"),
        keywords=("knowledge graph", "graph rag", "citation"),
    ),
    OfflineCapability(
        "rag_multimodal", "rag", "Text/image/document multimodal retrieval",
        ("rag_tutorials/multimodal_agentic_rag", "rag_tutorials/vision_rag"),
        ("local VLM", "local OCR", "image embeddings", "local vector store"),
        "adapted",
        network_only_parts=("cloud VLM APIs in some upstream examples",),
        product_uses=("invoice/document intelligence", "visual knowledge assistant"),
        keywords=("image", "vision", "multimodal", "ocr"),
    ),
    OfflineCapability(
        "persistent_memory", "memory", "Session + long-term semantic memory",
        ("advanced_llm_apps/llm_apps_with_memory_tutorials/local_chatgpt_with_memory", "advanced_llm_apps/llm_apps_with_memory_tutorials/llama3_stateful_chat"),
        ("SQLite", "local vector memory", "graph memory"),
        "native",
        product_uses=("personalized assistants", "CRM copilot", "tutor"),
        keywords=("memory", "personalized", "history", "session"),
    ),
    OfflineCapability(
        "data_analysis", "analytics", "Natural-language analysis of local CSV/Excel",
        ("starter_ai_agents/ai_data_analysis_agent", "starter_ai_agents/ai_data_visualisation_agent"),
        ("pandas/polars", "DuckDB", "local LLM", "local chart renderer"),
        "native",
        product_uses=("sales analyst", "finance analyst", "student analytics"),
        keywords=("excel", "csv", "analysis", "analytics", "chart", "data"),
    ),
    OfflineCapability(
        "resume_job_matching", "document_ai", "Resume parsing, matching and explainable scoring",
        ("advanced_llm_apps/resume_job_matcher", "advanced_ai_agents/multi_agent_apps/agent_teams/ai_recruitment_agent_team"),
        ("local parser", "local embeddings", "deterministic score rules"),
        "native",
        product_uses=("recruitment copilot", "career coach"),
        keywords=("resume", "recruitment", "candidate", "job", "interview"),
    ),
    OfflineCapability(
        "codebase_intelligence", "developer", "Repository/code understanding and migration planning",
        ("advanced_ai_agents/multi_agent_apps/ai_codebase_migration_agent", "agent_skills/commit-archaeologist", "agent_skills/scope-creep-detector"),
        ("tree-sitter", "local embeddings", "git CLI", "local LLM"),
        "native",
        product_uses=("AI Code Engineer", "migration copilot", "review agent"),
        keywords=("code", "repo", "github", "migration", "developer", "diff"),
    ),
    OfflineCapability(
        "dependency_quality", "developer", "Dependency and project health diagnostics",
        ("agent_skills/dependency-doctor", "rag_tutorials/rag_failure_diagnostics_clinic"),
        ("manifest parsers", "local advisory snapshot", "test/eval runner"),
        "adapted",
        network_only_parts=("fresh registry/security advisories require online updates",),
        product_uses=("code quality gate", "RAG diagnostics"),
        keywords=("dependency", "diagnostic", "quality", "security"),
    ),
    OfflineCapability(
        "generative_ui", "ui", "Agent emits typed interactive UI artifacts",
        ("generative_ui_agents/generative-ui-starter-project", "generative_ui_agents/ai-shadcn-component-generator"),
        ("Next.js", "React", "shadcn/ui", "local JSON schema"),
        "native",
        product_uses=("AI app builder", "workflow designer", "admin tools"),
        keywords=("ui", "component", "form", "kanban", "shadcn"),
    ),
    OfflineCapability(
        "dashboard_canvas", "ui", "Chat-to-dashboard component composition",
        ("generative_ui_agents/ai-dashboard-canvas-agent",),
        ("React", "local charting", "DuckDB/SQLite"),
        "native",
        product_uses=("BI copilot", "operations dashboard", "analytics product"),
        keywords=("dashboard", "canvas", "chart", "kpi"),
    ),
    OfflineCapability(
        "mcp_local_router", "tools", "Multi-tool/MCP routing restricted to local servers",
        ("mcp_ai_agents/multi_mcp_agent_router", "generative_ui_agents/ai-mcp-app-builder"),
        ("MCP SDK", "stdio/localhost MCP servers", "allowlist policy"),
        "adapted",
        network_only_parts=("remote SaaS MCP servers",),
        product_uses=("tool-using agent", "local app automation"),
        keywords=("mcp", "tools", "connector", "integration"),
    ),
    OfflineCapability(
        "browser_local_automation", "automation", "Browser agent for local/intranet apps",
        ("mcp_ai_agents/browser_mcp_agent", "advanced_ai_agents/single_agent_apps/windows_use_autonomous_agent"),
        ("Playwright", "localhost/intranet target allowlist", "approval gates"),
        "adapted",
        network_only_parts=("public web navigation when air-gapped",),
        product_uses=("RPA", "QA automation", "local admin automation"),
        keywords=("browser", "automation", "rpa", "playwright"),
    ),
    OfflineCapability(
        "always_on_scheduler", "automation", "Scheduled/event-driven local agents",
        ("always_on_agents/always_on_hn_briefing_agent", "always_on_agents/release_radar_agent"),
        ("APScheduler/Cron", "SQLite queue", "local folders/events"),
        "adapted",
        network_only_parts=("fresh internet feeds/releases",),
        product_uses=("folder watcher", "local digest", "operations monitor"),
        keywords=("schedule", "monitor", "watch", "always on", "cron"),
    ),
    OfflineCapability(
        "voice_pipeline", "voice", "Speech in -> agent/RAG -> speech out",
        ("voice_ai_agents/customer_support_voice_agent", "voice_ai_agents/voice_rag_openaisdk"),
        ("Whisper/whisper.cpp", "local LLM", "Piper/Kokoro TTS"),
        "adapted",
        network_only_parts=("real-time cloud voice APIs in upstream examples",),
        product_uses=("voice support", "voice RAG", "receptionist"),
        keywords=("voice", "speech", "audio", "call"),
    ),
    OfflineCapability(
        "vision_pipeline", "vision", "Local image/video understanding pipeline",
        ("starter_ai_agents/multimodal_ai_agent", "advanced_llm_apps/multimodal_video_moment_finder"),
        ("local VLM", "OpenCV", "FFmpeg", "local embeddings"),
        "adapted",
        network_only_parts=("cloud multimodal APIs in some examples",),
        product_uses=("visual inspection", "video intelligence", "document vision"),
        keywords=("vision", "video", "image", "camera"),
    ),
    OfflineCapability(
        "content_media_pipeline", "media", "Research/script/media assembly pipeline",
        ("starter_ai_agents/ai_blog_to_podcast_agent", "advanced_ai_agents/multi_agent_apps/ai_news_and_podcast_agents"),
        ("local LLM", "Whisper", "Piper/Kokoro", "FFmpeg"),
        "adapted",
        network_only_parts=("live news/blog retrieval",),
        product_uses=("podcast factory", "training-content studio", "video workflow"),
        keywords=("podcast", "content", "media", "video", "script"),
    ),
    OfflineCapability(
        "fine_tuning", "model", "Local fine-tuning / adapter training workflow",
        ("advanced_llm_apps/llm_finetuning_tutorials/gemma3_finetuning", "advanced_llm_apps/llm_finetuning_tutorials/llama3.2_finetuning"),
        ("Transformers", "PEFT/LoRA", "local datasets"),
        "native",
        product_uses=("domain model customization",),
        keywords=("fine tune", "finetune", "lora", "training"),
    ),
    OfflineCapability(
        "context_optimization", "model", "Prompt/context compression and budget optimization",
        ("advanced_llm_apps/llm_optimization_tools/headroom_context_optimization", "advanced_llm_apps/llm_optimization_tools/toonify_token_optimization"),
        ("local token counter", "context budgeter", "cache"),
        "native",
        product_uses=("all agentic products",),
        keywords=("context", "token", "optimize", "cost"),
    ),
)


_BY_ID = {item.id: item for item in OFFLINE_CAPABILITIES}


def capability_by_id(capability_id: str) -> OfflineCapability | None:
    return _BY_ID.get(capability_id)


def list_offline_capabilities() -> list[dict[str, object]]:
    return [item.to_dict() for item in OFFLINE_CAPABILITIES]


def resolve_capabilities(text: str, *, limit: int = 12) -> list[dict[str, object]]:
    lowered = (text or "").lower()
    scored: list[tuple[int, OfflineCapability]] = []
    for item in OFFLINE_CAPABILITIES:
        score = sum(2 if " " in keyword else 1 for keyword in item.keywords if keyword in lowered)
        if score:
            scored.append((score, item))
    scored.sort(key=lambda pair: (-pair[0], pair[1].id))
    if not scored:
        defaults = ("local_llm_reasoning", "single_agent", "trust_gated_agents", "generative_ui")
        return [_BY_ID[item].to_dict() for item in defaults]
    return [item.to_dict() for _, item in scored[:limit]]


def local_stacks(capability_ids: Iterable[str]) -> list[str]:
    output: list[str] = []
    for capability_id in capability_ids:
        item = _BY_ID.get(capability_id)
        if not item:
            continue
        for component in item.local_components:
            if component not in output:
                output.append(component)
    return output
