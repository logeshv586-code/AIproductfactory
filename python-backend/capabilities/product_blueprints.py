"""Offline product recipes composed from reusable capability primitives."""

from __future__ import annotations

from dataclasses import asdict, dataclass

from .offline_catalog import capability_by_id, local_stacks


@dataclass(frozen=True)
class ProductBlueprint:
    id: str
    name: str
    description: str
    capabilities: tuple[str, ...]
    keywords: tuple[str, ...]
    outputs: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        data = asdict(self)
        data["local_stack"] = local_stacks(self.capabilities)
        data["offline_ready"] = all(
            (capability_by_id(cid) and capability_by_id(cid).offline_grade in {"native", "adapted"})
            for cid in self.capabilities
        )
        return data


PRODUCT_BLUEPRINTS: tuple[ProductBlueprint, ...] = (
    ProductBlueprint("private_knowledge_assistant", "Private Knowledge Assistant",
        "Air-gapped chat/search over company documents with citations and memory.",
        ("local_llm_reasoning", "rag_hybrid", "rag_graph", "persistent_memory", "generative_ui"),
        ("knowledge", "policy", "documents", "pdf", "assistant"),
        ("chat workspace", "citation viewer", "document ingestion", "admin index controls")),
    ProductBlueprint("offline_research_workspace", "Offline Research Workspace",
        "Research and synthesis over a preloaded local corpus with evidence tracking.",
        ("local_llm_reasoning", "rag_agentic", "rag_graph", "multi_agent_orchestration", "trust_gated_agents"),
        ("research", "corpus", "papers", "evidence"),
        ("research plan", "evidence cards", "report", "source trace")),
    ProductBlueprint("recruitment_copilot", "Recruitment Copilot",
        "Resume screening, matching, interview planning and candidate evidence.",
        ("resume_job_matching", "rag_basic", "multi_agent_orchestration", "persistent_memory", "generative_ui"),
        ("resume", "recruitment", "candidate", "interview", "job"),
        ("candidate ranking", "match explanation", "interview kit", "review queue")),
    ProductBlueprint("local_data_analyst", "Local Data Analyst",
        "Natural-language analytics over CSV, Excel, SQLite and local databases.",
        ("data_analysis", "local_llm_reasoning", "dashboard_canvas", "trust_gated_agents"),
        ("excel", "csv", "analytics", "data", "dashboard"),
        ("query plan", "tables", "charts", "executive summary")),
    ProductBlueprint("codebase_copilot", "Codebase Copilot",
        "Offline repository understanding, change planning, review and verified patch generation.",
        ("codebase_intelligence", "dependency_quality", "multi_agent_orchestration", "critique_improvement_loop", "trust_gated_agents"),
        ("code", "repo", "developer", "migration", "review"),
        ("architecture map", "change plan", "patch", "tests", "verification evidence")),
    ProductBlueprint("customer_support_ai", "Private Customer Support AI",
        "Local support assistant grounded in manuals, SOPs and product documentation.",
        ("rag_hybrid", "persistent_memory", "single_agent", "generative_ui"),
        ("support", "customer", "manual", "faq", "sop"),
        ("support chat", "citations", "case notes", "handoff bundle")),
    ProductBlueprint("voice_support_ai", "Offline Voice Support AI",
        "Local speech-to-speech support grounded in private documents.",
        ("voice_pipeline", "rag_hybrid", "persistent_memory", "trust_gated_agents"),
        ("voice", "speech", "call", "support"),
        ("transcript", "grounded answer", "audio response", "case summary")),
    ProductBlueprint("document_intelligence", "Document Intelligence",
        "OCR, multimodal extraction, validation and evidence-grounded Q&A.",
        ("rag_multimodal", "vision_pipeline", "rag_hybrid", "trust_gated_agents"),
        ("invoice", "document", "ocr", "image", "form"),
        ("structured extraction", "validation", "document viewer", "evidence")),
    ProductBlueprint("dashboard_builder", "AI Dashboard Builder",
        "Chat-driven local dashboard and KPI workspace generation.",
        ("dashboard_canvas", "generative_ui", "data_analysis", "local_llm_reasoning"),
        ("dashboard", "kpi", "chart", "bi"),
        ("dashboard schema", "interactive cards", "charts", "saved views")),
    ProductBlueprint("local_tool_agent", "Local Tool/MCP Agent",
        "Agent that routes actions across allowlisted local MCP/tools.",
        ("mcp_local_router", "single_agent", "trust_gated_agents", "persistent_memory"),
        ("mcp", "tool", "integration", "automation"),
        ("tool registry", "approval queue", "execution log", "result artifacts")),
    ProductBlueprint("education_tutor", "Private AI Tutor",
        "Adaptive local tutor with course knowledge, quizzes and learner memory.",
        ("rag_basic", "persistent_memory", "multi_agent_orchestration", "generative_ui"),
        ("student", "education", "tutor", "quiz", "learning"),
        ("learning path", "lesson workspace", "quiz", "progress memory")),
    ProductBlueprint("local_rpa_agent", "Local RPA Agent",
        "Approval-gated browser/desktop automation for local or intranet applications.",
        ("browser_local_automation", "trust_gated_agents", "always_on_scheduler", "single_agent"),
        ("rpa", "browser", "automation", "desktop", "intranet"),
        ("workflow", "approval", "execution evidence", "retry/checkpoint")),
    ProductBlueprint("visual_inspection_ai", "Visual Inspection AI",
        "Local image/video understanding for inspection and QA workflows.",
        ("vision_pipeline", "rag_multimodal", "trust_gated_agents", "dashboard_canvas"),
        ("camera", "vision", "inspection", "video", "image"),
        ("detections", "evidence frames", "inspection report", "dashboard")),
    ProductBlueprint("content_studio", "Offline Content Studio",
        "Local script, narration and media assembly from user-supplied material.",
        ("content_media_pipeline", "voice_pipeline", "local_llm_reasoning", "critique_improvement_loop"),
        ("content", "podcast", "video", "script", "media"),
        ("script", "voice track", "timeline", "render package")),
    ProductBlueprint("domain_model_lab", "Domain Model Lab",
        "Local dataset preparation, LoRA fine-tuning and evaluation workflow.",
        ("fine_tuning", "context_optimization", "trust_gated_agents"),
        ("fine tune", "lora", "training", "model"),
        ("dataset report", "training config", "adapter", "evaluation report")),
)


_BY_ID = {item.id: item for item in PRODUCT_BLUEPRINTS}


def blueprint_by_id(blueprint_id: str) -> ProductBlueprint | None:
    return _BY_ID.get(blueprint_id)


def match_product_blueprints(text: str, *, limit: int = 6) -> list[dict[str, object]]:
    lowered = (text or "").lower()
    scored: list[tuple[int, ProductBlueprint]] = []
    for item in PRODUCT_BLUEPRINTS:
        score = sum(2 if " " in keyword else 1 for keyword in item.keywords if keyword in lowered)
        if score:
            scored.append((score, item))
    scored.sort(key=lambda pair: (-pair[0], pair[1].name))
    if not scored:
        scored = [(1, _BY_ID["private_knowledge_assistant"]), (1, _BY_ID["codebase_copilot"])]
    return [item.to_dict() for _, item in scored[:limit]]
