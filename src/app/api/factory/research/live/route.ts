import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 90

type Signal = {
  source: string
  kind: string
  title: string
  url: string
  summary: string
  publishedAt?: string
  relevance?: number
  metrics?: Record<string, number | string>
}

const SOURCE_CATALOG = [
  { id: 'github', name: 'GitHub', mode: 'core', purpose: 'Repositories, releases, issues and maintenance activity' },
  { id: 'gitlab', name: 'GitLab', mode: 'live', purpose: 'Public open-source projects beyond GitHub' },
  { id: 'huggingface', name: 'Hugging Face', mode: 'live', purpose: 'Open models, datasets and runnable AI Spaces' },
  { id: 'depsdev', name: 'deps.dev / OpenSSF', mode: 'core', purpose: 'Project health, licenses, package mappings and Scorecard evidence' },
  { id: 'osv', name: 'OSV', mode: 'on-demand', purpose: 'Open-source vulnerability records' },
  { id: 'hackernews', name: 'Hacker News', mode: 'live', purpose: 'Near-real-time developer launches and interest' },
  { id: 'stackoverflow', name: 'Stack Overflow', mode: 'live', purpose: 'Developer pain points, errors and implementation demand' },
  { id: 'arxiv', name: 'arXiv', mode: 'live', purpose: 'Recent technical methods and research' },
  { id: 'dockerhub', name: 'Docker Hub', mode: 'on-demand', purpose: 'Container/deployment availability' },
  { id: 'pypi', name: 'PyPI', mode: 'on-demand', purpose: 'Python package release metadata' },
  { id: 'npm', name: 'npm', mode: 'on-demand', purpose: 'JavaScript package ecosystem metadata' },
  { id: 'tavily', name: 'Broad web research', mode: 'configured', purpose: 'Current competitors, pricing, news and product pages' },
] as const

function terms(value: string) {
  return [...new Set(value.toLowerCase().match(/[a-z0-9+#.]{3,}/g) || [])]
    .filter((term) => !['with', 'from', 'that', 'this', 'software', 'product', 'create', 'build'].includes(term))
    .slice(0, 10)
}

function relevance(query: string, value: string) {
  const wanted = terms(query)
  if (!wanted.length) return 0.5
  const lowered = value.toLowerCase()
  const hits = wanted.filter((term) => lowered.includes(term)).length
  return Math.min(1, 0.22 + (hits / wanted.length) * 0.78)
}

async function json(url: string, init?: RequestInit) {
  try {
    const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(15000) })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

function makeSignal(signal: Signal, query: string): Signal {
  return { ...signal, relevance: Number(relevance(query, `${signal.title} ${signal.summary}`).toFixed(3)) }
}

async function gitlab(query: string): Promise<Signal[]> {
  const url = new URL('https://gitlab.com/api/v4/projects')
  url.searchParams.set('search', query)
  url.searchParams.set('visibility', 'public')
  url.searchParams.set('simple', 'true')
  url.searchParams.set('order_by', 'star_count')
  url.searchParams.set('sort', 'desc')
  url.searchParams.set('per_page', '6')
  const data = await json(url.toString())
  if (!Array.isArray(data)) return []
  return data.slice(0, 6).map((item: any) => makeSignal({
    source: 'GitLab', kind: 'repository',
    title: item.name_with_namespace || item.name || 'GitLab project',
    url: item.web_url || '', summary: item.description || '', publishedAt: item.last_activity_at,
    metrics: { stars: item.star_count || 0, forks: item.forks_count || 0 },
  }, query))
}

async function huggingFace(query: string, kind: 'models' | 'datasets' | 'spaces'): Promise<Signal[]> {
  const url = new URL(`https://huggingface.co/api/${kind}`)
  url.searchParams.set('search', query)
  url.searchParams.set('sort', 'downloads')
  url.searchParams.set('direction', '-1')
  url.searchParams.set('limit', '5')
  const data = await json(url.toString())
  if (!Array.isArray(data)) return []
  return data.slice(0, 5).map((item: any) => {
    const id = item.modelId || item.id || ''
    const prefix = kind === 'models' ? '' : `${kind}/`
    return makeSignal({
      source: 'Hugging Face', kind: kind.slice(0, -1), title: id,
      url: id ? `https://huggingface.co/${prefix}${id}` : '',
      summary: Array.isArray(item.tags) ? item.tags.slice(0, 10).join(', ') : `Open ${kind.slice(0, -1)}`,
      publishedAt: item.lastModified,
      metrics: { downloads: item.downloads || 0, likes: item.likes || 0 },
    }, query)
  }).filter((item: Signal) => item.title)
}

async function hackerNews(query: string): Promise<Signal[]> {
  const ids = await json('https://hacker-news.firebaseio.com/v0/newstories.json')
  if (!Array.isArray(ids)) return []
  const items = await Promise.all(ids.slice(0, 28).map((id: number) => json(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)))
  return items.filter(Boolean).map((item: any) => makeSignal({
    source: 'Hacker News', kind: 'developer-news', title: item.title || '',
    url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    summary: `HN score ${item.score || 0} · ${item.descendants || 0} comments`,
    publishedAt: item.time ? new Date(item.time * 1000).toISOString() : undefined,
    metrics: { score: item.score || 0, comments: item.descendants || 0 },
  }, query)).filter((signal: Signal) => (signal.relevance || 0) >= 0.35).sort((a: Signal, b: Signal) => (b.relevance || 0) - (a.relevance || 0)).slice(0, 6)
}

async function stackOverflow(query: string): Promise<Signal[]> {
  const url = new URL('https://api.stackexchange.com/2.3/search/advanced')
  url.searchParams.set('site', 'stackoverflow')
  url.searchParams.set('order', 'desc')
  url.searchParams.set('sort', 'activity')
  url.searchParams.set('q', query)
  url.searchParams.set('pagesize', '7')
  const data = await json(url.toString()) as any
  if (!data || !Array.isArray(data.items)) return []
  return data.items.slice(0, 7).map((item: any) => makeSignal({
    source: 'Stack Overflow', kind: 'developer-question',
    title: String(item.title || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
    url: item.link || '',
    summary: `${item.answer_count || 0} answers · ${item.view_count || 0} views · score ${item.score || 0}`,
    publishedAt: item.last_activity_date ? new Date(item.last_activity_date * 1000).toISOString() : undefined,
    metrics: { answers: item.answer_count || 0, views: item.view_count || 0, score: item.score || 0 },
  }, query))
}

function atomValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return (match?.[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

async function arxiv(query: string): Promise<Signal[]> {
  try {
    const url = new URL('https://export.arxiv.org/api/query')
    url.searchParams.set('search_query', `all:${query}`)
    url.searchParams.set('start', '0')
    url.searchParams.set('max_results', '6')
    url.searchParams.set('sortBy', 'submittedDate')
    url.searchParams.set('sortOrder', 'descending')
    const response = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(18000) })
    if (!response.ok) return []
    const xml = await response.text()
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || []
    return entries.slice(0, 6).map((entry) => makeSignal({
      source: 'arXiv', kind: 'research-paper', title: atomValue(entry, 'title'),
      url: atomValue(entry, 'id'), summary: atomValue(entry, 'summary'), publishedAt: atomValue(entry, 'published'),
    }, query))
  } catch { return [] }
}

async function githubReleases(repos: string[], query: string): Promise<Signal[]> {
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'AI-Product-Factory/8.0' }
  if (token) headers.Authorization = `Bearer ${token}`
  const groups = await Promise.all(repos.slice(0, 5).map(async (repo) => {
    const releases = await json(`https://api.github.com/repos/${repo}/releases?per_page=2`, { headers })
    if (!Array.isArray(releases)) return []
    return releases.slice(0, 2).map((release: any) => makeSignal({
      source: 'GitHub Releases', kind: 'release', title: `${repo} ${release.name || release.tag_name || 'release'}`,
      url: release.html_url || `https://github.com/${repo}/releases`,
      summary: String(release.body || '').slice(0, 700) || `Latest published release for ${repo}`,
      publishedAt: release.published_at || release.created_at,
      metrics: {},
    }, query))
  }))
  return groups.flat()
}

async function tavily(query: string): Promise<Signal[]> {
  const key = process.env.TAVILY_API_KEY
  if (!key) return []
  const queries = [`${query} competitors pricing`, `${query} latest open source`, `${query} market news`]
  const groups = await Promise.all(queries.map(async (q) => {
    const data = await json('https://api.tavily.com/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query: q, max_results: 5, include_answer: false, include_raw_content: false }),
    }) as any
    if (!data || !Array.isArray(data.results)) return []
    return data.results.map((item: any) => makeSignal({
      source: 'Web research', kind: q.includes('pricing') ? 'pricing-market' : 'market-news',
      title: item.title || '', url: item.url || '', summary: item.content || '',
    }, query))
  }))
  return groups.flat()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const idea = typeof body.idea === 'string' ? body.idea.trim() : ''
    if (!idea) return NextResponse.json({ success: false, error: 'A product idea is required' }, { status: 400 })
    const repos = Array.isArray(body.repos) ? body.repos.filter((value: unknown) => typeof value === 'string').slice(0, 8) : []
    const query = terms(idea).slice(0, 6).join(' ') || idea.split(/\s+/).slice(0, 8).join(' ')
    const started = Date.now()
    const settled = await Promise.allSettled([
      gitlab(query), huggingFace(query, 'models'), huggingFace(query, 'datasets'), huggingFace(query, 'spaces'),
      hackerNews(query), stackOverflow(query), arxiv(query), githubReleases(repos, query), tavily(query),
    ])
    const signals = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
      .filter((signal) => signal.title && signal.url)
      .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
      .slice(0, 50)
    const counts = signals.reduce<Record<string, number>>((acc, signal) => { acc[signal.source] = (acc[signal.source] || 0) + 1; return acc }, {})
    return NextResponse.json({
      success: true, query, generatedAt: new Date().toISOString(), elapsedMs: Date.now() - started,
      sourceCatalog: SOURCE_CATALOG, signals,
      summary: { signalCount: signals.length, sourcesWithResults: Object.keys(counts).length, sourceCounts: counts },
      accuracyPolicy: 'Live evidence can be partial because upstream APIs change, rate-limit, or go offline. Every recommendation must preserve source URLs and validation gates.',
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Live research failed' }, { status: 500 })
  }
}
