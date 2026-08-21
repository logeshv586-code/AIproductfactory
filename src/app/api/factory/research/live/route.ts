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
  capabilities?: string[]
  repository?: {
    fullName?: string
    description?: string
    language?: string
    license?: string
    stars?: number
    forks?: number
    updatedAt?: string
    archived?: boolean
    topics?: string[]
  }
}

type ResearchProfile = {
  query: string
  intentTerms: string[]
  domainTerms: string[]
  capabilities: string[]
  domain: string
}

const SOURCE_CATALOG = [
  { id: 'github', name: 'GitHub', mode: 'core', purpose: 'Capability-matched repositories, releases and maintenance evidence' },
  { id: 'gitlab', name: 'GitLab', mode: 'live', purpose: 'Capability-matched public projects beyond GitHub' },
  { id: 'huggingface', name: 'Hugging Face', mode: 'live', purpose: 'Open models, datasets and runnable AI Spaces when the product needs AI/model capabilities' },
  { id: 'depsdev', name: 'deps.dev / OpenSSF', mode: 'core', purpose: 'Project health, licenses, package mappings and Scorecard evidence' },
  { id: 'osv', name: 'OSV', mode: 'on-demand', purpose: 'Open-source vulnerability records for shortlisted components' },
  { id: 'hackernews', name: 'Hacker News', mode: 'expert', purpose: 'Relevant launches and developer adoption signals' },
  { id: 'stackoverflow', name: 'Stack Overflow', mode: 'expert', purpose: 'Relevant implementation pain points and ecosystem evidence' },
  { id: 'arxiv', name: 'arXiv', mode: 'expert', purpose: 'Technical methods only when research papers directly match an AI/research capability' },
  { id: 'dockerhub', name: 'Docker Hub', mode: 'on-demand', purpose: 'Container/deployment availability for shortlisted components' },
  { id: 'pypi', name: 'PyPI', mode: 'on-demand', purpose: 'Python package release metadata for shortlisted components' },
  { id: 'npm', name: 'npm', mode: 'on-demand', purpose: 'JavaScript package ecosystem metadata for shortlisted components' },
  { id: 'tavily', name: 'Broad web research', mode: 'configured', purpose: 'Current competitors, pricing, market evidence and product pages' },
] as const

const STOP = new Set([
  'about', 'after', 'again', 'also', 'another', 'because', 'before', 'being', 'build', 'building', 'create',
  'customer', 'customers', 'does', 'from', 'have', 'into', 'make', 'making', 'more', 'most', 'only', 'other',
  'product', 'products', 'should', 'some', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this',
  'through', 'using', 'want', 'with', 'within', 'without', 'would', 'your', 'application', 'software',
])

const SYNONYMS: Record<string, string[]> = {
  sales: ['crm', 'lead', 'prospect', 'prospecting', 'outreach', 'pipeline', 'contact', 'email', 'enrichment'],
  lead: ['prospect', 'contact', 'crm', 'outreach'],
  prospect: ['lead', 'contact', 'outreach', 'enrichment', 'crm'],
  shopping: ['ecommerce', 'commerce', 'price', 'pricing', 'catalog', 'merchant', 'seller', 'retail', 'comparison'],
  ecommerce: ['shopping', 'catalog', 'merchant', 'seller', 'pricing', 'retail'],
  video: ['media', 'generation', 'diffusion', 'animation', 'render', 'image', 'multimodal'],
  document: ['pdf', 'ocr', 'docx', 'pptx', 'markdown', 'extraction', 'parser'],
  support: ['ticket', 'helpdesk', 'chat', 'knowledge', 'faq'],
  finance: ['invoice', 'accounting', 'payment', 'billing', 'expense', 'reconciliation'],
  recruiting: ['job', 'candidate', 'resume', 'hiring', 'ats', 'recruitment'],
  automation: ['workflow', 'agent', 'task', 'trigger', 'approval', 'integration', 'orchestration'],
  ai: ['llm', 'agent', 'rag', 'embedding', 'model', 'inference', 'prompt'],
  search: ['retrieval', 'index', 'query', 'semantic', 'vector'],
  authentication: ['auth', 'oauth', 'sso', 'identity', 'rbac'],
  monitoring: ['observability', 'metrics', 'telemetry', 'tracing', 'logs'],
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function list<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0))
}

function stem(value: string) {
  let token = value.toLowerCase().replace(/[^a-z0-9+#.-]/g, '')
  if (token.length > 6 && token.endsWith('ing')) token = token.slice(0, -3)
  else if (token.length > 5 && token.endsWith('ed')) token = token.slice(0, -2)
  else if (token.length > 5 && token.endsWith('es')) token = token.slice(0, -2)
  else if (token.length > 4 && token.endsWith('s')) token = token.slice(0, -1)
  return token
}

function terms(value: string, max = 18) {
  return [...new Set(value.toLowerCase().match(/[a-z0-9+#.-]{3,}/g) || [])]
    .map(stem)
    .filter((term) => term && !STOP.has(term))
    .slice(0, max)
}

function expand(values: string[]) {
  const output = new Set(values.map(stem))
  for (const value of values) {
    const key = stem(value)
    for (const synonym of SYNONYMS[key] || []) output.add(stem(synonym))
  }
  for (const [anchor, synonyms] of Object.entries(SYNONYMS)) {
    const group = [anchor, ...synonyms].map(stem)
    if (group.some((term) => output.has(term))) group.forEach((term) => output.add(term))
  }
  return [...output]
}

function capabilityNames(graph: Record<string, any>) {
  const output: string[] = []
  const add = (value: unknown) => {
    const item = text(value)
    if (!item) return
    if (!output.some((existing) => terms(existing).join('|') === terms(item).join('|'))) output.push(item)
  }
  for (const capability of list<Record<string, any>>(graph?.capabilities?.capabilities)) add(capability.name || capability.title)
  for (const mapping of list<Record<string, any>>(graph?.capability_mappings)) add(mapping.capability_name || mapping.capability_id)
  for (const requirement of list<Record<string, any>>(graph?.requirements)) add(requirement.capability || requirement.name)
  return output.slice(0, 12)
}

function inferDomain(idea: string) {
  const value = idea.toLowerCase()
  const domains: Array<[string, RegExp]> = [
    ['Sales & CRM', /sales|crm|lead|prospect|outreach|pipeline|customer acquisition/],
    ['Commerce & Shopping', /shopping|ecommerce|e-commerce|price|pricing|seller|merchant|catalog/],
    ['Video & Media AI', /video|animation|cartoon|image generation|media generation|diffusion/],
    ['Documents & Knowledge', /document|pdf|ocr|knowledge base|rag|file extraction/],
    ['Customer Support', /support|helpdesk|ticket|customer service|faq/],
    ['Finance Operations', /invoice|accounting|billing|payment|expense|finance/],
    ['Recruiting & Jobs', /recruit|hiring|candidate|resume|job application|ats/],
    ['Business Automation', /automation|workflow|approval|agent|process/],
  ]
  return domains.find(([, pattern]) => pattern.test(value))?.[0] || 'General software product'
}

function buildProfile(idea: string, graph: Record<string, any>): ResearchProfile {
  const capabilities = capabilityNames(graph)
  const intentTerms = terms(idea, 18)
  const capabilityTerms = terms(capabilities.join(' '), 16)
  const expanded = expand([...intentTerms, ...capabilityTerms])
  const domainTerms = expanded.filter((term) => !['frontend', 'backend', 'database', 'auth', 'authentication', 'api', 'monitor', 'monitoring', 'search'].includes(term)).slice(0, 10)
  const query = [...new Set([...domainTerms.slice(0, 6), ...capabilityTerms.slice(0, 4)])].slice(0, 9).join(' ')
    || intentTerms.slice(0, 8).join(' ')
    || idea.split(/\s+/).slice(0, 8).join(' ')
  return { query, intentTerms: expanded.slice(0, 36), domainTerms, capabilities, domain: inferDomain(idea) }
}

function relevance(profile: ResearchProfile, value: string, focus = '') {
  const corpus = new Set(terms(`${value} ${focus}`, 80))
  const wanted = profile.intentTerms
  if (!wanted.length) return 0.5
  const domainWanted = profile.domainTerms.length ? profile.domainTerms : wanted.slice(0, 8)
  const domainHits = domainWanted.filter((term) => corpus.has(stem(term))).length
  const allHits = wanted.filter((term) => corpus.has(stem(term))).length
  const domainScore = domainHits / Math.max(1, Math.min(domainWanted.length, 8))
  const broadScore = allHits / Math.max(1, Math.min(wanted.length, 16))
  const capabilityBoost = profile.capabilities.some((capability) => {
    const capTerms = terms(capability)
    if (!capTerms.length) return false
    return capTerms.filter((term) => corpus.has(term)).length / capTerms.length >= 0.6
  }) ? 0.15 : 0
  return clamp(domainScore * 0.56 + broadScore * 0.34 + capabilityBoost)
}

function matchedCapabilities(profile: ResearchProfile, value: string) {
  const corpus = new Set(terms(value, 90))
  return profile.capabilities.filter((capability) => {
    const capTerms = terms(capability)
    if (!capTerms.length) return false
    return capTerms.filter((term) => corpus.has(term)).length / capTerms.length >= 0.5
  })
}

function genericCapability(value: string) {
  return /frontend|ui|backend|api|database|data store|authentication|auth|search|monitoring|observability|queue|workflow|notification/i.test(value)
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

function makeSignal(signal: Signal, profile: ResearchProfile, focus = ''): Signal {
  return { ...signal, relevance: Number(relevance(profile, `${signal.title} ${signal.summary}`, focus).toFixed(3)) }
}

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'AI-Product-Factory/10.0',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function daysSince(value: string | undefined) {
  const time = value ? new Date(value).getTime() : Number.NaN
  if (!Number.isFinite(time)) return 3650
  return Math.max(0, (Date.now() - time) / 86_400_000)
}

function repositoryHealth(item: any) {
  const stars = Math.max(0, Number(item.stargazers_count || 0))
  const forks = Math.max(0, Number(item.forks_count || 0))
  const ageDays = daysSince(item.pushed_at || item.updated_at)
  const activityScore = ageDays <= 30 ? 1 : ageDays <= 90 ? 0.92 : ageDays <= 180 ? 0.82 : ageDays <= 365 ? 0.68 : ageDays <= 730 ? 0.48 : 0.28
  const popularityScore = clamp(Math.log10(stars + 1) / 4.5)
  const ecosystemScore = clamp(Math.log10(forks + 1) / 3.5)
  const docsScore = text(item.description).length >= 30 ? 0.9 : text(item.description).length ? 0.65 : 0.35
  const licenseKey = text(item.license?.spdx_id).toLowerCase()
  const licenseScore = !licenseKey || ['noassertion', 'other'].includes(licenseKey)
    ? 0.35
    : ['mit', 'apache-2.0', 'bsd-2-clause', 'bsd-3-clause', 'isc', 'mpl-2.0'].includes(licenseKey)
      ? 1
      : 0.68
  const health = clamp(activityScore * 0.35 + popularityScore * 0.22 + ecosystemScore * 0.08 + docsScore * 0.15 + licenseScore * 0.20)
  return {
    healthScore: Math.round(health * 100),
    activityScore: Math.round(activityScore * 100),
    popularityScore: Math.round(popularityScore * 100),
    licenseScore: Math.round(licenseScore * 100),
  }
}

async function githubRepositories(profile: ResearchProfile): Promise<Signal[]> {
  const baseTerms = profile.domainTerms.slice(0, 4).join(' ') || profile.query
  const capabilityQueries = profile.capabilities.slice(0, 4).map((capability) => ({
    query: `${baseTerms} ${terms(capability, 4).join(' ')}`.trim(),
    capability,
  }))
  const queries = [
    { query: profile.query, capability: '' },
    ...capabilityQueries,
  ].filter((item, index, values) => item.query && values.findIndex((candidate) => candidate.query === item.query) === index).slice(0, 5)

  const groups = await Promise.all(queries.map(async ({ query, capability }) => {
    const url = new URL('https://api.github.com/search/repositories')
    url.searchParams.set('q', `${query} in:name,description,readme archived:false`)
    url.searchParams.set('sort', 'stars')
    url.searchParams.set('order', 'desc')
    url.searchParams.set('per_page', '10')
    const data = await json(url.toString(), { headers: githubHeaders() }) as any
    if (!data || !Array.isArray(data.items)) return []

    return data.items.map((item: any) => {
      const topics = list<string>(item.topics)
      const corpus = `${item.full_name || ''} ${item.description || ''} ${topics.join(' ')}`
      const matched = matchedCapabilities(profile, `${corpus} ${capability}`)
      const productRelevance = relevance(profile, corpus, capability)
      const capFit = profile.capabilities.length ? matched.length / profile.capabilities.length : productRelevance
      const health = repositoryHealth(item)
      const recommendationScore = clamp(productRelevance * 0.65 + capFit * 0.15 + (health.healthScore / 100) * 0.20)
      const focusedGeneric = capability && genericCapability(capability) && matched.includes(capability)
      if (item.archived) return null
      if (productRelevance < (focusedGeneric ? 0.30 : 0.44) && recommendationScore < 0.55) return null

      return {
        source: 'GitHub',
        kind: 'github-repository',
        title: item.full_name || item.name || 'GitHub repository',
        url: item.html_url || '',
        summary: text(item.description) || `Open-source repository matched to ${matched.join(', ') || capability || profile.domain}.`,
        publishedAt: item.pushed_at || item.updated_at,
        relevance: Number(Math.max(productRelevance, recommendationScore * 0.92).toFixed(3)),
        capabilities: matched.length ? matched : capability ? [capability] : [],
        metrics: {
          stars: Number(item.stargazers_count || 0),
          forks: Number(item.forks_count || 0),
          openIssues: Number(item.open_issues_count || 0),
          recommendationScore: Math.round(recommendationScore * 100),
          healthScore: health.healthScore,
          activityScore: health.activityScore,
          popularityScore: health.popularityScore,
          licenseScore: health.licenseScore,
        },
        repository: {
          fullName: item.full_name || '',
          description: text(item.description),
          language: text(item.language) || 'Unknown',
          license: text(item.license?.spdx_id) || 'unknown',
          stars: Number(item.stargazers_count || 0),
          forks: Number(item.forks_count || 0),
          updatedAt: item.pushed_at || item.updated_at,
          archived: Boolean(item.archived),
          topics,
        },
      } satisfies Signal
    }).filter((signal: Signal | null): signal is Signal => Boolean(signal))
  }))

  const byRepo = new Map<string, Signal>()
  for (const signal of groups.flat()) {
    const key = text(signal.repository?.fullName).toLowerCase() || signal.title.toLowerCase()
    const existing = byRepo.get(key)
    if (!existing || Number(signal.relevance || 0) > Number(existing.relevance || 0)) byRepo.set(key, signal)
    else if (existing) existing.capabilities = [...new Set([...(existing.capabilities || []), ...(signal.capabilities || [])])]
  }

  return [...byRepo.values()]
    .sort((a, b) => Number(b.metrics?.recommendationScore || 0) - Number(a.metrics?.recommendationScore || 0))
    .slice(0, 28)
}

async function gitlab(profile: ResearchProfile): Promise<Signal[]> {
  const url = new URL('https://gitlab.com/api/v4/projects')
  url.searchParams.set('search', profile.query)
  url.searchParams.set('visibility', 'public')
  url.searchParams.set('simple', 'true')
  url.searchParams.set('order_by', 'star_count')
  url.searchParams.set('sort', 'desc')
  url.searchParams.set('per_page', '8')
  const data = await json(url.toString())
  if (!Array.isArray(data)) return []
  return data.slice(0, 8).map((item: any) => makeSignal({
    source: 'GitLab', kind: 'repository',
    title: item.name_with_namespace || item.name || 'GitLab project',
    url: item.web_url || '', summary: item.description || '', publishedAt: item.last_activity_at,
    metrics: { stars: item.star_count || 0, forks: item.forks_count || 0 },
    capabilities: matchedCapabilities(profile, `${item.name_with_namespace || ''} ${item.description || ''}`),
  }, profile)).filter((signal) => Number(signal.relevance || 0) >= 0.56)
}

function needsModelResearch(profile: ResearchProfile) {
  const value = `${profile.query} ${profile.capabilities.join(' ')}`
  return /\bai\b|llm|model|vision|video generation|image generation|speech|embedding|rag|machine learning|ml|inference|diffusion/i.test(value)
}

async function huggingFace(profile: ResearchProfile, kind: 'models' | 'datasets' | 'spaces'): Promise<Signal[]> {
  if (!needsModelResearch(profile)) return []
  const query = [...profile.domainTerms.slice(0, 4), ...terms(profile.capabilities.join(' '), 3)].join(' ') || profile.query
  const url = new URL(`https://huggingface.co/api/${kind}`)
  url.searchParams.set('search', query)
  url.searchParams.set('sort', 'downloads')
  url.searchParams.set('direction', '-1')
  url.searchParams.set('limit', '7')
  const data = await json(url.toString())
  if (!Array.isArray(data)) return []
  return data.slice(0, 7).map((item: any) => {
    const id = item.modelId || item.id || ''
    const prefix = kind === 'models' ? '' : `${kind}/`
    const summary = Array.isArray(item.tags) ? item.tags.slice(0, 14).join(', ') : `Open ${kind.slice(0, -1)}`
    return makeSignal({
      source: 'Hugging Face', kind: kind.slice(0, -1), title: id,
      url: id ? `https://huggingface.co/${prefix}${id}` : '', summary,
      publishedAt: item.lastModified,
      metrics: { downloads: item.downloads || 0, likes: item.likes || 0 },
      capabilities: matchedCapabilities(profile, `${id} ${summary}`),
    }, profile)
  }).filter((item: Signal) => item.title && Number(item.relevance || 0) >= 0.58)
}

async function hackerNews(profile: ResearchProfile): Promise<Signal[]> {
  const ids = await json('https://hacker-news.firebaseio.com/v0/newstories.json')
  if (!Array.isArray(ids)) return []
  const items = await Promise.all(ids.slice(0, 35).map((id: number) => json(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)))
  return items.filter(Boolean).map((item: any) => makeSignal({
    source: 'Hacker News', kind: 'developer-news', title: item.title || '',
    url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    summary: `HN score ${item.score || 0} · ${item.descendants || 0} comments`,
    publishedAt: item.time ? new Date(item.time * 1000).toISOString() : undefined,
    metrics: { score: item.score || 0, comments: item.descendants || 0 },
  }, profile)).filter((signal: Signal) => Number(signal.relevance || 0) >= 0.62)
    .sort((a: Signal, b: Signal) => Number(b.relevance || 0) - Number(a.relevance || 0)).slice(0, 6)
}

async function stackOverflow(profile: ResearchProfile): Promise<Signal[]> {
  const url = new URL('https://api.stackexchange.com/2.3/search/advanced')
  url.searchParams.set('site', 'stackoverflow')
  url.searchParams.set('order', 'desc')
  url.searchParams.set('sort', 'relevance')
  url.searchParams.set('q', profile.query)
  url.searchParams.set('pagesize', '8')
  const data = await json(url.toString()) as any
  if (!data || !Array.isArray(data.items)) return []
  return data.items.slice(0, 8).map((item: any) => makeSignal({
    source: 'Stack Overflow', kind: 'developer-question',
    title: String(item.title || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
    url: item.link || '',
    summary: `${item.answer_count || 0} answers · ${item.view_count || 0} views · score ${item.score || 0}`,
    publishedAt: item.last_activity_date ? new Date(item.last_activity_date * 1000).toISOString() : undefined,
    metrics: { answers: item.answer_count || 0, views: item.view_count || 0, score: item.score || 0 },
  }, profile)).filter((signal: Signal) => Number(signal.relevance || 0) >= 0.6)
}

function atomValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  return (match?.[1] || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function shouldUseArxiv(profile: ResearchProfile) {
  return needsModelResearch(profile) && /model|algorithm|generation|vision|speech|language|rag|retrieval|agent|learning|diffusion|inference/i.test(`${profile.query} ${profile.capabilities.join(' ')}`)
}

async function arxiv(profile: ResearchProfile): Promise<Signal[]> {
  if (!shouldUseArxiv(profile)) return []
  try {
    const focused = [...new Set([...profile.domainTerms.slice(0, 3), ...terms(profile.capabilities.join(' '), 3)])].slice(0, 4)
    if (!focused.length) return []
    const url = new URL('https://export.arxiv.org/api/query')
    url.searchParams.set('search_query', focused.map((term) => `all:${term}`).join(' AND '))
    url.searchParams.set('start', '0')
    url.searchParams.set('max_results', '8')
    url.searchParams.set('sortBy', 'relevance')
    url.searchParams.set('sortOrder', 'descending')
    const response = await fetch(url.toString(), { cache: 'no-store', signal: AbortSignal.timeout(18000) })
    if (!response.ok) return []
    const xml = await response.text()
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/gi) || []
    return entries.slice(0, 8).map((entry) => makeSignal({
      source: 'arXiv', kind: 'research-paper', title: atomValue(entry, 'title'),
      url: atomValue(entry, 'id'), summary: atomValue(entry, 'summary'), publishedAt: atomValue(entry, 'published'),
    }, profile)).filter((signal) => Number(signal.relevance || 0) >= 0.72).slice(0, 5)
  } catch { return [] }
}

async function githubReleases(repos: string[], profile: ResearchProfile): Promise<Signal[]> {
  const groups = await Promise.all(repos.slice(0, 6).map(async (repo) => {
    const releases = await json(`https://api.github.com/repos/${repo}/releases?per_page=2`, { headers: githubHeaders() })
    if (!Array.isArray(releases)) return []
    return releases.slice(0, 2).map((release: any) => makeSignal({
      source: 'GitHub Releases', kind: 'release', title: `${repo} ${release.name || release.tag_name || 'release'}`,
      url: release.html_url || `https://github.com/${repo}/releases`,
      summary: String(release.body || '').slice(0, 700) || `Latest published release for ${repo}`,
      publishedAt: release.published_at || release.created_at,
      metrics: {},
    }, profile)).filter((signal) => Number(signal.relevance || 0) >= 0.52)
  }))
  return groups.flat()
}

async function tavily(profile: ResearchProfile): Promise<Signal[]> {
  const key = process.env.TAVILY_API_KEY
  if (!key) return []
  const queries = [
    `${profile.query} competitors pricing`,
    `${profile.query} open source software`,
    `${profile.query} customer workflow market`,
  ]
  const groups = await Promise.all(queries.map(async (q) => {
    const data = await json('https://api.tavily.com/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query: q, max_results: 6, include_answer: false, include_raw_content: false }),
    }) as any
    if (!data || !Array.isArray(data.results)) return []
    return data.results.map((item: any) => makeSignal({
      source: 'Web research', kind: q.includes('pricing') ? 'pricing-market' : 'market-news',
      title: item.title || '', url: item.url || '', summary: item.content || '',
    }, profile)).filter((signal: Signal) => Number(signal.relevance || 0) >= 0.56)
  }))
  return groups.flat()
}

function dedupeSignals(signals: Signal[]) {
  const seen = new Map<string, Signal>()
  for (const signal of signals) {
    if (!signal.title || !signal.url) continue
    const key = signal.kind === 'github-repository'
      ? `repo:${text(signal.repository?.fullName).toLowerCase() || signal.title.toLowerCase()}`
      : signal.url.toLowerCase()
    const current = seen.get(key)
    if (!current || Number(signal.relevance || 0) > Number(current.relevance || 0)) seen.set(key, signal)
  }
  return [...seen.values()]
}

function sourceThreshold(signal: Signal) {
  if (signal.kind === 'github-repository') return 0.50
  if (signal.source === 'arXiv') return 0.72
  if (signal.source === 'Hacker News') return 0.62
  if (signal.source === 'Stack Overflow') return 0.60
  return 0.56
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const idea = typeof body.idea === 'string' ? body.idea.trim() : ''
    if (!idea) return NextResponse.json({ success: false, error: 'A product idea is required' }, { status: 400 })
    const repos = Array.isArray(body.repos) ? body.repos.filter((value: unknown) => typeof value === 'string').slice(0, 8) : []
    const graph = body?.graph && typeof body.graph === 'object' && !Array.isArray(body.graph) ? body.graph : {}
    const profile = buildProfile(idea, graph)
    const started = Date.now()

    const settled = await Promise.allSettled([
      githubRepositories(profile),
      gitlab(profile),
      huggingFace(profile, 'models'),
      huggingFace(profile, 'datasets'),
      huggingFace(profile, 'spaces'),
      hackerNews(profile),
      stackOverflow(profile),
      arxiv(profile),
      githubReleases(repos, profile),
      tavily(profile),
    ])

    const rawSignals = dedupeSignals(settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []))
    const signals = rawSignals
      .filter((signal) => Number(signal.relevance || 0) >= sourceThreshold(signal))
      .sort((a, b) => {
        const repoBonusA = a.kind === 'github-repository' ? 0.08 : 0
        const repoBonusB = b.kind === 'github-repository' ? 0.08 : 0
        return (Number(b.relevance || 0) + repoBonusB) - (Number(a.relevance || 0) + repoBonusA)
      })
      .slice(0, 60)

    const counts = signals.reduce<Record<string, number>>((acc, signal) => {
      acc[signal.source] = (acc[signal.source] || 0) + 1
      return acc
    }, {})
    const averageRelevance = signals.length
      ? Number((signals.reduce((sum, signal) => sum + Number(signal.relevance || 0), 0) / signals.length).toFixed(3))
      : 0
    const githubCandidates = signals.filter((signal) => signal.kind === 'github-repository').length
    const confidenceBand = signals.length >= 12 && githubCandidates >= 5 && averageRelevance >= 0.68
      ? 'high'
      : signals.length >= 6 && githubCandidates >= 2
        ? 'medium'
        : 'low'

    return NextResponse.json({
      success: true,
      query: profile.query,
      profile,
      generatedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      sourceCatalog: SOURCE_CATALOG,
      signals,
      summary: {
        signalCount: signals.length,
        relevantSignalCount: signals.length,
        rejectedSignalCount: Math.max(0, rawSignals.length - signals.length),
        sourcesWithResults: Object.keys(counts).length,
        sourceCounts: counts,
        githubCandidates,
        averageRelevance,
        confidenceBand,
      },
      accuracyPolicy: 'Evidence is capability-filtered before recommendation. Popularity alone cannot qualify a repository. High-confidence recommendations still require pinned-source, license, build, test, security and end-user outcome verification.',
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Live research failed' }, { status: 500 })
  }
}
