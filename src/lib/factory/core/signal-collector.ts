/**
 * Signal Collector — Web signals · GitHub repos · RAG retrieval
 * Ported from signal_collector.py — integrated with our MCP GitHub API
 */
import { llm } from '@/llm/provider'
import { webSearch } from '@/lib/search'
import { z } from 'zod'
import { getMemory } from '../core/rag-memory'
import type { ExpandedIdea } from '../core/idea-expander'

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

  // GitHub repo search
  async collectGithubRepos(expanded: ExpandedIdea): Promise<RepoCandidate[]> {
    const queries = expanded.suggestedStack.length > 0
      ? expanded.suggestedStack.slice(0, 3)
      : [expanded.original]

    const allItems: any[] = []
    for (const tech of queries) {
      try {
        const query = encodeURIComponent(`${tech} stars:>100`)
        const data = await githubFetch(
          `/search/repositories?q=${query}&sort=stars&order=desc&per_page=5`,
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
    const unique = allItems.filter(item => {
      if (seen.has(item.fullName)) return false
      seen.add(item.fullName)
      return true
    })

    // Rank with LLM
    const ranked = await this.rankRepos(expanded, unique)
    console.log(`[SignalCollector] github repos: ${ranked.length} ranked candidates`)
    return ranked
  }

  private async rankRepos(expanded: ExpandedIdea, candidates: RepoCandidate[]): Promise<RepoCandidate[]> {
    if (candidates.length === 0) return candidates

    try {
      const repoList = candidates.map(c => ({
        full_name: c.fullName,
        stars: c.stars,
        description: c.description,
      }))

      const schema = z.object({
        rankings: z.array(z.object({
          full_name: z.string(),
          score: z.number(),
          reason: z.string()
        }))
      })

      const data = await llm.generateJSON(
        schema,
        `IDEA:\n${expanded.original}\nFEATURES:\n${expanded.features.join(', ')}\n\nREPOS:\n${JSON.stringify(repoList, null, 2)}`,
        `You are a repo selection agent. Given an expanded product idea and a list of GitHub repos, rank them by relevance. For each repo return a score 0-1 and a one-line reason.`,
        { temperature: 0.3 }
      )

      const rankMap = new Map(data.rankings?.map((r: any) => [r.full_name, r]) || [])

      for (const c of candidates) {
        const rank = rankMap.get(c.fullName)
        if (rank) {
          c.relevanceScore = rank.score
          c.reason = rank.reason
        }
      }

      candidates.sort((a, b) => b.relevanceScore - a.relevanceScore)
    } catch (e) {
      console.error('[SignalCollector] ranking error:', e)
      // Fallback: sort by stars
      candidates.sort((a, b) => b.stars - a.stars)
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
