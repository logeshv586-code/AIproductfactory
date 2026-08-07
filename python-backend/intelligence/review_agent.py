"""
Review Agent — validates the entire Product Knowledge Graph before approval.

Checks for missing requirements, unsupported capabilities, weak repository
choices, architecture conflicts, duplicate functionality and risk hotspots.
Produces the Review Report (advisory) that the user sees alongside the
strategy comparison before they approve.
"""

from __future__ import annotations

from typing import Any

from intelligence.prompt_utils import ask_json, as_dict, as_list, as_str
from llm.provider import LLMProvider

_SYSTEM_PROMPT = """You are a senior product reviewer inside an AI product factory.
Review the entire Product Knowledge Graph BEFORE the user approves a strategy.

Return ONLY valid JSON with EXACTLY these keys:
{
  "score": 0,
  "overall_confidence": 0.0,
  "verdict": "approve | review | revise",
  "findings": [
    {"severity": "critical" | "warning" | "info", "category": "missing_requirement | unsupported_capability | weak_repository | architecture_conflict | duplicate_functionality | risk_hotspot | general", "message": "...", "recommendation": "..."}
  ],
  "missing_requirements": ["..."],
  "unsupported_capabilities": ["..."],
  "weak_repository_choices": ["..."],
  "architecture_conflicts": ["..."],
  "duplicate_functionality": ["..."],
  "risk_hotspots": ["..."],
  "recommendations": ["..."],
  "reasoning": "short justification"
}
score is 0-100, overall_confidence is 0..1. Be concrete and evidence-backed.
Do not add or remove keys."""

_SEVERITIES = {"critical", "warning", "info"}
_CATEGORIES = {
    "missing_requirement", "unsupported_capability", "weak_repository",
    "architecture_conflict", "duplicate_functionality", "risk_hotspot", "general",
}


def _compact_graph_summary(graph: dict[str, Any]) -> dict[str, Any]:
    """
    Reduce the (potentially huge) knowledge graph to a compact digest for the
    LLM. The full graph can be 100KB+ and make the model think for >60s; the
    reviewer only needs the decision-relevant facts.
    """
    capabilities = as_list(as_dict(graph.get("capabilities")).get("capabilities"))
    mappings = as_list(graph.get("capability_mappings"))
    strategies = as_list(graph.get("strategies"))
    reports = as_list(as_dict(graph.get("repository_intelligence")).get("reports"))

    return {
        "domain": as_str(graph.get("domain")) or as_str(as_dict(graph.get("intent")).get("domain")),
        "idea": as_str(graph.get("idea"))[:200],
        "requirements": [as_str(r.get("title")) or as_str(r.get("id")) for r in as_list(graph.get("requirements")) if isinstance(r, dict)][:15],
        "requirements_count": len(as_list(graph.get("requirements"))),
        "existing_products": [as_str(p.get("name")) for p in as_list(graph.get("existing_products")) if isinstance(p, dict)][:10],
        "gaps": [as_str(g.get("gap")) or as_str(g.get("description")) for g in as_list(graph.get("gaps")) if isinstance(g, dict)][:10],
        "competitors_count": len(as_list(graph.get("competitors"))),
        "capabilities": [
            {
                "id": as_str(c.get("id")),
                "name": as_str(c.get("name")),
                "priority": as_str(c.get("priority")),
            }
            for c in capabilities
        ][:15],
        "capability_mappings": [
            {
                "capability": as_str(m.get("capability_name")),
                "selected_repo": as_str(m.get("selected")),
                "confidence": float(m.get("confidence", 0.5)),
            }
            for m in mappings
        ][:15],
        "repository_reports": [
            {
                "full_name": as_str(r.get("full_name")),
                "score": round(float(r.get("explainable_score", 0.5)), 3),
            }
            for r in reports
        ][:12],
        "strategies": [
            {
                "id": as_str(s.get("id")),
                "name": as_str(s.get("name")),
                "confidence": float(s.get("confidence", 0.7)),
                "complexity": as_str(s.get("complexity")),
            }
            for s in strategies
        ],
        "product_thinking_confidence": as_dict(graph.get("product_thinking")).get("confidence"),
        "innovation_score": as_dict(graph.get("innovation")).get("innovation_score"),
        "evolution_chain": as_list(as_dict(graph.get("evolution")).get("evolution_chain"))[:6],
    }


def _deterministic_checks(graph: dict[str, Any]) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []

    requirements = as_list(graph.get("requirements"))
    if not requirements:
        findings.append(
            {"severity": "critical", "category": "missing_requirement",
             "message": "No requirements extracted — the pipeline has no functional grounding.",
             "recommendation": "Re-run requirement intelligence before approving."}
        )

    capabilities = as_dict(graph.get("capabilities")).get("capabilities", [])
    if not capabilities:
        findings.append(
            {"severity": "critical", "category": "unsupported_capability",
             "message": "Capability graph is empty — strategies cannot map to implementations.",
             "recommendation": "Re-run capability intelligence."}
        )

    # capability ids referenced by strategies must exist in the capability graph
    known_ids = {as_str(c.get("id")) for c in capabilities}
    for s in as_list(graph.get("strategies")):
        for cid in as_list(s.get("capabilities")):
            if cid and cid not in known_ids:
                findings.append(
                    {"severity": "warning", "category": "unsupported_capability",
                     "message": f"Strategy {as_str(s.get('id'))} references capability {cid} not in the capability graph.",
                     "recommendation": "Add the capability or remove the reference."}
                )

    mappings = as_list(graph.get("capability_mappings"))
    repos = as_list(graph.get("repos"))
    if not repos:
        findings.append(
            {"severity": "warning", "category": "weak_repository",
             "message": "No GitHub repositories discovered (rate limit or network). Repository mapping is empty.",
             "recommendation": "Provide a GITHUB_TOKEN or retry later."}
        )
    elif not mappings:
        findings.append(
            {"severity": "warning", "category": "weak_repository",
             "message": "Capability-to-repository mapping is empty.",
             "recommendation": "Re-run repository intelligence."}
        )

    strategies = as_list(graph.get("strategies"))
    if len(strategies) < 3:
        findings.append(
            {"severity": "warning", "category": "general",
             "message": f"Expected 3 strategies, found {len(strategies)}.",
             "recommendation": "Re-run strategy generation."}
        )

    # duplicate functionality: two strategies referencing the same core capability set
    seen_caps: dict[str, str] = {}
    for s in strategies:
        sid = as_str(s.get("id"))
        caps_key = tuple(sorted(as_list(s.get("capabilities"))))
        if caps_key in seen_caps:
            findings.append(
                {"severity": "info", "category": "duplicate_functionality",
                 "message": f"Strategy {sid} and {seen_caps[caps_key]} use the same capability set.",
                 "recommendation": "Differentiate the tiers more strongly."}
            )
        else:
            seen_caps[caps_key] = sid

    return findings


def _fallback(graph: dict[str, Any]) -> dict[str, Any]:
    findings = _deterministic_checks(graph)
    criticals = sum(1 for f in findings if f["severity"] == "critical")
    warnings = sum(1 for f in findings if f["severity"] == "warning")
    score = max(0, 100 - criticals * 30 - warnings * 10)
    verdict = "revise" if criticals else ("review" if warnings else "approve")
    return {
        "score": score,
        "overall_confidence": round(max(0.3, min(1.0, score / 100)), 3),
        "verdict": verdict,
        "findings": findings,
        "missing_requirements": [f["message"] for f in findings if f["category"] == "missing_requirement"],
        "unsupported_capabilities": [f["message"] for f in findings if f["category"] == "unsupported_capability"],
        "weak_repository_choices": [f["message"] for f in findings if f["category"] == "weak_repository"],
        "architecture_conflicts": [],
        "duplicate_functionality": [f["message"] for f in findings if f["category"] == "duplicate_functionality"],
        "risk_hotspots": [f["message"] for f in findings if f["severity"] == "critical"],
        "recommendations": [f["recommendation"] for f in findings if f["recommendation"]],
        "reasoning": "deterministic graph validation (LLM unavailable)",
    }


def _normalize(data: Any, graph: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(data, dict) or not data:
        return _fallback(graph)
    findings = []
    for f in as_list(data.get("findings")):
        fd = as_dict(f)
        severity = as_str(fd.get("severity"))
        category = as_str(fd.get("category"))
        findings.append(
            {
                "severity": severity if severity in _SEVERITIES else "info",
                "category": category if category in _CATEGORIES else "general",
                "message": as_str(fd.get("message")) or "",
                "recommendation": as_str(fd.get("recommendation")),
            }
        )
    if not findings:
        findings = _deterministic_checks(graph)
    verdict = as_str(data.get("verdict"))
    if verdict not in ("approve", "review", "revise"):
        verdict = "review"
    return {
        "score": int(data.get("score", 70)),
        "overall_confidence": min(1.0, max(0.0, float(data.get("overall_confidence", 0.7)))),
        "verdict": verdict,
        "findings": findings,
        "missing_requirements": as_list(data.get("missing_requirements")),
        "unsupported_capabilities": as_list(data.get("unsupported_capabilities")),
        "weak_repository_choices": as_list(data.get("weak_repository_choices")),
        "architecture_conflicts": as_list(data.get("architecture_conflicts")),
        "duplicate_functionality": as_list(data.get("duplicate_functionality")),
        "risk_hotspots": as_list(data.get("risk_hotspots")),
        "recommendations": as_list(data.get("recommendations")),
        "reasoning": as_str(data.get("reasoning")),
    }


async def review_graph(graph: dict[str, Any], provider: LLMProvider) -> dict[str, Any]:
    """
    Review the full Product Knowledge Graph before approval.

    Returns the Review Report (see keys above). Deterministic checks always run
    and are merged with the LLM's synthesis. Never raises.
    """
    deterministic = _deterministic_checks(graph)
    data = await ask_json(
        provider,
        _SYSTEM_PROMPT,
        f"PRODUCT KNOWLEDGE GRAPH (COMPACT DIGEST):\n{_compact_graph_summary(graph)}\n\n"
        f"DETERMINISTIC CHECKS ALREADY FOUND:\n{deterministic}",
        fallback=None,
        temperature=0.4,
        max_tokens=1500,
    )
    report = _normalize(data, graph)
    # merge deterministic findings not already present
    seen = {(f["severity"], f["message"]) for f in report["findings"]}
    for f in deterministic:
        if (f["severity"], f["message"]) not in seen:
            report["findings"].append(f)
    report["score"] = max(0, min(100, report["score"]))
    return report
