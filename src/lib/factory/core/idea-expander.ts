/**
 * Idea Expander — Market · Users · Features · USP · Risks
 * Ported from idea_expander.py
 */
import { llm } from '@/llm/provider'
import { z } from 'zod'
import type { ProbabilityScore } from './probability-engine'
import { classifyIntent } from './intent-classifier'

// Intent → realistic suggested stack used in the LLM-failure fallback path.
// (Previously this was hardcoded to ['TypeScript', 'Next.js', 'Python'] which
// caused queries like "Python stars:>100" to return awesome-python / algorithms.)
const STACK_BY_TAG: Record<string, string[]> = {
  rpa:                  ['Playwright', 'Robocorp', 'n8n'],
  agents:               ['LangChain', 'LangGraph', 'CrewAI'],
  'browser-automation': ['Playwright', 'Puppeteer', 'Selenium'],
  workflow:             ['Temporal', 'Prefect', 'Airflow'],
  orchestration:        ['Kubernetes', 'Temporal'],
  llm:                  ['LangChain', 'Ollama', 'vLLM'],
  rag:                  ['LlamaIndex', 'Haystack', 'Qdrant'],
  'vector-db':          ['Qdrant', 'Chroma', 'Weaviate'],
  ml:                   ['PyTorch', 'Transformers'],
  data:                 ['DuckDB', 'dbt', 'Kafka'],
  devops:               ['Docker', 'Terraform'],
  security:             ['Auth0', 'Keycloak'],
  web:                  ['Next.js', 'React'],
  mobile:               ['React Native', 'Flutter'],
  realtime:             ['Socket.IO', 'Pusher'],
  ui:                   ['shadcn-ui', 'Radix'],
}

export interface ExpandedIdea {
  original: string
  market: string
  targetUsers: string[]
  features: string[]
  usp: string
  risks: string[]
  suggestedStack: string[]
  raw: Record<string, any>
}

const ExpandedIdeaSchema = z.object({
  market: z.string(),
  target_users: z.array(z.string()),
  features: z.array(z.string()),
  usp: z.string(),
  risks: z.array(z.string()),
  suggested_stack: z.array(z.string())
})

export class IdeaExpander {
  async expand(idea: string, probScore?: ProbabilityScore): Promise<ExpandedIdea> {
    let probCtx = ''
    if (probScore) {
      probCtx = `\nProbability scores: feasibility=${probScore.feasibility}, novelty=${probScore.novelty}, demand=${probScore.demand}\nPlanner directives: ${probScore.directives.join(', ')}`
    }

    try {
      const data = await llm.generateJSON(
        ExpandedIdeaSchema,
        `IDEA:\n${idea}${probCtx}`,
        `You are a product strategist inside an AI product factory.
Given a raw product idea (and optional probability score), expand it into a structured brief.

Return ONLY valid JSON.
Be concrete and specific. Features should be implementable.`,
        { temperature: 0.7 }
      )

      const expanded: ExpandedIdea = {
        original: idea,
        market: data.market || idea,
        targetUsers: data.target_users || [],
        features: data.features || [],
        usp: data.usp || '',
        risks: data.risks || [],
        suggestedStack: data.suggested_stack || [],
        raw: data,
      }

      console.log(`[IdeaExpander] USP: ${expanded.usp}`)
      console.log(`[IdeaExpander] Features: ${expanded.features.join(', ')}`)
      return expanded
    } catch (error) {
      console.error('[IdeaExpander] error:', error)
      // Domain-aware fallback: derive stack from the user's intent rather than
      // a hardcoded ['TypeScript', 'Next.js', 'Python'] (which caused the
      // signal collector to surface awesome-python / TheAlgorithms / etc.).
      const intent = classifyIntent(idea)
      const stack: string[] = []
      for (const tag of intent.tags) {
        for (const tech of STACK_BY_TAG[tag] || []) {
          if (!stack.includes(tech)) stack.push(tech)
        }
        if (stack.length >= 4) break
      }
      const suggestedStack = stack.length > 0 ? stack : ['TypeScript', 'Python']
      console.log(
        `[IdeaExpander] fallback stack from intent [${intent.tags.join(',')}]: ${suggestedStack.join(', ')}`
      )

      return {
        original: idea,
        market: `Market for ${idea}`,
        targetUsers: ['Developers', 'Tech startups'],
        features: ['Core functionality', 'API access', 'Dashboard', 'Integration support', 'Documentation'],
        usp: `First product to fully address ${idea}`,
        risks: ['Market competition', 'Technical complexity', 'User adoption'],
        suggestedStack,
        raw: { intentTags: intent.tags, intentConfidence: intent.confidence },
      }
    }
  }
}
