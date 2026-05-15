"""
Execution Agent — Autonomous implementation of the plan.
"""

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

    async def execute_task(self, task: dict[str, Any]):
        """
        Execute a single task from the plan.
        """
        self._log(f"Starting task: {task['title']}")
        
        messages = [
            {
                "role": "system",
                "content": f"""You are an Autonomous AI Senior Engineer. 
Your task is to implement: {task['title']}
Description: {task['description']}

Generate the necessary code or configuration files.
Return ONLY valid JSON:
{{
  "files": [
    {{"path": "...", "content": "..."}}
  ],
  "summary": "..."
}}"""
            }
        ]

        raw = await self.provider.chat(messages, temperature=0.1)
        data = self.provider.parse_json(raw)
        
        for file in data.get("files", []):
            self.simulator.write_file(file["path"], file["content"])
            self._log(f"Wrote file: {file['path']}")

        self._log(f"Task completed: {data.get('summary')}")
        return data

    def get_logs(self) -> list[str]:
        return self.logs

_agents = {}

def get_execution_agent(workspace_id: str, provider: Optional[LLMProvider] = None) -> ExecutionAgent:
    if workspace_id not in _agents:
        _agents[workspace_id] = ExecutionAgent(workspace_id, provider)
    return _agents[workspace_id]
