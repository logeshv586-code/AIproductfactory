import asyncio
from intelligence.strategy_tournament import run_strategy_tournament
from llm.provider import LocalProvider
import sys
sys.path.insert(0, "tests")
from test_strategy_tournament import STRATS

async def main():
    t_none = await run_strategy_tournament(STRATS, [], {}, {}, provider=None)
    t_loc = await run_strategy_tournament(STRATS, [], {}, {}, provider=LocalProvider())

    def show(label, t):
        print(f"\n[{label}] winner: {t['winner']['id']} agg {t['winner']['aggregate']} conf {t['winner']['confidence']}")
        for e in t["ranking"]:
            print(f"  {e['id']}: rank {e['rank']}, wins {e['wins']}, aggregate {e['aggregate']}")
        for cmp in t["comparisons"]:
            print(f"  cmp {cmp['a']} vs {cmp['b']} -> {cmp['winner_id']} (score {cmp['score_a']}/{cmp['score_b']}) source={cmp['source']}")

    show("provider=None", t_none)
    show("LocalProvider", t_loc)

    print("\nSame winner?", t_none["winner"]["id"] == t_loc["winner"]["id"])
    print("Same ranking order?", [e["id"] for e in t_none["ranking"]] == [e["id"] for e in t_loc["ranking"]])

asyncio.run(main())
