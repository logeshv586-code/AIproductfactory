import { inspectPublicRepositoryLocally, readPublicRepoFiles } from '@/lib/factory/local-public-repo-inspector'
import type { DeepResearchSignalV12 } from '@/lib/factory/deep-research-v12'

type CapabilityRule = {
  name: string
  trigger: RegExp
  query: string
  evidence: RegExp[]
  action?: RegExp
}

const RULES: CapabilityRule[] = [
  { name: 'Desktop computer control', trigger: /desktop|computer[- ]?use|windows|screen control|mouse|keyboard|rpa|gui/i, query: 'computer use desktop GUI agent automation', evidence: [/computer[- ]?use|desktop|gui|uiautomation|pywinauto|pyautogui|accessibility/i, /mouse|keyboard|click|scroll|screen/i], action: /click|type|scroll|invoke|control|execute|automation/i },
  { name: 'Vision screen understanding', trigger: /vision|screen|screenshot|visual|ocr|multimodal/i, query: 'vision screen understanding GUI agent', evidence: [/vision|vlm|multimodal|screenshot|screen capture|ocr|grounding/i], action: /screen|coordinate|element|gui|desktop|computer/i },
  { name: 'PowerPoint automation', trigger: /powerpoint|pptx|presentation|slides?/i, query: 'powerpoint pptx presentation automation', evidence: [/powerpoint|pptx|pptxgenjs|python-pptx|presentation|slides?/i], action: /create|generate|edit|write|insert|format|update/i },
  { name: 'Excel automation', trigger: /excel|xlsx|spreadsheet|workbook|worksheet/i, query: 'excel xlsx spreadsheet automation agent', evidence: [/excel|xlsx|openpyxl|xlwings|xlsxwriter|spreadsheet|workbook/i], action: /create|generate|edit|write|insert|format|update|formula|chart/i },
  { name: 'Word document automation', trigger: /word document|docx|microsoft word|office document/i, query: 'microsoft word docx automation', evidence: [/docx|python-docx|microsoft word|office document/i], action: /create|generate|edit|write|insert|format|update/i },
  { name: 'Browser automation', trigger: /browser|website|playwright|selenium|web automation/i, query: 'browser automation agent playwright', evidence: [/browser|playwright|selenium|chromium|web agent/i], action: /click|navigate|type|page|execute|automation/i },
  { name: 'Autonomous task planning', trigger: /autonomous|agentic|self[- ]?evolv|self[- ]?improv|plan task|planner/i, query: 'autonomous agent planner tool execution', evidence: [/agent|planner|planning|state machine|tool use|tool-use|orchestrator/i], action: /plan|reason|decide|execute|iterate|task|state/i },
  { name: 'Memory and learning loop', trigger: /memory|self[- ]?evolv|self[- ]?improv|learn|reflection|experience/i, query: 'agent memory reflection learning', evidence: [/memory|reflection|experience|execution trace|rag|retrieval|knowledge/i], action: /learn|retrieve|adapt|agent|task|workflow/i },
  { name: 'Workflow orchestration', trigger: /workflow|automation|orchestration|schedule|trigger/i, query: 'workflow automation orchestration agent', evidence: [/workflow|orchestrat|pipeline|task graph|scheduler|trigger|runner/i], action: /execute|run|task|workflow|trigger|schedule/i },
  { name: 'Tool and skill execution', trigger: /any task|tool use|tool-use|skills|plugin|mcp|automation/i, query: 'agent tool use skills MCP executor', evidence: [/tool[- ]?use|skills?|plugin|mcp|executor|action server/i], action: /execute|call|invoke|run|action|tool|skill/i },
]

const STOP = new Set(['create', 'build', 'application', 'product', 'using', 'with', 'that', 'this', 'from', 'have', 'will', 'user', 'users', 'easily', 'capable', 'make', 'making', 'into', 'their'])
const CODE = /\.(py|ts|tsx|js|jsx|mjs|cjs|go|rs|java|kt|cs|cpp|cc|cxx|c|h|hpp|swift|rb|php|vue|svelte)$/i

function terms(value: string) {
  return [...new Set((value.toLowerCase().match(/[a-z0-9+#.-]{3,}/g) || []).filter((term) => !STOP.has(term)))].slice(0, 60)
}

function requestedCapabilities(idea: string) {
  return RULES.filter((rule) => rule.trigger.test(idea)).map((rule) => rule.name)
}

function capabilityMatches(corpus: string, requested: string[]) {
  return requested.filter((capability) => {
    const rule = RULES.find((item) => item.name === capability)
    if (!rule) return false
    const hits = rule.evidence.filter((pattern) => pattern.test(corpus)).length
    return hits > 0 && (!rule.action || rule.action.test(corpus))
  })
}

function lexicalScore(ideaTerms: string[], corpus: string) {
  const haystack = new Set(terms(corpus))
  if (!ideaTerms.length) return 0
  return Math.min(1, ideaTerms.filter((term) => haystack.has(term)).length / Math.max(4, Math.min(ideaTerms.length, 18)))
}

function pathScore(filePath: string, ideaTerms: string[], capabilities: string[]) {
  const lower = filePath.toLowerCase()
  if (/node_modules|vendor|dist|build|\.min\.|\.png$|\.jpg$|\.jpeg$|\.gif$|\.svg$|\.ico$|\.lock$/.test(lower)) return -100
  let score = 0
  if (/readme|architecture|docs\/|examples?\/|demo\//.test(lower)) score += 14
  if (/package\.json|pyproject\.toml|requirements.*\.txt|cargo\.toml|go\.mod|dockerfile|docker-compose/.test(lower)) score += 16
  if (CODE.test(lower)) score += 10
  if (/src\/|app\/|lib\/|agent|workflow|automation|vision|screen|desktop|office|tool|skill|planner|executor/.test(lower)) score += 12
  for (const term of ideaTerms.slice(0, 24)) if (lower.includes(term)) score += 3
  for (const capability of capabilities) for (const term of terms(capability).slice(0, 4)) if (lower.includes(term)) score += 2
  return score
}

function architectureHints(paths: string[], corpus: string) {
  const joined = `${paths.join(' ')} ${corpus.slice(0, 30_000)}`.toLowerCase()
  const hints: string[] = []
  if (/dockerfile|docker-compose/.test(joined)) hints.push('Containerized deployment assets detected')
  if (/playwright|selenium|browser/.test(joined)) hints.push('Browser/computer automation layer detected')
  if (/agent|planner|tool|skill|mcp/.test(joined)) hints.push('Agent/tool architecture detected')
  if (/vision|ocr|screen|image|multimodal/.test(joined)) hints.push('Vision or screen-understanding modules detected')
  if (/ppt|powerpoint|xlsx|excel|docx|office/.test(joined)) hints.push('Office automation modules detected')
  if (/memory|reflection|rag|execution trace/.test(joined)) hints.push('Memory/learning substrate detected')
  if (/api|server|backend/.test(joined)) hints.push('Service/API boundary detected')
  if (/ui|frontend|react|next/.test(joined)) hints.push('User interface layer detected')
  if (/test|spec/.test(joined)) hints.push('Automated test assets detected')
  return [...new Set(hints)].slice(0, 8)
}

async function publicSearch(query: string) {
  try {
    const url = new URL('https://api.github.com/search/repositories')
    url.searchParams.set('q', `${query} in:name,description,readme archived:false fork:false`)
    url.searchParams.set('per_page', '10')
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'AI-Product-Factory-Tokenless/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })
    if (!response.ok) return { items: [] as any[], rateLimited: response.status === 403 || response.status === 429 }
    const data = await response.json() as any
    return { items: Array.isArray(data.items) ? data.items : [], rateLimited: false }
  } catch {
    return { items: [] as any[], rateLimited: false }
  }
}

function seedItem(fullName: string) {
  return {
    full_name: fullName,
    html_url: `https://github.com/${fullName}`,
    description: 'Capability-aware public repository seed; source must still pass local inspection.',
    stargazers_count: 0,
    forks_count: 0,
    open_issues_count: 0,
    language: 'Unknown',
    license: null,
    topics: [],
  }
}

export async function runTokenlessPublicResearch(idea: string, seedRepos: string[]) {
  const requested = requestedCapabilities(idea)
  const ideaTerms = terms(`${idea} ${requested.join(' ')}`)
  const queryList = [
    ...RULES.filter((rule) => requested.includes(rule.name)).map((rule) => rule.query),
    `${ideaTerms.slice(0, 6).join(' ')} open source`,
  ].filter(Boolean)
  const queries = [...new Set(queryList)].slice(0, 6)
  const groups = await Promise.all(queries.map(publicSearch))
  const rateLimited = groups.some((group) => group.rateLimited)
  const byName = new Map<string, any>()

  for (const item of groups.flatMap((group) => group.items)) {
    const fullName = String(item?.full_name || '').trim()
    if (fullName) byName.set(fullName.toLowerCase(), item)
  }
  for (const seed of seedRepos.slice(0, 10)) {
    if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(seed)) {
      const key = seed.toLowerCase()
      if (!byName.has(key)) byName.set(key, seedItem(seed))
    }
  }

  const ranked = [...byName.values()].map((item) => {
    const corpus = `${item.full_name || ''} ${item.description || ''} ${(item.topics || []).join(' ')}`
    const lexical = lexicalScore(ideaTerms, corpus)
    const seedBoost = seedRepos.some((seed) => seed.toLowerCase() === String(item.full_name || '').toLowerCase()) ? 0.30 : 0
    const stars = Math.max(0, Number(item.stargazers_count || 0))
    const popularity = Math.min(0.12, Math.log10(stars + 1) / 40)
    return { item, score: lexical * 0.58 + seedBoost + popularity }
  }).sort((a, b) => b.score - a.score).slice(0, 6)

  const inspected = await Promise.all(ranked.map(async ({ item }): Promise<DeepResearchSignalV12 | null> => {
    const fullName = String(item.full_name || '').trim()
    if (!fullName) return null
    const snapshot = await inspectPublicRepositoryLocally(fullName, String(item.default_branch || '').trim() || undefined)
    if (!snapshot || !snapshot.headSha || !snapshot.files.length) return null

    const keyPaths = snapshot.files
      .map((filePath) => ({ filePath, score: pathScore(filePath, ideaTerms, requested) }))
      .filter((entry) => entry.score > 0 && (CODE.test(entry.filePath) || /package\.json|pyproject\.toml|requirements|cargo\.toml|go\.mod|dockerfile/i.test(entry.filePath)))
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .map((entry) => entry.filePath)
    const sampled = await readPublicRepoFiles(snapshot, keyPaths)
    const sampledText = sampled.map((entry) => entry.content).join('\n').slice(0, 100_000)
    const corpus = `${fullName}\n${item.description || ''}\n${snapshot.readme}\n${sampledText}`
    const verified = capabilityMatches(corpus, requested)
    if (requested.length && !verified.length) return null

    const sourceFilesSampled = sampled.filter((entry) => entry.content.length >= 120 && CODE.test(entry.path)).length
    if (sourceFilesSampled < 1) return null
    const coverage = requested.length ? verified.length / requested.length : 0
    const lexical = lexicalScore(ideaTerms, corpus)
    const readmeScore = snapshot.readme.length >= 5000 ? 1 : snapshot.readme.length >= 1500 ? 0.82 : snapshot.readme.length >= 400 ? 0.62 : snapshot.readme.length ? 0.42 : 0
    const codeScore = Math.min(1, sourceFilesSampled / 4)
    const inspectionScore = Math.round(Math.min(1, readmeScore * 0.28 + codeScore * 0.38 + Math.min(1, snapshot.files.length / 100) * 0.12 + Math.min(1, verified.length / 4) * 0.22) * 100)
    const relevance = Math.min(1, lexical * 0.32 + Math.min(1, 0.45 + coverage * 0.55) * 0.46 + inspectionScore / 100 * 0.22)
    if (inspectionScore < 52 || relevance < 0.66) return null

    const pinnedRef = snapshot.headSha
    const sourceLinks = [
      { label: `${fullName} repository`, url: snapshot.repoUrl, kind: 'repository' },
      ...(snapshot.readmePath ? [{ label: 'README inspected locally', url: `${snapshot.repoUrl}/blob/${pinnedRef}/${snapshot.readmePath}`, kind: 'readme' }] : []),
      ...sampled.filter((entry) => entry.content.length >= 120).slice(0, 6).map((entry) => ({
        label: entry.path,
        url: `${snapshot.repoUrl}/blob/${pinnedRef}/${entry.path.split('/').map(encodeURIComponent).join('/')}`,
        kind: 'source-file',
      })),
    ]
    const hints = architectureHints(snapshot.files, corpus)

    return {
      source: 'GitHub local clone',
      kind: 'github-repository',
      title: fullName,
      url: snapshot.repoUrl,
      summary: `Tokenless local clone inspection verified ${verified.join(', ') || 'direct capability evidence'} at pinned commit ${pinnedRef.slice(0, 12)}. ${String(item.description || '')}`.slice(0, 720),
      publishedAt: item.pushed_at || item.updated_at,
      relevance: Number(relevance.toFixed(3)),
      capabilities: verified,
      metrics: {
        stars: Number(item.stargazers_count || 0),
        forks: Number(item.forks_count || 0),
        openIssues: Number(item.open_issues_count || 0),
        healthScore: 70,
        activityScore: 70,
        popularityScore: Math.min(100, Math.round(Math.log10(Number(item.stargazers_count || 0) + 1) / 4.5 * 100)),
        licenseScore: item.license?.spdx_id ? 85 : 35,
        inspectionScore,
        specializedCapabilityCount: verified.length,
        totalVerifiedCapabilities: verified.length,
        queryMatches: 1,
        localCloneInspection: 1,
        localCloneCacheHit: snapshot.cacheHit ? 1 : 0,
      },
      repository: {
        fullName,
        description: String(item.description || ''),
        language: String(item.language || 'Unknown'),
        license: String(item.license?.spdx_id || 'unknown'),
        stars: Number(item.stargazers_count || 0),
        forks: Number(item.forks_count || 0),
        updatedAt: item.pushed_at || item.updated_at,
        archived: false,
        topics: Array.isArray(item.topics) ? item.topics : [],
      },
      inspection: {
        inspected: true,
        depth: 'code-sample',
        defaultBranch: snapshot.defaultBranch,
        filesSeen: snapshot.files.length,
        sourceFilesSampled,
        readmeCharacters: snapshot.readme.length,
        inspectionScore,
        verifiedCapabilities: verified,
        specializedCapabilities: verified,
        architectureHints: hints,
        keyFiles: sampled.filter((entry) => entry.content.length >= 120).map((entry) => ({
          path: entry.path,
          url: `${snapshot.repoUrl}/blob/${pinnedRef}/${entry.path.split('/').map(encodeURIComponent).join('/')}`,
          reason: 'Inspected from a tokenless shallow public clone and pinned to the observed commit.',
        })),
        sourceLinks,
        warnings: [
          ...(snapshot.cacheHit ? ['Local public-repository cache reused; source links remain pinned to the cached commit.'] : []),
          ...(!item.license?.spdx_id ? ['License metadata unavailable in tokenless discovery; verify license from the cloned repository before source lock.'] : []),
        ],
      },
    }
  }))

  const signals: DeepResearchSignalV12[] = []
  for (const signal of inspected) if (signal) signals.push(signal)
  signals.sort((a, b) => Number(b.relevance || 0) - Number(a.relevance || 0))

  return {
    signals,
    telemetry: {
      mode: 'public-local-clone',
      authenticated: false,
      queriesAttempted: queries.length,
      repositoriesDiscovered: byName.size,
      repositoriesLocallyInspected: ranked.length,
      repositoriesQualified: signals.length,
      cacheHits: signals.filter((signal) => Number(signal.metrics?.localCloneCacheHit || 0) > 0).length,
      rateLimited,
      note: 'GitHub API is used only for public discovery. Deep README/tree/source verification is performed from shallow local clones without a personal GitHub token. No repository code is executed during research.',
    },
  }
}
