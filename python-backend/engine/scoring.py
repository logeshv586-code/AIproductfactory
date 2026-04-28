"""
Scoring Engine — Scores product viability on 4 axes:
  - Trend (30%): Market momentum and star power of underlying repos
  - Innovation (30%): Novelty of capability combinations and composition patterns
  - Feasibility (20%): Technical achievability based on available components
  - Competition (20%): Market saturation (inverse — less competition = higher score)
"""

from typing import Any


def score_product(
    product: dict[str, Any],
    repos: list[dict[str, Any]],
    capabilities: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Score a product on 4 axes and compute a weighted final score.

    Returns dict with: trend, innovation, feasibility, competition, final_score,
    success_probability, success_percentage
    """
    # ── Trend Score (30%) ────────────────────────────────────────────────
    # Based on average star count of repos used
    repos_used = product.get("repos_used", [])
    if repos_used and repos:
        matched = [r for r in repos if r.get("name") in repos_used or r.get("full_name") in repos_used]
        if matched:
            avg_stars = sum(r.get("stars", 0) for r in matched) / len(matched)
            # Normalize: 0-10k stars → 0.3-0.95
            trend_score = min(0.3 + (avg_stars / 10000) * 0.65, 0.95)
        else:
            trend_score = 0.5
    else:
        trend_score = 0.5

    # ── Innovation Score (30%) ───────────────────────────────────────────
    # Based on number and diversity of capability combinations
    caps = product.get("capabilities", [])
    unique_caps = set(caps)
    cap_diversity = len(unique_caps)

    # More diverse capabilities = more innovative
    innovation_base = min(cap_diversity * 0.2, 0.8)

    # Bonus for rare combinations
    rare_combos = [
        {"agent", "memory"}, {"rag", "automation"}, {"agent", "ui"},
        {"memory", "ui"}, {"automation", "rag"},
    ]
    combo_bonus = 0.1 if any(unique_caps >= combo for combo in rare_combos) else 0

    # Bonus for composition patterns
    pattern = product.get("composition_pattern", "")
    pattern_bonus = 0.15 if pattern else 0

    # Bonus for gap filling
    gap_bonus = 0.1 if product.get("gap_filled") else 0

    innovation_score = min(innovation_base + combo_bonus + pattern_bonus + gap_bonus, 0.95)

    # ── Feasibility Score (20%) ──────────────────────────────────────────
    # Based on number of components needed vs available
    components_needed = len(product.get("key_features", []))
    available_repos = len(repos_used)

    if components_needed <= 0:
        feasibility_score = 0.5
    elif available_repos >= components_needed:
        feasibility_score = 0.85
    elif available_repos >= components_needed * 0.5:
        feasibility_score = 0.7
    else:
        feasibility_score = max(0.4, 0.5 - (components_needed - available_repos) * 0.05)

    # Adjust based on capability confidence if available
    if capabilities:
        avg_confidence = sum(c.get("confidence", 0.5) for c in capabilities) / max(len(capabilities), 1)
        feasibility_score = feasibility_score * 0.7 + avg_confidence * 0.3

    # ── Competition Score (20%) ──────────────────────────────────────────
    # Lower competition = higher score. Estimate based on market signals.
    # This is a heuristic — real implementation would use web search data.
    competition_base = 0.6  # Default moderate competition

    # More niche combinations suggest less competition
    if cap_diversity >= 3:
        competition_base += 0.15
    if pattern or product.get("gap_filled"):
        competition_base += 0.1

    competition_score = min(competition_base, 0.9)

    # ── Final Weighted Score ─────────────────────────────────────────────
    final_score = (
        trend_score * 0.30 +
        innovation_score * 0.30 +
        feasibility_score * 0.20 +
        competition_score * 0.20
    )

    success_probability = min(
        0.98,
        max(
            0.05,
            final_score * 0.55 +
            feasibility_score * 0.30 +
            competition_score * 0.15,
        ),
    )
    success_percentage = round(success_probability * 100, 1)

    return {
        "trend": round(trend_score, 3),
        "innovation": round(innovation_score, 3),
        "feasibility": round(feasibility_score, 3),
        "competition": round(competition_score, 3),
        "final_score": round(final_score, 3),
        "success_probability": round(success_probability, 3),
        "success_percentage": success_percentage,
    }


def rank_products(
    products: list[dict[str, Any]],
    repos: list[dict[str, Any]],
    capabilities: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Score and rank a list of products by final_score descending."""
    scored = []
    for product in products:
        scores = score_product(product, repos, capabilities)
        scored.append({**product, "scores": scores})

    scored.sort(key=lambda p: p["scores"]["final_score"], reverse=True)
    return scored
