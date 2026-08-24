"""Deterministic local provider used for development, CI and remote fallback."""

from __future__ import annotations

import json

from llm.base import LLMProvider, deterministic_embedding


class LocalProvider(LLMProvider):
    """Local/mock provider that keeps the complete Product Factory testable offline."""

    async def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.5,
        max_tokens: int = 1000,
        enable_thinking: bool | None = None,
    ) -> str:
        system = next((m["content"] for m in messages if m.get("role") == "system"), "")
        user = next((m["content"] for m in messages if m.get("role") == "user"), "")
        lowered = system.lower()

        # Autonomous build contract used by ExecutionAgent. Keeping this
        # deterministic means the full approve -> build -> verify path remains
        # runnable in CI and when users deliberately select the local mock.
        if "autonomous senior engineer" in lowered and '"files"' in lowered:
            if "create runnable project foundation" in lowered:
                return json.dumps({
                    "files": [
                        {
                            "path": "main.py",
                            "content": (
                                '"""Generated Product Factory starter."""\n\n'
                                'from typing import Any\n\n'
                                'def run(input_data: dict[str, Any] | None = None) -> dict[str, Any]:\n'
                                '    return {"status": "ok", "input": input_data or {}}\n\n'
                                'if __name__ == "__main__":\n'
                                '    import json\n'
                                '    print(json.dumps(run()))\n'
                            ),
                        },
                        {"path": "requirements.txt", "content": ""},
                        {
                            "path": "tests/test_smoke.py",
                            "content": (
                                "from main import run\n\n"
                                "def test_generated_product_smoke():\n"
                                "    assert run({\"hello\": \"world\"})[\"status\"] == \"ok\"\n"
                            ),
                        },
                    ],
                    "summary": "Created deterministic runnable foundation and smoke test",
                })
            return json.dumps({
                "files": [
                    {
                        "path": "src/milestones.py",
                        "content": (
                            '"""Deterministic milestone implementation used by local/CI mode."""\n\n'
                            'def implemented() -> bool:\n'
                            '    return True\n'
                        ),
                    }
                ],
                "summary": "Implemented milestone in deterministic local mode",
            })

        if "probability scoring" in lowered or "feasibility" in lowered:
            return json.dumps({
                "feasibility": 0.72,
                "novelty": 0.65,
                "demand": 0.78,
                "directives": ["Focus on API-first architecture", "Prefer repos with MIT license"],
                "rationale": "The idea has strong market demand with existing open-source components available for integration. Technical feasibility is good but requires careful architecture design.",
            })

        if "expand" in lowered and "product strategist" not in lowered:
            return json.dumps({
                "market": "Growing market for AI-powered developer tools and automation platforms",
                "target_users": ["Software developers", "DevOps engineers", "Tech startups", "Enterprise IT teams"],
                "features": ["AI-powered code generation", "Real-time collaboration", "GitHub integration", "Automated testing", "Custom workflow builder"],
                "usp": "First platform to combine AI code generation with automated repo composition",
                "risks": ["Market competition from established players", "Technical complexity of multi-repo integration", "User adoption challenges"],
                "suggested_stack": ["Python", "FastAPI", "React", "PostgreSQL", "Redis"],
            })

        if "planner" in lowered or "dag" in lowered:
            return json.dumps({
                "tasks": [
                    {"id": "arch", "name": "Design System Architecture", "depends_on": [], "agent": "system_designer", "inputs": {}, "priority": 10},
                    {"id": "compose", "name": "Compose Repos", "depends_on": ["arch"], "agent": "repo_composer", "inputs": {}, "priority": 8},
                    {"id": "gen1", "name": "Generate Core Module", "depends_on": ["compose"], "agent": "code_generator", "inputs": {}, "priority": 7},
                    {"id": "gen2", "name": "Generate API Layer", "depends_on": ["compose"], "agent": "code_generator", "inputs": {}, "priority": 6},
                    {"id": "test", "name": "Run Tests", "depends_on": ["gen1", "gen2"], "agent": "test_agent", "inputs": {}, "priority": 5},
                ]
            })

        if "architect" in lowered or "architecture" in lowered:
            return json.dumps({
                "components": [
                    {"name": "Core Engine", "role": "Main processing pipeline", "tech": "Python", "interface": "api"},
                    {"name": "API Gateway", "role": "Request routing and auth", "tech": "FastAPI", "interface": "rest"},
                    {"name": "Data Layer", "role": "Persistence and caching", "tech": "PostgreSQL", "interface": "lib"},
                    {"name": "AI Service", "role": "LLM integration and orchestration", "tech": "Python", "interface": "api"},
                    {"name": "Frontend Dashboard", "role": "User interface", "tech": "React", "interface": "ui"},
                ],
                "data_flows": [
                    {"from": "API Gateway", "to": "Core Engine", "data": "User requests and pipeline triggers"},
                    {"from": "Core Engine", "to": "AI Service", "data": "LLM prompts and context"},
                    {"from": "Core Engine", "to": "Data Layer", "data": "State persistence and retrieval"},
                    {"from": "Frontend Dashboard", "to": "API Gateway", "data": "User interactions"},
                ],
                "tech_stack": ["Python", "FastAPI", "React", "PostgreSQL", "Redis", "Docker"],
                "deployment": "docker-compose",
                "diagram_description": "Five-tier architecture: Frontend → API Gateway → Core Engine → AI Service + Data Layer, with Redis caching layer between Core and Data",
            })

        if "repo selection" in lowered or "rank" in lowered:
            return json.dumps({
                "rankings": [
                    {"full_name": "langchain-ai/langchain", "score": 0.92, "reason": "Core AI orchestration framework"},
                    {"full_name": "chroma-core/chroma", "score": 0.85, "reason": "Vector database for semantic search"},
                    {"full_name": "openai/openai-python", "score": 0.80, "reason": "LLM API integration"},
                    {"full_name": "fastapi/fastapi", "score": 0.78, "reason": "High-performance API framework"},
                    {"full_name": "prisma/prisma", "score": 0.70, "reason": "Database ORM and migrations"},
                ]
            })

        if "integration" in lowered or "compose" in lowered:
            return json.dumps({
                "steps": [
                    {"order": 1, "action": "Initialize project structure", "file": "pyproject.toml", "detail": "Create Python project with dependencies"},
                    {"order": 2, "action": "Set up FastAPI application", "file": "app/main.py", "detail": "Create API routes and middleware"},
                    {"order": 3, "action": "Configure database", "file": "app/database.py", "detail": "Set up PostgreSQL connection and models"},
                    {"order": 4, "action": "Implement AI service", "file": "app/ai_service.py", "detail": "LLM integration layer"},
                    {"order": 5, "action": "Create Docker configuration", "file": "docker-compose.yml", "detail": "Multi-container setup"},
                ],
                "repo_roles": {},
                "glue_code_needed": ["API adapter for repo integration", "Custom middleware for auth"],
                "config_files": ["pyproject.toml", "docker-compose.yml", ".env.example", "alembic.ini"],
            })

        if "code generator" in lowered or "generate" in lowered:
            return json.dumps({
                "filename": "core_engine.py",
                "language": "python",
                "code": '"""Core Engine — Main processing pipeline"""\n\nfrom typing import Any, Optional\n\n\nclass CoreEngine:\n    """Main processing engine for the AI product factory."""\n\n    def __init__(self, config: Optional[dict] = None):\n        self.config = config or {}\n        self.pipeline_steps = []\n        self.is_running = False\n\n    async def run_pipeline(self, input_data: dict[str, Any]) -> dict[str, Any]:\n        self.is_running = True\n        results = {"status": "success", "steps_completed": 0}\n        for step in self.pipeline_steps:\n            try:\n                await step.execute(input_data)\n                results["steps_completed"] += 1\n            except Exception as exc:\n                results["error"] = str(exc)\n                break\n        self.is_running = False\n        return results\n\n    def add_step(self, step: Any) -> None:\n        self.pipeline_steps.append(step)\n',
                "description": "Core engine module with async pipeline execution",
            })

        if (
            "product" in lowered
            or "idea" in lowered
            or "combine" in lowered
            or "create" in user.lower()
            or "design a product" in lowered
        ):
            caps_found = [
                cap for cap in ["memory", "agent", "rag", "ui", "backend", "automation"]
                if cap in user.lower() or cap in lowered
            ]
            if not caps_found:
                caps_found = ["backend", "agent"]
            return json.dumps({
                "name": f"AI-{''.join(c.title() for c in caps_found[:2])} Platform",
                "description": f"An innovative platform combining {caps_found[0]} and {caps_found[-1]} capabilities to create a powerful AI-powered solution for developers and teams",
                "system_flow": f"User Input → {caps_found[0].title()} Service → AI Processing → {caps_found[-1].title()} Engine → Output → Feedback Loop",
                "capabilities": caps_found,
                "target_users": ["Software developers", "DevOps engineers", "AI researchers"],
                "key_features": [f"Advanced {caps_found[0]} processing", f"Smart {caps_found[-1]} automation", "Real-time collaboration", "API-first design", "Custom workflow builder"],
                "repos_used": [],
                "gap_filled": caps_found[0] if "gap" in lowered else "",
                "trend_alignment": f"Aligned with {caps_found[0]} + {caps_found[-1]} trend",
                "composition_pattern": "pipeline_composition",
                "gaps_filled": caps_found,
            })

        return json.dumps({"result": "mock response", "name": "Default Product", "description": "A default product idea"})

    async def get_embedding(self, text: str) -> list[float]:
        return deterministic_embedding(text)
