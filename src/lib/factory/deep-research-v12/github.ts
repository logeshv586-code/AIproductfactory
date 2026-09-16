import { text, list, terms, normalize, clamp, daysSince } from './nlp-utils'
import { matchedCapabilities, lexicalRelevance, repositoryHealth } from './scoring'
import type { ResearchProfileV12, DeepResearchSignalV12, SourceLink } from './types'

export function githubHeaders() {
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'AI-Product-Factory/12.0',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

export async function json(url: string, init?: RequestInit, timeout = 15000) {
  try {
    const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(timeout) })
    if (!response.ok) return null
    return await response.json()
  } catch { return null }
}

export function decodeBase64(value: unknown) {
  try { return typeof value === 'string' ? Buffer.from(value.replace(/\n/g, ''), 'base64').toString('utf8') : '' } catch { return '' }
}

export function filePriority(path: string, profile: ResearchProfileV12) {
  const lower = path.toLowerCase()
  if (/node_modules|vendor|dist|build|\.min\.|lock$|\.png$|\.jpg$|\.jpeg$|\.gif$|\.svg$|\.ico$/.test(lower)) return -100
  let score = 0
  if (/readme|architecture|docs\/|examples?\/|demo\//.test(lower)) score += 16
  if (/package\.json|pyproject\.toml|requirements.*\.txt|cargo\.toml|go\.mod|dockerfile|docker-compose/.test(lower)) score += 18
  if (/src\/|app\/|lib\/|agent|workflow|automation|vision|screen|desktop|office|tool|skill|planner|executor/.test(lower)) score += 12
  for (const term of profile.domainTerms.slice(0, 12)) if (lower.includes(term)) score += 5
  for (const capability of profile.specializedCapabilities.slice(0, 10)) for (const term of terms(capability, 4)) if (lower.includes(term)) score += 3
  return score
}

export function architectureHints(paths: string[], corpus: string) {
  const hints: string[] = []
  const joined = `${paths.join(' ')} ${corpus.slice(0, 24000)}`.toLowerCase()
  if (/dockerfile|docker-compose/.test(joined)) hints.push('Containerized deployment assets detected')
  if (/playwright|selenium|browser/.test(joined)) hints.push('Browser/computer automation layer detected')
  if (/agent|planner|tool|skill|mcp/.test(joined)) hints.push('Agent/tool architecture detected')
  if (/vision|ocr|screen|image|multimodal/.test(joined)) hints.push('Vision or screen-understanding modules detected')
  if (/ppt|powerpoint|xlsx|excel|docx|wordcom|office/.test(joined)) hints.push('Office automation modules detected')
  if (/memory|reflection|rag|execution trace|knowledge substrate/.test(joined)) hints.push('Memory/learning substrate detected')
  if (/api|server|backend/.test(joined)) hints.push('Service/API boundary detected')
  if (/ui|frontend|web|react|next/.test(joined)) hints.push('User interface layer detected')
  if (/test|spec/.test(joined)) hints.push('Automated test assets detected')
  return [...new Set(hints)].slice(0, 8)
}

export async function fetchRepoFile(fullName: string, path: string, branch: string) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const data = await json(`https://api.github.com/repos/${fullName}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`, { headers: githubHeaders() }, 10000) as any
  return data && !Array.isArray(data) ? decodeBase64(data.content).slice(0, 22000) : ''
}

export async function inspectRepository(item: any, profile: ResearchProfileV12, queryFocuses: string[]): Promise<DeepResearchSignalV12 | null> {
  const fullName = text(item.full_name)
  if (!fullName || item.archived || item.fork) return null
  const branch = text(item.default_branch) || 'main'
  const repoUrl = text(item.html_url) || `https://github.com/${fullName}`
  const readmeData = await json(`https://api.github.com/repos/${fullName}/readme`, { headers: githubHeaders() }, 10000) as any
  const readme = decodeBase64(readmeData?.content).slice(0, 60000)
  const root = await json(`https://api.github.com/repos/${fullName}/contents?ref=${encodeURIComponent(branch)}`, { headers: githubHeaders() }, 10000) as any
  const rootPaths = Array.isArray(root) ? root.map((entry: any) => text(entry.path)).filter(Boolean) : []

  const hasToken = Boolean(process.env.GITHUB_TOKEN)
  let treePaths = rootPaths
  const shouldDeepInspect = hasToken || Number(item.stargazers_count || 0) >= 50 || queryFocuses.some((focus) => focus === 'Existing product closest to the full idea')
  if (shouldDeepInspect) {
    const tree = await json(`https://api.github.com/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers: githubHeaders() }, 14000) as any
    if (tree && Array.isArray(tree.tree)) treePaths = tree.tree.filter((entry: any) => entry.type === 'blob').map((entry: any) => text(entry.path)).filter(Boolean).slice(0, 7000)
  }

  const sampleLimit = hasToken ? 6 : 3
  const keyPaths = treePaths
    .map((path) => ({ path, score: filePriority(path, profile) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, sampleLimit)
    .map((entry) => entry.path)
  const sampled = shouldDeepInspect ? await Promise.all(keyPaths.map((path) => fetchRepoFile(fullName, path, branch))) : []
  const sampledText = sampled.join('\n').slice(0, 80000)
  const metadataCorpus = `${fullName} ${text(item.description)} ${list<string>(item.topics).join(' ')} ${queryFocuses.join(' ')}`
  const corpus = `${metadataCorpus}\n${readme}\n${sampledText}`
  const verified = matchedCapabilities(profile, corpus)
  const specialized = verified.filter((capability) => profile.specializedCapabilities.includes(capability))
  const generic = verified.filter((capability) => profile.genericCapabilities.includes(capability))
  const lexical = lexicalRelevance(profile, corpus)
  const specializedCoverage = profile.specializedCapabilities.length ? specialized.length / profile.specializedCapabilities.length : 0
  const directCapabilitySignal = specialized.length ? Math.min(1, 0.42 + specializedCoverage * 0.58) : 0
  const readmeScore = readme.length >= 5000 ? 1 : readme.length >= 1500 ? 0.82 : readme.length >= 400 ? 0.62 : readme.length ? 0.42 : 0
  const codeScore = sampled.filter((item) => item.length >= 120).length / Math.max(1, sampleLimit)
  const inspectionScore = Math.round(clamp(readmeScore * 0.30 + codeScore * 0.35 + Math.min(1, treePaths.length / 80) * 0.12 + Math.min(1, verified.length / 4) * 0.23) * 100)
  const health = repositoryHealth(item)
  const relevance = clamp(lexical * 0.30 + directCapabilitySignal * 0.42 + (inspectionScore / 100) * 0.18 + (health.healthScore / 100) * 0.10)

  if (profile.specializedCapabilities.length && specialized.length === 0) return null
  if (relevance < 0.64 || inspectionScore < 48) return null

  const warnings: string[] = []
  if (!readme.length) warnings.push('README could not be inspected')
  if (!sampled.some((item) => item.length >= 120)) warnings.push('Representative source code could not be sampled')
  if (!text(item.license?.spdx_id) || ['NOASSERTION', 'OTHER'].includes(text(item.license?.spdx_id).toUpperCase())) warnings.push('License metadata requires manual verification')
  if (daysSince(item.pushed_at || item.updated_at) > 730) warnings.push('Repository activity is older than two years')

  const sourceLinks: SourceLink[] = [
    { label: `${fullName} repository`, url: repoUrl, kind: 'repository' },
    ...(readmeData?.html_url ? [{ label: 'README inspected', url: String(readmeData.html_url), kind: 'readme' }] : []),
    ...keyPaths.map((path) => ({ label: path, url: `${repoUrl}/blob/${encodeURIComponent(branch)}/${path.split('/').map(encodeURIComponent).join('/')}`, kind: 'source-file' })),
  ]
  const hints = architectureHints(treePaths, corpus)
  const keyFiles = keyPaths.map((path) => ({
    path,
    url: `${repoUrl}/blob/${encodeURIComponent(branch)}/${path.split('/').map(encodeURIComponent).join('/')}`,
    reason: 'High-signal architecture or capability file inspected by the research engine.',
  }))
  const role = specialized.length >= 3 || specializedCoverage >= 0.45 ? 'existing-product/foundation' : 'specialist component'
  const summary = `${role}; verified ${specialized.join(', ') || verified.join(', ')} from README/source inspection. ${text(item.description)}`.slice(0, 720)

  return {
    source: 'GitHub',
    kind: 'github-repository',
    title: fullName,
    url: repoUrl,
    summary,
    publishedAt: item.pushed_at || item.updated_at,
    relevance: Number(relevance.toFixed(3)),
    capabilities: [...specialized, ...generic],
    metrics: {
      stars: Number(item.stargazers_count || 0),
      forks: Number(item.forks_count || 0),
      openIssues: Number(item.open_issues_count || 0),
      healthScore: health.healthScore,
      activityScore: health.activityScore,
      popularityScore: health.popularityScore,
      licenseScore: health.licenseScore,
      inspectionScore,
      specializedCapabilityCount: specialized.length,
      totalVerifiedCapabilities: verified.length,
      queryMatches: queryFocuses.length,
    },
    repository: {
      fullName,
      description: text(item.description),
      language: text(item.language) || 'Unknown',
      license: text(item.license?.spdx_id) || 'unknown',
      stars: Number(item.stargazers_count || 0),
      forks: Number(item.forks_count || 0),
      updatedAt: item.pushed_at || item.updated_at,
      archived: Boolean(item.archived),
      topics: list<string>(item.topics),
    },
    inspection: {
      inspected: true,
      depth: sampled.some((entry) => entry.length >= 120) ? 'code-sample' : readme.length ? 'readme' : 'metadata',
      defaultBranch: branch,
      filesSeen: treePaths.length,
      sourceFilesSampled: sampled.filter((entry) => entry.length >= 120).length,
      readmeCharacters: readme.length,
      inspectionScore,
      verifiedCapabilities: verified,
      specializedCapabilities: specialized,
      architectureHints: hints,
      keyFiles,
      sourceLinks,
      warnings,
    },
  }
}

export async function githubCandidates(profile: ResearchProfileV12, seedRepos: string[]) {
  const byName = new Map<string, { item: any; focuses: Set<string> }>()
  const queryLimit = process.env.GITHUB_TOKEN ? profile.queries.length : Math.min(6, profile.queries.length)
  const queries = profile.queries.slice(0, queryLimit)

  const groups = await Promise.all(queries.map(async (plan) => {
    const url = new URL('https://api.github.com/search/repositories')
    url.searchParams.set('q', `${plan.query} in:name,description,readme archived:false fork:false`)
    url.searchParams.set('per_page', process.env.GITHUB_TOKEN ? '12' : '8')
    const data = await json(url.toString(), { headers: githubHeaders() }, 15000) as any
    return data && Array.isArray(data.items) ? data.items.map((item: any) => ({ item, focus: plan.focus })) : []
  }))

  for (const result of groups.flat()) {
    const key = text(result.item?.full_name).toLowerCase()
    if (!key) continue
    const current = byName.get(key) || { item: result.item, focuses: new Set<string>() }
    current.focuses.add(result.focus)
    byName.set(key, current)
  }

  const exactSeeds = await Promise.all(seedRepos.slice(0, process.env.GITHUB_TOKEN ? 8 : 3).map(async (repo) => {
    const item = await json(`https://api.github.com/repos/${repo}`, { headers: githubHeaders() }, 10000)
    return item ? { item, focus: 'Product graph seed; must still pass deep relevance proof' } : null
  }))
  for (const result of exactSeeds.filter(Boolean) as Array<{ item: any; focus: string }>) {
    const key = text(result.item?.full_name).toLowerCase()
    if (!key) continue
    const current = byName.get(key) || { item: result.item, focuses: new Set<string>() }
    current.focuses.add(result.focus)
    byName.set(key, current)
  }

  const preRanked = [...byName.values()].map((entry) => {
    const item = entry.item
    const corpus = `${text(item.full_name)} ${text(item.description)} ${list<string>(item.topics).join(' ')} ${[...entry.focuses].join(' ')}`
    const metaCaps = matchedCapabilities(profile, corpus)
    const specialized = metaCaps.filter((cap) => profile.specializedCapabilities.includes(cap)).length
    const lexical = lexicalRelevance(profile, corpus)
    const health = repositoryHealth(item)
    const preScore = lexical * 0.48 + Math.min(1, specialized / Math.max(1, Math.min(profile.specializedCapabilities.length, 3))) * 0.34 + (health.healthScore / 100) * 0.18
    return { ...entry, preScore }
  }).sort((a, b) => b.preScore - a.preScore)

  const inspectLimit = process.env.GITHUB_TOKEN ? 14 : 8
  const inspected = await Promise.all(preRanked.slice(0, inspectLimit).map((entry) => inspectRepository(entry.item, profile, [...entry.focuses])))
  return {
    discoveredCount: byName.size,
    inspectedCount: Math.min(inspectLimit, preRanked.length),
    signals: inspected.filter((signal): signal is DeepResearchSignalV12 => Boolean(signal))
      .sort((a, b) => Number(b.relevance || 0) - Number(a.relevance || 0)),
  }
}
