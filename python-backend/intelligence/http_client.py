"""
HTTP Client — thin async wrapper around httpx.

Every network call in the Product Intelligence engines goes through here so
that failures are contained: engines never see exceptions, only (status, data).
"""

from __future__ import annotations

from typing import Any

import httpx


async def request_json(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    params: dict[str, Any] | None = None,
    method: str = "GET",
    json: Any = None,
    timeout: float = 20.0,
) -> tuple[int, Any | None]:
    """
    Perform a JSON HTTP request.

    Returns a tuple ``(status_code, data)``.
    On any failure (network error, 4xx/5xx, bad JSON) returns ``(0, None)`` or
    ``(status, None)`` — callers should never need a try/except.
    """
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.request(
                method, url, headers=headers, params=params, json=json
            )
            if resp.status_code >= 400:
                return resp.status_code, None
            try:
                return resp.status_code, resp.json()
            except Exception:
                return resp.status_code, None
    except Exception:
        return 0, None


async def fetch_text(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    params: dict[str, Any] | None = None,
    timeout: float = 20.0,
) -> str:
    """Fetch a URL and return its text body ('' on any failure)."""
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code >= 400:
                return ""
            return resp.text
    except Exception:
        return ""
