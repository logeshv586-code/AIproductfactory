"""
Test Agent — Playwright + unit tests
Fix Agent  — Auto-debug loop (×3)
"""
from __future__ import annotations
import json
import subprocess
import os
from dataclasses import dataclass
from anthropic import Anthropic
from agents import GeneratedComponent


@dataclass
class TestResult:
    passed: bool
    total: int
    failed: int
    errors: list[str]
    stdout: str
    stderr: str


@dataclass
class FixResult:
    success: bool
    attempts: int
    fixed_components: list[GeneratedComponent]
    remaining_errors: list[str]


# ── Test Agent ────────────────────────────────────────────────────────────────

class TestAgent:
    """
    Generates and runs unit tests + Playwright E2E checks.
    Max 3 iterations of the fix loop.
    """

    TEST_SYSTEM = """You are a QA engineer. Given generated code files, write a test suite.

Return ONLY valid JSON:
{
  "test_filename": "<test_file.py or test_file.ts>",
  "test_code": "<complete test file content>",
  "test_command": "<pytest tests/ or npx playwright test or ...>"
}
Include unit tests for each function/class. Use pytest for Python, Jest/Playwright for JS/TS.
Make tests self-contained and mock external calls."""

    def __init__(self, client: Anthropic, output_dir: str = "/tmp/product_output"):
        self._client = client
        self._output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_tests(self, components: list[GeneratedComponent]) -> dict:
        code_summary = [{"name": c.name, "filename": c.filename,
                         "code": c.code[:500]} for c in components]
        resp = self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            system=self.TEST_SYSTEM,
            messages=[{"role": "user", "content": f"COMPONENTS:\n{json.dumps(code_summary, indent=2)}"}],
        )
        raw = resp.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw)

    def run(self, components: list[GeneratedComponent]) -> TestResult:
        # Write component files
        for comp in components:
            fpath = os.path.join(self._output_dir, comp.filename)
            os.makedirs(os.path.dirname(fpath), exist_ok=True)
            with open(fpath, "w") as f:
                f.write(comp.code)

        # Generate tests
        try:
            test_data = self.generate_tests(components)
        except Exception as e:
            return TestResult(passed=False, total=0, failed=1,
                              errors=[str(e)], stdout="", stderr="test generation failed")

        test_file = os.path.join(self._output_dir, test_data["test_filename"])
        os.makedirs(os.path.dirname(test_file), exist_ok=True)
        with open(test_file, "w") as f:
            f.write(test_data["test_code"])

        # Run tests
        cmd = test_data["test_command"].split()
        try:
            result = subprocess.run(
                cmd, cwd=self._output_dir,
                capture_output=True, text=True, timeout=60
            )
            passed = result.returncode == 0
            errors = [result.stderr] if result.stderr and not passed else []
            print(f"[TestAgent] {'PASS' if passed else 'FAIL'} | cmd={' '.join(cmd)}")
            return TestResult(
                passed=passed, total=len(components), failed=0 if passed else 1,
                errors=errors, stdout=result.stdout, stderr=result.stderr
            )
        except Exception as e:
            return TestResult(passed=False, total=len(components), failed=1,
                              errors=[str(e)], stdout="", stderr=str(e))


# ── Fix Agent ─────────────────────────────────────────────────────────────────

class FixAgent:
    """Auto-debug loop up to MAX_ATTEMPTS times."""

    MAX_ATTEMPTS = 3

    FIX_SYSTEM = """You are a debugging expert. Given error logs and the problematic code,
fix the code.

Return ONLY valid JSON:
{
  "fixes": [
    {
      "filename": "<filename>",
      "fixed_code": "<complete corrected file content>",
      "explanation": "<what was wrong and what you fixed>"
    }
  ],
  "confidence": <0-1>
}"""

    def __init__(self, client: Anthropic, test_agent: TestAgent):
        self._client = client
        self._test_agent = test_agent

    def fix_loop(self, components: list[GeneratedComponent],
                 test_result: TestResult) -> FixResult:
        current_components = list(components)
        current_result = test_result
        attempt = 0

        while not current_result.passed and attempt < self.MAX_ATTEMPTS:
            attempt += 1
            print(f"[FixAgent] attempt {attempt}/{self.MAX_ATTEMPTS}")
            errors = "\n".join(current_result.errors)
            stderr = current_result.stderr[:1000]
            code_map = {c.filename: c.code for c in current_components}
            prompt = (
                f"ERRORS:\n{errors}\n\nSTDERR:\n{stderr}\n\n"
                f"CODE FILES:\n{json.dumps({k: v[:600] for k, v in code_map.items()}, indent=2)}"
            )
            try:
                resp = self._client.messages.create(
                    model="claude-sonnet-4-20250514",
                    max_tokens=1500,
                    system=self.FIX_SYSTEM,
                    messages=[{"role": "user", "content": prompt}],
                )
                raw = resp.content[0].text.strip()
                if raw.startswith("```"):
                    raw = raw.split("```")[1]
                    if raw.startswith("json"):
                        raw = raw[4:]
                fix_data = json.loads(raw)
                # Apply fixes
                fix_map = {f["filename"]: f["fixed_code"] for f in fix_data["fixes"]}
                for comp in current_components:
                    if comp.filename in fix_map:
                        comp.code = fix_map[comp.filename]
                        print(f"[FixAgent] fixed {comp.filename}: "
                              f"{fix_data['fixes'][0].get('explanation', '')[:80]}")
                # Re-run tests
                current_result = self._test_agent.run(current_components)
            except Exception as e:
                print(f"[FixAgent] error on attempt {attempt}: {e}")
                break

        return FixResult(
            success=current_result.passed,
            attempts=attempt,
            fixed_components=current_components,
            remaining_errors=current_result.errors,
        )
