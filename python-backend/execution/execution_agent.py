"""
Execution Agent — Autonomous implementation of the plan.
"""

from __future__ import annotations

import os
from typing import Any, Optional

from llm.provider import LLMProvider, get_provider
from execution.simulator import get_simulator


class ExecutionAgent:
    def __init__(self, workspace_id: str, provider: Optional[LLMProvider] = None):
        self.workspace_id = workspace_id
        self.provider = provider or get_provider()
        self.simulator = get_simulator(workspace_id)
        self.logs = []

    def _log(self, message: str):
        self.logs.append(message)
        print(f"[Execution] {message}")

    @staticmethod
    def _safe_relative_path(path: str) -> str:
        normalized = os.path.normpath(str(path or "").replace("\\", "/")).replace("\\", "/")
        if not normalized or normalized in {".", ".."}:
            raise ValueError("generated file path is empty")
        if normalized.startswith("../") or normalized.startswith("/") or ":" in normalized.split("/")[0]:
            raise ValueError(f"generated file path escapes workspace: {path}")
        return normalized

    async def execute_task(self, task: dict[str, Any]):
        """Execute a single implementation task and persist every returned file."""
        title = task.get("title") or task.get("name") or "Implementation Task"
        description = task.get("description") or task.get("summary") or task.get("detail") or "Implement the selected pipeline task."
        self._log(f"Starting task: {title}")

        messages = [
            {
                "role": "system",
                "content": f"""You are the Product Factory Autonomous Senior Engineer.
Your task is to implement: {title}
Description: {description}

You are modifying one coherent repository. Generate production-oriented source and configuration files, not a prose blueprint.
Rules:
- Return only files that belong in the repository, using relative paths.
- Never put YAML, JSON, Markdown, or shell content into a .py/.ts/.js source file.
- Create/update dependency manifests when code introduces dependencies.
- Prefer a minimal runnable vertical slice over placeholders or TODO-only files.
- Include tests or health/smoke checks when the task adds runtime behavior.
- Do not emit secrets; use environment-variable placeholders.
- Keep existing architectural choices in the supplied repository context consistent.

Return ONLY valid JSON:
{{
  "files": [
    {{"path": "...", "content": "..."}}
  ],
  "summary": "..."
}}""",
            }
        ]

        raw = await self.provider.chat(messages, temperature=0.1)
        data = self.provider.parse_json(raw)
        if not isinstance(data, dict):
            raise ValueError("execution model did not return a JSON object")

        files = data.get("files", [])
        if not isinstance(files, list):
            raise ValueError("execution model returned invalid files payload")

        persisted = []
        for file in files:
            if not isinstance(file, dict):
                continue
            path = self._safe_relative_path(str(file.get("path") or ""))
            content = file.get("content", "")
            if not isinstance(content, str):
                content = str(content)
            self.simulator.write_file(path, content)
            persisted.append({"path": path, "content": content})
            self._log(f"Wrote file: {path}")

        if not persisted:
            raise ValueError(f"execution task produced no files: {title}")

        data["files"] = persisted
        self._log(f"Task completed: {data.get('summary')}")
        return data

    def get_logs(self) -> list[str]:
        return self.logs


_agents = {}


def get_execution_agent(workspace_id: str, provider: Optional[LLMProvider] = None) -> ExecutionAgent:
    if workspace_id not in _agents:
        _agents[workspace_id] = ExecutionAgent(workspace_id, provider)
    return _agents[workspace_id]
