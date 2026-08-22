import json
import os
import shutil
import unittest
import uuid

from execution.build_engine import build_approved_product, verify_workspace
from execution.execution_agent import ExecutionAgent
from execution.simulator import FSSimulator


class FakeBuildProvider:
    async def chat(self, messages, temperature=0.1, max_tokens=1000, enable_thinking=None):
        return json.dumps(
            {
                "files": [
                    {
                        "path": "apps/api/main.py",
                        "content": "def health():\n    return {'status': 'ok'}\n",
                    },
                    {"path": "requirements.txt", "content": "# stdlib-only smoke fixture\n"},
                    {"path": "README.md", "content": "# Generated Product\n\nRun the API entrypoint.\n"},
                    {
                        "path": "docker-compose.yml",
                        "content": "services:\n  api:\n    image: python:3.12-slim\n",
                    },
                    {
                        "path": "tests/test_smoke.py",
                        "content": "def test_smoke():\n    assert True\n",
                    },
                ],
                "summary": "Created a runnable verified starter slice.",
            }
        )

    @staticmethod
    def parse_json(raw):
        return json.loads(raw)


class AutonomousBuildTests(unittest.IsolatedAsyncioTestCase):
    async def test_execution_plan_generates_and_verifies_workspace(self):
        run_id = f"test-build-{uuid.uuid4().hex[:8]}"
        try:
            result = await build_approved_product(
                run_id=run_id,
                strategy={"name": "Test Product"},
                execution_plan={
                    "milestones": [
                        {"title": "Foundation", "tasks": ["Build API"]},
                        {"title": "Integration", "tasks": ["Add smoke test"]},
                    ]
                },
                blueprint={
                    "product_name": "Test Product",
                    "technology_stack": ["Python"],
                    "folder_structure": ["apps/api", "tests"],
                },
                engineering={"config_files": ["Dockerfile", "docker-compose.yml"]},
                architecture={"components": [{"name": "API", "role": "HTTP API"}]},
                composition_plan={"services": [{"name": "api"}]},
                provider=FakeBuildProvider(),
            )

            self.assertTrue(result["success"], result)
            self.assertEqual(result["tasks_total"], 4)  # 2 seed tasks + 2 planned tasks
            self.assertEqual(result["tasks_completed"], 4)
            self.assertTrue(result["verification"]["passed"])
            self.assertIn("apps/api/main.py", result["verification"]["files"])
            self.assertIn("requirements.txt", result["verification"]["manifests"])
            self.assertIn("apps/api/main.py", result["verification"]["entrypoints"])
        finally:
            shutil.rmtree(os.path.join(os.getcwd(), "output", run_id), ignore_errors=True)

    def test_verification_rejects_invalid_python(self):
        run_id = f"test-invalid-{uuid.uuid4().hex[:8]}"
        simulator = FSSimulator(run_id)
        try:
            simulator.write_file("main.py", "def broken(:\n    pass\n")
            simulator.write_file("requirements.txt", "")
            simulator.write_file("README.md", "# Broken fixture\n")
            report = verify_workspace(simulator.base_path)
            self.assertFalse(report["passed"])
            self.assertTrue(any(check["check"] == "python-ast" and not check["passed"] for check in report["checks"]))
        finally:
            shutil.rmtree(simulator.base_path, ignore_errors=True)

    def test_generated_paths_cannot_escape_workspace(self):
        with self.assertRaises(ValueError):
            ExecutionAgent._safe_relative_path("../../outside.py")
        with self.assertRaises(ValueError):
            ExecutionAgent._safe_relative_path("/tmp/outside.py")

        simulator = FSSimulator(f"test-path-{uuid.uuid4().hex[:8]}")
        try:
            with self.assertRaises(ValueError):
                simulator.write_file("../outside.txt", "nope")
        finally:
            shutil.rmtree(simulator.base_path, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
