import asyncio
from pathlib import Path

import pytest

from execution.autonomous_builder import _milestone_tasks, verify_workspace
from execution.execution_agent import ExecutionAgent
from execution.simulator import FSSimulator
from llm.local_provider import LocalProvider


def test_milestones_are_batched_into_coherent_build_passes():
    plan = {
        "milestones": [
            {"title": "Foundation", "tasks": ["Create API", "Add persistence"]},
            {"title": "Polish", "tasks": [{"title": "Smoke test", "description": "Exercise the primary flow"}]},
        ]
    }

    tasks = _milestone_tasks(plan)

    assert len(tasks) == 2
    assert tasks[0]["title"] == "Implement milestone: Foundation"
    assert "Create API" in tasks[0]["description"]
    assert "Add persistence" in tasks[0]["description"]
    assert "Smoke test" in tasks[1]["description"]


def test_workspace_verification_requires_source_and_manifest(tmp_path: Path):
    (tmp_path / "main.py").write_text("print('ok')\n", encoding="utf-8")
    (tmp_path / "requirements.txt").write_text("\n", encoding="utf-8")

    report = verify_workspace(str(tmp_path))

    assert report["verified"] is True
    assert report["source_file_count"] == 1
    assert "requirements.txt" in report["manifest_files"]
    assert not report["failed_checks"]


def test_workspace_verification_fails_without_dependency_manifest(tmp_path: Path):
    (tmp_path / "main.py").write_text("print('ok')\n", encoding="utf-8")

    report = verify_workspace(str(tmp_path))

    assert report["verified"] is False
    assert "dependency-manifest" in report["failed_checks"]


def test_simulator_rejects_path_traversal(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(tmp_path)
    simulator = FSSimulator("safe-workspace")

    with pytest.raises(ValueError, match="traversal|escapes workspace"):
        simulator.write_file("../outside.py", "print('no')")

    simulator.write_file("src/app.py", "print('yes')")
    assert (tmp_path / "output" / "safe-workspace" / "src" / "app.py").exists()


def test_local_provider_satisfies_autonomous_execution_contract(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(tmp_path)
    agent = ExecutionAgent("local-ci-build", LocalProvider())

    result = asyncio.run(
        agent.execute_task(
            {
                "title": "Create runnable project foundation",
                "description": "Create runnable project foundation with source, dependencies, and a smoke test.",
                "context": {"idea": "offline CI product"},
            }
        )
    )

    assert result["files"]
    workspace = tmp_path / "output" / "local-ci-build"
    assert (workspace / "main.py").exists()
    assert (workspace / "requirements.txt").exists()
    assert (workspace / "tests" / "test_smoke.py").exists()
    assert verify_workspace(str(workspace))["verified"] is True
