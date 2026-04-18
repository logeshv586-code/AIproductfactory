"""
Repo Execution Layer — Clone · Analyze · Extract APIs · Wrap as MCP tool · Docker sandbox
"""
from __future__ import annotations
import os
import json
import subprocess
from dataclasses import dataclass, field
from anthropic import Anthropic
from mcp_registry import MCPRegistry, MCPTool


@dataclass
class RepoProfile:
    full_name: str
    local_path: str
    language: str
    entry_points: list[str]
    public_api: list[dict]        # [{name, signature, description}, ...]
    dockerfile_present: bool
    mcp_tool_name: str
    summary: str


class RepoExecutor:
    """
    Clones repos, analyses their structure with Claude, wraps them as MCP tools,
    and optionally runs them in a Docker sandbox.
    """

    ANALYZE_SYSTEM = """You are a code analyst. Given a file listing and sample files from a repo,
extract key information.

Return ONLY valid JSON:
{
  "language": "<primary language>",
  "entry_points": ["<file1>", "<file2>"],
  "public_api": [
    {"name": "<fn/class>", "signature": "<signature>", "description": "<what it does>"}
  ],
  "summary": "<2 sentence description of what this repo does>"
}
Limit public_api to the 5 most important items."""

    def __init__(self, registry: MCPRegistry, client: Anthropic, sandbox_dir: str = "/tmp/sandbox"):
        self._registry = registry
        self._client = client
        self._sandbox_dir = sandbox_dir

    def process_repo(self, clone_url: str, full_name: str) -> RepoProfile | None:
        # 1. Clone
        clone_result = self._registry.mcp_runner("repo_clone",
                                                  clone_url=clone_url, repo_name=full_name)
        if clone_result.get("status") == "error":
            print(f"[RepoExecutor] clone failed: {clone_result.get('stderr', '')}")
            return None

        local_path = clone_result["path"]
        print(f"[RepoExecutor] cloned to {local_path}")

        # 2. Analyse
        profile = self._analyze(full_name, local_path)

        # 3. Wrap as MCP tool
        self._wrap_as_mcp_tool(profile)
        return profile

    def _analyze(self, full_name: str, local_path: str) -> RepoProfile:
        # Collect file tree
        file_tree = self._file_tree(local_path, max_files=60)
        # Sample a few key files
        sample_content = self._sample_files(local_path, max_chars=3000)
        has_dockerfile = os.path.exists(os.path.join(local_path, "Dockerfile"))

        prompt = f"REPO: {full_name}\n\nFILE TREE:\n{file_tree}\n\nSAMPLE FILES:\n{sample_content}"
        resp = self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=600,
            system=self.ANALYZE_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw)
        tool_name = "repo_" + full_name.replace("/", "_").replace("-", "_").lower()
        return RepoProfile(
            full_name=full_name,
            local_path=local_path,
            language=data.get("language", "unknown"),
            entry_points=data.get("entry_points", []),
            public_api=data.get("public_api", []),
            dockerfile_present=has_dockerfile,
            mcp_tool_name=tool_name,
            summary=data.get("summary", ""),
        )

    def _wrap_as_mcp_tool(self, profile: RepoProfile):
        """Register a dynamic MCP tool that runs this repo via subprocess."""
        _profile = profile   # capture

        def handler(command: str, args: list[str] | None = None, env: dict | None = None):
            cmd = ["python", command] if command.endswith(".py") else command.split()
            if args:
                cmd.extend(args)
            result = subprocess.run(
                cmd,
                cwd=_profile.local_path,
                capture_output=True, text=True, timeout=30,
                env={**os.environ, **(env or {})}
            )
            return {"stdout": result.stdout, "stderr": result.stderr,
                    "returncode": result.returncode}

        tool = MCPTool(
            name=profile.mcp_tool_name,
            description=f"Run commands inside repo {profile.full_name}. {profile.summary}",
            tags=["repo", "dynamic"],
            handler=handler,
            schema={
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Command or script to run"},
                    "args": {"type": "array", "items": {"type": "string"}},
                    "env": {"type": "object"},
                },
                "required": ["command"],
            },
        )
        self._registry.register(tool)
        print(f"[RepoExecutor] wrapped '{profile.full_name}' as MCP tool '{profile.mcp_tool_name}'")

    # ── helpers ───────────────────────────────────────────────────────────────
    def _file_tree(self, path: str, max_files: int = 60) -> str:
        lines = []
        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if not d.startswith(".") and d not in
                       ("node_modules", "__pycache__", ".git", "venv", ".venv")]
            level = root.replace(path, "").count(os.sep)
            indent = "  " * level
            lines.append(f"{indent}{os.path.basename(root)}/")
            for f in files:
                lines.append(f"{indent}  {f}")
            if len(lines) > max_files:
                lines.append("  ... (truncated)")
                break
        return "\n".join(lines)

    def _sample_files(self, path: str, max_chars: int = 3000) -> str:
        targets = ["README.md", "main.py", "index.js", "src/main.py",
                   "app.py", "setup.py", "pyproject.toml", "package.json"]
        collected = []
        total = 0
        for t in targets:
            fp = os.path.join(path, t)
            if os.path.exists(fp):
                try:
                    content = open(fp).read()[:800]
                    collected.append(f"--- {t} ---\n{content}")
                    total += len(content)
                    if total > max_chars:
                        break
                except Exception:
                    pass
        return "\n\n".join(collected) or "(no sample files found)"
