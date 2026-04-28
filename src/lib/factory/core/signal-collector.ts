/**
 * Signal Collector — Web signals · GitHub repos · RAG retrieval
 * Ported from signal_collector.py — integrated with our MCP GitHub API
 */
import { llm } from '@/llm/provider'
import { webSearch } from '@/lib/search'
import { z } from 'zod'
import { getMemory } from '../core/rag-memory'
import type { ExpandedIdea } from '../core/idea-expander'
import {
  classifyIntent,
  rankByIntent,
  isGenericCollection,
  type IntentProfile,
} from './intent-classifier'

export interface RepoCandidate {
  fullName: string
  stars: number
  description: string
  url: string
  cloneUrl: string
  relevanceScore: number
  reason: string
  language?: string
  topics?: string[]
}

export interface SignalBundle {
  webSignals: any[]
  repoCandidates: RepoCandidate[]
  ragContext: any[]
}

const GITHUB_API_BASE = 'https://api.github.com'

async function githubFetch(endpoint: string, token?: string): Promise<any> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'AI-Product-Factory/1.0',
  }
  if (token) headers['Authorization'] = `token ${token}`

  const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, { headers })
  if (!response.ok) throw new Error(`GitHub API error: ${response.status}`)
  return response.json()
}

export class SignalCollector {
  private memory = getMemory()
  private githubToken?: string

  constructor(githubToken?: string) {
    this.githubToken = githubToken || process.env.GITHUB_TOKEN
  }

  // Web signals (using web search)
  async collectWebSignals(idea: string, expanded?: ExpandedIdea): Promise<any[]> {
    const queries = [idea]
    if (expanded) {
      queries.push(`${expanded.market} trends`)
      queries.push(`${expanded.usp} competitors`)
    }

    const results: any[] = []
    for (const q of queries.slice(0, 3)) {
      const searchResult = await webSearch(q, { maxResults: 3 })
      results.push(...searchResult)
    }

    console.log(`[SignalCollector] web signals: ${results.length} results`)
    return results
  }

  // GitHub repo search — domain-aware
  //
  // Pipeline:
  //   1. classifyIntent(idea)  → tags + curated GitHub queries + negative filters
  //   2. fan-out search across intent queries (NOT generic "Python stars:>100")
  //   3. hard-exclude awesome-*/tutorial/algorithms collections
  //   4. local domain-aware scoring (keywordMatch*3 + log(stars)*0.2 - 50 generic)
  //   5. LLM re-rank only the top-N survivors (cheaper + better signal)
  async collectGithubRepos(expanded: ExpandedIdea): Promise<RepoCandidate[]> {
    const intent: IntentProfile = classifyIntent(expanded.original)
    console.log(
      `[SignalCollector] intent: tags=[${intent.tags.join(', ')}] confidence=${intent.confidence.toFixed(2)}`
    )

    // Build query set: intent queries take priority. Fall back to suggestedStack
    // ONLY when intent confidence is low (unknown domain).
    let queries: string[]
    if (intent.confidence >= 0.5 && intent.queries.length > 0) {
      queries = intent.queries
    } else {
      const stack = expanded.suggestedStack.slice(0, 3)
      queries = stack.length > 0
        ? stack.map(tech => `${tech} stars:>100`)
        : [`${expanded.original} stars:>100`]
    }
    console.log(`[SignalCollector] github queries: ${queries.length}`)

    const allItems: any[] = []
    for (const q of queries) {
      try {
        const query = encodeURIComponent(q)
        const data = await githubFetch(
          `/search/repositories?q=${query}&sort=stars&order=desc&per_page=8`,
          this.githubToken
        )
        const items = (data.items || []).map((item: any) => ({
          fullName: item.full_name,
          stars: item.stargazers_count,
          description: item.description || '',
          url: item.html_url,
          cloneUrl: item.clone_url,
          language: item.language,
          topics: item.topics || [],
          relevanceScore: 0,
          reason: '',
        }))
        allItems.push(...items)
      } catch (e) {
        console.error('[SignalCollector] github_search error:', e)
      }
    }

    // Deduplicate
    const seen = new Set<string>()
    let unique = allItems.filter(item => {
      if (seen.has(item.fullName)) return false
      seen.add(item.fullName)
      return true
    })
    const beforeFilter = unique.length

    // Hard-exclude generic collections / tutorials / algorithm dumps
    unique = unique.filter(
      item => !isGenericCollection(item.fullName, item.description, item.topics, intent.negativeFilters)
    )
    if (beforeFilter !== unique.length) {
      console.log(`[SignalCollector] filtered ${beforeFilter - unique.length} generic/tutorial repos`)
    }

    // Domain-aware local scoring (works even with no LLM)
    const scored = rankByIntent(unique, intent, { topK: 15 })
    for (const s of scored) {
      const candidate = unique.find(u => u.fullName === s.fullName)
      if (candidate) {
        candidate.relevanceScore = s.score
        candidate.reason = s.reasons.join('; ')
      }
    }
    let preLLM: RepoCandidate[] = scored
      .map(s => unique.find(u => u.fullName === s.fullName))
      .filter(Boolean) as RepoCandidate[]

    // LLM re-rank ONLY the top survivors. We pass intent context so the LLM
    // optimizes for domain fit, not popularity.
    const ranked = await this.rankRepos(expanded, preLLM, intent)
    console.log(`[SignalCollector] github repos: ${ranked.length} ranked candidates`)
    return ranked
  }

  private async rankRepos(
    expanded: ExpandedIdea,
    candidates: RepoCandidate[],
    intent?: IntentProfile,
  ): Promise<RepoCandidate[]> {
    if (candidates.length === 0) return candidates

    try {
      const repoList = candidates.map(c => ({
        full_name: c.fullName,
        stars: c.stars,
        description: c.description,
        topics: c.topics,
      }))

      const schema = z.object({
        rankings: z.array(z.object({
          full_name: z.string(),
          score: z.number(),
          reason: z.string()
        }))
      })

      const intentBlock = intent
        ? `INTENT_TAGS: ${intent.tags.join(', ') || '(none)'}
DOMAIN_KEYWORDS: ${intent.positiveKeywords.join(', ')}
NEGATIVE_FILTERS (auto-excluded already): ${intent.negativeFilters.slice(0, 8).join(', ')}…
RULES:
- Optimize for INTENT MATCH, not GitHub popularity.
- Penalize generic collections / tutorials / algorithm dumps.
- Prefer concrete frameworks (e.g. langchain, playwright, temporal) over awesome-lists.
`
        : ''

      const data = await llm.generateJSON(
        schema,
        `IDEA:\n${expanded.original}\nFEATURES:\n${expanded.features.join(', ')}\n\n${intentBlock}REPOS:\n${JSON.stringify(repoList, null, 2)}`,
        `You are a domain-aware repo selection agent. Given a product idea, an INTENT profile, and a list of GitHub repos, rank repos by *intent-specific relevance* — not by stars. Score 0-1, one-line reason. Stars matter only as a tiebreaker.`,
        { temperature: 0.3 }
      )

      const rankMap = new Map(data.rankings?.map((r: any) => [r.full_name, r]) || [])

      for (const c of candidates) {
        const rank = rankMap.get(c.fullName)
        if (rank) {
          // Blend LLM score with our local domain-aware score so LLM can't
          // single-handedly resurrect a generic repo.
          const local = c.relevanceScore // already populated by rankByIntent
          c.relevanceScore = (rank.score * 10) * 0.6 + local * 0.4
          c.reason = rank.reason
        }
      }

      candidates.sort((a, b) => b.relevanceScore - a.relevanceScore)
    } catch (e) {
      console.error('[SignalCollector] ranking error:', e)
      // Fallback: keep the local domain-aware score (already on candidates)
      candidates.sort((a, b) => b.relevanceScore - a.relevanceScore)
    }

    return candidates
  }

  // RAG retrieval
  collectRagContext(idea: string): any[] {
    const hits = this.memory.recallContext(idea, 5)
    console.log(`[SignalCollector] RAG hits: ${hits.length}`)
    return hits
  }

  // Combined
  async collectAll(idea: string, expanded?: ExpandedIdea): Promise<SignalBundle> {
    const defaultExpanded: ExpandedIdea = {
      original: idea,
      market: idea,
      targetUsers: [],
      features: [],
      usp: idea,
      risks: [],
      suggestedStack: [],
      raw: {},
    }

    const exp = expanded || defaultExpanded

    const [webSignals, repoCandidates] = await Promise.all([
      this.collectWebSignals(idea, exp),
      this.collectGithubRepos(exp),
    ])

    // Note: Individual query costs are logged by the LLM manager per generateJSON call.
    return {
      webSignals,
      repoCandidates,
      ragContext: this.collectRagContext(idea),
    }
  }
}
