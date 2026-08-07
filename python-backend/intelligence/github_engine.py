"""
GitHub Intelligence — per-capability repository discovery and weighted ranking.

For every capability in the capability graph this engine runs its own targeted
GitHub repository search (never one generic query), scores each candidate with
an 11-axis weighted formula (stars never dominate), and produces both a deduped
repo index and per-capability mappings. All scoring is deterministic code — the
LLM is never used here. Degrades to empty result sets on rate limits or network
failure without raising.
"""

from __future__ import annotations

import math
import time
from typing import Any

from intelligence.http_client import request_json
from intelligence.prompt_utils import as_list, as_str

GITHUB_API = "https://api.github.com"
MAX_SEARCHES = 10
PER_PAGE = 5

# Exact weights from PI_CONTRACT (Engine 6). Sum = 1.00.
WEIGHTS: dict[str, float] = {
    "intent_match": 0.20,
    "capability_coverage": 0.15,
    "stars": 0.10,
    "maintenance": 0.10,
    "contributors": 0.10,
    "issue_resolution": 0.08,
    "license": 0.08,
    "documentation": 0.07,
    "security": 0.05,
    "api_quality": 0.04,
    "extensibility": 0.03,
}

_PERMISSIVE_LICENSES = {"mit", "apache-2.0", "bsd-2-clause", "bsd-3-clause"}
_SECURITY_TERMS = {"auth", "sso", "oauth", "security", "encryption", "jwt", "rate limit", "2fa"}
_API_TERMS = {"api", "sdk", "client", "rest", "graphql"}
_EXTENSIBILITY_TERMS = {"plugin", "extension", "middleware", "sdk", "api", "modular"}
_STOPWORDS = {
    "the", "and", "for", "of", "in", "on", "with", "a", "an", "to", "using",
    "engine", "system", "platform", "tool", "library", "app", "application",
}


def _headers(token: str | None) -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "AI-Product-Factory/1.0",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _query_for(capability: dict[str, Any]) -> str:
    """Build a targeted search query: capability name + 1-2 technologies."""
    name = as_str(capability.get("name")) or "software"
    techs = as_list(capability.get("technologies"))
    parts = [w for w in name.split() if w.lower() not in _STOPWORDS]
    if not parts:
        parts = [name]
    # cap the query so GitHub doesn't mangle it
    query = " ".join(parts[:2] + techs[:1])
    return query[:120]


def _capability_terms(capability: dict[str, Any]) -> tuple[list[str], list[str]]:
    name = as_str(capability.get("name")) or ""
    name_terms = [w.lower() for w in name.split() if w.lower() not in _STOPWORDS]
    if not name_terms:
        name_terms = [name.lower()]
    tech_terms = [t.lower() for t in as_list(capability.get("technologies"))]
    return name_terms, tech_terms


def _overlap(terms: list[str], text: str) -> float:
    if not terms:
        return 0.5
    lowered = text.lower()
    matches = sum(1 for t in terms if t in lowered)
    return matches / len(terms)


def _axis_intent(name_terms: list[str], tech_terms: list[str], repo: dict[str, Any]) -> float:
    text = " ".join(
        [
            as_str(repo.get("full_name")),
            as_str(repo.get("description")),
            " ".join(as_list(repo.get("topics"))),
        ]
    )
    return min(1.0, 0.1 + 0.9 * _overlap(name_terms + tech_terms, text))


def _axis_coverage(name_terms: list[str], tech_terms: list[str], repo: dict[str, Any]) -> float:
    # name terms count double — biased toward the capability name
    weighted = name_terms + name_terms + tech_terms
    text = " ".join(
        [
            as_str(repo.get("full_name")),
            as_str(repo.get("description")),
            " ".join(as_list(repo.get("topics"))),
        ]
    )
    return min(1.0, _overlap(weighted, text))


def _axis_stars(stars: int) -> float:
    return min(1.0, math.log10(stars + 1) / 6.0)


def _days_since_pushed(pushed_at: str) -> float | None:
    try:
        struct = time.strptime(pushed_at, "%Y-%m-%dT%H:%M:%SZ")
        pushed_ts = time.mktime(struct)
        return max(0.0, (time.time() - pushed_ts) / 86400.0)
    except Exception:
        return None


def _axis_maintenance(days: float | None) -> float:
    if days is None:
        return 0.5
    if days >= 365:
        return 0.2
    if days >= 180:
        return 0.5
    if days >= 90:
        return 0.7
    if days >= 30:
        return 0.85
    return 1.0


def _axis_contributors(stars: int) -> float:
    # contributor fetch is skipped (http_client does not surface Link headers),
    # so use the documented stars-based proxy
    return min(1.0, math.log10(stars + 1) / 5.0)


def _axis_issue_resolution(stars: int, open_issues: int) -> float:
    if open_issues <= 0:
        return 0.9
    ratio = min(1.0, (stars + 1) / open_issues / 8.0)
    return min(1.0, 0.5 + ratio / 2.0)


def _axis_license(spdx_id: str | None) -> float:
    if not spdx_id:
        return 0.2
    if spdx_id.lower() in _PERMISSIVE_LICENSES:
        return 1.0
    return 0.5


def _axis_documentation(description: str) -> float:
    score = 0.5
    word_count = len(as_str(description).split())
    if word_count >= 25:
        score += 0.3
    if word_count >= 60:
        score += 0.5
    return min(1.0, score)


def _term_hits(terms: set[str], repo: dict[str, Any]) -> int:
    text = " ".join(
        [
            as_str(repo.get("description")),
            " ".join(as_list(repo.get("topics"))),
        ]
    ).lower()
    return sum(1 for t in terms if t in text)


def _axis_security(repo: dict[str, Any]) -> float:
    return 0.5 + (0.5 if _term_hits(_SECURITY_TERMS, repo) > 0 else 0.0)


def _axis_api_quality(repo: dict[str, Any]) -> float:
    return 0.5 + (0.5 if _term_hits(_API_TERMS, repo) > 0 else 0.0)


def _axis_extensibility(repo: dict[str, Any]) -> float:
    return 0.4 + (0.6 if _term_hits(_EXTENSIBILITY_TERMS, repo) > 0 else 0.0)


def _score_repo(repo: dict[str, Any], capability: dict[str, Any]) -> dict[str, Any]:
    name_terms, tech_terms = _capability_terms(capability)
    stars = int(repo.get("stargazers_count", 0) or 0)
    open_issues = int(repo.get("open_issues_count", 0) or 0)
    pushed_at = as_str(repo.get("pushed_at"))
    description = as_str(repo.get("description"))
    spdx_id = None
    lic = repo.get("license")
    if isinstance(lic, dict):
        spdx_id = lic.get("spdx_id") or lic.get("key")

    scores: dict[str, float] = {
        "intent_match": _axis_intent(name_terms, tech_terms, repo),
        "capability_coverage": _axis_coverage(name_terms, tech_terms, repo),
        "stars": _axis_stars(stars),
        "maintenance": _axis_maintenance(_days_since_pushed(pushed_at)),
        "contributors": _axis_contributors(stars),
        "issue_resolution": _axis_issue_resolution(stars, open_issues),
        "license": _axis_license(spdx_id),
        "documentation": _axis_documentation(description),
        "security": _axis_security(repo),
        "api_quality": _axis_api_quality(repo),
        "extensibility": _axis_extensibility(repo),
    }
    weighted = sum(WEIGHTS[k] * scores[k] for k in WEIGHTS)

    reasons = _reasons(scores, capability, repo, stars, pushed_at, spdx_id)
    return {
        "full_name": as_str(repo.get("full_name")),
        "html_url": as_str(repo.get("html_url")) or f"https://github.com/{repo.get('full_name', '')}",
        "description": description,
        "language": as_str(repo.get("language")),
        "stars": stars,
        "forks": int(repo.get("forks_count", 0) or 0),
        "open_issues": open_issues,
        "license": spdx_id or "none",
        "pushed_at": pushed_at,
        "topics": as_list(repo.get("topics")),
        "contributors_count": 0,
        "weighted_score": round(weighted, 4),
        "rank": 0,
        "scores": {k: round(v, 4) for k, v in scores.items()},
        "reasons": reasons,
    }


def _reasons(
    scores: dict[str, float],
    capability: dict[str, Any],
    repo: dict[str, Any],
    stars: int,
    pushed_at: str,
    spdx_id: str | None,
) -> list[str]:
    out: list[str] = []
    if scores["intent_match"] >= 0.5:
        out.append(f"Strong match for '{as_str(capability.get('name'))}'")
    if stars >= 1000:
        out.append(f"Popular ({stars:,} stars)")
    days = _days_since_pushed(pushed_at)
    if days is not None and days < 90:
        out.append(f"Actively maintained (pushed {int(days)}d ago)")
    if spdx_id and spdx_id.lower() in _PERMISSIVE_LICENSES:
        out.append(f"{spdx_id} license")
    if scores["api_quality"] >= 0.8:
        out.append("Exposes a clean API/SDK")
    if not out:
        out.append("Weighted score ranks capability fit over raw stars")
    return out[:4]


async def _search_repos(query: str, token: str | None) -> tuple[int, list[dict[str, Any]]]:
    status, data = await request_json(
        f"{GITHUB_API}/search/repositories",
        headers=_headers(token),
        params={"q": query, "sort": "stars", "order": "desc", "per_page": PER_PAGE},
        timeout=20.0,
    )
    if status != 200 or not isinstance(data, dict):
        return status, []
    items = data.get("items", [])
    return status, [i for i in items if isinstance(i, dict)]


async def discover_repos_and_mappings(
    capabilities: dict[str, Any],
    intent: dict[str, Any],
    github_token: str | None = None,
) -> dict[str, Any]:
    """
    Per-capability GitHub discovery + weighted ranking.

    Returns a dict with keys ``repos`` and ``capability_mappings`` (plus a
    ``note`` when discovery was partial). Never raises.
    """
    token = github_token or None
    cap_list = as_list(capabilities.get("capabilities"))
    cap_list = cap_list[:MAX_SEARCHES]

    repos_by_name: dict[str, dict[str, Any]] = {}
    mappings: list[dict[str, Any]] = []
    partial_note: str | None = None

    for capability in cap_list:
        query = _query_for(capability)
        status, items = await _search_repos(query, token)
        if status in (403, 0):
            partial_note = partial_note or (
                "GitHub discovery partial: rate limited or network unavailable after "
                f"{len(mappings)}/{len(cap_list)} capabilities"
            )
            break
        if not items:
            continue

        candidates: list[dict[str, Any]] = []
        for item in items:
            scored = _score_repo(item, capability)
            name = scored["full_name"]
            if not name:
                continue
            if name not in repos_by_name:
                repos_by_name[name] = scored
            # keep the best weighted_score for this capability's ranking
            candidates.append(repos_by_name[name])

        candidates.sort(key=lambda c: c["weighted_score"], reverse=True)
        best = candidates[0] if candidates else None
        if not best:
            continue

        confidence = min(1.0, best["weighted_score"] * 0.8 + 0.2) if len(candidates) >= 3 else min(1.0, best["weighted_score"] * 0.6)
        mappings.append(
            {
                "capability_id": as_str(capability.get("id")) or "",
                "capability_name": as_str(capability.get("name")) or "",
                "candidates": [
                    {"full_name": c["full_name"], "stars": c["stars"], "weighted_score": c["weighted_score"]}
                    for c in candidates[:3]
                ],
                "selected": best["full_name"],
                "coverage_score": best["weighted_score"],
                "confidence": round(confidence, 4),
                "alternatives": [c["full_name"] for c in candidates[1:3]],
            }
        )

    # Assign global ranks by weighted_score.
    repos = list(repos_by_name.values())
    repos.sort(key=lambda r: r["weighted_score"], reverse=True)
    for i, repo in enumerate(repos, start=1):
        repo["rank"] = i

    result: dict[str, Any] = {
        "repos": repos,
        "capability_mappings": mappings,
    }
    if partial_note:
        result["note"] = partial_note
    elif not repos:
        result["note"] = "GitHub discovery unavailable"
    return result
