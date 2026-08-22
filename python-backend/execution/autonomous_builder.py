"""Autonomous approved-product build runner.

Turns the approved Product Knowledge Graph execution plan into an actual workspace,
asks the existing ExecutionAgent to implement each task, and applies deterministic
verification gates before the Product Factory reports the build as complete.

The runner intentionally does not install arbitrary dependencies during an API
request. Generated dependency manifests are verified for presence, while compile,
typecheck, tests and build commands run only when the required toolchain is already
available. This keeps the autonomous build path useful without turning a model-
generated requirements file into an implicit supply-chain execution primitive.
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from typing import Any

from execution.execution_agent import ExecutionAgent
from intelligence.prompt_utils import as_dict, as_list, as_str
from llm.provider import LLMProvider


_MAX_TASKS = 14
_MAX_COMMAND_SECONDS = 120


def _slug(value: str) -> str:
    cleaned = "".join(ch.lower() if ch.isalnum() else "-" for ch in value).strip("-")
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return cleaned[:48] or "product"


def _project_context(graph: dict[str, Any], live_sources: dict[str, Any] | None = None) -> dict[str, Any]:
    strategy = as_dict(graph.get("approved_strategy"))
    if not strategy:
        strategy = as_dict(graph.get("_approved_strategy"))
    source_signals = as_list(as_dict(live_sources or {}).get("signals"))[:12]
    return {
        "idea": as_str(graph.get("idea")),
        "intent": as_dict(graph.get("intent")),
        "requirements": as_list(graph.get("requirements"))[:16],
        "approved_strategy": strategy,
        "architecture": as_dict(graph.get("architecture")),
        "architecture_views": as_dict(graph.get("architecture_views")),
        "composition_plan": as_dict(graph.get("composition_plan")),
        "blueprint": as_dict(graph.get("blueprint")),
        "engineering": as_dict(graph.get("engineering")),
        "repository_mappings": as_list(graph.get("capability_mappings"))[:16],
        "live_source_evidence": source_signals,
    }


def _milestone_tasks(execution_plan: dict[str, Any]) -> list[dict[str, Any]]:
    tasks: list[dict[str, Any]] = []
    for milestone_index, milestone in enumerate(as_list(execution_plan.get("milestones")), start=1):
        md = as_dict(milestone)
        milestone_title = as_str(md.get("title")) or f"Milestone {milestone_index}"
        for task_index, raw in enumerate(as_list(md.get("tasks")), start=1):
            if isinstance(raw, dict):
                task = dict(raw)
                task.setdefault("title", as_str(raw.get("name")) or f"{milestone_title} task {task_index}")
                task.setdefault("description", as_str(raw.get("description")) or as_str(raw.get("summary")))
            else:
                text = as_str(raw)
                if not text:
                    continue
                task = {"title": text, "description": text}
            task["milestone"] = milestone_title
            tasks.append(task)
    return tasks[:_MAX_TASKS]


def _seed_files(agent: ExecutionAgent, graph: dict[str, Any]) -> None:
    blueprint = as_dict(graph.get("blueprint"))
    engineering = as_dict(graph.get("engineering"))
    folders = [as_str(p) for p in as_list(blueprint.get("folder_structure")) if as_str(p)]
    if folders:
        agent.simulator.create_structure([p.rstrip("/") + "/" for p in folders])

    readme = as_str(engineering.get("starter_readme"))
    if readme:
        agent.simulator.write_file("README.md", readme)

    build_meta = {
        "generated_by": "AI Product Factory autonomous build",
        "blueprint": blueprint,
        "engineering": engineering,
    }
    agent.simulator.write_file(".factory/build-context.json", json.dumps(build_meta, indent=2, default=str))


def _command_result(name: str, command: list[str], root: str, *, timeout: int = _MAX_COMMAND_SECONDS) -> dict[str, Any]:
    started = time.time()
    try:
        proc = subprocess.run(
            command,
            cwd=root,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            timeout=timeout,
            check=False,
            env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
        )
        output = (proc.stdout or "")[-12000:]
        return {
            "name": name,
            "command": command,
            "status": "passed" if proc.returncode == 0 else "failed",
            "returncode": proc.returncode,
            "elapsed_ms": round((time.time() - started) * 1000),
            "output": output,
        }
    except subprocess.TimeoutExpired as exc:
        return {
            "name": name,
            "command": command,
            "status": "failed",
            "returncode": None,
            "elapsed_ms": round((time.time() - started) * 1000),
            "output": f"verification timed out after {timeout}s: {exc}",
        }
    except Exception as exc:  # pragma: no cover - platform/tooling dependent
        return {
            "name": name,
            "command": command,
            "status": "failed",
            "returncode": None,
            "elapsed_ms": round((time.time() - started) * 1000),
            "output": str(exc),
        }


def verify_workspace(root: str) -> dict[str, Any]:
    """Run deterministic verification gates against the generated workspace."""
    root_path = Path(root)
    files = sorted(
        str(path.relative_to(root_path)).replace("\\", "/")
        for path in root_path.rglob("*")
        if path.is_file() and ".factory" not in path.parts
    )
    source_files = [p for p in files if p.endswith((".py", ".ts", ".tsx", ".js", ".jsx"))]
    manifests = [p for p in files if Path(p).name in {"requirements.txt", "pyproject.toml", "package.json", "Pipfile", "poetry.lock"}]

    checks: list[dict[str, Any]] = [
        {
            "name": "source-files",
            "status": "passed" if source_files else "failed",
            "detail": f"{len(source_files)} source files generated",
        },
        {
            "name": "dependency-manifest",
            "status": "passed" if manifests else "failed",
            "detail": ", ".join(manifests) if manifests else "No dependency manifest generated",
        },
    ]

    python_files = [p for p in files if p.endswith(".py")]
    if python_files:
        checks.append(_command_result("python-compile", [sys.executable, "-m", "compileall", "-q", "."], root))

        has_tests = any(Path(p).name.startswith("test_") or "/tests/" in f"/{p}" for p in python_files)
        try:
            import pytest  # noqa: F401
            pytest_available = True
        except Exception:
            pytest_available = False
        if has_tests and pytest_available:
            checks.append(_command_result("pytest", [sys.executable, "-m", "pytest", "-q"], root))
        elif has_tests:
            checks.append({"name": "pytest", "status": "skipped", "detail": "pytest is not installed in the Product Factory runtime"})

    package_json = root_path / "package.json"
    if package_json.exists():
        npm = shutil.which("npm")
        node_modules = root_path / "node_modules"
        if npm and node_modules.exists():
            checks.append(_command_result("npm-typecheck", [npm, "run", "typecheck", "--if-present"], root))
            checks.append(_command_result("npm-test", [npm, "run", "test", "--if-present"], root))
            checks.append(_command_result("npm-build", [npm, "run", "build", "--if-present"], root))
        else:
            checks.append({
                "name": "node-verification",
                "status": "skipped",
                "detail": "npm/node_modules unavailable; dependency installation is intentionally not executed inside the approval request",
            })

    failed = [check for check in checks if check.get("status") == "failed"]
    passed = [check for check in checks if check.get("status") == "passed"]
    verified = bool(passed) and not failed
    return {
        "verified": verified,
        "checks": checks,
        "files": files,
        "file_count": len(files),
        "source_file_count": len(source_files),
        "manifest_files": manifests,
        "failed_checks": [as_str(c.get("name")) for c in failed],
    }


async def build_approved_product(
    run_id: str,
    graph: dict[str, Any],
    provider: LLMProvider,
    *,
    live_sources: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Execute all approved milestones and return a verified build report."""
    blueprint = as_dict(graph.get("blueprint"))
    product_name = as_str(blueprint.get("product_name")) or as_str(as_dict(graph.get("approved_strategy")).get("name")) or "product"
    workspace_id = f"{_slug(product_name)}-{_slug(run_id)}"
    agent = ExecutionAgent(workspace_id, provider)
    _seed_files(agent, graph)

    context = _project_context(graph, live_sources)
    foundation_task = {
        "title": "Create runnable project foundation",
        "description": (
            "Create the runnable foundation for the approved product. Generate real entrypoints, "
            "dependency manifests, configuration examples, implementation modules, and a minimal "
            "automated smoke test. Do not return placeholders or prose-only files. Keep all paths "
            "relative to the workspace and make the generated code internally consistent."
        ),
        "context": context,
    }

    planned_tasks = _milestone_tasks(as_dict(graph.get("execution_plan")))
    task_results: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []

    for index, task in enumerate([foundation_task, *planned_tasks], start=1):
        enriched = dict(task)
        enriched["context"] = context
        enriched["task_number"] = index
        enriched["existing_files"] = agent.simulator.list_files()
        try:
            result = await agent.execute_task(enriched)
            task_results.append({
                "task": as_str(enriched.get("title")),
                "milestone": as_str(enriched.get("milestone")),
                "summary": as_str(as_dict(result).get("summary")),
                "files": [as_str(f.get("path")) for f in as_list(as_dict(result).get("files")) if isinstance(f, dict)],
                "success": True,
            })
        except Exception as exc:
            failure = {
                "task": as_str(enriched.get("title")),
                "milestone": as_str(enriched.get("milestone")),
                "success": False,
                "error": str(exc),
            }
            task_results.append(failure)
            failures.append(failure)

    root = agent.simulator.base_path
    verification = await asyncio.to_thread(verify_workspace, root)
    package_path = ""
    if verification.get("verified"):
        try:
            package_path = await asyncio.to_thread(shutil.make_archive, root, "zip", root)
        except Exception as exc:  # packaging is useful but not a verification blocker
            agent._log(f"Packaging skipped: {exc}")

    status = "verified" if verification.get("verified") and not failures else "failed"
    report = {
        "workspace_id": workspace_id,
        "output_path": root,
        "package_path": package_path,
        "status": status,
        "verified": status == "verified",
        "tasks_attempted": len(task_results),
        "tasks_completed": len([r for r in task_results if r.get("success")]),
        "task_results": task_results,
        "verification": verification,
        "logs": agent.get_logs(),
    }
    agent.simulator.write_file(".factory/BUILD_REPORT.json", json.dumps(report, indent=2, default=str))
    return report
