"""
PiOrchestrator — the multi-agent orchestration layer for the Product
Intelligence Operating System (v4 + v5).

Agents communicate exclusively through the Product Knowledge Graph — no direct
coupling. Each agent reasons, validates and refines the previous stage's output
before progressing. The approval gate runs the Review Agent over the whole
graph before the user decides; approvals and outcomes are recorded to the
Learning Store so future runs improve.

v5 — Collaborative Reasoning & Evidence Graph:
- agents DEBATE before accepting a decision (capability ↔ repository ↔ architecture)
- every stage is validated and may be revised (validate → improve → validate)
- confidence PROPAGATES through the graph; low-confidence nodes trigger refinement
- the architecture is SIMULATED and auto-revised before approval
- the whole reasoning is SELF-CRITIQUED before presentation
- every product receives a Product DNA (comparable signature)

Phase 1 (``strategize``) runs the cognitive + discovery + strategy agents and
stops at the Review-gated approval screen. Phase 2 (``approve``) reloads the
graph, runs the engineering agents, records learning, and returns the complete
blueprint.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from typing import Any

from intelligence.architecture_simulator import simulate_architecture
from intelligence.capability_engine import build_capability_graph
from intelligence.competitor_engine import build_competitor_intelligence
from intelligence.composition_engine import (
    build_architecture,
    build_architecture_views,
    build_blueprint,
    build_composition_plan,
    build_engineering,
    build_execution_plan,
    deep_research,
)
from intelligence.confidence_engine import propagate_confidences
from intelligence.decision_engine import debate, validate_and_improve
from intelligence.experience_engine import ExperienceEngine
from intelligence.evolution_engine import analyze_evolution
from intelligence.gap_engine import analyze_gaps
from intelligence.github_engine import discover_repos_and_mappings
from intelligence.innovation_engine import analyze_innovation
from intelligence.intent_engine import analyze_intent
from intelligence.knowledge_graph import ProductKnowledgeGraph, run_path
from intelligence.learning_store import get_learning_store
from intelligence.market_engine import analyze_market
from intelligence.product_dna import compute_dna
from intelligence.product_memory import ProductMemory
from intelligence.prompt_utils import as_dict, as_list, as_str
from intelligence.product_thinking_engine import analyze_product_thinking
from intelligence.repository_intelligence import build_repository_intelligence
from intelligence.requirement_engine import extract_requirements
from intelligence.review_agent import review_graph
from intelligence.self_critique_engine import self_critique
from intelligence.strategy_engine import generate_strategies
from intelligence.strategy_tournament import run_strategy_tournament
from llm.provider import LLMProvider, get_provider

# The 12 specialized agents, in execution order (Phase 1). Each maps to a stage.
AGENT_PHASE1 = [
    "product_thinking", "intent", "requirement", "market", "competitor",
    "innovation", "gap", "capability", "github", "repository", "strategy", "review",
]
AGENT_PHASE2 = [
    "approval", "deep_research", "composition", "architecture", "simulation",
    "blueprint", "engineering", "execution", "learning",
]


# ── v5 helpers ──────────────────────────────────────────────────────────────

def _capability_deps_validator(capabilities: dict[str, Any]) -> list[dict[str, Any]]:
    """Validate the capability graph: deps must exist and be mirrored as edges."""
    findings: list[dict[str, Any]] = []
    caps = as_list(capabilities.get("capabilities"))
    ids = {as_str(c.get("id")) for c in caps}
    edges = as_list(capabilities.get("edges"))
    edge_pairs = {(as_str(e.get("source")), as_str(e.get("target"))) for e in edges if isinstance(e, dict)}
    for c in caps:
        cid = as_str(c.get("id"))
        for dep in as_list(c.get("dependencies")):
            if dep and dep not in ids:
                findings.append({
                    "severity": "warning",
                    "category": "unknown_dependency",
                    "message": f"Capability {cid} depends on unknown id {dep}",
                })
            elif dep and dep in ids and (cid, dep) not in edge_pairs:
                findings.append({
                    "severity": "info",
                    "category": "missing_edge",
                    "message": f"Missing edge {cid} → {dep}",
                })
    return findings


def _fix_capability_deps(
    capabilities: dict[str, Any], _findings: list[dict[str, Any]]
) -> dict[str, Any]:
    """Deterministic revision: drop unknown deps and rebuild the edge list."""
    caps = as_list(capabilities.get("capabilities"))
    ids = {as_str(c.get("id")) for c in caps}
    fixed: list[dict[str, Any]] = []
    for c in caps:
        c2 = dict(c)
        c2["dependencies"] = [d for d in as_list(c2.get("dependencies")) if d in ids]
        fixed.append(c2)
    edges: list[dict[str, Any]] = []
    seen: set[tuple[str, str]] = set()
    for c in fixed:
        cid = c.get("id", "")
        for dep in c.get("dependencies", []):
            key = (cid, dep)
            if key not in seen:
                seen.add(key)
                edges.append({"source": cid, "target": dep, "type": "requires"})
    return {"domain": as_str(capabilities.get("domain")) or "general", "capabilities": fixed, "edges": edges}


async def _debate_mapping(
    mapping: dict[str, Any],
    capability: dict[str, Any],
    provider: LLMProvider,
    *,
    learning: dict[str, Any] | None = None,
    memory: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Run the capability ↔ repository ↔ architecture debate for one mapping.

    ``learning`` is the Experience Engine's per-repo stats; when it names a
    repo with a proven track record for this capability, that evidence is added
    as a Repository Agent position so past success can influence the winner.
    ``memory`` is the Product Memory retrieval result; when a similar past
    product used a candidate repo for this capability, that is added as a
    Product Memory Agent position.
    """
    cap_name = as_str(mapping.get("capability_name")) or as_str(capability.get("name")) or "capability"
    candidates = as_list(mapping.get("candidates"))
    selected = as_str(mapping.get("selected"))
    alternatives = as_list(mapping.get("alternatives"))
    alt = alternatives[0] if alternatives else None
    if not alt and len(candidates) > 1:
        alt = as_str(candidates[1].get("full_name"))
    integration = as_str(capability.get("integration_complexity")) or "medium"
    priority = as_str(capability.get("priority")) or "important"

    # v6 · Experience-based learning — past outcomes become a debate position.
    learning_stats = as_dict(learning or {}).get("repositories", {})
    learned_best = None
    learned_evidence: list[str] = []
    for cand in as_list(mapping.get("candidates")):
        cname = as_str(cand.get("full_name"))
        stats = as_dict(learning_stats.get(cname))
        if stats and int(stats.get("used_in", 0)) > 0:
            learned_evidence.append(
                f"{cname}: {int(stats.get('used_in', 0))} prior uses · "
                f"{round(float(stats.get('success_rate', 0)) * 100)}% success"
            )
            if learned_best is None or float(stats.get("success_rate", 0)) > learned_best[1]:
                learned_best = (cname, float(stats.get("success_rate", 0)))

    positions: list[dict[str, Any]] = [
        {
            "agent": "Capability Agent",
            "stance": f"The product needs {cap_name} ({priority} priority).",
            "argument": as_str(capability.get("description")) or f"{cap_name} is required for the product.",
            "evidence": [
                f"required_infrastructure: {as_list(capability.get('required_infrastructure'))}",
                f"integration_complexity: {integration}",
            ],
            "confidence": float(capability.get("confidence", 0.7)),
            "metrics": {"priority_weight": 1.0 if priority == "core" else 0.7},
        }
    ]
    if selected:
        top = next((c for c in candidates if c.get("full_name") == selected), None) or (candidates[0] if candidates else None)
        top = as_dict(top)
        positions.append({
            "agent": "Repository Agent",
            "stance": f"{selected} is the strongest repository for {cap_name}.",
            "argument": f"Weighted score {float(top.get('weighted_score', 0)):.2f}, {int(top.get('stars', 0))} stars.",
            "evidence": [
                f"weighted_score: {float(top.get('weighted_score', 0)):.2f}",
                f"stars: {int(top.get('stars', 0))}",
            ],
            "confidence": float(mapping.get("confidence", 0.6)),
            "metrics": {"explainable_score": float(top.get("weighted_score", 0.5))},
        })
    # v6 · Experience position — the repo with the best historical track record
    # for this capability argues from outcomes, not GitHub signals.
    if learned_best:
        best_name, best_rate = learned_best
        if best_name and best_name != selected:
            positions.append({
                "agent": "Repository Agent",
                "stance": f"{best_name} has a proven track record for {cap_name}.",
                "argument": (
                    f"{best_rate * 100:.0f}% historical success across "
                    f"{int(as_dict(learning_stats.get(best_name)).get('used_in', 0))} prior uses."
                ),
                "evidence": learned_evidence,
                "confidence": min(1.0, 0.5 + best_rate * 0.4),
                "metrics": {"learned_success_rate": round(best_rate, 3)},
            })

    # v6 Phase 6 · Product Memory position — a similar past product reused a
    # candidate repo for this capability, so it argues from precedent.
    memory_match = _memory_repo_for_cap(memory, cap_name)
    if memory_match and memory_match["repo"] and memory_match["repo"] != selected and memory_match["repo"] in {
        as_str(c.get("full_name")) for c in candidates
    }:
        positions.append({
            "agent": "Product Memory Agent",
            "stance": f"Similar past product used {memory_match['repo']} for {cap_name}.",
            "argument": (
                f"{memory_match['similarity'] * 100:.0f}% similar to "
                f"{memory_match['prev_product'] or 'a past product'}."
            ),
            "evidence": [
                f"similarity: {memory_match['similarity']:.2f}",
                f"shared_repos: {memory_match.get('shared_repos', [])}",
            ],
            "confidence": min(1.0, 0.45 + memory_match["similarity"] * 0.4),
            "metrics": {"memory_similarity": round(memory_match["similarity"], 3)},
        })
    if alt:
        positions.append({
            "agent": "Architecture Agent",
            "stance": f"{alt} lowers deployment complexity for {cap_name}.",
            "argument": f"Alternative candidate; weigh operational cost vs {integration} integration complexity.",
            "evidence": ["deployment consideration"],
            "confidence": 0.55,
            "metrics": {"integration_complexity_note": integration},
        })

    return await debate(
        f"Which repository best implements {cap_name}?",
        positions,
        provider,
    )


def _apply_debate_adjustments(
    capabilities: dict[str, Any],
    mappings: list[dict[str, Any]],
    debates: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Apply any Decision Engine 'change' adjustments to the capability mappings.

    A debate may decide a different repository is stronger. If an adjustment
    names a valid candidate for the mapping, override the selection and record
    the evidence. Deterministic.
    """
    updated = [dict(m) for m in mappings]
    for d in debates:
        for adj in as_list(d.get("adjustments")):
            a = as_dict(adj)
            if as_str(a.get("action")) != "change":
                continue
            target_repo = as_str(a.get("to"))
            item = as_str(a.get("item")) or ""
            for m in updated:
                if item and item.lower() not in as_str(m.get("capability_name", "")).lower():
                    continue
                candidates = [c.get("full_name") for c in as_list(m.get("candidates")) if isinstance(c, dict)]
                if target_repo and target_repo in candidates and target_repo != as_str(m.get("selected")):
                    m["selected"] = target_repo
                    m["confidence"] = round(max(0.5, float(d.get("confidence", 0.6))), 4)
                    m["debate_changed"] = True
                    m["debate_reason"] = as_str(d.get("winner_stance"))
                break
    return updated


def _weakest_mapping(mappings: list[dict[str, Any]]) -> dict[str, Any] | None:
    """The mapping with the lowest confidence that still has alternatives."""
    candidates = [m for m in mappings if as_str(m.get("selected")) and len(as_list(m.get("candidates"))) > 1]
    if not candidates:
        return None
    return min(candidates, key=lambda m: float(m.get("confidence", 1.0)))


def _memory_repo_for_cap(
    memory: dict[str, Any] | None,
    capability_name: str,
) -> dict[str, Any] | None:
    """
    Find a repository a similar past product used for ``capability_name``.

    Walks the Product Memory retrieval matches (highest similarity first) and
    returns the strongest repo a past product's ``repository_map`` used for this
    capability. Returns None when there is no memory or no overlap. Deterministic.
    """
    if not memory:
        return None
    cap_lower = capability_name.lower()
    for m in memory.get("matches", []):
        record = as_dict(m.get("record"))
        repo_map = as_dict(record.get("repository_map"))
        if not repo_map:
            continue
        for cap, repo in repo_map.items():
            if as_str(cap).lower() == cap_lower and as_str(repo):
                return {
                    "repo": as_str(repo),
                    "similarity": float(m.get("similarity", 0)),
                    "prev_product": as_str(m.get("idea")),
                    "shared_repos": as_list(m.get("shared_repositories")),
                }
    return None


class PiOrchestrator:
    """Adaptive multi-agent reasoning over the Product Knowledge Graph."""

    def __init__(self, provider: LLMProvider | None = None):
        self.provider = provider or get_provider()

    # ── Phase 1 ──────────────────────────────────────────────────────────────
    async def strategize(
        self,
        idea: str,
        github_token: str | None = None,
        tavily_key: str | None = None,
    ) -> dict[str, Any]:
        graph = ProductKnowledgeGraph(idea=idea)
        learning = get_learning_store()

        # v6 · Experience-based learning — load prior outcomes into the graph so
        # discovery, debate and strategy selection can be influenced by history.
        experience = ExperienceEngine(learning)
        learning_evidence = experience.evidence_report()
        graph.set("learning_evidence", learning_evidence)
        if learning_evidence.get("has_evidence"):
            graph.add_trace(
                "learning", "loaded prior experience into reasoning",
                f"{learning_evidence.get('repository_count', 0)} repos · "
                f"{learning_evidence.get('capability_count', 0)} capability rankings · "
                f"{learning_evidence.get('architecture_count', 0)} architecture patterns",
            )

        # v6 Phase 6 · Product Memory retrieval — the entry point for reasoning.
        # Draft a Product DNA from the idea (deterministic, no LLM) and retrieve
        # similar past products as structured guidance for every stage after this.
        memory = ProductMemory(learning)
        retrieval = memory.search(idea=idea)
        graph.set("product_memory", retrieval)
        if retrieval.get("matches"):
            graph.add_trace(
                "product_memory", "retrieved similar past products",
                f"{len(retrieval.get('matches', []))} similar of {retrieval.get('total_memory', 0)} in memory",
            )
        else:
            graph.add_trace(
                "product_memory", "no similar past products",
                retrieval.get("note") or "cold start — reasoning from first principles",
            )

        # 1. Product Thinking Agent
        intent = await analyze_intent(idea, self.provider)
        graph.set("intent", intent)
        graph.set("domain", intent.get("domain", ""))
        graph.add_trace("intent", "interpreted idea", intent.get("summary", ""), {"confidence": intent.get("confidence")})

        # 2. Product Thinking (PM reasoning above intent)
        thinking = await analyze_product_thinking(intent, self.provider)
        graph.set("product_thinking", thinking)
        graph.add_trace("product_thinking", "PM reasoning complete", thinking.get("business_objective", ""), {"confidence": thinking.get("confidence")})
        clarifying = as_list(thinking.get("clarifying_questions"))
        if clarifying:
            graph.add_trace("product_thinking", "low confidence — clarifying questions", " | ".join(clarifying))

        # 3. Requirement Intelligence
        requirements = await extract_requirements(intent, self.provider)
        graph.set("requirements", requirements)
        graph.add_trace("requirement", "extracted requirements", f"{len(requirements)} requirements")

        # 4. Market Intelligence (+ existing products)
        market = await analyze_market(intent, self.provider, tavily_key)
        graph.set("market", market)
        graph.set("existing_products", market.get("existing_products", []))
        graph.add_trace("market", "analyzed market", f"{len(market.get('existing_products', []))} existing products")

        # 5. Competitor Intelligence (Competitor Knowledge Graph)
        competitors = await build_competitor_intelligence(market, self.provider)
        for c in competitors:
            graph.add_competitor(c)
        graph.add_trace("competitor", "built competitor knowledge graph", f"{len(competitors)} competitors")

        # 6. Innovation Intelligence
        innovation = await analyze_innovation(intent, requirements, competitors, market, self.provider)
        graph.set("innovation", innovation)
        graph.add_trace("innovation", "identified what should exist", f"innovation score {innovation.get('innovation_score')}")

        # 7. Evolution Engine
        evolution = await analyze_evolution(intent, requirements, competitors, self.provider)
        graph.set("evolution", evolution)
        graph.add_trace("evolution", "mapped evolution chain", " → ".join(evolution.get("evolution_chain", [])[:4]))

        # 8. Gap Analysis (validated against innovation + competitors)
        gaps = await analyze_gaps(intent, requirements, market, self.provider)
        graph.set("gaps", gaps.get("gaps", []))
        graph.set("opportunity_statement", gaps.get("opportunity_statement", ""))
        graph.add_trace("gap", "identified gaps", gaps.get("opportunity_statement", ""))

        # 9. Capability Intelligence v2 → validate → improve → validate loop
        capabilities = await build_capability_graph(intent, requirements, gaps.get("gaps", []), self.provider)
        capabilities, cap_findings = await validate_and_improve(
            capabilities,
            _capability_deps_validator,
            _fix_capability_deps,
            max_iterations=1,
        )
        graph.set("capabilities", capabilities)
        graph.add_trace(
            "capability",
            "capability graph validated" if not cap_findings else f"capability graph revised ({len(cap_findings)} findings fixed)",
            f"{len(capabilities.get('capabilities', []))} capabilities",
        )

        # 10. GitHub Intelligence (per-capability discovery, weighted)
        github = await discover_repos_and_mappings(capabilities, intent, github_token)
        graph.set("repos", github.get("repos", []))
        graph.set("capability_mappings", github.get("capability_mappings", []))
        graph.add_trace(
            "github", "discovered repos per capability",
            f"{len(github.get('repos', []))} repos across {len(github.get('capability_mappings', []))} capabilities",
            {"note": github.get("note")},
        )

        # 11. Repository Intelligence v2 (12-dimension report)
        repo_intel = await build_repository_intelligence(github.get("repos", []), github.get("capability_mappings", []), github_token)
        graph.set("repository_intelligence", repo_intel)
        graph.add_trace("repository", "built repository intelligence report", f"{repo_intel.get('summary', {}).get('total', 0)} repos ranked")

        # 12. Agent Debate — capability ↔ repository ↔ architecture for the
        #     top 3 capabilities with candidates. Every repo choice now has reasoning.
        cap_list = as_list(capabilities.get("capabilities"))
        cap_by_name = {as_str(c.get("name")): c for c in cap_list}
        mappings = as_list(github.get("capability_mappings"))
        debate_candidates = [m for m in mappings if as_str(m.get("selected"))]
        # Run the debates concurrently — they are independent reasoning threads.
        debates: list[dict[str, Any]] = list(
            await asyncio.gather(
                *[
                    _debate_mapping(
                        m,
                        cap_by_name.get(as_str(m.get("capability_name")), {}),
                        self.provider,
                        learning=learning_evidence,
                        memory=retrieval,
                    )
                    for m in debate_candidates[:3]
                ]
            )
        )
        debates = [d for d in debates if d]
        for d in debates:
            graph.add_debate(d)
            graph.add_evidence(
                "debate",
                f"{d.get('topic')} → {d.get('winner_agent')} won",
                confidence=float(d.get("confidence", 0.6)),
                source=f"{d.get('winner_agent')} / Decision Engine",
                detail=as_str(d.get("winner_stance")),
            )
        mappings = _apply_debate_adjustments(capabilities, mappings, debates)
        graph.set("capability_mappings", mappings)
        graph.add_trace("debate", "agents debated capability↔repo↔architecture", f"{len(debates)} debates, selections recorded")

        # 13. Multi-Strategy Intelligence (biased by learned evidence)
        strategies = await generate_strategies(
            intent, requirements, capabilities,
            mappings, market, self.provider,
            innovation=innovation,
            learning=learning_evidence,
            memory=retrieval,
        )
        graph.set("strategies", strategies)
        graph.add_trace("strategy", "generated 3 strategies", "Fast MVP / Balanced / Enterprise")

        # 13b. v6 Phase 4 · Strategy Tournament — let the three strategies (plus
        #     a synthesized Challenger) compete across 8 weighted dimensions and
        #     head-to-head comparisons. Judgment is biased by the Experience
        #     Engine (Phase 1) and Product Memory (Phase 6), so this is a
        #     decision, not just a scoring layer.
        try:
            tournament = await run_strategy_tournament(
                strategies,
                mappings,
                learning_evidence,
                retrieval,
                self.provider,
            )
        except Exception as e:
            # Never break the pipeline — degrade to an empty tournament block.
            tournament = {"error": f"tournament failed: {e}"}
        graph.set("tournament", tournament)
        t_winner = tournament.get("winner", {})
        if t_winner:
            winner_conf = t_winner.get("confidence")
            if winner_conf is None:
                winner_conf = 0.7
            else:
                winner_conf = float(winner_conf)
            # Don't surface the challenger as the recommended strategy unless
            # it cleared the confidence gate — a low-confidence contrarian pick
            # would be surfaced as a primary recommendation otherwise.
            is_challenger = as_str(t_winner.get("id")) == "STRAT-D"
            if is_challenger and winner_conf < 0.55:
                graph.add_decision(
                    "tournament",
                    f"Challenger STRAT-D not recommended (confidence {winner_conf:.2f} below threshold)",
                    "The challenger did not achieve sufficient confidence to be the primary recommendation.",
                    confidence=winner_conf,
                )
            else:
                graph.add_decision(
                    "tournament",
                    f"Recommended {t_winner.get('id')} ({t_winner.get('name')})",
                    as_str(t_winner.get("rationale")) or "won the strategy tournament",
                    confidence=winner_conf,
                )
            for t_loser in tournament.get("rejected", []):
                loser_conf = t_loser.get("confidence")
                graph.add_decision(
                    "tournament",
                    f"Eliminated {t_loser.get('id')}: {as_str(t_loser.get('reason'))[:110]}",
                    as_str(t_loser.get("reason"))[:110],
                    confidence=0.5 if loser_conf is None else float(loser_conf),
                )
        graph.add_trace(
            "tournament", "strategies competed in the tournament",
            f"winner {t_winner.get('id')} · {len(tournament.get('ranking', []))} ranked",
        )

        # 14. Review Agent — validates the whole graph before approval
        review = await review_graph(graph.to_dict(), self.provider)
        graph.set("review", review)
        graph.add_trace(
            "review", "reviewed graph before approval",
            f"score {review.get('score')}/100 · verdict {review.get('verdict')}",
            {"findings": len(review.get("findings", []))},
        )

        # 15. Confidence propagation — every node now carries confidence;
        #     low-confidence stages trigger additional reasoning.
        confidences = propagate_confidences(graph.to_dict())
        graph.set_confidences(confidences)
        low = as_list(confidences.get("low_confidence"))
        if low:
            graph.add_trace("confidence", "low-confidence nodes flagged for refinement", ", ".join(low))
            graph.add_evidence(
                "confidence",
                f"Low-confidence stages: {', '.join(low)}",
                confidence=0.5,
                source="confidence propagation",
                detail="Additional reasoning recommended for these stages",
            )
            # Bounded refinement: re-debate the weakest repository mapping.
            weakest = _weakest_mapping(mappings)
            if "repositories" in low and weakest:
                weak_cap = cap_by_name.get(as_str(weakest.get("capability_name")), {})
                refine_debate = await _debate_mapping(weakest, weak_cap, self.provider, learning=learning_evidence, memory=retrieval)
                graph.add_debate(refine_debate)
                graph.set("capability_mappings", _apply_debate_adjustments(capabilities, mappings, [refine_debate]))
                graph.add_trace("refinement", "re-debated weakest repository choice", as_str(refine_debate.get("winner_stance")))
        else:
            graph.add_trace("confidence", "confidence propagation passed", f"overall {confidences.get('overall')}")

        # 16. Self-Critique — the AI asks itself hard questions before presenting.
        critique = await self_critique(graph.to_dict(), self.provider)
        graph.set("self_critique", critique)
        graph.add_trace(
            "self_critique", "self-critiqued the reasoning before presenting",
            f"score {critique.get('score')} · passed {critique.get('passed')}",
            {"concerns": len(critique.get("concerns", []))},
        )

        # 17. Product DNA — a comparable signature for this product.
        dna = compute_dna(graph.to_dict())
        graph.add_product_dna(dna)
        graph.add_trace("dna", "computed product DNA", dna.get("summary", ""))

        run_id = str(uuid.uuid4())[:8]
        graph.set("_run_id", run_id)
        graph.save(run_path(run_id))

        return {
            "run_id": run_id,
            "graph": graph.to_dict(),
            "strategies": strategies,
            "review": review,
            "confidences": confidences,
            "self_critique": critique,
            "product_dna": dna,
            "debates": debates,
            "tournament": tournament,
            "status": "awaiting_approval",
        }

    # ── Phase 2 ──────────────────────────────────────────────────────────────
    async def approve(self, run_id: str, strategy_id: str) -> dict[str, Any]:
        path = run_path(run_id)
        graph = ProductKnowledgeGraph.load(path)
        if graph is None:
            return {"success": False, "error": f"run_id {run_id} not found"}

        strategies = graph.get("strategies", [])
        strategy = next((s for s in strategies if s.get("id") == strategy_id), None)
        if strategy is None:
            strategy = next((s for s in strategies if s.get("name") == strategy_id), None)
        if strategy is None:
            return {"success": False, "error": f"strategy {strategy_id} not found"}

        intent = graph.get("intent", {})
        requirements = graph.get("requirements", [])
        capabilities = graph.get("capabilities", {})
        capability_mappings = graph.get("capability_mappings", [])
        domain = graph.get("domain", "")

        graph.set_approved_strategy(strategy)
        graph.add_trace("approval", "strategy approved", strategy.get("id", ""), {"name": strategy.get("name")})
        graph.add_decision(
            "approval", f"Approved {strategy.get('id', '')} ({strategy.get('name', '')})",
            strategy.get("why", ""), confidence=strategy.get("confidence", 0.7),
        )

        # Repository Composition Blueprint (module/API/file-level)
        composition_plan = build_composition_plan(strategy, capability_mappings)
        graph.set("composition_plan", composition_plan)
        graph.add_trace("composition", "built composition blueprint", f"{len(composition_plan.get('services', []))} services")

        # Deep Research + Architecture Intelligence v2 (multi-view) — the three
        # LLM-bound agents are independent here, so run them concurrently.
        research, architecture, architecture_views = await asyncio.gather(
            deep_research(intent, strategy, capability_mappings, self.provider),
            build_architecture(strategy, capability_mappings, composition_plan, self.provider),
            build_architecture_views(strategy, capabilities, composition_plan, self.provider),
        )
        graph.set("deep_research", research)
        graph.add_trace("research", "deep research", f"{len(research.get('technologies', []))} technologies")
        graph.set("architecture", architecture)
        graph.add_trace("architecture", "designed architecture", f"{len(architecture.get('components', []))} components")
        graph.set("architecture_views", architecture_views)
        graph.add_trace("architecture", "generated multi-view architecture", list(architecture_views.keys()))

        # v5 · Architecture Simulation — simulate before approving, auto-revise.
        simulation = simulate_architecture(
            strategy,
            capability_mappings,
            composition_plan,
            architecture,
            architecture_views,
            capability_edges=capabilities.get("edges", []),
            capabilities_meta=capabilities.get("capabilities", []),
        )
        graph.set("architecture_simulation", simulation)
        graph.add_trace(
            "simulation", "simulated architecture before approval",
            f"score {simulation.get('score')} · passed {simulation.get('passed')}",
            {"rounds": simulation.get("simulation_rounds"), "revisions": simulation.get("revision_summary")},
        )
        # apply the simulator's auto-revisions back to the plan/views
        revised_plan = simulation.get("revised_composition_plan") or composition_plan
        revised_views = simulation.get("revised_architecture_views") or architecture_views
        graph.set("composition_plan", revised_plan)
        graph.set("architecture_views", revised_views)
        if simulation.get("revision_summary"):
            graph.add_decision(
                "simulation", "Architecture revised after simulation",
                "; ".join(simulation.get("revision_summary", [])),
                confidence=round(simulation.get("score", 70) / 100, 3),
            )
            graph.add_evidence(
                "simulation",
                "Architecture auto-revised after failing simulation",
                confidence=round(simulation.get("score", 70) / 100, 3),
                source="architecture simulator",
                detail="; ".join(simulation.get("revision_summary", [])),
            )

        # Blueprint
        blueprint = build_blueprint(strategy, architecture, capability_mappings)
        graph.set("blueprint", blueprint)
        graph.add_trace("blueprint", "built blueprint", blueprint.get("product_name", ""))

        # Engineering Intelligence
        engineering = build_engineering(strategy, blueprint, architecture)
        graph.set("engineering", engineering)
        graph.add_trace("engineering", "built engineering setup", f"{len(engineering.get('config_files', []))} config files")

        # Execution Plan
        execution_plan = build_execution_plan(strategy, architecture, requirements)
        graph.set("execution_plan", execution_plan)
        graph.add_trace("execution", "built execution plan", f"{len(execution_plan.get('milestones', []))} milestones")

        # Learning System — record the approval, repo outcomes, capability
        # mappings and architecture decisions so future runs improve.
        learning = get_learning_store()
        learning.record_approval(strategy, domain)
        for cap_name, repo in as_dict(strategy.get("repository_map")).items():
            if repo:
                learning.record_capability_mapping(cap_name, repo, success=True)
                learning.record_repository_outcome(repo, approved=True)
        learning.record_architecture_decision(
            as_str(architecture.get("deployment")) or "docker-compose",
            domain, outcome="accepted", confidence=strategy.get("confidence", 0.7),
        )
        # v6 Phase 4 · persist the tournament that produced this approval so
        # future tournaments can learn whether the winner actually won.
        tournament = graph.get("tournament", {})
        if tournament:
            learning.record_tournament(run_id, tournament)
        graph.set("learning", learning.summary())
        graph.add_trace("learning", "recorded learning", str(learning.summary()))

        # recompute Product DNA now that a strategy is approved
        dna = compute_dna(graph.to_dict())
        graph.add_product_dna(dna)
        graph.add_trace("dna", "recomputed product DNA after approval", dna.get("summary", ""))

        # v6 Phase 6 · Persist the full product record to Product Memory so
        # future requests can retrieve this product before reasoning begins.
        import time as _time
        memory_record = {
            "idea": graph.get("idea", ""),
            "domain": domain,
            "product_dna": dna,
            "intent": intent,
            "capabilities": capabilities,
            "repository_map": as_dict(strategy.get("repository_map")),
            "architecture": architecture,
            "architecture_pattern": as_str(as_dict(architecture.get("deployment")) or "docker-compose"),
            "approved_strategy": strategy,
            "confidences": graph.get("confidences", {}),
            "debates": graph.get("debates", []),
            "decisions": graph.get("decisions", []),
            "simulation": simulation,
            "self_critique": graph.get("self_critique", {}),
            "review": graph.get("review", {}),
            "learning_evidence": graph.get("learning_evidence", {}),
            "tournament": graph.get("tournament", {}),
            "ts": int(_time.time() * 1000),
        }
        learning.record_product_memory(run_id, memory_record)
        graph.add_trace("product_memory", "persisted product to memory", f"{dna.get('domain')} · {dna.get('signature')}")

        graph.set("_status", "complete")
        graph.save(path)

        return {
            "success": True,
            "run_id": run_id,
            "graph": graph.to_dict(),
            "approved_strategy": strategy,
            "product_dna": dna,
            "architecture_simulation": simulation,
            "status": "complete",
        }
