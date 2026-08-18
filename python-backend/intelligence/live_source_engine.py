"""Live Source Intelligence — current open-source, developer, and research signals.

The Product Factory already has capability-level GitHub discovery and Tavily market
search. This engine broadens evidence with stable public sources that are useful
for product creation: GitLab, Hugging Face, Hacker News, Stack Overflow and arXiv.
All network failures degrade to partial results; they never break strategize().
"""

from __future__ import annotations

import asyncio
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote_plus

from intelligence.http_client import fetch_text, request_json
from intelligence.prompt_utils import as_list, as_str

SOURCE_CATALOG = [
    {"id": "github", "name": "GitHub", "purpose": "source repositories, releases, issues, activity", "mode": "core"},
    {"id": "gitlab", "name": "GitLab", "purpose": "public source projects outside GitHub", "mode": "live"},
    {"id": "huggingface", "name": "Hugging Face", "purpose": "open models, datasets and runnable Spaces", "mode": "live"},
    {"id": "depsdev", "name": "deps.dev / OpenSSF", "purpose": "project health, package mapping, license and security scorecard", "mode": "core"},
    {"id": "osv", "name": "OSV", "purpose": "open-source vulnerability evidence", "mode": "on_demand"},
    {"id": "hackernews", "name": "Hacker News", "purpose": "near-real-time developer interest and launches", "mode": "live"},
    {"id": "stackoverflow", "name": "Stack Overflow", "purpose": "developer pain points and implementation questions", "mode": "live"},
    {"id": "arxiv", "name": "arXiv", "purpose": "recent technical research and methods", "mode": "live"},
    {"id": "dockerhub", "name": "Docker Hub", "purpose": "container availability and deployment assets", "mode": "on_demand"},
    {"id": "pypi", "name": "PyPI", "purpose": "Python package release metadata", "mode": "on_demand"},
    {"id": "npm", "name": "npm", "purpose": "JavaScript package ecosystem metadata", "mode": "on_demand"},
    {"id": "tavily", "name": "Broad web research", "purpose": "competitors, pricing, news and product pages", "mode": "configured"},
]


def _query(intent: dict[str, Any]) -> str:
    idea = as_str(intent.get("idea")) or as_str(intent.get("summary")) or as_str(intent.get("domain")) or "software"
    keywords = [as_str(k) for k in as_list(intent.get("search_keywords")) if as_str(k)]
    if keywords:
        return " ".join(keywords[:4])[:160]
    return " ".join(idea.split()[:8])[:160]


def _terms(query: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9+#.]{3,}", query.lower()) if w not in {"with", "from", "that", "this", "software", "product"}}


def _relevance(query: str, text: str) -> float:
    wanted = _terms(query)
    if not wanted:
        return 0.5
    lowered = text.lower()
    hits = sum(1 for term in wanted if term in lowered)
    return round(min(1.0, 0.25 + 0.75 * hits / len(wanted)), 3)


def _signal(source: str, kind: str, title: str, url: str, summary: str, query: str, *, published: str = "", metrics: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "source": source,
        "kind": kind,
        "title": title[:240],
        "url": url[:700],
        "summary": summary[:900],
        "published_at": published,
        "relevance": _relevance(query, f"{title} {summary}"),
        "metrics": metrics or {},
    }


async def _gitlab(query: str) -> list[dict[str, Any]]:
    status, data = await request_json(
        "https://gitlab.com/api/v4/projects",
        params={"search": query, "visibility": "public", "simple": "true", "order_by": "star_count", "sort": "desc", "per_page": 6},
        timeout=16.0,
    )
    if status != 200 or not isinstance(data, list):
        return []
    out = []
    for item in data[:6]:
        if not isinstance(item, dict):
            continue
        out.append(_signal(
            "GitLab", "repository", as_str(item.get("name_with_namespace")) or as_str(item.get("name")),
            as_str(item.get("web_url")), as_str(item.get("description")), query,
            published=as_str(item.get("last_activity_at")),
            metrics={"stars": int(item.get("star_count", 0) or 0), "forks": int(item.get("forks_count", 0) or 0)},
        ))
    return out


async def _huggingface(query: str, kind: str) -> list[dict[str, Any]]:
    path = {"model": "models", "dataset": "datasets", "space": "spaces"}[kind]
    status, data = await request_json(
        f"https://huggingface.co/api/{path}",
        params={"search": query, "sort": "downloads", "direction": "-1", "limit": 5},
        timeout=16.0,
    )
    if status != 200 or not isinstance(data, list):
        return []
    out = []
    for item in data[:5]:
        if not isinstance(item, dict):
            continue
        repo_id = as_str(item.get("modelId")) or as_str(item.get("id"))
        if not repo_id:
            continue
        prefix = "" if kind == "model" else f"{path}/"
        tags = ", ".join(as_list(item.get("tags"))[:8])
        out.append(_signal(
            "Hugging Face", kind, repo_id, f"https://huggingface.co/{prefix}{repo_id}",
            tags or f"Open {kind} on Hugging Face", query,
            published=as_str(item.get("lastModified")),
            metrics={"downloads": int(item.get("downloads", 0) or 0), "likes": int(item.get("likes", 0) or 0)},
        ))
    return out


async def _hacker_news(query: str) -> list[dict[str, Any]]:
    status, ids = await request_json("https://hacker-news.firebaseio.com/v0/newstories.json", timeout=12.0)
    if status != 200 or not isinstance(ids, list):
        return []
    results = await asyncio.gather(*[
        request_json(f"https://hacker-news.firebaseio.com/v0/item/{item_id}.json", timeout=10.0)
        for item_id in ids[:28]
    ])
    ranked: list[dict[str, Any]] = []
    for _, item in results:
        if not isinstance(item, dict) or item.get("type") != "story":
            continue
        title = as_str(item.get("title"))
        url = as_str(item.get("url")) or f"https://news.ycombinator.com/item?id={item.get('id')}"
        relevance = _relevance(query, title)
        if relevance < 0.38:
            continue
        signal = _signal(
            "Hacker News", "developer-news", title, url,
            f"HN score {int(item.get('score', 0) or 0)} · {int(item.get('descendants', 0) or 0)} comments", query,
            published=datetime.fromtimestamp(int(item.get("time", 0) or 0), tz=timezone.utc).isoformat() if item.get("time") else "",
            metrics={"score": int(item.get("score", 0) or 0), "comments": int(item.get("descendants", 0) or 0)},
        )
        ranked.append(signal)
    return sorted(ranked, key=lambda s: (s["relevance"], s["metrics"].get("score", 0)), reverse=True)[:6]


async def _stackoverflow(query: str) -> list[dict[str, Any]]:
    status, data = await request_json(
        "https://api.stackexchange.com/2.3/search/advanced",
        params={"site": "stackoverflow", "order": "desc", "sort": "activity", "q": query, "pagesize": 7},
        timeout=16.0,
    )
    if status != 200 or not isinstance(data, dict):
        return []
    out = []
    for item in as_list(data.get("items"))[:7]:
        if not isinstance(item, dict):
            continue
        title = re.sub(r"<[^>]+>", "", as_str(item.get("title")))
        out.append(_signal(
            "Stack Overflow", "developer-question", title, as_str(item.get("link")),
            f"{int(item.get('answer_count', 0) or 0)} answers · score {int(item.get('score', 0) or 0)}", query,
            published=datetime.fromtimestamp(int(item.get("last_activity_date", 0) or 0), tz=timezone.utc).isoformat() if item.get("last_activity_date") else "",
            metrics={"answers": int(item.get("answer_count", 0) or 0), "score": int(item.get("score", 0) or 0), "views": int(item.get("view_count", 0) or 0)},
        ))
    return out


async def _arxiv(query: str) -> list[dict[str, Any]]:
    text = await fetch_text(
        "https://export.arxiv.org/api/query",
        params={"search_query": f"all:{quote_plus(query)}", "start": 0, "max_results": 6, "sortBy": "submittedDate", "sortOrder": "descending"},
        timeout=18.0,
    )
    if not text:
        return []
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return []
    ns = {"a": "http://www.w3.org/2005/Atom"}
    out = []
    for entry in root.findall("a:entry", ns)[:6]:
        title = " ".join((entry.findtext("a:title", default="", namespaces=ns) or "").split())
        summary = " ".join((entry.findtext("a:summary", default="", namespaces=ns) or "").split())
        url = entry.findtext("a:id", default="", namespaces=ns) or ""
        published = entry.findtext("a:published", default="", namespaces=ns) or ""
        out.append(_signal("arXiv", "research-paper", title, url, summary, query, published=published))
    return out


async def research_live_sources(intent: dict[str, Any]) -> dict[str, Any]:
    query = _query(intent)
    started = time.time()
    groups = await asyncio.gather(
        _gitlab(query),
        _huggingface(query, "model"),
        _huggingface(query, "dataset"),
        _huggingface(query, "space"),
        _hacker_news(query),
        _stackoverflow(query),
        _arxiv(query),
        return_exceptions=True,
    )
    signals: list[dict[str, Any]] = []
    for group in groups:
        if isinstance(group, list):
            signals.extend(group)
    signals.sort(key=lambda item: (float(item.get("relevance", 0)), str(item.get("published_at", ""))), reverse=True)
    source_counts: dict[str, int] = {}
    for item in signals:
        source = as_str(item.get("source")) or "unknown"
        source_counts[source] = source_counts.get(source, 0) + 1
    return {
        "query": query,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "elapsed_ms": round((time.time() - started) * 1000),
        "source_catalog": SOURCE_CATALOG,
        "signals": signals[:36],
        "summary": {
            "signal_count": len(signals),
            "sources_with_results": len(source_counts),
            "source_counts": source_counts,
            "top_signal": signals[0] if signals else None,
        },
        "note": "Live source evidence is time-sensitive and may be partial when a public API is unavailable or rate-limited.",
    }
