"""Execution Agent — autonomous implementation of approved engineering tasks."""

from typing import Any, Optional

from llm.provider import LLMProvider, get_provider
from execution.simulator import get_simulator


class ExecutionAgent:
    def __init__(self, workspace_id: str, provider: Optional[LLMProvider] = None):
        self.workspace_id = workspace_id
        self.provider = provider or get_provider()
        self.simulator = get_simulator(workspace_id)
        self.logs: list[str] = []

    def _log(self, message: str):
        self.logs.append(message)
        print(f"[Execution] {message}")

    async def execute_task(self, task: dict[str, Any]):
        """Execute one engineering task and persist the returned files inside the build workspace."""
        title = task.get("title") or task.get("name") or "Implementation Task"
        description = task.get("description") or task.get("summary") or task.get("detail") or "Implement the selected pipeline task."
        reference_repo = task.get("reference_repo") or task.get("referenceRepo") or ""
        phase = task.get("phase") or "Engineering"
        self._log(f"Starting task: {phase} / {title}")

        messages = [
            {
                "role": "system",
                "content": f"""You are an autonomous senior product engineer working inside an existing generated repository.

PHASE: {phase}
TASK: {title}
DESCRIPTION: {description}
REFERENCE REPOSITORY: {reference_repo or 'Use only the approved source set provided in the task description.'}

Rules:
- Generate implementation code/configuration, not prose-only placeholders.
- Preserve working files unless a change is necessary.
- Use only relative repository paths. Never use ../ or absolute paths.
- Never emit credentials, API keys, private keys, or secrets.
- Keep each task focused: at most 24 changed files.
- Prefer adapters/modules around approved third-party foundations instead of copying entire repositories.
- Return ONLY valid JSON in this exact shape:
{{
  "files": [{{"path": "relative/path.ext", "content": "complete file content"}}],
  "summary": "short engineering summary"
}}""",
            }
        ]

        raw = await self.provider.chat(messages, temperature=0.1)
        data = self.provider.parse_json(raw)
        if not isinstance(data, dict):
            raise ValueError("Engineering agent returned a non-object response")
        files = data.get("files", [])
        if not isinstance(files, list):
            raise ValueError("Engineering agent response did not contain a files list")
        if len(files) > 24:
            raise ValueError("Engineering agent attempted to change more than 24 files in one task")

        written = 0
        for file in files:
            if not isinstance(file, dict):
                continue
            path = str(file.get("path") or "").strip().replace("\\", "/")
            content = file.get("content")
            if not path or path.startswith("/") or ".." in path.split("/"):
                raise ValueError(f"Unsafe generated file path: {path or '<empty>'}")
            if content is None:
                continue
            self.simulator.write_file(path, str(content))
            written += 1
            self._log(f"Wrote file: {path}")

        summary = str(data.get("summary") or f"Task completed with {written} file change(s).")
        self._log(f"Task completed: {summary}")
        return {**data, "summary": summary, "writtenFiles": written}

    def get_logs(self) -> list[str]:
        return self.logs


_agents = {}


def get_execution_agent(workspace_id: str, provider: Optional[LLMProvider] = None) -> ExecutionAgent:
    if workspace_id not in _agents:
        _agents[workspace_id] = ExecutionAgent(workspace_id, provider)
    return _agents[workspace_id]
