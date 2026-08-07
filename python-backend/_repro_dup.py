import asyncio
from intelligence.strategy_tournament import run_strategy_tournament

A = {
    "id": "STRAT-A",
    "name": "Fast MVP",
    "tagline": "t",
    "description": "A focused MVP.",
    "features": ["Core user flow"],
    "capabilities": ["CAP-001"],
    "architecture": "Single service: API + UI + datastore.",
    "timeline": "2-3 weeks",
    "estimated_cost": "$2k - $5k",
    "complexity": "low",
    "innovation_score": 0.3,
    "feasibility": 0.9,
    "market_opportunity": 0.7,
    "confidence": 0.85,
    "risk_level": "low",
    "risks": ["Scope creep"],
    "repository_map": {"Auth": "org/repo-auth"},
    "differentiation": "d",
    "why": "w",
}


async def main():
    t = await run_strategy_tournament(
        [A, dict(A)],  # duplicate id STRAT-A, same dict twice
        [],
        None,
        None,
        provider=None,
    )
    print("=== ranking ===")
    for e in t["ranking"]:
        print(e["rank"], e["id"], e["wins"], e["losses"], e["aggregate"])
    print("=== scores keys ===", list(t["scores"].keys()), "len candidates:", t["methodology"]["candidates"])
    print("=== comparisons ===")
    for c in t["comparisons"]:
        print(c["a"], "vs", c["b"], "-> winner", c["winner_id"])
    print("=== decision report rejected ===")
    print(t["decision_report"]["rejected"])
    print("=== winner ===")
    print(t["winner"]["id"], t["winner"]["wins"], t["winner"]["losses"])


asyncio.run(main())
