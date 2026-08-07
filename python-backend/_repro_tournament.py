import asyncio, json
from intelligence.strategy_tournament import run_strategy_tournament, score_strategy
from llm.provider import LocalProvider, get_provider
from intelligence.prompt_utils import as_dict

def make_strat(sid, feas, inno, conf):
    return {
        "id": sid, "name": sid, "complexity": "low", "risk_level": "low",
        "features": ["a", "b"], "architecture": "single service", "estimated_cost": "$2k - $5k",
        "innovation_score": inno, "feasibility": feas, "market_opportunity": 0.7,
        "confidence": conf, "risks": ["scope"],
        "repository_map": {"Search": "algolia/algoliasearch-client-python"},
        "capabilities": ["CAP-1"], "description": "d", "tagline": "t", "why": "w",
        "differentiation": "d", "timeline": "2w",
    }

# Claim scenario: BOLD {feasibility .95, innovation 1.0, confidence .5} vs SAFE {feasibility .5, innovation .2, confidence .95}
BOLD = make_strat("STRAT-BOLD", 0.95, 1.0, 0.5)
SAFE = make_strat("STRAT-SAFE", 0.5, 0.2, 0.95)

sb = score_strategy(BOLD, [], {}, {})
ss = score_strategy(SAFE, [], {}, {})
print("BOLD aggregate:", sb["aggregate"], "aggregate_conf:", sb["confidence"])
print("SAFE aggregate:", ss["aggregate"], "aggregate_conf:", ss["confidence"])
print("BOLD > SAFE aggregate:", sb["aggregate"] > ss["aggregate"])

async def main():
    # Path A: provider=None -> deterministic _pairwise_compare (aggregate decides)
    t_none = await run_strategy_tournament([BOLD, SAFE], [], {}, {}, provider=None, include_challenger=False)
    print("\n[provider=None] ranking:")
    for e in t_none["ranking"]:
        print(f"  {e['id']}: rank {e['rank']}, wins {e['wins']}, aggregate {e['aggregate']}")
    print("winner:", t_none["winner"]["id"])

    # Path B: LocalProvider -> debate -> fallback_debate (_score_position decides)
    prov = LocalProvider()
    t_loc = await run_strategy_tournament([BOLD, SAFE], [], {}, {}, provider=prov, include_challenger=False)
    print("\n[LocalProvider] ranking:")
    for e in t_loc["ranking"]:
        print(f"  {e['id']}: rank {e['rank']}, wins {e['wins']}, aggregate {e['aggregate']}")
    print("winner:", t_loc["winner"]["id"])
    for cmp in t_loc["comparisons"]:
        print("  comparison:", cmp["a"], "vs", cmp["b"], "-> winner", cmp["winner_id"], "source:", cmp["source"])
        print("     score_a", cmp["score_a"], "score_b", cmp["score_b"], "margin", cmp["margin"])

asyncio.run(main())
