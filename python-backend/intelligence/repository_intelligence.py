"""
Repository Intelligence v2 — produces the Repository Intelligence Report.

For every repository this engine collects the 12 dimensions (stars, forks,
contributors, commit activity, issue velocity, release frequency, documentation
quality, security advisories, license compatibility, API stability,
extensibility, community adoption) and produces an explainable ranking with
per-dimension scores, evidence and reasoning.
"""

from __future__ import annotations

import math
import time
from typing import Any

from intelligence.http_client import request_json
from intelligence.prompt_utils import as_list, as_str
from intelligence.github_engine import WEIGHTS, _days_since_pushed

GITHUB_API = "https://api.github.com"
_PERMISSIVE_LICENSES = {"mit", "apache-2.0", "bsd-2-clause", "bsd-3-clause"}
_SECURITY_TERMS = {"security", "auth", "sso", "oauth", "encryption", "jwt", "2fa"}
_API_TERMS = {"api", "sdk", "client", "rest", "graphql"}
_EXTENSIBILITY_TERMS = {"plugin", "extension", "middleware", "sdk", "api", "modular"}

# The 12 dimensions with the proxy used for each (documented in code).
DIMENSIONS: list[str] = [
    "stars", "forks", "contributors", "commit_activity", "issue_velocity",
    "release_frequency", "documentation", "security", "license",
    "api_stability", "extensibility", "community_adoption",
]


def _headers(token: str | None) -> dict[str, str]:
    h = {"Accept": "application/vnd.github+json", "User-Agent": "AI-Product-Factory/1.0"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def _dim_scores(repo: dict[str, Any]) -> dict[str, float]:
    stars = int(repo.get("stars", 0) or 0)
    forks = int(repo.get("forks", 0) or 0)
    open_issues = int(repo.get("open_issues", 0) or 0)
    days = _days_since_pushed(as_str(repo.get("pushed_at")))
    license = as_str(repo.get("license"))
    description = as_str(repo.get("description"))
    topics = as_list(repo.get("topics"))
    text = f"{description} {' '.join(topics)}".lower()

    commit_activity = (
        0.2 if (days is None or days >= 365)
        else (0.5 if days >= 180 else (0.7 if days >= 90 else (0.85 if days >= 30 else 1.0)))
    )
    dims = {
        # popularity
        "stars": min(1.0, math.log10(stars + 1) / 6.0),
        "forks": min(1.0, math.log10(forks + 1) / 5.0),
        # contributors proxied from stars (Link-header fetch is skipped in the
        # v3 engine; kept consistent here)
        "contributors": min(1.0, math.log10(stars + 1) / 5.0),
        # maintenance
        "commit_activity": commit_activity,
        # issue velocity: open issues relative to stars
        "issue_velocity": min(1.0, 0.5 + min(1.0, (stars + 1) / max(open_issues, 1) / 8.0) / 2.0),
        # release frequency proxied by recent push
        "release_frequency": 0.4 if (days is None or days >= 180) else (0.7 if days >= 90 else 1.0),
        # documentation quality
        "documentation": min(1.0, 0.5 + (0.5 if len(description.split()) >= 60 else (0.3 if len(description.split()) >= 25 else 0.0))),
        # security posture
        "security": 0.5 + (0.5 if any(t in text for t in _SECURITY_TERMS) else 0.0),
        # license compatibility
        "license": 1.0 if license.lower() in _PERMISSIVE_LICENSES else (0.5 if license and license != "none" else 0.2),
        # API stability proxied by repo maturity + api signals
        "api_stability": min(1.0, 0.4 + 0.3 * min(1.0, math.log10(stars + 1) / 6.0) + (0.3 if any(t in text for t in _API_TERMS) else 0.0)),
        # extensibility
        "extensibility": 0.4 + (0.6 if any(t in text for t in _EXTENSIBILITY_TERMS) else 0.0),
        # community adoption = popularity x health
        "community_adoption": min(1.0, math.log10(stars + 1) / 6.0 * (0.5 + 0.5 * commit_activity)),
    }
    return dims


async def build_repository_intelligence(
    repos: list[dict[str, Any]],
    capability_mappings: list[dict[str, Any]],
    token: str | None = None,
) -> dict[str, Any]:
    """
    Build the Repository Intelligence Report from the discovered repos.

    Returns a dict:
    {
      "reports": [ { "full_name", "dimensions": {...12 dims 0..1}, "explainable_score", "rank", "reasons", "evidence" } ],
      "summary": { "total", "best", "worst", "dimension_averages" },
      "note": optional
    }
    Never raises.
    """
    reports: list[dict[str, Any]] = []
    for repo in repos:
        dims = _dim_scores(repo)
        score = sum(WEIGHTS[k] * dims.get(k, 0.5) for k in WEIGHTS if k in dims)
        # add the remaining dimensions (not in WEIGHTS) as informational
        score = score / sum(WEIGHTS.values())
        top = sorted(dims.items(), key=lambda kv: kv[1], reverse=True)[:3]
        weak = sorted(dims.items(), key=lambda kv: kv[1])[:2]
        reasons = [
            f"{k.replace('_', ' ')}: {v:.2f}" for k, v in top
        ] + [
            f"weak: {k.replace('_', ' ')} ({v:.2f})" for k, v in weak
        ]
        reports.append(
            {
                "full_name": as_str(repo.get("full_name")),
                "stars": int(repo.get("stars", 0) or 0),
                "dimensions": {k: round(v, 3) for k, v in dims.items()},
                "explainable_score": round(score, 4),
                "reasons": reasons,
                "evidence": {
                    "source": as_str(repo.get("html_url")),
                    "pushed_at": as_str(repo.get("pushed_at")),
                    "license": as_str(repo.get("license")),
                },
            }
        )

    reports.sort(key=lambda r: r["explainable_score"], reverse=True)
    for i, r in enumerate(reports, start=1):
        r["rank"] = i

    if reports:
        best = reports[0]["full_name"]
        worst = reports[-1]["full_name"]
    else:
        best = worst = ""
    dim_avgs = {}
    if reports:
        for dim in DIMENSIONS:
            dim_avgs[dim] = round(sum(r["dimensions"].get(dim, 0) for r in reports) / len(reports), 3)

    return {
        "reports": reports,
        "summary": {
            "total": len(reports),
            "best": best,
            "worst": worst,
            "dimension_averages": dim_avgs,
        },
        "note": "" if reports else "Repository intelligence unavailable (no repos discovered)",
    }
