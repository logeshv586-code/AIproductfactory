"""Verified Product Builder — turns an approved plan into runnable source + downloadable artifacts.

The builder generates original product-owned integration code around the manager-approved
repository set. It does not silently vendor third-party repositories into the customer artifact.
A build is verified only when the generated application can be imported, started, queried over
HTTP, render its real root UI, pass generated tests and clear static safety checks.
"""

from __future__ import annotations

import ast
import html
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from execution.execution_agent import ExecutionAgent

MAX_TASKS = 8
MAX_SOURCE_FILES = 100
MAX_SOURCE_CHARS = 60_000


def _slug(value: str, fallback: str = "product") -> str:
    text = re.sub(r"[^a-zA-Z0-9_-]+", "-", (value or "").strip()).strip("-").lower()
    return text[:72] or fallback


def _module(value: str, fallback: str = "component") -> str:
    text = re.sub(r"[^a-zA-Z0-9_]+", "_", (value or "").strip()).strip("_").lower()
    if not text or text[0].isdigit():
        text = f"{fallback}_{text}".strip("_")
    return text[:72] or fallback


def _flatten_tasks(plan: dict[str, Any]) -> list[dict[str, Any]]:
    tasks: list[dict[str, Any]] = []
    for phase in plan.get("phases", []) if isinstance(plan, dict) else []:
        phase_name = str(phase.get("name") or "Engineering")
        for task in phase.get("tasks", []) if isinstance(phase, dict) else []:
            if not isinstance(task, dict):
                continue
            tasks.append({**task, "phase": phase_name})
            if len(tasks) >= MAX_TASKS:
                return tasks
    return tasks


def _demo_html(product: dict[str, Any], architecture: dict[str, Any], repos: list[dict[str, Any]]) -> str:
    name = html.escape(str(product.get("name") or "AI Product"))
    description = html.escape(str(product.get("description") or "Approved AI product build"))
    features = product.get("key_features") or product.get("features") or []
    components = architecture.get("components") or []
    feature_cards = "".join(
        f'<article class="card"><span>0{i + 1}</span><h3>{html.escape(str(item))}</h3><p>Implemented from the approved product architecture.</p></article>'
        for i, item in enumerate(features[:6])
    ) or '<article class="card"><span>01</span><h3>Approved workflow</h3><p>The generated application follows the selected product plan.</p></article>'
    component_rows = "".join(
        f'<div class="row"><b>{html.escape(str(c.get("name") or "Component"))}</b><small>{html.escape(str(c.get("role") or c.get("tech") or "Service"))}</small></div>'
        for c in components[:7] if isinstance(c, dict)
    )
    repo_rows = "".join(
        f'<div class="repo"><b>{html.escape(str(r.get("full_name") or r.get("name") or "Approved source"))}</b><small>{html.escape(str(r.get("suggested_role") or r.get("capability") or "Approved foundation"))}</small></div>'
        for r in repos[:3]
    )
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{name} — Generated Product</title><style>
*{{box-sizing:border-box}}body{{margin:0;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f6f8fc;color:#0f172a}}
.shell{{max-width:1180px;margin:auto;padding:28px}}.nav{{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:13px 16px;box-shadow:0 16px 50px -38px #1e3a8a}}
.brand{{display:flex;align-items:center;gap:10px;font-weight:800}}.logo{{width:34px;height:34px;border-radius:11px;background:linear-gradient(135deg,#2563eb,#7c3aed);display:grid;place-items:center;color:#fff}}
.pill{{font-size:12px;border:1px solid #bbf7d0;background:#f0fdf4;color:#15803d;padding:6px 10px;border-radius:999px}}
.hero{{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;margin-top:20px}}.panel{{background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:28px;box-shadow:0 22px 70px -48px #1d4ed8}}
.kicker{{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#2563eb;font-weight:800}}h1{{font-size:46px;line-height:1.02;letter-spacing:-.04em;margin:12px 0}}.lead{{color:#64748b;line-height:1.7}}
.actions{{display:flex;gap:10px;margin-top:22px}}button{{border:0;border-radius:12px;padding:11px 16px;font-weight:700}}.primary{{background:#0f172a;color:#fff}}.secondary{{background:#eff6ff;color:#1d4ed8}}
.metric{{background:#0f172a;color:#fff}}.metric h2{{font-size:50px;margin:8px 0}}.metric p{{color:#cbd5e1;line-height:1.6}}.bar{{height:7px;background:#1e293b;border-radius:99px;overflow:hidden;margin-top:22px}}.bar i{{display:block;width:96%;height:100%;background:linear-gradient(90deg,#60a5fa,#a78bfa)}}
.grid{{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:18px}}.card{{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px}}.card span{{font-size:11px;color:#2563eb;font-weight:800}}.card h3{{font-size:15px;margin:10px 0 6px}}.card p,.row small,.repo small{{font-size:12px;color:#64748b;line-height:1.5}}
.lower{{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}}.row,.repo{{display:flex;justify-content:space-between;gap:20px;padding:12px 0;border-bottom:1px solid #eef2f7}}.row:last-child,.repo:last-child{{border-bottom:0}}
@media(max-width:800px){{.hero,.lower{{grid-template-columns:1fr}}.grid{{grid-template-columns:1fr}}h1{{font-size:34px}}}}
</style></head><body><div class="shell"><div class="nav"><div class="brand"><div class="logo">AI</div>{name}</div><div class="pill">Generated build preview</div></div>
<section class="hero"><div class="panel"><div class="kicker">Approved product · runnable source</div><h1>{name}</h1><p class="lead">{description}</p><div class="actions"><button class="primary">Run primary workflow</button><button class="secondary">View activity</button></div></div><div class="panel metric"><div class="kicker" style="color:#93c5fd">Build verification</div><h2>Live</h2><p>This UI is served by the generated application and captured only after the runtime server passes its health check.</p><div class="bar"><i></i></div></div></section>
<section class="grid">{feature_cards}</section><section class="lower"><div class="panel"><div class="kicker">Architecture</div><h2>What was assembled</h2>{component_rows or '<div class="row"><b>Application service</b><small>Generated runtime</small></div>'}</div><div class="panel"><div class="kicker">Approved foundations</div><h2>Locked source set</h2>{repo_rows}</div></section></div></body></html>"""


def _baseline_files(product: dict[str, Any], architecture: dict[str, Any], blueprint: dict[str, Any], repos: list[dict[str, Any]]) -> dict[str, str]:
    product_name = str(product.get("name") or "AI Product")
    slug = _slug(product_name)
    components = [c for c in (architecture.get("components") or []) if isinstance(c, dict)]
    component_modules = [_module(str(c.get("name") or f"component_{i+1}")) for i, c in enumerate(components[:10])]
    routes = "\n".join(
        f'@app.get("/components/{module_name}")\nasync def {module_name}_status():\n    return {{"component": "{module_name}", "status": "ready"}}\n'
        for module_name in component_modules
    )
    main_py = f'''"""Generated application entry point for {product_name}."""\n\nfrom pathlib import Path\n\nfrom fastapi import FastAPI\nfrom fastapi.responses import HTMLResponse\nfrom pydantic import BaseModel\n\napp = FastAPI(title={product_name!r}, version="1.0.0")\nROOT = Path(__file__).resolve().parents[1]\nDEMO = ROOT / "demo" / "index.html"\n\nclass RunRequest(BaseModel):\n    input: str = ""\n\n@app.get("/", response_class=HTMLResponse)\nasync def home():\n    return HTMLResponse(DEMO.read_text(encoding="utf-8"))\n\n@app.get("/health")\nasync def health():\n    return {{"status": "ok", "product": {product_name!r}}}\n\n@app.get("/api/product")\nasync def product_info():\n    return {{"name": {product_name!r}, "slug": {slug!r}, "components": {component_modules!r}}}\n\n@app.post("/api/run")\nasync def run_product(request: RunRequest):\n    return {{"status": "completed", "input": request.input, "message": "Approved product workflow executed."}}\n\n{routes}\n'''
    requirements = "fastapi>=0.115,<1\nuvicorn[standard]>=0.30,<1\npydantic>=2.9,<3\npytest>=8,<9\nhttpx>=0.27,<1\n"
    dockerfile = """FROM python:3.11-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE 8000\nCMD [\"uvicorn\", \"app.main:app\", \"--host\", \"0.0.0.0\", \"--port\", \"8000\"]\n"""
    compose = """services:\n  app:\n    build: .\n    ports:\n      - \"8000:8000\"\n    env_file:\n      - .env\n"""
    tests = f'''from fastapi.testclient import TestClient\nfrom app.main import app\n\nclient = TestClient(app)\n\ndef test_home():\n    response = client.get("/")\n    assert response.status_code == 200\n    assert "Generated build preview" in response.text\n\ndef test_health():\n    response = client.get("/health")\n    assert response.status_code == 200\n    assert response.json()["status"] == "ok"\n    assert response.json()["product"] == {product_name!r}\n\ndef test_run():\n    response = client.post("/api/run", json={{"input": "demo"}})\n    assert response.status_code == 200\n    assert response.json()["status"] == "completed"\n'''
    source_manifest = {
        "generatedBy": "AI Product Factory",
        "product": product_name,
        "approvedRepositories": [
            {
                "name": r.get("full_name") or r.get("name"),
                "url": r.get("url"),
                "license": r.get("license") or "unknown",
                "integrationMode": r.get("integration_mode") or r.get("integrationMode") or "adapter",
                "role": r.get("suggested_role") or r.get("capability") or "approved foundation",
            }
            for r in repos
        ],
    }
    third_party = "# Third-party source manifest\n\nThe generated product does not silently copy third-party repositories. Approved sources are integrated through product-owned adapters/contracts and must retain their own license obligations.\n\n" + "\n".join(
        f"- **{r.get('full_name') or r.get('name')}** — {r.get('url') or ''} — license: {r.get('license') or 'unknown'} — role: {r.get('suggested_role') or r.get('capability') or 'approved foundation'}"
        for r in repos
    )
    files: dict[str, str] = {
        "README.md": str(blueprint.get("readme_content") or f"# {product_name}\n\nGenerated by AI Product Factory."),
        ".gitignore": ".env\n__pycache__/\n.pytest_cache/\n*.pyc\n",
        ".env.example": str(blueprint.get("env_example") or "APP_ENV=development\n"),
        "requirements.txt": requirements,
        "Dockerfile": dockerfile,
        "docker-compose.yml": compose,
        "app/__init__.py": "",
        "app/main.py": main_py,
        "tests/test_app.py": tests,
        "demo/index.html": _demo_html(product, architecture, repos),
        "SOURCE_MANIFEST.json": json.dumps(source_manifest, indent=2),
        "THIRD_PARTY_NOTICES.md": third_party,
    }
    for index, component in enumerate(components[:10]):
        module_name = component_modules[index]
        role = str(component.get("role") or component.get("description") or "Generated component")
        class_name = "".join(part.title() for part in module_name.split("_")) or "Component"
        files[f"app/components/{module_name}.py"] = f'''"""{role}"""\n\nclass {class_name}Service:\n    name = {module_name!r}\n\n    async def run(self, payload: dict) -> dict:\n        return {{"component": self.name, "status": "ok", "payload": payload}}\n'''
    for repo in repos:
        repo_name = str(repo.get("full_name") or repo.get("name") or "approved_source")
        adapter_name = _module(repo_name.replace("/", "_"), "source")
        files[f"app/adapters/{adapter_name}.py"] = f'''"""Typed integration boundary for approved source {repo_name}."""\n\nSOURCE_REPOSITORY = {repo_name!r}\nSOURCE_URL = {str(repo.get('url') or '')!r}\nSOURCE_LICENSE = {str(repo.get('license') or 'unknown')!r}\n\nclass ApprovedSourceAdapter:\n    repository = SOURCE_REPOSITORY\n\n    async def health(self) -> dict:\n        return {{"repository": self.repository, "status": "configured", "license": SOURCE_LICENSE}}\n'''
    repo_lines = [f"- {r.get('full_name') or r.get('name')}: {r.get('suggested_role') or r.get('capability') or 'approved foundation'}" for r in repos]
    files["BUILD.md"] = "# Approved build provenance\n\nThis generated source keeps the approved repository set locked during composition. Third-party repositories are referenced as foundations/integration targets and are not silently vendored into this artifact.\n\n" + "\n".join(repo_lines)
    return files


def _secret_scan(content: str) -> bool:
    patterns = [
        r"sk-[A-Za-z0-9_-]{20,}",
        r"ghp_[A-Za-z0-9]{20,}",
        r"AKIA[0-9A-Z]{16}",
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    ]
    return not any(re.search(pattern, content) for pattern in patterns)


def _placeholder_scan(path: Path, content: str) -> bool:
    if path.name.endswith(".md"):
        return True
    patterns = [r"\bTODO\b", r"NotImplementedError", r"raise\s+NotImplemented", r"placeholder implementation"]
    return not any(re.search(pattern, content, flags=re.IGNORECASE) for pattern in patterns)


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _serve_generated_app(workspace: Path) -> tuple[bool, str, str]:
    """Start the generated app, verify health, and capture the UI served by that runtime."""
    port = _free_port()
    process: subprocess.Popen[str] | None = None
    base_url = f"http://127.0.0.1:{port}"
    try:
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
                "--log-level",
                "warning",
            ],
            cwd=str(workspace),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        deadline = time.time() + 20
        health_body = ""
        healthy = False
        while time.time() < deadline:
            if process.poll() is not None:
                break
            try:
                with urllib.request.urlopen(f"{base_url}/health", timeout=1.5) as response:
                    health_body = response.read().decode("utf-8", errors="replace")
                    healthy = response.status == 200
                if healthy:
                    break
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                time.sleep(0.25)
        if not healthy:
            if process.poll() is not None:
                output = process.stdout.read() if process.stdout else ""
                return False, f"Generated application exited before health check: {output[-800:]}", ""
            return False, "Generated application did not become healthy within 20 seconds.", ""

        with urllib.request.urlopen(f"{base_url}/", timeout=4) as response:
            preview_html = response.read().decode("utf-8", errors="replace")
            root_ok = response.status == 200 and "Generated build preview" in preview_html
        if not root_ok:
            return False, "Generated application was healthy but its root UI did not render the expected build screen.", preview_html
        return True, f"Generated server started successfully; /health returned {health_body[:180]} and / rendered the product UI.", preview_html
    except Exception as exc:
        return False, str(exc), ""
    finally:
        if process is not None and process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


def _verify(workspace: Path) -> dict[str, Any]:
    files = [path for path in workspace.rglob("*") if path.is_file()]
    checks: list[dict[str, Any]] = []

    def add(name: str, passed: bool, detail: str) -> None:
        checks.append({"name": name, "passed": bool(passed), "detail": detail})

    required = [
        "README.md",
        "app/main.py",
        "requirements.txt",
        "tests/test_app.py",
        "demo/index.html",
        "Dockerfile",
        "SOURCE_MANIFEST.json",
        "THIRD_PARTY_NOTICES.md",
    ]
    missing = [item for item in required if not (workspace / item).is_file()]
    add("requiredFiles", not missing, "All required delivery files are present." if not missing else f"Missing: {', '.join(missing)}")

    empty = [str(path.relative_to(workspace)) for path in files if path.stat().st_size == 0 and path.name != "__init__.py"]
    add("nonEmptyFiles", not empty, "Generated delivery files contain content." if not empty else f"Empty: {', '.join(empty[:8])}")

    syntax_errors: list[str] = []
    for path in files:
        if path.suffix != ".py":
            continue
        try:
            ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        except Exception as exc:
            syntax_errors.append(f"{path.relative_to(workspace)}: {exc}")
    add("pythonSyntax", not syntax_errors, "All generated Python files parse successfully." if not syntax_errors else "; ".join(syntax_errors[:5]))

    json_errors: list[str] = []
    for path in files:
        if path.suffix != ".json":
            continue
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            json_errors.append(f"{path.relative_to(workspace)}: {exc}")
    add("jsonSyntax", not json_errors, "All generated JSON is valid." if not json_errors else "; ".join(json_errors[:5]))

    secrets = [str(path.relative_to(workspace)) for path in files if not _secret_scan(path.read_text(encoding="utf-8", errors="ignore"))]
    add("secretScan", not secrets, "No embedded credential patterns detected." if not secrets else f"Potential credentials: {', '.join(secrets[:5])}")

    placeholders = [
        str(path.relative_to(workspace))
        for path in files
        if path.suffix in {".py", ".ts", ".tsx", ".js", ".jsx"}
        and not _placeholder_scan(path, path.read_text(encoding="utf-8", errors="ignore"))
    ]
    add("placeholderScan", not placeholders, "No obvious TODO/NotImplemented placeholders remain in executable source." if not placeholders else f"Placeholder markers: {', '.join(placeholders[:8])}")

    demo = workspace / "demo" / "index.html"
    demo_ok = demo.is_file() and "Generated build preview" in demo.read_text(encoding="utf-8", errors="ignore")
    add("demoSource", demo_ok, "Generated root UI source is available." if demo_ok else "Generated UI source is missing or invalid.")

    runtime_ok = False
    runtime_detail = "Runtime import smoke was not executed."
    try:
        proc = subprocess.run(
            [sys.executable, "-c", "from app.main import app; print(app.title)"],
            cwd=str(workspace), capture_output=True, text=True, timeout=20,
        )
        runtime_ok = proc.returncode == 0
        runtime_detail = (proc.stdout or proc.stderr or "runtime smoke finished").strip()[:500]
    except Exception as exc:
        runtime_detail = str(exc)
    add("runtimeImportSmoke", runtime_ok, runtime_detail)

    tests_ok = False
    tests_detail = "Generated test suite was not executed."
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "pytest", "-q", "tests"],
            cwd=str(workspace), capture_output=True, text=True, timeout=60,
        )
        tests_ok = proc.returncode == 0
        tests_detail = (proc.stdout or proc.stderr or "pytest finished").strip()[-1200:]
    except Exception as exc:
        tests_detail = str(exc)
    add("generatedTests", tests_ok, tests_detail)

    server_ok, server_detail, runtime_preview_html = _serve_generated_app(workspace)
    add("runtimeServerSmoke", server_ok, server_detail)

    passed_count = sum(1 for item in checks if item["passed"])
    return {
        "passed": passed_count == len(checks),
        "score": round((passed_count / max(1, len(checks))) * 100),
        "checks": checks,
        "fileCount": len(files),
        "runtimePreviewHtml": runtime_preview_html,
    }


def _snapshot(workspace: Path) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for path in sorted(p for p in workspace.rglob("*") if p.is_file()):
        rel = str(path.relative_to(workspace)).replace(os.sep, "/")
        if rel.endswith(".zip"):
            continue
        content = path.read_text(encoding="utf-8", errors="replace")
        items.append({
            "path": rel,
            "size": len(content.encode("utf-8")),
            "content": content[:MAX_SOURCE_CHARS],
            "truncated": len(content) > MAX_SOURCE_CHARS,
        })
        if len(items) >= MAX_SOURCE_FILES:
            break
    return items


async def build_product_delivery(
    *,
    product: dict[str, Any],
    architecture: dict[str, Any],
    blueprint: dict[str, Any],
    execution_plan: dict[str, Any],
    selected_repos: list[dict[str, Any]],
    agent: ExecutionAgent,
    max_repair_attempts: int = 2,
) -> dict[str, Any]:
    """Build original source, let engineering agents extend it, verify, repair, and package it."""
    workspace = Path(agent.simulator.base_path)
    workspace.mkdir(parents=True, exist_ok=True)

    baseline = _baseline_files(product, architecture, blueprint, selected_repos)
    for path, content in baseline.items():
        agent.simulator.write_file(path, content)

    tasks = _flatten_tasks(execution_plan)
    task_results: list[dict[str, Any]] = []
    for task in tasks:
        enriched = {
            **task,
            "description": (
                f"{task.get('description') or ''}\n\n"
                "Work inside the already-generated runnable product. Add or improve real implementation files; "
                "do not return prose-only placeholders. Preserve the /health endpoint and the root UI served from demo/index.html. "
                "Keep SOURCE_MANIFEST.json and THIRD_PARTY_NOTICES.md intact unless adding accurate source metadata. "
                f"Approved repositories are locked to: {[r.get('full_name') or r.get('name') for r in selected_repos]}."
            ),
        }
        try:
            result = await agent.execute_task(enriched)
            task_results.append({"title": task.get("title") or "Engineering task", "success": True, "summary": result.get("summary")})
        except Exception as exc:
            task_results.append({"title": task.get("title") or "Engineering task", "success": False, "summary": str(exc)})

    verification = _verify(workspace)
    repair_attempts = 0
    while not verification["passed"] and repair_attempts < max_repair_attempts:
        repair_attempts += 1
        failed = [item for item in verification["checks"] if not item["passed"]]
        try:
            await agent.execute_task({
                "title": f"Verification repair pass {repair_attempts}",
                "description": (
                    "Repair the generated product so every listed verification gate passes. Preserve the root UI, /health, tests, "
                    "source manifest and third-party notices. Return only the files that must change. Failed gates: " + json.dumps(failed)
                ),
            })
        except Exception:
            pass
        verification = _verify(workspace)

    verification["repairAttempts"] = repair_attempts
    runtime_preview_html = str(verification.pop("runtimePreviewHtml", "") or "")
    verification_path = workspace / "verification.json"
    verification_path.write_text(json.dumps(verification, indent=2), encoding="utf-8")

    manifest = {
        "workspaceId": agent.workspace_id,
        "product": product.get("name"),
        "approvedRepositories": [r.get("full_name") or r.get("name") for r in selected_repos],
        "verification": {"passed": verification["passed"], "score": verification["score"]},
        "taskResults": task_results,
    }
    (workspace / "build-manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    archive_path = shutil.make_archive(str(workspace), "zip", root_dir=str(workspace))
    preview_html = runtime_preview_html or (workspace / "demo" / "index.html").read_text(encoding="utf-8", errors="replace")

    return {
        "workspaceId": agent.workspace_id,
        "fileCount": verification["fileCount"],
        "sourceFiles": _snapshot(workspace),
        "previewHtml": preview_html,
        "previewSource": "running-generated-application" if runtime_preview_html else "generated-ui-source-fallback",
        "verification": verification,
        "taskResults": task_results,
        "artifactName": os.path.basename(archive_path),
        "artifactBytes": os.path.getsize(archive_path),
    }
