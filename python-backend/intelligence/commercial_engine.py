"""Commercial Intelligence — evidence-aware pricing and profitability scenarios.

This engine deliberately returns ranges and assumptions rather than pretending a
product can be priced with certainty before real customer and cost data exists.
It uses current competitor pricing text when Market Intelligence found it, then
combines that evidence with product/repository complexity to propose testable
SaaS and implementation pricing scenarios.
"""

from __future__ import annotations

import math
import re
from typing import Any

from intelligence.prompt_utils import as_dict, as_list, as_str

_PRICE_RE = re.compile(r"(?:\$|usd\s*)(\d+(?:\.\d+)?)", re.I)


def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return min(hi, max(lo, value))


def _money(value: float) -> int:
    # Friendly SaaS price endings while remaining deterministic.
    if value < 15:
        return max(5, int(round(value)))
    rounded = int(round(value / 10.0) * 10)
    return max(10, rounded - 1 if rounded % 10 == 0 else rounded)


def _competitor_price_points(market: dict[str, Any]) -> list[dict[str, Any]]:
    points: list[dict[str, Any]] = []
    for product in as_list(market.get("existing_products")):
        p = as_dict(product)
        pricing = as_str(p.get("pricing"))
        values = [float(x) for x in _PRICE_RE.findall(pricing)]
        if values:
            points.append({
                "name": as_str(p.get("name")) or "competitor",
                "pricing": pricing,
                "values_usd": values[:4],
                "source": as_str(p.get("source")),
            })
    return points


def _complexity(intent: dict[str, Any], strategies: list[dict[str, Any]], mappings: list[dict[str, Any]]) -> float:
    strategy_complexities = [as_str(s.get("complexity")).lower() for s in strategies]
    complexity_weight = 0.5
    if "high" in strategy_complexities:
        complexity_weight = 0.78
    elif "medium" in strategy_complexities:
        complexity_weight = 0.62
    elif "low" in strategy_complexities:
        complexity_weight = 0.42
    cap_count = len(as_list(intent.get("required_capabilities"))) or len(mappings)
    repo_factor = min(1.0, len({as_str(m.get("selected")) for m in mappings if as_str(m.get("selected"))}) / 5.0)
    cap_factor = min(1.0, cap_count / 8.0)
    return _clamp(complexity_weight * 0.55 + repo_factor * 0.2 + cap_factor * 0.25)


def build_commercial_intelligence(
    intent: dict[str, Any],
    market: dict[str, Any],
    strategies: list[dict[str, Any]],
    capability_mappings: list[dict[str, Any]],
    live_research: dict[str, Any] | None = None,
) -> dict[str, Any]:
    price_points = _competitor_price_points(market)
    complexity = _complexity(intent, strategies, capability_mappings)
    all_prices = sorted(v for p in price_points for v in p["values_usd"] if 1 <= v <= 10000)

    if all_prices:
        median = all_prices[len(all_prices) // 2]
        evidence_strength = min(1.0, len(price_points) / 5.0)
        starter = max(9.0, median * 0.45)
        pro = max(29.0, median * 0.95)
        business = max(79.0, median * 2.1)
    else:
        # Explicit heuristic fallback: price rises with product complexity.
        evidence_strength = 0.25
        starter = 12 + complexity * 28
        pro = 39 + complexity * 90
        business = 119 + complexity * 260

    # Conservative modeled variable cost/customer/month. This is an assumption
    # until the generated product has measured token, compute, storage and support data.
    variable_cost = 5 + complexity * 34
    fixed_monthly = 150 + complexity * 850
    support_cost = 3 + complexity * 12
    modeled_cogs = variable_cost + support_cost

    tiers = []
    for name, raw_price, positioning in [
        ("Starter", starter, "individuals / light usage"),
        ("Pro", pro, "power users / small teams"),
        ("Business", business, "teams needing higher limits, governance and support"),
    ]:
        price = float(_money(raw_price))
        gross_profit = max(0.0, price - modeled_cogs)
        gross_margin = gross_profit / price if price else 0.0
        break_even = math.ceil(fixed_monthly / gross_profit) if gross_profit > 0 else None
        tiers.append({
            "name": name,
            "monthly_price_usd": int(price),
            "annual_price_usd": int(round(price * 10)),
            "positioning": positioning,
            "modeled_cogs_per_customer_usd": round(modeled_cogs, 2),
            "modeled_gross_margin_pct": round(gross_margin * 100, 1),
            "modeled_break_even_customers": break_even,
        })

    pro = tiers[1]
    one_time_low = _money(1500 + complexity * 6000)
    one_time_high = _money(5000 + complexity * 18000)
    live_summary = as_dict((live_research or {}).get("summary"))
    live_signal_count = int(live_summary.get("signal_count", 0) or 0)
    research_bonus = min(0.15, live_signal_count / 100.0)
    confidence = _clamp(0.35 + evidence_strength * 0.42 + research_bonus)

    return {
        "currency": "USD",
        "recommended_model": "tiered subscription + usage guardrails + enterprise onboarding",
        "pricing_tiers": tiers,
        "implementation_sale_range_usd": {
            "low": one_time_low,
            "high": one_time_high,
            "use_case": "custom deployment, integration, white-label or implementation service",
        },
        "modeled_cost_assumptions": {
            "variable_compute_ai_per_customer_month_usd": round(variable_cost, 2),
            "support_ops_per_customer_month_usd": round(support_cost, 2),
            "fixed_platform_month_usd": round(fixed_monthly, 2),
            "complexity_score": round(complexity, 3),
            "note": "Replace these assumptions with measured token/compute/storage/support costs after the first runnable build.",
        },
        "profitability_scenarios": [
            {
                "scenario": "100 Pro customers",
                "monthly_revenue_usd": 100 * pro["monthly_price_usd"],
                "modeled_monthly_cogs_usd": round(100 * modeled_cogs + fixed_monthly, 2),
                "modeled_monthly_contribution_usd": round(100 * pro["monthly_price_usd"] - (100 * modeled_cogs + fixed_monthly), 2),
            },
            {
                "scenario": "500 Pro customers",
                "monthly_revenue_usd": 500 * pro["monthly_price_usd"],
                "modeled_monthly_cogs_usd": round(500 * modeled_cogs + fixed_monthly, 2),
                "modeled_monthly_contribution_usd": round(500 * pro["monthly_price_usd"] - (500 * modeled_cogs + fixed_monthly), 2),
            },
        ],
        "competitor_price_evidence": price_points,
        "pricing_confidence": round(confidence, 3),
        "pricing_status": "evidence-backed estimate" if len(price_points) >= 3 else "hypothesis — validate with current competitor/customer data",
        "profit_playbook": [
            "Put expensive AI/compute actions behind usage quotas or metered overages instead of unlimited plans.",
            "Use annual prepay around 10 months of monthly price to improve cash flow without destroying unit economics.",
            "Sell implementation, private deployment, SSO, audit logs and support separately from the core self-serve plan.",
            "Track cost per successful user outcome, not only cost per API call; automatically route simple tasks to cheaper models/services.",
            "Run willingness-to-pay interviews and landing-page price tests before treating the suggested price as final.",
        ],
        "commercial_warning": "These are modeled scenarios, not guaranteed profit or market value. Final pricing requires measured operating costs, current competitor prices, customer willingness-to-pay and legal/license review.",
    }
