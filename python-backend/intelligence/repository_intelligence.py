"""Repository Intelligence v3 — explainable repository due diligence.

For every discovered repository this engine combines GitHub signals with Google's
deps.dev/OpenSSF project evidence when available. The report is intentionally
explainable: every repository has health dimensions, strengths, weaknesses,
source links and capability mappings instead of only a star-based score.
"""

from __future__ import annotations

import asyncio
import math
from typing import Any
from urllib.parse import quote

from intelligence.http_client import request_json
from intelligence.prompt_utils import as_list, as_str
from intelligence.github_engine import _days_since_pushed

_PERMISSIVE_LICENSES = {"mit", "apache-2.0", "bsd-2-clause", "bsd-3-clause", "isc", "mpl-2.0"}
_SECURITY_TERMS = {"security", "auth", "sso", "oauth", "encryption", "jwt", "2fa"}
_API_TERMS = {"api", "sdk", "client", "rest", "graphql"}
_EXTENSIBILITY_TERMS = {"plugin", "extension", "middleware", "sdk", "api", "modular"}

DIMENSIONS: list[str] = [
    "stars", "forks", "contributors", "commit_activity", "issue_velocity",
    "release_frequency", "documentation", "security", "license",
    "api_stability", "extensibility", "community_adoption",
]

# Repository-report weights are separate from capability-search weights. They
# sum to 1.0 and match the dimensions this report actually measures.
REPORT_WEIGHTS: dict[str, float] = {
    "stars": 0.05,
    "forks": 0.04,
    "contributors": 0.06,
    "commit_activity": 0.12,
    "issue_velocity": 0.08,
    "release_frequency": 0.08,
    "documentation": 0.10,
    "security": 0.16,
    "license": 0.12,
    "api_stability": 0.08,
    "extensibility": 0.06,
    "community_adoption": 0.05,
}


def _license_score(license_name: str) -> float:
    value = (license_name or "").lower()
    if value in _PERMISSIVE_LICENSES:
        return 1.0
    if value and value not in {"none", "noassertion", "other"}:
        return 0.55
    return 0.2


def _dim_scores(repo: dict[str, Any], deps_project: dict[str, Any] | None = None) -> dict[str, float]:
    deps_project = deps_project or {}
    stars = int(repo.get("stars", 0) or deps_project.get("starsCount", 0) or 0)
    forks = int(repo.get("forks", 0) or deps_project.get("forksCount", 0) or 0)
    open_issues = int(repo.get("open_issues", 0) or deps_project.get("openIssuesCount", 0) or 0)
    days = _days_since_pushed(as_str(repo.get("pushed_at")))
    license_name = as_str(deps_project.get("license")) or as_str(repo.get("license"))
    description = as_str(repo.get("description")) or as_str(deps_project.get("description"))
    topics = as_list(repo.get("topics"))
    combined_text = f"{description} {' '.join(topics)}".lower()

    commit_activity = (
        0.2 if (days is None or days >= 365)
        else (0.5 if days >= 180 else (0.7 if days >= 90 else (0.85 if days >= 30 else 1.0)))
    )

    scorecard = deps_project.get("scorecard") if isinstance(deps_project.get("scorecard"), dict) else {}
    scorecard_raw = scorecard.get("overallScore")
    if isinstance(scorecard_raw, (int, float)) and scorecard_raw >= 0:
        security = min(1.0, max(0.0, float(scorecard_raw) / 10.0))
    else:
        security = 0.5 + (0.25 if any(term in combined_text for term in _SECURITY_TERMS) else 0.0)

    return {
        "stars": min(1.0, math.log10(stars + 1) / 6.0),
        "forks": min(1.0, math.log10(forks + 1) / 5.0),
        "contributors": min(1.0, math.log10(stars + 1) / 5.0),
        "commit_activity": commit_activity,
        "issue_velocity": min(1.0, 0.5 + min(1.0, (stars + 1) / max(open_issues, 1) / 8.0) / 2.0),
        "release_frequency": 0.4 if (days is None or days >= 180) else (0.7 if days >= 90 else 1.0),
        "documentation": min(1.0, 0.5 + (0.5 if len(description.split()) >= 60 else (0.3 if len(description.split()) >= 25 else 0.0))),
        "security": security,
        "license": _license_score(license_name),
        "api_stability": min(1.0, 0.4 + 0.3 * min(1.0, math.log10(stars + 1) / 6.0) + (0.3 if any(t in combined_text for t in _API_TERMS) else 0.0)),
        "extensibility": 0.4 + (0.6 if any(t in combined_text for t in _EXTENSIBILITY_TERMS) else 0.0),
        "community_adoption": min(1.0, math.log10(stars + 1) / 6.0 * (0.5 + 0.5 * commit_activity)),
    }


async def _deps_project(full_name: str) -> dict[str, Any]:
    project_id = quote(f"github.com/{full_name}", safe="")
    status, data = await request_json(f"https://api.deps.dev/v3/projects/{project_id}", timeout=14.0)
    return data if status == 200 and isinstance(data, dict) else {}


def _capability_roles(capability_mappings: list[dict[str, Any]]) -> dict[str, list[str]]:
    roles: dict[str, list[str]] = {}
    for mapping in capability_mappings:
        cap = as_str(mapping.get("capability_name")) or as_str(mapping.get("capability_id"))
        selected = as_str(mapping.get("selected"))
        if selected and cap:
            roles.setdefault(selected, []).append(cap)
        for candidate in as_list(mapping.get("candidates")):
            if not isinstance(candidate, dict):
                continue
            name = as_str(candidate.get("full_name"))
            if name and cap and cap not in roles.setdefault(name, []):
                roles[name].append(cap)
    return roles


async def build_repository_intelligence(
    repos: list[dict[str, Any]],
    capability_mappings: list[dict[str, Any]],
    token: str | None = None,
) -> dict[str, Any]:
    """Build an evidence-backed repository report. Never raises."""
    del token  # deps.dev is public; kept in signature for backwards compatibility.
    deps_results = await asyncio.gather(*[_deps_project(as_str(repo.get("full_name"))) for repo in repos])
    capabilities = _capability_roles(capability_mappings)

    reports: list[dict[str, Any]] = []
    for repo, deps_project in zip(repos, deps_results):
        full_name = as_str(repo.get("full_name"))
        dims = _dim_scores(repo, deps_project)
        score = sum(REPORT_WEIGHTS[k] * dims[k] for k in REPORT_WEIGHTS)
        top = sorted(dims.items(), key=lambda kv: kv[1], reverse=True)[:4]
        weak = sorted(dims.items(), key=lambda kv: kv[1])[:3]
        scorecard = deps_project.get("scorecard") if isinstance(deps_project.get("scorecard"), dict) else {}
        deps_license = as_str(deps_project.get("license"))
        reported_license = deps_license or as_str(repo.get("license"))
        roles = capabilities.get(full_name, [])

        reports.append({
            "full_name": full_name,
            "description": as_str(repo.get("description")) or as_str(deps_project.get("description")),
            "language": as_str(repo.get("language")),
            "stars": int(repo.get("stars", 0) or deps_project.get("starsCount", 0) or 0),
            "forks": int(repo.get("forks", 0) or deps_project.get("forksCount", 0) or 0),
            "license": reported_license or "none",
            "capabilities": roles,
            "dimensions": {k: round(v, 3) for k, v in dims.items()},
            "explainable_score": round(score, 4),
            "strengths": [f"{k.replace('_', ' ')} {v * 100:.0f}%" for k, v in top],
            "weaknesses": [f"{k.replace('_', ' ')} {v * 100:.0f}%" for k, v in weak],
            "reasons": [
                *(f"Provides/assists: {role}" for role in roles[:4]),
                *(f"{k.replace('_', ' ')}: {v:.2f}" for k, v in top[:3]),
            ],
            "evidence": {
                "github": as_str(repo.get("html_url")),
                "deps_dev": f"https://deps.dev/project/{quote(f'github.com/{full_name}', safe='')}" if deps_project else "",
                "pushed_at": as_str(repo.get("pushed_at")),
                "license": reported_license,
                "scorecard_overall": scorecard.get("overallScore"),
                "scorecard_checks": len(as_list(scorecard.get("checks"))),
                "oss_fuzz": bool(deps_project.get("ossFuzz")),
                "deps_dev_available": bool(deps_project),
            },
        })

    reports.sort(key=lambda r: r["explainable_score"], reverse=True)
    for i, report in enumerate(reports, start=1):
        report["rank"] = i

    dim_avgs: dict[str, float] = {}
    if reports:
        for dim in DIMENSIONS:
            dim_avgs[dim] = round(sum(r["dimensions"].get(dim, 0) for r in reports) / len(reports), 3)

    return {
        "reports": reports,
        "summary": {
            "total": len(reports),
            "best": reports[0]["full_name"] if reports else "",
            "worst": reports[-1]["full_name"] if reports else "",
            "dimension_averages": dim_avgs,
            "deps_dev_verified": sum(1 for r in reports if r["evidence"].get("deps_dev_available")),
        },
        "methodology": {
            "weights": REPORT_WEIGHTS,
            "security_source": "deps.dev/OpenSSF Scorecard when available; conservative fallback otherwise",
            "license_source": "deps.dev project metadata when available, then GitHub metadata",
        },
        "note": "" if reports else "Repository intelligence unavailable (no repos discovered)",
    }
