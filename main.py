#!/usr/bin/env python3
"""
AI Product Factory — Main entry point

Usage:
    python main.py "Your product idea here"
    python main.py --idea "Your product idea" --max-repos 3

Environment variables:
    ANTHROPIC_API_KEY   (required)
    GITHUB_TOKEN        (optional, increases GitHub API rate limits)
    OUTPUT_DIR          (optional, default: ./output)
"""
import argparse
import json
import os
import sys

from controller import AIProductFactory


def print_banner():
    print("""
╔══════════════════════════════════════════════════════════════╗
║           AI PRODUCT FACTORY  —  Full Pipeline               ║
║  User Idea → Probability → Expand → Signals → Repos → MCP   ║
║  → Planner DAG → Architect → Compose → Generate → Test/Fix  ║
║  → Output Scaffold → Feedback Loop                           ║
╚══════════════════════════════════════════════════════════════╝
""")


def main():
    parser = argparse.ArgumentParser(description="AI Product Factory")
    parser.add_argument("idea", nargs="?", help="Product idea (positional)")
    parser.add_argument("--idea", dest="idea_flag", help="Product idea (named)")
    parser.add_argument("--max-repos", type=int, default=2,
                        help="Maximum repos to clone and analyse (default: 2)")
    parser.add_argument("--output-dir", default=os.environ.get("OUTPUT_DIR", "./output"),
                        help="Output directory")
    parser.add_argument("--memory-path", default=".rag_memory.json",
                        help="RAG memory file path")
    parser.add_argument("--json", action="store_true", help="Print JSON summary to stdout")
    args = parser.parse_args()

    idea = args.idea or args.idea_flag
    if not idea:
        parser.print_help()
        sys.exit(1)

    print_banner()
    print(f"IDEA: {idea}\n")

    factory = AIProductFactory(
        github_token=os.environ.get("GITHUB_TOKEN"),
        output_dir=args.output_dir,
        memory_path=args.memory_path,
    )

    state = factory.build(idea, max_repos=args.max_repos)

    # ── Summary ───────────────────────────────────────────────────────────────
    print("\n" + "═" * 64)
    print("BUILD SUMMARY")
    print("═" * 64)
    print(f"Build ID   : {state.build_id}")
    print(f"Status     : {state.status}")
    print(f"Output     : {state.output_path}")
    print(f"Prob Score : composite={state.prob_score.composite:.2f}  "
          f"F={state.prob_score.feasibility}  N={state.prob_score.novelty}  "
          f"D={state.prob_score.demand}")
    print(f"Repos used : {[r.full_name for r in state.repo_profiles]}")
    print(f"Components : {[c.filename for c in state.generated_components]}")
    if state.test_result:
        icon = "✅" if state.test_result.passed else "❌"
        print(f"Tests      : {icon} {'PASS' if state.test_result.passed else 'FAIL'}")
    if state.fix_result:
        print(f"Fix loop   : {state.fix_result.attempts} attempt(s), "
              f"{'✅ resolved' if state.fix_result.success else '❌ unresolved'}")
    if state.errors:
        print(f"Errors     : {state.errors}")

    print("\nTIMELINE:")
    for entry in state.timeline:
        print(f"  {entry['step']}" + (f" — {entry['detail']}" if entry['detail'] else ""))
    print("═" * 64)

    if args.json:
        summary = {
            "build_id": state.build_id,
            "status": state.status,
            "output_path": state.output_path,
            "prob_score": state.prob_score.composite,
            "components": [c.filename for c in state.generated_components],
            "test_passed": state.test_result.passed if state.test_result else None,
        }
        print(json.dumps(summary, indent=2))

    return 0 if state.status == "complete" else 1


if __name__ == "__main__":
    sys.exit(main())
