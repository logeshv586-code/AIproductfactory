import { text } from './nlp-utils'
import { matchedCapabilities, lexicalRelevance } from './scoring'
import { json, githubHeaders } from './github'
import type { ResearchProfileV12, DeepResearchSignalV12 } from './types'

export function sourceProofSignals(repo: DeepResearchSignalV12) {
  const inspection = repo.inspection
  if (!inspection) return []
  const baseRelevance = Number(repo.relevance || 0)
  return inspection.sourceLinks.slice(1, 7).map<DeepResearchSignalV12>((link, index) => ({
    source: link.kind === 'readme' ? 'GitHub README' : 'GitHub source proof',
    kind: 'github-source-proof',
    title: `${repo.title} · ${link.label}`,
    url: link.url,
    summary: link.kind === 'readme'
      ? `README inspected before ${repo.title} was allowed into the recommendation pool.`
      : `Representative source file inspected for direct capability evidence: ${link.label}`,
    publishedAt: repo.publishedAt,
    relevance: Number(Math.max(0.62, baseRelevance - 0.02 - index * 0.005).toFixed(3)),
    capabilities: repo.capabilities,
    metrics: { inspectionScore: inspection.inspectionScore },
  }))
}

export function needsModelResearch(profile: ResearchProfileV12) {
  return /ai|llm|model|vision|video|image|speech|embedding|rag|inference|multimodal/i.test(`${profile.productArchetype} ${profile.capabilities.join(' ')}`)
}

export async function huggingFace(profile: ResearchProfileV12): Promise<DeepResearchSignalV12[]> {
  if (!needsModelResearch(profile)) return []
  const query = profile.specializedCapabilities.includes('Vision screen understanding') ? 'computer use vision gui grounding' : profile.productArchetype
  const url = new URL('https://huggingface.co/api/models')
  url.searchParams.set('search', query)
  url.searchParams.set('sort', 'downloads')
  url.searchParams.set('direction', '-1')
  url.searchParams.set('limit', '8')
  const data = await json(url.toString(), undefined, 12000)
  if (!Array.isArray(data)) return []
  return data.map((item: any) => {
    const id = text(item.modelId || item.id)
    const tags = (Array.isArray(item.tags) ? item.tags : []).join(' ')
    const corpus = `${id} ${tags}`
    const matched = matchedCapabilities(profile, corpus)
    const rel = lexicalRelevance(profile, corpus) * 0.55 + (matched.length / Math.max(1, Math.min(profile.specializedCapabilities.length, 5))) * 0.45
    return {
      source: 'Hugging Face', kind: 'model', title: id,
      url: id ? `https://huggingface.co/${id}` : '', summary: tags.slice(0, 600),
      publishedAt: item.lastModified, relevance: Number(Math.min(1, Math.max(0, rel)).toFixed(3)),
      capabilities: matched, metrics: { downloads: item.downloads || 0, likes: item.likes || 0 },
    }
  }).filter((signal: DeepResearchSignalV12) => signal.title && Number(signal.relevance || 0) >= 0.66).slice(0, 6)
}

export async function gitlab(profile: ResearchProfileV12): Promise<DeepResearchSignalV12[]> {
  const url = new URL('https://gitlab.com/api/v4/projects')
  url.searchParams.set('search', profile.productArchetype)
  url.searchParams.set('visibility', 'public')
  url.searchParams.set('simple', 'true')
  url.searchParams.set('order_by', 'last_activity_at')
  url.searchParams.set('sort', 'desc')
  url.searchParams.set('per_page', '8')
  const data = await json(url.toString(), undefined, 12000)
  if (!Array.isArray(data)) return []
  return data.map((item: any) => {
    const corpus = `${item.name_with_namespace || ''} ${item.description || ''}`
    const caps = matchedCapabilities(profile, corpus)
    const specialized = caps.filter((cap) => profile.specializedCapabilities.includes(cap))
    const relevance = Math.min(1, Math.max(0, lexicalRelevance(profile, corpus) * 0.55 + Math.min(1, specialized.length / 2) * 0.45))
    return {
      source: 'GitLab', kind: 'repository-lead', title: item.name_with_namespace || item.name || 'GitLab project',
      url: item.web_url || '', summary: item.description || '', publishedAt: item.last_activity_at,
      relevance: Number(relevance.toFixed(3)), capabilities: caps,
      metrics: { stars: item.star_count || 0, forks: item.forks_count || 0 },
    }
  }).filter((signal: DeepResearchSignalV12) => Number(signal.relevance || 0) >= 0.70 && (signal.capabilities || []).some((cap) => profile.specializedCapabilities.includes(cap))).slice(0, 5)
}

export async function tavily(profile: ResearchProfileV12): Promise<DeepResearchSignalV12[]> {
  const key = process.env.TAVILY_API_KEY
  if (!key) return []
  const queries = [
    `${profile.productArchetype} existing products open source competitors`,
    `${profile.productArchetype} pricing product`,
    `${profile.productArchetype} architecture computer automation`,
  ]
  const groups = await Promise.all(queries.map(async (query) => {
    const data = await json('https://api.tavily.com/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query, max_results: 6, include_answer: false, include_raw_content: false }),
    }, 15000) as any
    if (!data || !Array.isArray(data.results)) return []
    return data.results.map((item: any) => {
      const corpus = `${item.title || ''} ${item.content || ''}`
      const relevance = lexicalRelevance(profile, corpus)
      return {
        source: 'Web research', kind: query.includes('pricing') ? 'pricing-market' : 'existing-product',
        title: item.title || '', url: item.url || '', summary: String(item.content || '').slice(0, 800),
        relevance: Number(relevance.toFixed(3)), capabilities: matchedCapabilities(profile, corpus),
      } satisfies DeepResearchSignalV12
    }).filter((signal: DeepResearchSignalV12) => Number(signal.relevance || 0) >= 0.68)
  }))
  return groups.flat().slice(0, 12)
}

function atomValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return (match?.[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

export async function arxiv(profile: ResearchProfileV12): Promise<DeepResearchSignalV12[]> {
  if (!/vision|agent|multimodal|computer use|learning|inference/i.test(`${profile.productArchetype} ${profile.specializedCapabilities.join(' ')}`)) return []
  const focus = profile.specializedCapabilities.slice(0, 3).flatMap((cap) => {
    return cap.toLowerCase().match(/[a-z0-9+#.-]{3,}/g) || []
  }).slice(0, 4)
  if (!focus.length) return []
  try {
    const url = new URL('https://export.arxiv.org/api/query')
    url.searchParams.set('search_query', focus.map((term) => `all:${term}`).join(' AND '))
    url.searchParams.set('start', '0')
    url.searchParams.set('max_results', '6')
    url.searchParams.set('sortBy', 'relevance')
    const response = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(15000) })
    if (!response.ok) return []
    const xml = await response.text()
    return (xml.match(/<entry>[\s\S]*?<\/entry>/gi) || []).map((entry) => {
      const title = atomValue(entry, 'title')
      const summary = atomValue(entry, 'summary')
      const corpus = `${title} ${summary}`
      const rel = lexicalRelevance(profile, corpus)
      return {
        source: 'arXiv', kind: 'research-paper', title,
        url: atomValue(entry, 'id'), summary: summary.slice(0, 800), publishedAt: atomValue(entry, 'published'),
        relevance: Number(rel.toFixed(3)), capabilities: matchedCapabilities(profile, corpus),
      } satisfies DeepResearchSignalV12
    }).filter((signal) => Number(signal.relevance || 0) >= 0.78).slice(0, 4)
  } catch { return [] }
}

export async function githubReleases(repos: DeepResearchSignalV12[]) {
  const groups = await Promise.all(repos.slice(0, 6).map(async (repo) => {
    const fullName = text(repo.repository?.fullName)
    if (!fullName) return []
    const releases = await json(`https://api.github.com/repos/${fullName}/releases?per_page=1`, { headers: githubHeaders() }, 10000)
    if (!Array.isArray(releases) || !releases[0]) return []
    const release = releases[0] as any
    return [{
      source: 'GitHub Releases', kind: 'release', title: `${fullName} · ${release.name || release.tag_name || 'latest release'}`,
      url: release.html_url || `${repo.url}/releases`, summary: String(release.body || 'Latest published release inspected for the shortlisted repository.').slice(0, 600),
      publishedAt: release.published_at || release.created_at, relevance: Number(Math.max(0.64, Number(repo.relevance || 0) - 0.04).toFixed(3)),
      capabilities: repo.capabilities, metrics: {},
    } satisfies DeepResearchSignalV12]
  }))
  return groups.flat()
}
