"""
MCP Tool Registry — GitHub · web · RAG · repo tools — all callable via mcp_runner
"""
from __future__ import annotations
import subprocess
import json
from dataclasses import dataclass, field
from typing import Callable, Any


@dataclass
class MCPTool:
    name: str
    description: str
    tags: list[str]
    handler: Callable[..., Any]
    schema: dict = field(default_factory=dict)


class MCPRegistry:
    """
    Central registry of all MCP tools.
    Tools are registered at startup and called by agents via mcp_runner().
    """

    def __init__(self):
        self._tools: dict[str, MCPTool] = {}

    # ── registration ─────────────────────────────────────────────────────────
    def register(self, tool: MCPTool):
        self._tools[tool.name] = tool
        print(f"[MCP] registered: {tool.name}")

    def list_tools(self, tag: str | None = None) -> list[str]:
        if tag:
            return [n for n, t in self._tools.items() if tag in t.tags]
        return list(self._tools.keys())

    def describe(self, name: str) -> dict:
        tool = self._tools[name]
        return {"name": tool.name, "description": tool.description,
                "schema": tool.schema, "tags": tool.tags}

    # ── invocation ────────────────────────────────────────────────────────────
    def mcp_runner(self, tool_name: str, **kwargs) -> Any:
        if tool_name not in self._tools:
            raise KeyError(f"Tool '{tool_name}' not registered in MCP registry")
        print(f"[MCP] calling {tool_name}({kwargs})")
        return self._tools[tool_name].handler(**kwargs)

    # ── convenience ───────────────────────────────────────────────────────────
    def to_llm_tools(self) -> list[dict]:
        """Return OpenAI-style tool definitions for LLM calls."""
        out = []
        for t in self._tools.values():
            out.append({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.schema or {"type": "object", "properties": {}},
                },
            })
        return out


# ── Built-in tool factories ───────────────────────────────────────────────────

def make_github_search_tool(token: str | None = None) -> MCPTool:
    """Search GitHub repos by query."""
    import urllib.request, urllib.parse

    def handler(query: str, sort: str = "stars", per_page: int = 5) -> dict:
        params = urllib.parse.urlencode({"q": query, "sort": sort, "per_page": per_page})
        url = f"https://api.github.com/search/repositories?{params}"
        req = urllib.request.Request(url, headers={"User-Agent": "ai-product-factory"})
        if token:
            req.add_header("Authorization", f"token {token}")
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
        return {
            "items": [
                {"full_name": i["full_name"], "stars": i["stargazers_count"],
                 "description": i.get("description", ""), "url": i["html_url"],
                 "clone_url": i["clone_url"]}
                for i in data.get("items", [])
            ]
        }

    return MCPTool(
        name="github_search",
        description="Search GitHub repositories by keyword. Returns name, stars, description, clone URL.",
        tags=["github", "search"],
        handler=handler,
        schema={
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "sort": {"type": "string", "enum": ["stars", "forks", "updated"]},
                "per_page": {"type": "integer"},
            },
            "required": ["query"],
        },
    )


def make_web_search_tool() -> MCPTool:
    """Stub web-search tool (replace with Firecrawl / SerpAPI in production)."""

    def handler(query: str, max_results: int = 5) -> dict:
        # Production: call Firecrawl or SerpAPI here
        return {"query": query, "results": [
            {"title": f"Result {i+1} for: {query}", "url": f"https://example.com/{i}", "snippet": "…"}
            for i in range(max_results)
        ]}

    return MCPTool(
        name="web_search",
        description="Search the web for information about a topic (market research, trends, competitors).",
        tags=["web", "search"],
        handler=handler,
        schema={
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "max_results": {"type": "integer"},
            },
            "required": ["query"],
        },
    )


def make_rag_query_tool(memory) -> MCPTool:
    """Query the RAG memory store."""

    def handler(query: str, top_k: int = 5) -> dict:
        hits = memory.recall_context(query, top_k=top_k)
        return {"hits": hits}

    return MCPTool(
        name="rag_query",
        description="Retrieve relevant past ideas, repos, builds, and debug logs from memory.",
        tags=["rag", "memory"],
        handler=handler,
        schema={
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "top_k": {"type": "integer"},
            },
            "required": ["query"],
        },
    )


def make_repo_clone_tool(sandbox_dir: str = "/tmp/sandbox") -> MCPTool:
    """Clone a repo into the Docker sandbox directory."""
    import os

    def handler(clone_url: str, repo_name: str) -> dict:
        dest = os.path.join(sandbox_dir, repo_name.replace("/", "_"))
        os.makedirs(sandbox_dir, exist_ok=True)
        if os.path.exists(dest):
            return {"status": "already_cloned", "path": dest}
        result = subprocess.run(
            ["git", "clone", "--depth=1", clone_url, dest],
            capture_output=True, text=True, timeout=60
        )
        if result.returncode != 0:
            return {"status": "error", "stderr": result.stderr}
        return {"status": "cloned", "path": dest}

    return MCPTool(
        name="repo_clone",
        description="Clone a GitHub repository into the Docker sandbox.",
        tags=["repo", "docker"],
        handler=handler,
        schema={
            "type": "object",
            "properties": {
                "clone_url": {"type": "string"},
                "repo_name": {"type": "string"},
            },
            "required": ["clone_url", "repo_name"],
        },
    )
