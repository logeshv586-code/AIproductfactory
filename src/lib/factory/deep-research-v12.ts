type SourceLink = { label: string; url: string; kind: string }

export type RepoInspectionV12 = {
  inspected: boolean
  depth: 'metadata' | 'readme' | 'code-sample'
  defaultBranch: string
  filesSeen: number
  sourceFilesSampled: number
  readmeCharacters: number
  inspectionScore: number
  verifiedCapabilities: string[]
  specializedCapabilities: string[]
  architectureHints: string[]
  keyFiles: Array<{ path: string; url: string; reason: string }>
  sourceLinks: SourceLink[]
  warnings: string[]
}

export type DeepResearchSignalV12 = {
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
  inspection?: RepoInspectionV12
}

type QueryPlan = { query: string; focus: string; kind: 'product' | 'capability' | 'architecture' }

type ResearchProfileV12 = {
  query: string
  queries: QueryPlan[]
  intentTerms: string[]
  domainTerms: string[]
  capabilities: string[]
  specializedCapabilities: string[]
  genericCapabilities: string[]
  domain: string
  productArchetype: string
}

const SOURCE_CATALOG = [
  { id: 'github-deep', name: 'GitHub deep inspection', mode: 'core', purpose: 'Existing products, README, repository structure, manifests, representative source files, releases, maintenance and license evidence' },
  { id: 'github-source-proof', name: 'GitHub source proof', mode: 'core', purpose: 'Clickable README and capability-bearing source files inspected before a repository can qualify' },
  { id: 'gitlab', name: 'GitLab', mode: 'live', purpose: 'Relevant public projects beyond GitHub' },
  { id: 'huggingface', name: 'Hugging Face', mode: 'live', purpose: 'Open models and runnable AI assets when the idea requires model capabilities' },
  { id: 'web', name: 'Broad web research', mode: 'configured', purpose: 'Current competitors, product pages, pricing and market evidence when TAVILY_API_KEY is configured' },
  { id: 'arxiv', name: 'arXiv', mode: 'expert', purpose: 'Directly relevant technical methods only; unrelated papers are rejected' },
] as const

const STOP = new Set([
  'about', 'after', 'again', 'also', 'another', 'because', 'before', 'being', 'build', 'building', 'create',
  'customer', 'customers', 'does', 'from', 'have', 'into', 'make', 'making', 'more', 'most', 'only', 'other',
  'product', 'products', 'should', 'some', 'that', 'their', 'them', 'then', 'there', 'these', 'they', 'this',
  'through', 'using', 'want', 'with', 'within', 'without', 'would', 'your', 'application', 'software', 'easily',
])

const SYNONYMS: Record<string, string[]> = {
  sales: ['crm', 'lead', 'prospect', 'outreach', 'pipeline', 'contact', 'email', 'enrichment'],
  video: ['media', 'generation', 'diffusion', 'animation', 'render', 'image', 'multimodal'],
  document: ['pdf', 'ocr', 'docx', 'pptx', 'powerpoint', 'word', 'excel', 'spreadsheet', 'office'],
  automation: ['workflow', 'agent', 'task', 'trigger', 'approval', 'integration', 'orchestration', 'rpa'],
  desktop: ['computer-use', 'gui', 'screen', 'mouse', 'keyboard', 'rpa', 'accessibility', 'uiautomation'],
  vision: ['screen', 'screenshot', 'ocr', 'multimodal', 'computer-vision', 'visual'],
  autonomous: ['agent', 'planner', 'reflection', 'memory', 'tool-use', 'self-improvement', 'agentic'],
  ai: ['llm', 'agent', 'rag', 'embedding', 'model', 'inference', 'prompt', 'multimodal'],
  search: ['retrieval', 'index', 'query', 'semantic', 'vector'],
  authentication: ['auth', 'oauth', 'sso', 'identity', 'rbac'],
  monitoring: ['observability', 'metrics', 'telemetry', 'tracing', 'logs'],
}

const GENERIC_CAPABILITIES = new Set([
  'Backend API', 'Frontend UI', 'Authentication', 'Data Store', 'Monitoring', 'Observability', 'Scheduling',
  'Error Handling', 'Audit Logging', 'Execution Runner', 'Workflow Engine', 'Notifications', 'Search',
])

const CAPABILITY_RULES: Array<{
  name: string
  pattern: RegExp
  query: string
  positive: RegExp[]
  requireAction?: RegExp
  negativeOnly?: RegExp
}> = [
  {
    name: 'Desktop computer control',
    pattern: /desktop|computer use|computer-use|screen control|mouse|keyboard|rpa|windows app|desktop app/i,
    query: 'desktop automation computer use gui agent',
    positive: [/computer[- ]?use/i, /desktop/i, /uiautomation|ui automation|accessibility tree/i, /pyautogui|pywinauto|win32|wincom/i, /mouse|keyboard|click|keystroke/i],
    requireAction: /click|type|keyboard|mouse|invoke|set_value|scroll|launch|control|automation|executor/i,
  },
  {
    name: 'Vision screen understanding',
    pattern: /vision|visual|screen|screenshot|image understand|ocr|multimodal/i,
    query: 'vision screen understanding computer use agent',
    positive: [/vision|multimodal|vlm/i, /screenshot|screen capture/i, /ocr|image recognition|grounding/i, /visual control|gui grounding/i],
    requireAction: /screen|desktop|gui|computer|element|coordinate|control/i,
  },
  {
    name: 'PowerPoint automation',
    pattern: /powerpoint|pptx|\bppt\b|presentation/i,
    query: 'powerpoint pptx presentation automation agent',
    positive: [/powerpoint|pptx|presentation|slides?/i, /python-pptx|powerpoint com|pptxgenjs/i],
    requireAction: /create|generate|edit|write|insert|format|update|automation|executor|com/i,
    negativeOnly: /convert|extract|parse|markdown/i,
  },
  {
    name: 'Excel automation',
    pattern: /excel|xlsx|spreadsheet|workbook|worksheet/i,
    query: 'excel xlsx spreadsheet workbook automation agent',
    positive: [/excel|xlsx|spreadsheet|workbook|worksheet/i, /openpyxl|xlwings|xlsxwriter|excel com/i],
    requireAction: /create|generate|edit|write|insert|format|update|formula|chart|automation|executor|com/i,
    negativeOnly: /dataset|download|scrap|crawl|extract only/i,
  },
  {
    name: 'Word document automation',
    pattern: /word document|docx|document automation|office document|microsoft word/i,
    query: 'microsoft word docx document automation agent',
    positive: [/microsoft word|wordcom|docx|python-docx|office document/i],
    requireAction: /create|generate|edit|write|insert|format|update|table|automation|executor|com/i,
    negativeOnly: /convert|extract|parse|markdown/i,
  },
  {
    name: 'Browser automation',
    pattern: /browser|website|web automation|playwright|selenium/i,
    query: 'browser automation agent playwright selenium',
    positive: [/browser|playwright|selenium|chromium/i, /computer[- ]?use|web agent/i],
    requireAction: /click|navigate|type|page|browser|automation|tool/i,
  },
  {
    name: 'Autonomous task planning',
    pattern: /autonomous|autonomously|agentic|self evolving|self-evolving|self improve|self-improve|plan task/i,
    query: 'autonomous agent task planning tool use executor',
    positive: [/agent|planner|planning|react loop|state machine/i, /tool use|tool-use|executor|action/i, /multi-agent|orchestrator/i],
    requireAction: /plan|reason|decide|execute|iterate|loop|state|task/i,
  },
  {
    name: 'Memory and learning loop',
    pattern: /memory|self evolving|self-evolving|self improve|self-improve|learn every|feedback loop|experience/i,
    query: 'agent memory reflection self improvement experience learning',
    positive: [/memory|experience|execution trace|demonstration/i, /reflection|self[- ]?improv|learning loop/i, /rag|retrieval|knowledge substrate|vector/i],
    requireAction: /agent|task|workflow|execution|learn|retrieve|adapt/i,
  },
  {
    name: 'Workflow orchestration',
    pattern: /automation|workflow|orchestration|schedule|trigger|approval/i,
    query: 'workflow automation orchestration agent task runner',
    positive: [/workflow|orchestrator|pipeline|task graph/i, /scheduler|trigger|queue|runner/i],
    requireAction: /execute|run|task|workflow|trigger|schedule|step/i,
  },
  {
    name: 'Tool and skill execution',
    pattern: /any task|tool use|tool-use|skills|plugin|execute task|automation/i,
    query: 'agent tool use skills mcp executor plugin automation',
    positive: [/tool[- ]?use|tools?|skills?|plugin|mcp/i, /executor|action server|command/i],
    requireAction: /execute|call|invoke|run|action|tool|skill/i,
  },
  {
    name: 'Local AI inference',
    pattern: /local ai|offline|ollama|lm studio|local model/i,
    query: 'local llm agent ollama lm studio computer use',
    positive: [/ollama|lm studio|llama\.cpp|local inference|local model/i],
    requireAction: /model|inference|llm|vision|agent/i,
  },
  {
    name: 'Human approval and audit',
    pattern: /approval|audit|governance|review before|human/i,
    query: 'human approval workflow audit agent automation',
    positive: [/approval|human[- ]in[- ]the[- ]loop|review gate/i, /audit|rbac|permission|policy/i],
    requireAction: /workflow|agent|task|action|execute|approve/i,
  },
]

function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
function list<T = any>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : [] }
function clamp(value: number, min = 0, max = 1) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0)) }

function stem(value: string) {
  let token = value.toLowerCase().replace(/[^a-z0-9+#.-]/g, '')
  if (token.length > 6 && token.endsWith('ing')) token = token.slice(0, -3)
  else if (token.length > 5 && token.endsWith('ed')) token = token.slice(0, -2)
  else if (token.length > 5 && token.endsWith('es')) token = token.slice(0, -2)
  else if (token.length > 4 && token.endsWith('s')) token = token.slice(0, -1)
  return token
}

function terms(value: string, max = 50) {
  return [...new Set(value.toLowerCase().match(/[a-z0-9+#.-]{3,}/g) || [])]
    .map(stem).filter((term) => term && !STOP.has(term)).slice(0, max)
}

function expand(values: string[]) {
  const output = new Set(values.map(stem))
  for (const [anchor, synonyms] of Object.entries(SYNONYMS)) {
    const group = [anchor, ...synonyms].map(stem)
    if (group.some((term) => output.has(term))) group.forEach((term) => output.add(term))
  }
  return [...output]
}

function normalize(value: string) { return terms(value).join(' ') }

function graphCapabilities(graph: Record<string, any>) {
  const output: string[] = []
  const add = (value: unknown) => {
    const item = text(value)
    if (!item || output.some((existing) => normalize(existing) === normalize(item))) return
    output.push(item)
  }
  for (const capability of list<Record<string, any>>(graph?.capabilities?.capabilities)) add(capability.name || capability.title)
  for (const mapping of list<Record<string, any>>(graph?.capability_mappings)) add(mapping.capability_name || mapping.capability_id)
  for (const requirement of list<Record<string, any>>(graph?.requirements)) add(requirement.capability || requirement.name)
  return output
}

function inferCapabilities(idea: string, graph: Record<string, any>) {
  const inferred = CAPABILITY_RULES.filter((rule) => rule.pattern.test(idea)).map((rule) => rule.name)
  const graphCaps = graphCapabilities(graph)
  const specializedGraph = graphCaps.filter((item) => !GENERIC_CAPABILITIES.has(item))
  const genericGraph = graphCaps.filter((item) => GENERIC_CAPABILITIES.has(item))
  return [...new Set([...inferred, ...specializedGraph, ...genericGraph])].slice(0, 20)
}

function inferDomain(idea: string) {
  const value = idea.toLowerCase()
  if (/desktop|computer use|rpa|powerpoint|pptx|excel|xlsx|word|docx|office/.test(value)) return 'AI desktop & office automation'
  if (/sales|crm|lead|prospect|outreach/.test(value)) return 'Sales & CRM'
  if (/video|animation|image generation|diffusion/.test(value)) return 'Video & Media AI'
  if (/document|pdf|ocr|knowledge base|rag/.test(value)) return 'Documents & Knowledge'
  if (/automation|workflow|agent|process/.test(value)) return 'Business Automation'
  return 'General software product'
}

function productArchetype(idea: string) {
  const value = idea.toLowerCase()
  if (/desktop|computer use|rpa/.test(value) && /vision|screen|screenshot/.test(value)) return 'vision driven desktop automation agent'
  if (/powerpoint|excel|word|office|pptx|xlsx|docx/.test(value)) return 'AI office automation assistant'
  if (/video|animation|diffusion/.test(value)) return 'AI media generation studio'
  if (/sales|crm|lead|outreach/.test(value)) return 'AI sales automation assistant'
  if (/invoice|billing|payment/.test(value)) return 'finance workflow automation assistant'
  return terms(idea, 8).join(' ') || 'AI software product'
}

function buildProfile(idea: string, graph: Record<string, any>): ResearchProfileV12 {
  const capabilities = inferCapabilities(idea, graph)
  const specializedCapabilities = capabilities.filter((item) => !GENERIC_CAPABILITIES.has(item))
  const genericCapabilities = capabilities.filter((item) => GENERIC_CAPABILITIES.has(item))
  const intentTerms = expand([...terms(idea, 32), ...terms(capabilities.join(' '), 28)])
  const domainTerms = intentTerms.filter((term) => !['frontend', 'backend', 'database', 'authentication', 'api', 'monitoring'].includes(term)).slice(0, 18)
  const archetype = productArchetype(idea)
  const planned: QueryPlan[] = [
    { query: archetype, focus: 'Existing product closest to the full idea', kind: 'product' },
    { query: `${archetype} open source agent`, focus: 'Existing end-to-end open-source product', kind: 'product' },
  ]
  for (const capability of specializedCapabilities.slice(0, 8)) {
    const rule = CAPABILITY_RULES.find((item) => item.name === capability)
    planned.push({ query: rule?.query || `${archetype} ${terms(capability, 5).join(' ')}`, focus: capability, kind: 'capability' })
  }
  planned.push({ query: `${archetype} architecture agent tools memory`, focus: 'Architecture patterns', kind: 'architecture' })
  const queries = planned
    .map((item) => ({ ...item, query: item.query.replace(/\s+/g, ' ').trim() }))
    .filter((item, index, all) => item.query && all.findIndex((candidate) => candidate.query === item.query) === index)
    .slice(0, 9)
  return {
    query: queries[0]?.query || archetype,
    queries,
    intentTerms: intentTerms.slice(0, 64),
    domainTerms,
    capabilities,
    specializedCapabilities,
    genericCapabilities,
    domain: inferDomain(idea),
    productArchetype: archetype,
  }
}

function evidenceForCapability(capability: string, corpus: string) {
  const rule = CAPABILITY_RULES.find((item) => item.name === capability)
  if (!rule) {
    const wanted = terms(capability, 5)
    const haystack = new Set(terms(corpus, 800))
    return wanted.length > 0 && wanted.filter((term) => haystack.has(term)).length / wanted.length >= 0.6
  }
  const positiveHits = rule.positive.filter((pattern) => pattern.test(corpus)).length
  if (positiveHits === 0) return false
  if (rule.requireAction && !rule.requireAction.test(corpus)) return false
  if (rule.negativeOnly?.test(corpus)) {
    const strongPositive = rule.positive.filter((pattern) => pattern.test(corpus)).length >= 2
    const constructive = /create|generate|edit|write|insert|format|update|formula|chart|executor|control/i.test(corpus)
    if (!strongPositive || !constructive) return false
  }
  return true
}

function matchedCapabilities(profile: ResearchProfileV12, corpus: string) {
  return profile.capabilities.filter((capability) => evidenceForCapability(capability, corpus))
}

function lexicalRelevance(profile: ResearchProfileV12, corpus: string) {
  const haystack = new Set(expand(terms(corpus, 1000)))
  const domain = profile.domainTerms.slice(0, 14)
  const intent = profile.intentTerms.slice(0, 34)
  const domainHits = domain.filter((term) => haystack.has(stem(term))).length
  const intentHits = intent.filter((term) => haystack.has(stem(term))).length
  const archetypeTerms = terms(profile.productArchetype, 8)
  const archetypeHits = archetypeTerms.filter((term) => haystack.has(term)).length
  return clamp(
    (domainHits / Math.max(1, Math.min(domain.length, 10))) * 0.45 +
    (intentHits / Math.max(1, Math.min(intent.length, 22))) * 0.30 +
    (archetypeHits / Math.max(1, Math.min(archetypeTerms.length, 6))) * 0.25,
  )
}

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'AI-Product-Factory/12.0',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function json(url: string, init?: RequestInit, timeout = 15000) {
  try {
    const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(timeout) })
    if (!response.ok) return null
    return await response.json()
  } catch { return null }
}

function decodeBase64(value: unknown) {
  try { return typeof value === 'string' ? Buffer.from(value.replace(/\n/g, ''), 'base64').toString('utf8') : '' } catch { return '' }
}

function daysSince(value: string | undefined) {
  const time = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 86_400_000) : 3650
}

function repositoryHealth(item: any) {
  const stars = Math.max(0, Number(item.stargazers_count || 0))
  const forks = Math.max(0, Number(item.forks_count || 0))
  const ageDays = daysSince(item.pushed_at || item.updated_at)
  const activity = ageDays <= 30 ? 1 : ageDays <= 90 ? 0.92 : ageDays <= 180 ? 0.82 : ageDays <= 365 ? 0.68 : ageDays <= 730 ? 0.48 : 0.25
  const popularity = clamp(Math.log10(stars + 1) / 4.5)
  const ecosystem = clamp(Math.log10(forks + 1) / 3.5)
  const license = text(item.license?.spdx_id).toLowerCase()
  const licenseScore = !license || ['noassertion', 'other'].includes(license) ? 0.35 : ['mit', 'apache-2.0', 'bsd-2-clause', 'bsd-3-clause', 'isc', 'mpl-2.0'].includes(license) ? 1 : 0.65
  const health = clamp(activity * 0.43 + popularity * 0.24 + ecosystem * 0.10 + licenseScore * 0.23)
  return { healthScore: Math.round(health * 100), activityScore: Math.round(activity * 100), popularityScore: Math.round(popularity * 100), licenseScore: Math.round(licenseScore * 100) }
}

function filePriority(path: string, profile: ResearchProfileV12) {
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

function architectureHints(paths: string[], corpus: string) {
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

async function fetchRepoFile(fullName: string, path: string, branch: string) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  const data = await json(`https://api.github.com/repos/${fullName}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`, { headers: githubHeaders() }, 10000) as any
  return data && !Array.isArray(data) ? decodeBase64(data.content).slice(0, 22000) : ''
}

async function inspectRepository(item: any, profile: ResearchProfileV12, queryFocuses: string[]): Promise<DeepResearchSignalV12 | null> {
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

  // This is the critical anti-keyword gate: a repo must prove at least one
  // specialized requested capability in README/source, not merely contain a word
  // like "excel" in a dataset name or provide a generic backend framework.
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

async function githubCandidates(profile: ResearchProfileV12, seedRepos: string[]) {
  const byName = new Map<string, { item: any; focuses: Set<string> }>()
  const queryLimit = process.env.GITHUB_TOKEN ? profile.queries.length : Math.min(6, profile.queries.length)
  const queries = profile.queries.slice(0, queryLimit)

  const groups = await Promise.all(queries.map(async (plan) => {
    const url = new URL('https://api.github.com/search/repositories')
    url.searchParams.set('q', `${plan.query} in:name,description,readme archived:false fork:false`)
    url.searchParams.set('per_page', process.env.GITHUB_TOKEN ? '12' : '8')
    // GitHub best-match search is deliberately retained. Stars are a health
    // signal after relevance, never the primary retrieval objective.
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

function sourceProofSignals(repo: DeepResearchSignalV12) {
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

function needsModelResearch(profile: ResearchProfileV12) {
  return /ai|llm|model|vision|video|image|speech|embedding|rag|inference|multimodal/i.test(`${profile.productArchetype} ${profile.capabilities.join(' ')}`)
}

async function huggingFace(profile: ResearchProfileV12): Promise<DeepResearchSignalV12[]> {
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
    const tags = list<string>(item.tags).join(' ')
    const corpus = `${id} ${tags}`
    const matched = matchedCapabilities(profile, corpus)
    const rel = lexicalRelevance(profile, corpus) * 0.55 + (matched.length / Math.max(1, Math.min(profile.specializedCapabilities.length, 5))) * 0.45
    return {
      source: 'Hugging Face', kind: 'model', title: id,
      url: id ? `https://huggingface.co/${id}` : '', summary: tags.slice(0, 600),
      publishedAt: item.lastModified, relevance: Number(clamp(rel).toFixed(3)),
      capabilities: matched, metrics: { downloads: item.downloads || 0, likes: item.likes || 0 },
    }
  }).filter((signal: DeepResearchSignalV12) => signal.title && Number(signal.relevance || 0) >= 0.66).slice(0, 6)
}

async function gitlab(profile: ResearchProfileV12): Promise<DeepResearchSignalV12[]> {
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
    const relevance = clamp(lexicalRelevance(profile, corpus) * 0.55 + Math.min(1, specialized.length / 2) * 0.45)
    return {
      source: 'GitLab', kind: 'repository-lead', title: item.name_with_namespace || item.name || 'GitLab project',
      url: item.web_url || '', summary: item.description || '', publishedAt: item.last_activity_at,
      relevance: Number(relevance.toFixed(3)), capabilities: caps,
      metrics: { stars: item.star_count || 0, forks: item.forks_count || 0 },
    }
  }).filter((signal: DeepResearchSignalV12) => Number(signal.relevance || 0) >= 0.70 && (signal.capabilities || []).some((cap) => profile.specializedCapabilities.includes(cap))).slice(0, 5)
}

async function tavily(profile: ResearchProfileV12): Promise<DeepResearchSignalV12[]> {
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

async function arxiv(profile: ResearchProfileV12): Promise<DeepResearchSignalV12[]> {
  if (!/vision|agent|multimodal|computer use|learning|inference/i.test(`${profile.productArchetype} ${profile.specializedCapabilities.join(' ')}`)) return []
  const focus = profile.specializedCapabilities.slice(0, 3).flatMap((cap) => terms(cap, 3)).slice(0, 4)
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

async function githubReleases(repos: DeepResearchSignalV12[]) {
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

function dedupeSignals(signals: DeepResearchSignalV12[]) {
  const seen = new Map<string, DeepResearchSignalV12>()
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

export async function runDeepResearchV12(idea: string, graph: Record<string, any>, seedRepos: string[]) {
  const profile = buildProfile(idea, graph)
  const started = Date.now()
  const github = await githubCandidates(profile, seedRepos)
  const qualifiedRepos = github.signals
  const proofSignals = qualifiedRepos.flatMap(sourceProofSignals)
  const [gitlabSignals, modelSignals, webSignals, paperSignals, releaseSignals] = await Promise.all([
    gitlab(profile),
    huggingFace(profile),
    tavily(profile),
    arxiv(profile),
    githubReleases(qualifiedRepos),
  ])

  const signals = dedupeSignals([
    ...qualifiedRepos,
    ...proofSignals,
    ...releaseSignals,
    ...webSignals,
    ...modelSignals,
    ...gitlabSignals,
    ...paperSignals,
  ]).filter((signal) => {
    if (signal.kind === 'github-repository') return Number(signal.relevance || 0) >= 0.64 && Boolean(signal.inspection?.specializedCapabilities.length)
    if (signal.kind === 'github-source-proof') return Number(signal.relevance || 0) >= 0.62
    if (signal.source === 'arXiv') return Number(signal.relevance || 0) >= 0.78
    return Number(signal.relevance || 0) >= 0.66
  }).sort((a, b) => {
    const repoBonusA = a.kind === 'github-repository' ? 0.08 : a.kind === 'github-source-proof' ? 0.035 : 0
    const repoBonusB = b.kind === 'github-repository' ? 0.08 : b.kind === 'github-source-proof' ? 0.035 : 0
    return Number(b.relevance || 0) + repoBonusB - (Number(a.relevance || 0) + repoBonusA)
  }).slice(0, 80)

  const counts = signals.reduce<Record<string, number>>((acc, signal) => {
    acc[signal.source] = (acc[signal.source] || 0) + 1
    return acc
  }, {})
  const repoSignals = signals.filter((signal) => signal.kind === 'github-repository')
  const evidenceSignals = signals.filter((signal) => signal.kind !== 'github-source-proof')
  const averageRelevance = evidenceSignals.length
    ? Number((evidenceSignals.reduce((sum, signal) => sum + Number(signal.relevance || 0), 0) / evidenceSignals.length).toFixed(3))
    : 0
  const covered = new Set(repoSignals.flatMap((signal) => signal.inspection?.specializedCapabilities || []))
  const capabilityCoverage = profile.specializedCapabilities.length
    ? Math.round((covered.size / profile.specializedCapabilities.length) * 100)
    : 0
  const averageInspection = repoSignals.length
    ? Math.round(repoSignals.reduce((sum, signal) => sum + Number(signal.inspection?.inspectionScore || 0), 0) / repoSignals.length)
    : 0
  const researchCompleteness = Math.round(clamp(
    Math.min(1, repoSignals.length / 5) * 0.24 +
    (capabilityCoverage / 100) * 0.36 +
    (averageInspection / 100) * 0.24 +
    Math.min(1, Object.keys(counts).length / 4) * 0.08 +
    Math.min(1, averageRelevance / 0.82) * 0.08,
  ) * 100)
  const confidenceBand = researchCompleteness >= 90 && repoSignals.length >= 3 && capabilityCoverage >= 75
    ? 'high'
    : researchCompleteness >= 70 && repoSignals.length >= 2
      ? 'medium'
      : 'low'

  const architecturePatterns = [...new Set(repoSignals.flatMap((signal) => signal.inspection?.architectureHints || []))].slice(0, 12)
  const sourceLinks = repoSignals.flatMap((signal) => signal.inspection?.sourceLinks || []).slice(0, 40)

  return {
    success: true,
    engineVersion: '12.0',
    query: profile.query,
    profile,
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    sourceCatalog: SOURCE_CATALOG,
    signals,
    sourceLinks,
    architecturePatterns,
    summary: {
      signalCount: signals.length,
      relevantSignalCount: evidenceSignals.length,
      rejectedSignalCount: Math.max(0, github.discoveredCount - repoSignals.length) + Math.max(0, gitlabSignals.length + modelSignals.length + webSignals.length + paperSignals.length - evidenceSignals.filter((signal) => signal.kind !== 'github-repository' && signal.kind !== 'release').length),
      sourcesWithResults: Object.keys(counts).length,
      sourceCounts: counts,
      githubCandidates: repoSignals.length,
      repositoriesDiscovered: github.discoveredCount,
      repositoriesInspected: github.inspectedCount,
      repositorySourceLinks: sourceLinks.length,
      averageRelevance,
      averageInspection,
      capabilityCoverage,
      researchCompleteness,
      confidenceBand,
    },
    accuracyPolicy: '90% is a release-quality recommendation target, never a fabricated guarantee. A GitHub repository cannot qualify from name/stars alone: README and representative capability-bearing source must prove direct fit. Generic frameworks and keyword-only matches are rejected; below-threshold research keeps the build gate locked.',
  }
}
