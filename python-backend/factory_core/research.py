"""Bounded retrieval with provenance. Retrieved code is data, never instructions."""
from __future__ import annotations

import asyncio
import base64
import hashlib
import os
import re
from datetime import datetime, timezone
from urllib.parse import quote

from factory_core.models import Brief, Evidence, Source
from intelligence.http_client import request_json, fetch_text
from intelligence.live_source_engine import research_live_sources

DOCS = {
    "web": "https://react.dev/learn/thinking-in-react",
    "desktop": "https://www.electronjs.org/docs/latest/tutorial/security",
    "automation": "https://playwright.dev/python/docs/locators",
}


async def inspect_repository(name: str) -> tuple[list[Evidence], Source | None]:
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", name):
        return [], None
    headers = {"Accept": "application/vnd.github+json"}
    if os.environ.get("GITHUB_TOKEN"):
        headers["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"
    api = f"https://api.github.com/repos/{name}"
    now = datetime.now(timezone.utc).isoformat()
    prefix = "ev_" + hashlib.sha256(name.encode()).hexdigest()[:12]
    status, repo = await request_json(api, headers=headers, timeout=10)
    if status != 200 or not isinstance(repo, dict):
        return [Evidence(id=prefix, url=f"https://github.com/{name}", claim="Repository could not be inspected", retrieved_at=now, status="unavailable", source_type="repository", limitation=f"HTTP {status}")], None
    branch = quote(str(repo.get("default_branch") or "HEAD"), safe="")
    status, commit = await request_json(f"{api}/commits/{branch}", headers=headers, timeout=10)
    sha = commit.get("sha", "") if status == 200 and isinstance(commit, dict) else ""
    if not re.fullmatch(r"[a-f0-9]{40}", sha):
        return [Evidence(id=prefix, url=repo["html_url"], claim="Commit revision unavailable", retrieved_at=now, status="unavailable", source_type="repository")], None
    _, readme = await request_json(f"{api}/readme", headers=headers, params={"ref": sha}, timeout=10)
    _, tree = await request_json(f"{api}/git/trees/{sha}", headers=headers, params={"recursive": "1"}, timeout=10)
    paths = [i.get("path", "") for i in (tree.get("tree", []) if isinstance(tree, dict) else []) if isinstance(i, dict) and i.get("type") == "blob"]
    sample = next((p for p in paths if p.endswith((".py", ".ts", ".tsx", ".rs")) and not any(x in p for x in ["test", "example", "vendor", "lock"])), None)
    samples = [("readme", readme)]
    if sample:
        _, code = await request_json(f"{api}/contents/{quote(sample, safe='/')}", headers=headers, params={"ref": sha}, timeout=10)
        samples.append((sample, code))
    evidence = []
    for index, (path, item) in enumerate(samples):
        if not isinstance(item, dict) or not item.get("content") or item.get("encoding") != "base64":
            continue
        try:
            raw = base64.b64decode(item["content"])
            content = raw.decode("utf-8", errors="replace")
        except (ValueError, TypeError):
            continue
        actual = item.get("path") or path
        evidence.append(Evidence(id=f"{prefix}_{index}", url=f"https://github.com/{name}/blob/{sha}/{actual}", claim=f"Inspected {actual} at pinned revision; capability claims require matching code evidence", retrieved_at=now, revision=sha, content_hash=hashlib.sha256(raw).hexdigest(), excerpt=content[:12000], status="retrieved", source_type="repository", limitation="Representative source sample; not an integration test or exhaustive audit"))
    license_id = (repo.get("license") or {}).get("spdx_id") or "unknown"
    source = None
    if len(evidence) >= 2 and license_id.lower() not in {"unknown", "none", "noassertion"}:
        source = Source(name=name, url=f"https://github.com/{name}", revision=sha, license=license_id, evidence_ids=[e.id for e in evidence])
    return evidence, source


async def research(brief: Brief, intent: dict, fixture: bool = False) -> dict:
    if brief.privacy == "local_only" or fixture:
        return {"evidence": [], "sources": [], "limitations": ["External research disabled for local-only privacy or deterministic fixture mode. Market and source claims remain unverified."]}
    keywords = [str(x) for x in intent.get("search_keywords", []) if isinstance(x, str)][:3]
    query = " ".join(keywords)[:160] or brief.idea[:120]
    headers = {"Accept": "application/vnd.github+json"}
    if os.environ.get("GITHUB_TOKEN"):
        headers["Authorization"] = f"Bearer {os.environ['GITHUB_TOKEN']}"
    (status, results), docs, signals = await asyncio.gather(
        request_json("https://api.github.com/search/repositories", headers=headers, params={"q": query, "per_page": 4}, timeout=12),
        fetch_text(DOCS[brief.platform], timeout=12),
        research_live_sources(intent),
    )
    names = [r["full_name"] for r in (results.get("items", []) if isinstance(results, dict) else []) if isinstance(r, dict) and r.get("full_name")][:4]
    inspections = await asyncio.gather(*(inspect_repository(name) for name in names))
    evidence = [e for ev, _ in inspections for e in ev]
    sources = [source for _, source in inspections if source]
    now = datetime.now(timezone.utc).isoformat()
    if docs:
        # A bounded excerpt is reasoning context; the content digest records the full fetch.
        clean = re.sub(r"<[^>]+>", " ", docs)
        evidence.append(Evidence(id="ev_docs", url=DOCS[brief.platform], claim="Official platform implementation guidance", retrieved_at=now, content_hash=hashlib.sha256(docs.encode()).hexdigest(), excerpt=re.sub(r"\s+", " ", clean)[:10000], status="retrieved", source_type="documentation", limitation="Documentation is not proof of a generated implementation"))
    for i, signal in enumerate(signals.get("signals", [])[:10]):
        evidence.append(Evidence(id=f"ev_signal_{i}", url=signal.get("url", ""), claim=signal.get("title", "External discovery signal"), retrieved_at=now, excerpt=str(signal.get("summary", ""))[:4000], status="retrieved", source_type="paper" if "arxiv" in str(signal.get("source", "")).lower() else "market", limitation="Discovery metadata only; not inspected implementation or validated market demand"))
    limitations = ["Bounded search of at most four repositories and selected external sources; no claim of exhaustive research or global novelty."]
    if not sources:
        limitations.append("No repository met revision, source-sample and license evidence requirements. Prefer original implementation or explicitly block an essential unsupported dependency.")
    if status != 200:
        limitations.append(f"Repository discovery unavailable (HTTP {status}).")
    return {"evidence": [e.model_dump() for e in evidence], "sources": [s.model_dump() for s in sources], "limitations": limitations}
