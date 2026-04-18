"""
Agent Pipeline
  Planner (DeerFlow)  — Reads probability → builds dynamic DAG
  System Designer     — Architecture from expanded idea
  Repo Composer       — Repos + architecture → integration plan
  Code Generator      — Generates code per component
"""
from __future__ import annotations
import json
from dataclasses import dataclass, field
from anthropic import Anthropic
from mcp_registry import MCPRegistry


# ── Data models ───────────────────────────────────────────────────────────────

@dataclass
class DAGTask:
    id: str
    name: str
    depends_on: list[str]
    agent: str
    inputs: dict
    priority: int = 0


@dataclass
class DAG:
    tasks: list[DAGTask]

    def ordered(self) -> list[DAGTask]:
        """Topological sort."""
        result, visited = [], set()
        task_map = {t.id: t for t in self.tasks}

        def visit(tid):
            if tid in visited:
                return
            visited.add(tid)
            for dep in task_map[tid].depends_on:
                if dep in task_map:
                    visit(dep)
            result.append(task_map[tid])

        for t in self.tasks:
            visit(t.id)
        return result


@dataclass
class SystemArchitecture:
    components: list[dict]
    data_flows: list[dict]
    tech_stack: list[str]
    deployment: str
    diagram_description: str


@dataclass
class IntegrationPlan:
    steps: list[dict]
    repo_roles: dict[str, str]
    glue_code_needed: list[str]
    config_files: list[str]


@dataclass
class GeneratedComponent:
    name: str
    filename: str
    language: str
    code: str
    description: str


# ── Planner ───────────────────────────────────────────────────────────────────

class PlannerAgent:
    """Reads probability directives and expanded idea → builds dynamic DAG."""

    SYSTEM = """You are a DeerFlow-style planner for an AI product factory.
Given an expanded product idea and probability directives, build a task DAG.

Return ONLY valid JSON:
{
  "tasks": [
    {
      "id": "<short_id>",
      "name": "<human name>",
      "depends_on": ["<id>", ...],
      "agent": "system_designer|repo_composer|code_generator|test_agent|fix_agent",
      "inputs": {"key": "value"},
      "priority": <0-10>
    }
  ]
}
Start with a system_designer task with no dependencies.
Then repo_composer (depends on system_designer).
Then code_generator tasks per component (depends on repo_composer).
Then test_agent (depends on all code_generator tasks).
Then fix_agent (depends on test_agent).
Be specific about inputs."""

    def __init__(self, client: Anthropic):
        self._client = client

    def build_dag(self, expanded, prob_score) -> DAG:
        prompt = (
            f"IDEA: {expanded.original}\n"
            f"MARKET: {expanded.market}\n"
            f"FEATURES: {expanded.features}\n"
            f"USP: {expanded.usp}\n"
            f"STACK: {expanded.suggested_stack}\n"
            f"PROB composite={prob_score.composite:.2f}\n"
            f"DIRECTIVES: {prob_score.directives}"
        )
        resp = self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            system=self.SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        tasks = [DAGTask(**t) for t in data["tasks"]]
        dag = DAG(tasks=tasks)
        print(f"[Planner] DAG has {len(tasks)} tasks")
        for t in dag.ordered():
            print(f"  [{t.id}] {t.name} (agent={t.agent}, deps={t.depends_on})")
        return dag


# ── System Designer ───────────────────────────────────────────────────────────

class SystemDesignerAgent:
    """Produces architecture from the expanded idea."""

    SYSTEM = """You are a senior software architect inside an AI product factory.
Given an expanded product idea and relevant repos, design the system architecture.

Return ONLY valid JSON:
{
  "components": [
    {"name": "<name>", "role": "<role>", "tech": "<technology>", "interface": "<api/cli/lib>"}
  ],
  "data_flows": [
    {"from": "<component>", "to": "<component>", "data": "<what flows>"}
  ],
  "tech_stack": ["<tech1>", "<tech2>"],
  "deployment": "<docker-compose | k8s | serverless | ...>",
  "diagram_description": "<text description of the architecture>"
}"""

    def __init__(self, client: Anthropic):
        self._client = client

    def design(self, expanded, repo_profiles: list, rag_context: list) -> SystemArchitecture:
        repos_summary = [{"name": r.full_name, "summary": r.summary,
                          "api": r.public_api[:3]} for r in repo_profiles]
        prompt = (
            f"IDEA: {expanded.original}\n"
            f"FEATURES: {expanded.features}\n"
            f"USP: {expanded.usp}\n"
            f"AVAILABLE REPOS:\n{json.dumps(repos_summary, indent=2)}\n"
            f"RAG CONTEXT (past builds):\n{json.dumps(rag_context[:3], indent=2)}"
        )
        resp = self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            system=self.SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        arch = SystemArchitecture(**data)
        print(f"[SystemDesigner] components: {[c['name'] for c in arch.components]}")
        return arch


# ── Repo Composer ─────────────────────────────────────────────────────────────

class RepoComposerAgent:
    """Repos + architecture → integration plan."""

    SYSTEM = """You are a repo integration specialist.
Given an architecture and available repos, create a detailed integration plan.

Return ONLY valid JSON:
{
  "steps": [
    {"order": 1, "action": "<what to do>", "file": "<target file>", "detail": "<specifics>"}
  ],
  "repo_roles": {"<repo_full_name>": "<role in the product>"},
  "glue_code_needed": ["<description of custom glue code needed>"],
  "config_files": ["docker-compose.yml", "requirements.txt", ".env.example"]
}"""

    def __init__(self, client: Anthropic):
        self._client = client

    def compose(self, architecture: SystemArchitecture, repo_profiles: list) -> IntegrationPlan:
        repos_info = [{"name": r.full_name, "language": r.language,
                       "entry_points": r.entry_points, "api": r.public_api}
                      for r in repo_profiles]
        arch_dict = {"components": architecture.components, "data_flows": architecture.data_flows}
        prompt = (
            f"ARCHITECTURE:\n{json.dumps(arch_dict, indent=2)}\n\n"
            f"REPOS:\n{json.dumps(repos_info, indent=2)}"
        )
        resp = self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            system=self.SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        plan = IntegrationPlan(**data)
        print(f"[RepoComposer] {len(plan.steps)} integration steps, "
              f"{len(plan.glue_code_needed)} glue modules needed")
        return plan


# ── Code Generator ────────────────────────────────────────────────────────────

class CodeGeneratorAgent:
    """Generates code per component based on the integration plan."""

    SYSTEM = """You are an expert software engineer. Generate clean, production-ready code
for a single component of the product.

Return ONLY valid JSON:
{
  "filename": "<path/filename.ext>",
  "language": "<python|typescript|yaml|...>",
  "code": "<the complete file content>",
  "description": "<what this file does>"
}
Include proper imports, type hints, docstrings, and error handling."""

    def __init__(self, client: Anthropic):
        self._client = client

    def generate(self, component: dict, architecture: SystemArchitecture,
                 integration_plan: IntegrationPlan, expanded=None) -> GeneratedComponent:
        prompt = (
            f"COMPONENT TO BUILD:\n{json.dumps(component, indent=2)}\n\n"
            f"FULL ARCHITECTURE:\n{architecture.diagram_description}\n"
            f"TECH STACK: {architecture.tech_stack}\n\n"
            f"INTEGRATION STEPS:\n{json.dumps(integration_plan.steps[:5], indent=2)}\n\n"
            f"GLUE CODE NEEDED: {integration_plan.glue_code_needed}"
        )
        resp = self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            system=self.SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        gen = GeneratedComponent(
            name=component["name"],
            filename=data["filename"],
            language=data["language"],
            code=data["code"],
            description=data["description"],
        )
        print(f"[CodeGenerator] generated {gen.filename} ({len(gen.code)} chars)")
        return gen

    def generate_all(self, architecture: SystemArchitecture, integration_plan: IntegrationPlan,
                     expanded=None) -> list[GeneratedComponent]:
        components = []
        for comp in architecture.components:
            try:
                gen = self.generate(comp, architecture, integration_plan, expanded)
                components.append(gen)
            except Exception as e:
                print(f"[CodeGenerator] error for {comp['name']}: {e}")
        return components
