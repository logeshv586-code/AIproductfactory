import asyncio
from pathlib import Path

from execution.execution_agent import ExecutionAgent
from execution.product_builder import build_product_delivery
from execution.simulator import FSSimulator
from llm.local_provider import LocalProvider


def test_verified_product_delivery_serves_runtime_ui_and_packages_zip(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    workspace_id = "delivery_test"
    simulator = FSSimulator(workspace_id)
    agent = ExecutionAgent(workspace_id, LocalProvider())
    agent.simulator = simulator

    product = {
        "name": "Delivery Test Product",
        "description": "A deterministic test product for full-source delivery.",
        "key_features": ["Verified runtime preview", "Source package"],
    }
    architecture = {
        "components": [
            {"name": "Core Engine", "role": "Processes the approved workflow", "tech": "Python"},
            {"name": "Frontend Dashboard", "role": "Shows product state", "tech": "HTML"},
        ],
        "tech_stack": ["Python", "FastAPI"],
        "deployment": "docker-compose",
    }
    blueprint = {
        "readme_content": "# Delivery Test Product\n",
        "env_example": "APP_ENV=development\n",
    }
    repos = [
        {
            "full_name": "example/approved-source",
            "url": "https://github.com/example/approved-source",
            "license": "MIT",
            "suggested_role": "approved adapter source",
            "integration_mode": "adapter",
        }
    ]

    result = asyncio.run(build_product_delivery(
        product=product,
        architecture=architecture,
        blueprint=blueprint,
        execution_plan={"phases": []},
        selected_repos=repos,
        agent=agent,
        max_repair_attempts=0,
    ))

    assert result["verification"]["passed"] is True
    assert result["previewSource"] == "running-generated-application"
    assert "Generated build preview" in result["previewHtml"]
    assert result["artifactName"].endswith(".zip")
    assert result["artifactBytes"] > 0

    workspace = Path(simulator.base_path)
    assert (workspace / "SOURCE_MANIFEST.json").is_file()
    assert (workspace / "THIRD_PARTY_NOTICES.md").is_file()
    assert (tmp_path / "output" / f"{workspace_id}.zip").is_file()

    check_names = {item["name"] for item in result["verification"]["checks"] if item["passed"]}
    assert "generatedTests" in check_names
    assert "runtimeServerSmoke" in check_names
