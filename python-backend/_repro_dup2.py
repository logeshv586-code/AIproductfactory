import asyncio
from intelligence.strategy_tournament import run_strategy_tournament


def strat(id, name, feas, conf, desc):
    return {
        "id": id, "name": name, "tagline": "t", "description": desc,
        "features": ["Core user flow"], "capabilities": ["CAP-001"],
        "architecture": "Single service: API + UI + datastore.",
        "timeline": "2-3 weeks", "estimated_cost": "$2k - $5k",
        "complexity": "low", "innovation_score": 0.3,
        "feasibility": feas, "market_opportunity": 0.7,
        "confidence": conf, "risk_level": "low", "risks": ["Scope creep"],
        "repository_map": {"Auth": "org/repo-auth"},
        "differentiation": "d", "why": "w",
    }


async def main():
    # Two DISTINCT strategies that share the same id STRAT-A
    A_strong = strat("STRAT-A", "Fast MVP (good)", feas=0.95, conf=0.95, desc="strong A")
    A_weak = strat("STRAT-A", "Fast MVP (bad)", feas=0.1, conf=0.1, desc="weak A")
    t = await run_strategy_tournament([A_strong, A_weak], [], None, None, provider=None)
    print("=== ranking ===")
    for e in t["ranking"]:
        print(e["rank"], e["id"], e["name"], e["wins"], e["losses"], e["aggregate"], "conf", e["confidence"])
    print("=== scores keys ===", list(t["scores"].keys()))
    print("=== rejected ===")
    for r in t["rejected"]:
        print(r)


asyncio.run(main())
