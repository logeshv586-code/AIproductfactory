"""
AI OS — Controller
Graph + state engine · orchestrates all layers
"""
from __future__ import annotations
import json
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Any
from anthropic import Anthropic

from rag_memory import RAGMemory
from mcp_registry import (MCPRegistry, make_github_search_tool,
                           make_web_search_tool, make_rag_query_tool,
                           make_repo_clone_tool)
from probability_engine import ProbabilityEngine
from idea_expander import IdeaExpander
from signal_collector import SignalCollector
from repo_executor import RepoExecutor
from agents import PlannerAgent, SystemDesignerAgent, RepoComposerAgent, CodeGeneratorAgent
from test_fix_agents import TestAgent, FixAgent


# ── State ─────────────────────────────────────────────────────────────────────

@dataclass
class FactoryState:
    build_id: str
    idea: str
    status: str = "init"
    prob_score: Any = None
    expanded_idea: Any = None
    signals: Any = None
    repo_profiles: list = field(default_factory=list)
    dag: Any = None
    architecture: Any = None
    integration_plan: Any = None
    generated_components: list = field(default_factory=list)
    test_result: Any = None
    fix_result: Any = None
    output_path: str = ""
    errors: list[str] = field(default_factory=list)
    timeline: list[dict] = field(default_factory=list)

    def log(self, step: str, detail: str = ""):
        entry = {"step": step, "ts": time.time(), "detail": detail}
        self.timeline.append(entry)
        print(f"[Controller] ▶ {step}" + (f" — {detail}" if detail else ""))


# ── Controller ────────────────────────────────────────────────────────────────

class AIProductFactory:
    """
    Top-level controller.  Implements the full pipeline from the architecture diagram:

        User idea
          ↓
        AI OS Controller  (this class)
          ↓
        Probability Engine
          ↓
        Idea Expansion
          ↓
        [Web signals | GitHub repos | RAG retrieval]
          ↓
        Repo Execution Layer  → MCP Tool Registry ← RAG Memory
          ↓
        Agent Pipeline: Planner → System Designer → Repo Composer → Code Generator
          ↓
        Test Agent ↔ Fix Agent (×3)
          ↓
        Output Scaffold
          ↓──(feedback loop)──→ Probability Engine
    """

    def __init__(self, anthropic_api_key: str | None = None,
                 github_token: str | None = None,
                 output_dir: str = "/tmp/ai_product_factory_output",
                 memory_path: str = ".rag_memory.json"):

        api_key = anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("Set ANTHROPIC_API_KEY env var or pass anthropic_api_key=")

        self._client = Anthropic(api_key=api_key)
        self._output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

        # ── Infrastructure ────────────────────────────────────────────────────
        self.memory = RAGMemory(memory_path)
        self.registry = MCPRegistry()

        # Register built-in MCP tools
        self.registry.register(make_github_search_tool(github_token))
        self.registry.register(make_web_search_tool())
        self.registry.register(make_rag_query_tool(self.memory))
        self.registry.register(make_repo_clone_tool(os.path.join(output_dir, "sandbox")))

        # ── Layer instances ───────────────────────────────────────────────────
        self.prob_engine = ProbabilityEngine(self._client, self.memory)
        self.idea_expander = IdeaExpander(self._client)
        self.signal_collector = SignalCollector(self.registry, self._client, self.memory)
        self.repo_executor = RepoExecutor(self.registry, self._client,
                                          sandbox_dir=os.path.join(output_dir, "sandbox"))
        self.planner = PlannerAgent(self._client)
        self.system_designer = SystemDesignerAgent(self._client)
        self.repo_composer = RepoComposerAgent(self._client)
        self.code_generator = CodeGeneratorAgent(self._client)
        self.test_agent = TestAgent(self._client, output_dir=output_dir)
        self.fix_agent = FixAgent(self._client, self.test_agent)

    # ── Main entry point ──────────────────────────────────────────────────────

    def build(self, idea: str, max_repos: int = 3) -> FactoryState:
        state = FactoryState(build_id=str(uuid.uuid4())[:8], idea=idea)
        state.log("START", idea[:80])

        try:
            # 1. Probability scoring
            state.status = "scoring"
            state.log("ProbabilityEngine")
            rag_ctx = self.memory.recall_context(idea, top_k=3)
            ctx_str = json.dumps(rag_ctx) if rag_ctx else ""
            state.prob_score = self.prob_engine.score(idea, context=ctx_str)
            self.memory.store("prob_weight", f"score:{state.build_id}",
                              {"composite": state.prob_score.composite,
                               "idea": idea[:100]})

            # 2. Idea expansion
            state.status = "expanding"
            state.log("IdeaExpander")
            state.expanded_idea = self.idea_expander.expand(idea, state.prob_score)
            self.memory.store_idea(state.build_id, {
                "idea": idea, "expanded": state.expanded_idea.raw,
                "prob": state.prob_score.composite,
            })

            # 3. Signal collection (all 3 channels in sequence; parallelise with threads if needed)
            state.status = "collecting_signals"
            state.log("SignalCollector", "web + github + RAG")
            state.signals = self.signal_collector.collect_all(idea, state.expanded_idea)

            # 4. Repo execution layer — process top repos
            state.status = "executing_repos"
            state.log("RepoExecutor")
            top_repos = state.signals.repo_candidates[:max_repos]
            for repo in top_repos:
                try:
                    profile = self.repo_executor.process_repo(repo.clone_url, repo.full_name)
                    if profile:
                        state.repo_profiles.append(profile)
                        self.memory.store_repo(repo.full_name, {
                            "summary": profile.summary,
                            "language": profile.language,
                            "api": profile.public_api,
                        })
                except Exception as e:
                    state.errors.append(f"repo {repo.full_name}: {e}")
                    print(f"[Controller] repo error: {e}")

            # 5. Planner — build DAG
            state.status = "planning"
            state.log("PlannerAgent (DeerFlow)")
            state.dag = self.planner.build_dag(state.expanded_idea, state.prob_score)

            # 6. System designer
            state.status = "designing"
            state.log("SystemDesignerAgent")
            state.architecture = self.system_designer.design(
                state.expanded_idea, state.repo_profiles, state.signals.rag_context
            )

            # 7. Repo composer
            state.status = "composing"
            state.log("RepoComposerAgent")
            state.integration_plan = self.repo_composer.compose(
                state.architecture, state.repo_profiles
            )

            # 8. Code generator
            state.status = "generating"
            state.log("CodeGeneratorAgent")
            state.generated_components = self.code_generator.generate_all(
                state.architecture, state.integration_plan, state.expanded_idea
            )

            # 9. Test agent
            state.status = "testing"
            state.log("TestAgent", "Playwright + unit tests")
            state.test_result = self.test_agent.run(state.generated_components)

            # 10. Fix agent (up to ×3)
            if not state.test_result.passed:
                state.status = "fixing"
                state.log("FixAgent", "auto-debug loop ×3")
                state.fix_result = self.fix_agent.fix_loop(
                    state.generated_components, state.test_result
                )
                state.generated_components = state.fix_result.fixed_components

            # 11. Output scaffold
            state.status = "scaffolding"
            state.log("OutputScaffold")
            state.output_path = self._write_scaffold(state)

            # 12. Feedback loop → Probability Engine
            state.status = "feedback"
            state.log("FeedbackLoop → ProbabilityEngine")
            success = state.fix_result.success if state.fix_result else state.test_result.passed
            feedback = {
                "feasibility": 0.9 if success else 0.4,
                "novelty": state.prob_score.novelty,
                "demand": state.prob_score.demand,
            }
            self.prob_engine.update_weights(feedback)

            state.status = "complete"
            state.log("DONE", f"output → {state.output_path}")
            self.memory.store_build(state.build_id, {
                "idea": idea, "status": state.status,
                "output_path": state.output_path,
                "components": [c.filename for c in state.generated_components],
            })

        except Exception as e:
            state.status = "error"
            state.errors.append(str(e))
            print(f"[Controller] FATAL: {e}")
            raise

        return state

    # ── Output scaffold writer ─────────────────────────────────────────────────

    def _write_scaffold(self, state: FactoryState) -> str:
        build_dir = os.path.join(self._output_dir, f"build_{state.build_id}")
        src_dir = os.path.join(build_dir, "src")
        os.makedirs(src_dir, exist_ok=True)

        # Write generated component files
        for comp in state.generated_components:
            fpath = os.path.join(src_dir, comp.filename)
            os.makedirs(os.path.dirname(fpath), exist_ok=True)
            with open(fpath, "w") as f:
                f.write(comp.code)

        # Write architecture doc
        arch = state.architecture
        arch_md = f"""# Architecture — {state.idea[:60]}

## Components
{chr(10).join(f"- **{c['name']}** ({c['tech']}): {c['role']}" for c in arch.components)}

## Data Flows
{chr(10).join(f"- {d['from']} → {d['to']}: {d['data']}" for d in arch.data_flows)}

## Tech Stack
{', '.join(arch.tech_stack)}

## Deployment
{arch.deployment}

## Overview
{arch.diagram_description}
"""
        with open(os.path.join(build_dir, "ARCHITECTURE.md"), "w") as f:
            f.write(arch_md)

        # Write config files list
        config_note = "\n".join(f"- {c}" for c in state.integration_plan.config_files)
        with open(os.path.join(build_dir, "INTEGRATION.md"), "w") as f:
            f.write(f"# Integration Plan\n\n## Config files needed\n{config_note}\n\n"
                    f"## Glue code needed\n"
                    + "\n".join(f"- {g}" for g in state.integration_plan.glue_code_needed))

        # Write pipeline metadata
        meta = {
            "build_id": state.build_id,
            "idea": state.idea,
            "prob_score": {
                "feasibility": state.prob_score.feasibility,
                "novelty": state.prob_score.novelty,
                "demand": state.prob_score.demand,
                "composite": state.prob_score.composite,
            },
            "repos_used": [r.full_name for r in state.repo_profiles],
            "components": [c.filename for c in state.generated_components],
            "test_passed": state.test_result.passed if state.test_result else None,
        }
        with open(os.path.join(build_dir, "pipeline.json"), "w") as f:
            json.dump(meta, f, indent=2)

        print(f"[Controller] scaffold written to {build_dir}")
        return build_dir
