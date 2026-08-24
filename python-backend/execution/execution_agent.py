"""
Execution Agent — autonomous implementation of an approved build task.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from execution.simulator import get_simulator
from llm.provider import LLMProvider, get_provider


class ExecutionAgent:
    def __init__(self, workspace_id: str, provider: Optional[LLMProvider] = None):
        self.workspace_id = workspace_id
        self.provider = provider or get_provider()
        self.simulator = get_simulator(workspace_id)
        self.logs: list[str] = []

    def _log(self, message: str):
        self.logs.append(message)
        print(f"[Execution] {message}")

    async def execute_task(self, task: dict[str, Any]) -> dict[str, Any]:
        """Execute one implementation task and persist every generated file."""
        title = task.get("title") or task.get("name") or "Implementation Task"
        description = task.get("description") or task.get("summary") or task.get("detail") or "Implement the selected pipeline task."
        context = task.get("context") or {}
        existing_files = task.get("existing_files") or self.simulator.list_files()
        self._log(f"Starting task: {title}")

        messages = [
            {
                "role": "system",
                "content": f"""You are the autonomous Senior Engineer inside AI Product Factory.
Implement the approved task as production-quality source code in the existing workspace.

TASK
Title: {title}
Description: {description}

APPROVED PRODUCT CONTEXT
{json.dumps(context, indent=2, default=str)[:18000]}

FILES ALREADY PRESENT
{json.dumps(existing_files[:160], indent=2)}

Rules:
- Generate real runnable implementation files, not a prose plan.
- Keep every file path relative to the workspace. Never use absolute paths or '..'.
- Preserve and extend the approved architecture and existing file layout.
- Include dependency manifests and tests when the task needs them.
- Prefer modifying the smallest coherent set of files instead of creating duplicates.
- Do not emit markdown fences around JSON.

Return ONLY valid JSON in this exact shape:
{{
  "files": [
    {{"path": "relative/path.ext", "content": "complete file content"}}
  ],
  "summary": "what was implemented"
}}""",
            }
        ]

        raw = await self.provider.chat(messages, temperature=0.1)
        data = self.provider.parse_json(raw)
        if not isinstance(data, dict):
            raise ValueError("Execution agent returned a non-object response")

        files = data.get("files", [])
        if not isinstance(files, list):
            raise ValueError("Execution agent response is missing a valid files array")

        written: list[dict[str, str]] = []
        for file in files:
            if not isinstance(file, dict):
                continue
            path = str(file.get("path") or "").strip()
            content = file.get("content")
            if not path or not isinstance(content, str):
                continue
            self.simulator.write_file(path, content)
            written.append({"path": path, "content": content})
            self._log(f"Wrote file: {path}")

        if not written:
            raise ValueError(f"Execution task '{title}' produced no writable files")

        summary = str(data.get("summary") or f"Implemented {title}")
        self._log(f"Task completed: {summary}")
        return {"files": written, "summary": summary}

    def get_logs(self) -> list[str]:
        return list(self.logs)


_agents: dict[str, ExecutionAgent] = {}


def get_execution_agent(workspace_id: str, provider: Optional[LLMProvider] = None) -> ExecutionAgent:
    if workspace_id not in _agents:
        _agents[workspace_id] = ExecutionAgent(workspace_id, provider)
    elif provider is not None:
        _agents[workspace_id].provider = provider
    return _agents[workspace_id]
