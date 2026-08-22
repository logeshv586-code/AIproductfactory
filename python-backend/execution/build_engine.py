"""Autonomous build phase for approved Product Factory strategies.

This module turns the deterministic execution plan into concrete implementation
steps, persists generated files under ``output/<run_id>``, and performs bounded
verification without executing arbitrary generated application code.
"""

from __future__ import annotations

import ast
import json
import os
from pathlib import Path
from typing import Any

from execution.execution_agent import get_execution_agent
from intelligence.prompt_utils import as_dict, as_list, as_str
from llm.provider import LLMProvider


_TEXT_EXTENSIONS = {
    ".py", ".pyi", ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".txt",
    ".toml", ".yaml", ".yml", ".ini", ".cfg", ".env", ".html", ".css",
    ".scss", ".sql", ".sh", ".ps1", ".dockerfile",
}


def _flatten_tasks(execution_plan: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert milestone strings into task objects understood by ExecutionAgent."""
    tasks: list[dict[str, Any]] = []
    for milestone_index, milestone in enumerate(as_list(execution_plan.get("milestones")), start=1):
        md = as_dict(milestone)
        milestone_title = as_str(md.get("title")) or f"Milestone {milestone_index}"
        milestone_tasks = as_list(md.get("tasks"))
        for task_index, raw_task in enumerate(milestone_tasks, start=1):
            if isinstance(raw_task, dict):
                task = dict(raw_task)
                task.setdefault("title", as_str(task.get("name")) or f"{milestone_title} task {task_index}")
                task.setdefault("description", as_str(task.get("detail")) or as_str(task.get("summary")))
            else:
                task = {
                    "title": as_str(raw_task) or f"{milestone_title} task {task_index}",
                    "description": as_str(raw_task) or "Implement this execution-plan task.",
                }
            task["milestone"] = milestone_title
            tasks.append(task)
    return tasks


def _seed_tasks(
    strategy: dict[str, Any],
    blueprint: dict[str, Any],
    engineering: dict[str, Any],
) -> list[dict[str, Any]]:
    """Guarantee that every generated repo has runnable scaffolding and manifests."""
    stack = ", ".join(as_str(item) for item in as_list(blueprint.get("technology_stack")) if as_str(item))
    config_files = ", ".join(as_str(item) for item in as_list(engineering.get("config_files")) if as_str(item))
    product_name = as_str(blueprint.get("product_name")) or as_str(strategy.get("name")) or "Product"
    return [
        {
            "title": "Create runnable repository foundation",
            "milestone": "Foundation",
            "description": (
                f"Create the actual runnable starter codebase for {product_name}. "
                f"Technology stack: {stack or 'choose the approved architecture stack'}. "
                "Generate real entrypoints, package/dependency manifests, README quickstart, "
                "environment example, and minimal health/smoke-test coverage. Do not return "
                "placeholder-only files."
            ),
        },
        {
            "title": "Create engineering and deployment configuration",
            "milestone": "Foundation",
            "description": (
                f"Create the approved engineering files ({config_files or 'CI, Docker, env and test config'}). "
                "Ensure configuration filenames match their contents; Docker Compose YAML must be written "
                "to docker-compose.yml or compose.yml, never to a Python file."
            ),
        },
    ]


def _verify_python(path: Path) -> dict[str, Any]:
    try:
        source = path.read_text(encoding="utf-8")
        ast.parse(source, filename=str(path))
        return {"path": str(path), "check": "python-ast", "passed": True}
    except Exception as exc:
        return {"path": str(path), "check": "python-ast", "passed": False, "error": str(exc)}


def _verify_json(path: Path) -> dict[str, Any]:
    try:
        json.loads(path.read_text(encoding="utf-8"))
        return {"path": str(path), "check": "json-parse", "passed": True}
    except Exception as exc:
        return {"path": str(path), "check": "json-parse", "passed": False, "error": str(exc)}


def verify_workspace(base_path: str) -> dict[str, Any]:
    """Perform deterministic, non-executing verification over a generated workspace.

    We intentionally do not run arbitrary generated application/test code in the Product
    Factory process. Syntax and manifest checks are safe and deterministic; a generated CI
    workflow can perform deeper install/test/build checks in an isolated runner.
    """
    root = Path(base_path).resolve()
    checks: list[dict[str, Any]] = []
    files: list[str] = []
    manifests: list[str] = []
    entrypoints: list[str] = []

    if not root.exists():
        return {
            "passed": False,
            "score": 0,
            "checks": [],
            "files": [],
            "errors": [f"workspace does not exist: {root}"],
        }

    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = str(path.relative_to(root)).replace(os.sep, "/")
        files.append(rel)
        lower = path.name.lower()
        if lower in {"requirements.txt", "pyproject.toml", "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"}:
            manifests.append(rel)
        if lower in {"main.py", "app.py", "server.py", "index.ts", "index.js", "main.ts", "main.js"}:
            entrypoints.append(rel)
        if path.suffix == ".py":
            result = _verify_python(path)
            result["path"] = rel
            checks.append(result)
        elif path.suffix == ".json":
            result = _verify_json(path)
            result["path"] = rel
            checks.append(result)

    required_checks = [
        {"check": "files-generated", "passed": len(files) >= 3, "detail": f"{len(files)} files"},
        {"check": "dependency-manifest", "passed": bool(manifests), "detail": ", ".join(manifests)},
        {"check": "runnable-entrypoint", "passed": bool(entrypoints), "detail": ", ".join(entrypoints)},
    ]
    checks.extend(required_checks)
    failed = [check for check in checks if not check.get("passed")]
    score = 100 if not checks else round(100 * (len(checks) - len(failed)) / len(checks))
    return {
        "passed": not failed,
        "score": score,
        "checks": checks,
        "files": files,
        "manifests": manifests,
        "entrypoints": entrypoints,
        "errors": [as_str(item.get("error")) or as_str(item.get("detail")) for item in failed],
        "verification_mode": "safe-static",
        "note": "Generated code is syntax/manifest checked in-process; deeper install/test/build execution belongs in isolated CI.",
    }


async def build_approved_product(
    *,
    run_id: str,
    strategy: dict[str, Any],
    execution_plan: dict[str, Any],
    blueprint: dict[str, Any],
    engineering: dict[str, Any],
    architecture: dict[str, Any],
    composition_plan: dict[str, Any],
    provider: LLMProvider,
) -> dict[str, Any]:
    """Generate all planned implementation tasks and verify the persisted workspace."""
    agent = get_execution_agent(run_id, provider)
    folders = [as_str(item) for item in as_list(blueprint.get("folder_structure")) if as_str(item)]
    if folders:
        agent.simulator.create_structure(folders)

    tasks = _seed_tasks(strategy, blueprint, engineering) + _flatten_tasks(execution_plan)
    results: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []

    shared_context = {
        "approved_strategy": strategy,
        "architecture": architecture,
        "composition_plan": composition_plan,
        "blueprint": blueprint,
        "engineering": engineering,
    }

    for index, task in enumerate(tasks, start=1):
        enriched = dict(task)
        enriched["description"] = (
            f"{as_str(task.get('description'))}\n\n"
            "Repository context (use this to keep all generated files coherent):\n"
            f"{json.dumps(shared_context, default=str)[:12000]}"
        )
        try:
            result = await agent.execute_task(enriched)
            results.append({
                "index": index,
                "title": as_str(task.get("title")),
                "milestone": as_str(task.get("milestone")),
                "summary": as_str(as_dict(result).get("summary")),
                "files": [as_str(as_dict(file).get("path")) for file in as_list(as_dict(result).get("files"))],
            })
        except Exception as exc:
            failures.append({"index": index, "title": as_str(task.get("title")), "error": str(exc)})

    verification = verify_workspace(agent.simulator.base_path)
    success = not failures and verification.get("passed", False)
    return {
        "success": success,
        "workspace_id": run_id,
        "output_path": agent.simulator.base_path,
        "tasks_total": len(tasks),
        "tasks_completed": len(results),
        "task_results": results,
        "task_failures": failures,
        "verification": verification,
        "logs": agent.get_logs(),
        "status": "verified" if success else "verification_failed",
    }
