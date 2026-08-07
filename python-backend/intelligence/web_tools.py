"""
Web Tools — structured web search (Tavily) for the Market Intelligence Engine.

The old ``webSignals`` path collected raw search results and discarded them.
This module returns clean, capped result lists that the Market Intelligence
Engine interprets into insights. When no API key is present it returns ``[]``
and engines fall back to the LLM's internal knowledge.
"""

from __future__ import annotations

import os
from typing import Any

from intelligence.http_client import request_json


async def web_search(
    query: str,
    api_key: str | None = None,
    max_results: int = 5,
) -> list[dict[str, str]]:
    """
    Search the web via Tavily.

    Returns a list of ``{"title", "url", "content"}`` (capped at ``max_results``).
    Returns ``[]`` when no API key is configured or the request fails.
    """
    key = api_key or os.environ.get("TAVILY_API_KEY", "")
    if not key:
        return []

    status, data = await request_json(
        "https://api.tavily.com/search",
        method="POST",
        json={
            "api_key": key,
            "query": query,
            "max_results": max_results,
            "include_answer": False,
            "include_raw_content": False,
        },
        timeout=25.0,
    )
    if status != 200 or not isinstance(data, dict):
        return []

    results = data.get("results", [])
    if not isinstance(results, list):
        return []

    out: list[dict[str, str]] = []
    for r in results[:max_results]:
        if not isinstance(r, dict):
            continue
        out.append(
            {
                "title": str(r.get("title", ""))[:300],
                "url": str(r.get("url", ""))[:500],
                "content": str(r.get("content", ""))[:1200],
            }
        )
    return out


async def multi_search(
    queries: list[str],
    api_key: str | None = None,
    per_query: int = 4,
) -> list[dict[str, str]]:
    """Run several web searches in parallel and flatten results."""
    import asyncio

    if not queries:
        return []
    results = await asyncio.gather(
        *(web_search(q, api_key=api_key, max_results=per_query) for q in queries)
    )
    flattened: list[dict[str, str]] = []
    for r in results:
        flattened.extend(r or [])
    return flattened
