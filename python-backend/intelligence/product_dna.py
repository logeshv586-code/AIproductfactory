"""
Product DNA — a compact, comparable signature for every generated product.

Each product receives a DNA profile: domain, capability/repository counts,
innovation and market-gap scores, complexity and confidence, plus a hex
``signature`` so future products can be compared. The Learning Store records
every DNA so the system can later answer "which products are similar" (the
Product Genome, v6).
"""

from __future__ import annotations

import hashlib
from typing import Any

from intelligence.prompt_utils import as_dict, as_list, as_str


def compute_dna(graph: dict[str, Any]) -> dict[str, Any]:
    """
    Compute the Product DNA from the knowledge graph.

    Returns ``{domain, capabilities, repositories, innovation_score,
    market_gap, complexity, confidence, signature, summary}``. Deterministic.
    """
    domain = as_str(graph.get("domain")) or "general"
    capabilities = as_dict(graph.get("capabilities"))
    cap_list = as_list(capabilities.get("capabilities"))
    repo_intel = as_dict(graph.get("repository_intelligence"))
    reports = as_list(repo_intel.get("reports"))
    strategies = as_list(graph.get("strategies"))
    approved = as_dict(graph.get("approved_strategy"))
    balanced = (
        approved
        or next((s for s in strategies if as_str(s.get("id")) == "STRAT-B"), None)
        or (strategies[0] if strategies else {})
    )

    innovation_score = float(as_dict(graph.get("innovation")).get("innovation_score") or 0.5)
    market_gap = float(balanced.get("market_opportunity") or 0.6)
    complexity = as_str(balanced.get("complexity")) or "medium"
    confidence = float(
        as_dict(graph.get("product_thinking")).get("confidence")
        or as_dict(graph.get("review")).get("overall_confidence")
        or 0.7
    )

    # signature over the stable, comparable fields
    raw = "|".join([
        domain.lower(),
        str(len(cap_list)),
        str(len(reports)),
        f"{innovation_score:.3f}",
        f"{market_gap:.3f}",
        complexity,
        f"{confidence:.3f}",
    ])
    signature = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]

    return {
        "domain": domain,
        "capabilities": len(cap_list),
        "repositories": len(reports),
        "innovation_score": round(innovation_score, 3),
        "market_gap": round(market_gap, 3),
        "complexity": complexity,
        "confidence": round(confidence, 3),
        "signature": signature,
        "summary": (
            f"{domain} product · {len(cap_list)} capabilities · {len(reports)} repos · "
            f"innovation {round(innovation_score * 100)}% · gap {round(market_gap * 100)}% · "
            f"{complexity} complexity · {round(confidence * 100)}% confidence"
        ),
    }


def dna_similarity(a: dict[str, Any], b: dict[str, Any]) -> float:
    """
    Similarity between two DNA profiles in [0, 1].

    Domain match is weighted highest; numeric fields compare by relative
    distance; complexity is a cheap string match.
    """
    if not a or not b:
        return 0.0
    scores: list[float] = []

    domain_a = as_str(a.get("domain")).lower()
    domain_b = as_str(b.get("domain")).lower()
    scores.append(0.4 if domain_a == domain_b else (0.15 if domain_a and domain_b else 0.0))

    for key in ("innovation_score", "market_gap", "confidence"):
        va, vb = float(a.get(key, 0)), float(b.get(key, 0))
        diff = abs(va - vb)
        scores.append(0.2 * (1.0 - min(1.0, diff)))

    scores.append(0.1 * (1.0 - min(1.0, abs(int(a.get("capabilities", 0)) - int(b.get("capabilities", 0))) / 12.0)))
    scores.append(0.1 * (1.0 - min(1.0, abs(int(a.get("repositories", 0)) - int(b.get("repositories", 0))) / 12.0)))
    scores.append(0.1 if as_str(a.get("complexity")) == as_str(b.get("complexity")) else 0.05)

    return round(min(1.0, sum(scores)), 3)
