/**
 * Probability Engine — Feasibility · Novelty · Demand → Planner directives
 * Ported from probability_engine.py
 */
import { llm } from '@/llm/provider'
import { z } from 'zod'
import { getMemory } from './rag-memory'

export interface ProbabilityScore {
  feasibility: number
  novelty: number
  demand: number
  composite: number
  directives: string[]
  rationale: string
}

const ProbabilityScoreSchema = z.object({
  feasibility: z.number().min(0).max(1),
  novelty: z.number().min(0).max(1),
  demand: z.number().min(0).max(1),
  directives: z.array(z.string()),
  rationale: z.string()
})

const DEFAULT_WEIGHTS = { feasibility: 0.4, novelty: 0.3, demand: 0.3 }

export class ProbabilityEngine {
  private memory = getMemory()

  private getWeights(): Record<string, number> {
    const stored = this.memory.getProbWeights()
    return Object.keys(stored).length > 0 ? stored : DEFAULT_WEIGHTS
  }

  async score(idea: string, context = ''): Promise<ProbabilityScore> {
    const weights = this.getWeights()

    try {
      const data = await llm.generateJSON(
        ProbabilityScoreSchema,
        `IDEA:\n${idea}\n\nCONTEXT:\n${context || 'none'}`,
        `You are a probability scoring engine for an AI product factory.
Given an idea and optional market/repo context, score it on three axes (0.0-1.0):
  - feasibility: can this be built with existing open-source repos and AI tools?
  - novelty: how differentiated / non-commoditised is this idea?
  - demand: how strong is the market demand signal?

Directives are short instructions for the planner (e.g. "prefer repos with MIT licence", "focus on API-first architecture").`,
        { temperature: 0.4 }
      )

      const composite = Math.round(
        (data.feasibility * (weights.feasibility || 0.4) +
          data.novelty * (weights.novelty || 0.3) +
          data.demand * (weights.demand || 0.3)) * 1000
      ) / 1000

      const score: ProbabilityScore = {
        feasibility: data.feasibility,
        novelty: data.novelty,
        demand: data.demand,
        composite,
        directives: data.directives || [],
        rationale: data.rationale || '',
      }

      console.log(`[ProbabilityEngine] composite=${score.composite} F=${score.feasibility} N=${score.novelty} D=${score.demand}`)
      return score
    } catch (error) {
      console.error('[ProbabilityEngine] error:', error)
      return {
        feasibility: 0.5,
        novelty: 0.5,
        demand: 0.5,
        composite: 0.5,
        directives: ['Use fallback scoring due to LLM error'],
        rationale: 'Fallback scoring applied due to error',
      }
    }
  }

  updateWeights(feedback: Record<string, number>): Record<string, number> {
    const w = this.getWeights()
    for (const k of ['feasibility', 'novelty', 'demand'] as const) {
      if (k in feedback) {
        w[k] = Math.round(0.8 * (w[k] || 0.4) + 0.2 * feedback[k] * 10000) / 10000
      }
    }
    // Normalize
    const total = Object.values(w).reduce((a, b) => a + b, 0)
    for (const k of Object.keys(w)) {
      w[k] = Math.round((w[k] / total) * 10000) / 10000
    }
    this.memory.storeProbWeights(w)
    return w
  }
}
