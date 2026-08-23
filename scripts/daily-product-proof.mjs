import fs from 'node:fs/promises'
import path from 'node:path'

const BASE = process.env.FACTORY_BASE_URL || 'http://127.0.0.1:3000'
const OUTPUT_DIR = process.env.DAILY_PROOF_DIR || 'proof/daily'
const SOURCE_LOOKBACK_DAYS = Number(process.env.DAILY_PROOF_LOOKBACK_DAYS || 7)
const GITHUB_TOKEN = (process.env.GITHUB_TOKEN || '').trim()
const OVERRIDE_IDEA = (process.env.FACTORY_DAILY_IDEA || '').trim()

let runtimeSessionId = ''

const painTerms = [
  'how do i', 'how can i', 'need a way', 'looking for', 'struggling', 'difficult',
  'pain', 'problem', 'issue', 'manual', 'slow', 'broken', 'frustrating', 'wish',
  'feature request', 'enhancement', 'workaround', 'cannot', "can't", 'unable',
  'automate', 'automation', 'too much time', 'repetitive', 'help wanted',
]

function cleanText(value = '') {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function excerpt(value = '', limit = 280) {
  const text = cleanText(value)
  return text.length <= limit ? text : `${text.slice(0, limit - 1).trim()}…`
}

function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function sinceDate(days) {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return isoDate(date)
}

function scoreCandidate(candidate) {
  const haystack = `${candidate.title} ${candidate.excerpt}`.toLowerCase()
  const painScore = painTerms.reduce((sum, term) => sum + (haystack.includes(term) ? 8 : 0), 0)
  const engagement = Math.min(30, Math.log2(1 + Number(candidate.engagement || 0)) * 5)
  const detail = Math.min(15, candidate.excerpt.length / 25)
  const sourceDiversityWeight = candidate.source === 'GitHub Issues' ? 8 : candidate.source === 'Stack Overflow' ? 7 : 6
  return Math.round((painScore + engagement + detail + sourceDiversityWeight) * 10) / 10
}

async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'AIproductfactory-daily-proof/1.0',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    })
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

async function fetchHackerNews() {
  const sinceUnix = Math.floor((Date.now() - SOURCE_LOOKBACK_DAYS * 86400000) / 1000)
  const url = `https://hn.algolia.com/api/v1/search_by_date?tags=story&query=Ask%20HN&numericFilters=created_at_i%3E${sinceUnix}&hitsPerPage=40`
  const data = await fetchJson(url)
  return (data.hits || [])
    .filter((item) => item.title && item.url !== null)
    .map((item) => ({
      source: 'Hacker News',
      title: cleanText(item.title),
      excerpt: excerpt(item.story_text || item.title),
      url: `https://news.ycombinator.com/item?id=${item.objectID}`,
      engagement: Number(item.num_comments || 0) + Number(item.points || 0),
      publishedAt: item.created_at || null,
    }))
}

async function fetchStackOverflow() {
  const fromdate = Math.floor((Date.now() - SOURCE_LOOKBACK_DAYS * 86400000) / 1000)
  const url = `https://api.stackexchange.com/2.3/questions?site=stackoverflow&fromdate=${fromdate}&pagesize=40&order=desc&sort=activity&filter=withbody`
  const data = await fetchJson(url)
  return (data.items || []).map((item) => ({
    source: 'Stack Overflow',
    title: cleanText(item.title),
    excerpt: excerpt(item.body || item.title),
    url: item.link,
    engagement: Number(item.answer_count || 0) * 3 + Number(item.score || 0) + Number(item.view_count || 0) / 100,
    publishedAt: item.creation_date ? new Date(item.creation_date * 1000).toISOString() : null,
  }))
}

async function fetchGitHubIssues() {
  const since = sinceDate(SOURCE_LOOKBACK_DAYS)
  const query = encodeURIComponent(`is:issue is:open created:>=${since} comments:>=2`)
  const url = `https://api.github.com/search/issues?q=${query}&sort=comments&order=desc&per_page=40`
  const headers = GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' } : {}
  const data = await fetchJson(url, { headers })
  return (data.items || [])
    .filter((item) => !item.pull_request)
    .map((item) => ({
      source: 'GitHub Issues',
      title: cleanText(item.title),
      excerpt: excerpt(item.body || item.title),
      url: item.html_url,
      engagement: Number(item.comments || 0) + Number(item.reactions?.total_count || 0),
      publishedAt: item.created_at || null,
    }))
}

async function discoverProblems() {
  const sources = [
    ['Hacker News', fetchHackerNews],
    ['Stack Overflow', fetchStackOverflow],
    ['GitHub Issues', fetchGitHubIssues],
  ]

  const candidates = []
  const sourceResults = []

  for (const [name, loader] of sources) {
    try {
      const rows = await loader()
      sourceResults.push({ source: name, ok: true, count: rows.length })
      candidates.push(...rows)
    } catch (error) {
      sourceResults.push({ source: name, ok: false, count: 0, error: String(error?.message || error) })
    }
  }

  const seen = new Set()
  const ranked = candidates
    .filter((item) => item.title && item.url)
    .filter((item) => {
      const key = item.title.toLowerCase().replace(/\W+/g, ' ').trim()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((item) => ({ ...item, score: scoreCandidate(item) }))
    .sort((a, b) => b.score - a.score)

  return { ranked, sourceResults }
}

async function request(route, options = {}) {
  const response = await fetch(`${BASE}${route}`, options)
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  if (!response.ok) throw new Error(`${route} failed (${response.status}): ${JSON.stringify(data).slice(0, 1800)}`)
  return data
}

async function post(route, body, { useSession = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (useSession && runtimeSessionId) headers['X-LLM-Session'] = runtimeSessionId
  const data = await request(route, { method: 'POST', headers, body: JSON.stringify(body) })
  if (data?.success === false) throw new Error(`${route} returned success=false: ${JSON.stringify(data).slice(0, 1800)}`)
  return data
}

function makeProductIdea(problem) {
  if (OVERRIDE_IDEA) return OVERRIDE_IDEA
  return [
    `Build a practical end-to-end product for people affected by this real public problem: "${problem.title}".`,
    problem.excerpt ? `Evidence context: ${problem.excerpt}` : '',
    'The product should reduce manual effort, make the main workflow simple for non-experts, provide measurable completion or verification, and prefer reliable integrations over a thin single-feature demo.',
  ].filter(Boolean).join(' ')
}

function md(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function boolMark(value) {
  return value === true ? '✅' : value === false ? '❌' : '—'
}

async function writeOutputs(state) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  const date = isoDate()
  const reportPath = path.join(OUTPUT_DIR, `${date}.md`)
  const latestPath = path.join(OUTPUT_DIR, 'latest.json')

  const selectedRepos = state.selectedComposition?.repos || []
  const verification = state.build?.verification || {}
  const sourceCount = state.discovery?.sourceResults?.filter((item) => item.ok).length || 0
  const candidateCount = state.discovery?.ranked?.length || 0
  const gatePassed = state.manager?.report?.researchProof?.gatePassed === true
  const quality = state.manager?.report?.recommendationQuality?.score

  const claim = state.status === 'VERIFIED_END_TO_END'
    ? `VERIFIED: On ${date}, AI Product Factory took a real public problem through product intelligence, source-qualified research, plan selection, approval, and a pipeline-verified source-locked build.`
    : state.status === 'VERIFIED_GUARDRAIL'
      ? `NOT CLAIMED: On ${date}, the research/build gate correctly stayed closed because the evidence threshold was not met. No end-to-end product-build claim is published for this run.`
      : `FAILED: The daily proof run did not complete safely. No product-build claim is published for this run.`

  const topCandidates = (state.discovery?.ranked || []).slice(0, 5)
  const report = `# Daily Product Factory Proof — ${date}\n\n` +
`> ${claim}\n\n` +
`## Result\n\n` +
`| Field | Value |\n| --- | --- |\n` +
`| Status | **${state.status}** |\n` +
`| Public sources reached | ${sourceCount}/3 |\n` +
`| Problem candidates ranked | ${candidateCount} |\n` +
`| Research gate | ${gatePassed ? 'Passed' : 'Closed'} |\n` +
`| Recommendation quality | ${typeof quality === 'number' ? `${quality}%` : 'n/a'} |\n` +
`| Pipeline verified | ${state.build?.pipelineVerified === true ? 'Yes' : 'No'} |\n\n` +
`## Chosen real-world problem\n\n` +
`${state.problem ? `- **Source:** ${md(state.problem.source)}\n- **Problem:** ${md(state.problem.title)}\n- **Evidence excerpt:** ${md(state.problem.excerpt || 'n/a')}\n- **Source URL:** ${state.problem.url}\n- **Selection score:** ${state.problem.score ?? 'override'}\n` : '- No problem selected.\n'}\n` +
`## Product request sent into the current factory\n\n${md(state.idea || 'n/a')}\n\n` +
`## Product details produced\n\n` +
`- **Customer goal:** ${md(state.manager?.report?.customerBrief?.goal || 'n/a')}\n` +
`- **Recommended strategy:** ${md(state.manager?.report?.recommendedStrategy?.title || state.manager?.report?.recommendedStrategy?.name || 'n/a')}\n` +
`- **Selected plan:** ${md(state.selectedComposition?.customerTitle || state.selectedComposition?.title || 'n/a')}\n` +
`- **Plan effort:** ${md(state.selectedComposition?.effort || 'n/a')}\n` +
`- **Capability coverage:** ${state.selectedComposition?.capabilityCoverage ?? 'n/a'}\n` +
`- **Domain relevance:** ${state.selectedComposition?.domainRelevance ?? 'n/a'}\n\n` +
`## Selected source repositories\n\n` +
(selectedRepos.length ? selectedRepos.map((repo) => `- [${md(repo.fullName)}](${repo.url}) — ${md(repo.whySelected || repo.description || '')}`).join('\n') : '- No repositories locked for build.') +
`\n\n## Build verification\n\n` +
`| Check | Result |\n| --- | --- |\n` +
`| Approved repository lock | ${boolMark(verification.approvedRepoLock)} |\n` +
`| Product generated | ${boolMark(verification.productGenerated)} |\n` +
`| Capability graph built | ${boolMark(verification.capabilityGraphBuilt)} |\n` +
`| Starter blueprint generated | ${boolMark(verification.starterBlueprintGenerated)} |\n` +
`| Architecture generated | ${boolMark(verification.architectureGenerated)} |\n` +
`| Pipeline completed | ${boolMark(verification.pipelineCompleted)} |\n\n` +
`## Source discovery health\n\n` +
`| Source | Status | Candidates |\n| --- | --- | ---: |\n` +
(state.discovery?.sourceResults || []).map((item) => `| ${md(item.source)} | ${item.ok ? '✅ fetched' : `❌ ${md(item.error || 'failed')}`} | ${item.count} |`).join('\n') +
`\n\n## Top problem candidates considered\n\n` +
(topCandidates.length ? topCandidates.map((item, index) => `${index + 1}. **${md(item.title)}** — ${md(item.source)} — score ${item.score} — ${item.url}`).join('\n') : 'No ranked candidates available.') +
`\n\n## Claim policy\n\nThis workflow never publishes “best”, “strongest”, “100% accurate”, or similar comparative claims from a single run. It only publishes an end-to-end claim when the current Product Factory research gate passes and the build API returns \`pipelineVerified: true\`. A closed research gate is treated as a successful guardrail, not as proof that a product was built.\n` +
(state.error ? `\n## Error\n\n\`${md(state.error)}\`\n` : '')

  const latest = {
    date,
    status: state.status,
    claim,
    problem: state.problem || null,
    idea: state.idea || null,
    sourceResults: state.discovery?.sourceResults || [],
    candidateCount,
    researchGatePassed: gatePassed,
    recommendationQuality: typeof quality === 'number' ? quality : null,
    selectedPlan: state.selectedComposition || null,
    pipelineVerified: state.build?.pipelineVerified === true,
    verification,
    error: state.error || null,
  }

  await fs.writeFile(reportPath, report, 'utf8')
  await fs.writeFile(latestPath, `${JSON.stringify(latest, null, 2)}\n`, 'utf8')

  if (process.env.GITHUB_STEP_SUMMARY) {
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `## Daily Product Factory Proof\n\n**${state.status}** — ${claim}\n\nReport: \`${reportPath}\`\n`)
  }

  console.log(`[daily-proof] report: ${reportPath}`)
  console.log(`[daily-proof] latest: ${latestPath}`)
}

async function runFactory(state) {
  const localModel = await post('/api/factory/llm/configure', {
    provider: 'local', apiKey: '', model: 'local-deterministic',
  }, { useSession: false })
  runtimeSessionId = localModel.sessionId
  if (!runtimeSessionId) throw new Error('local runtime session missing')

  const strategize = await post('/api/factory/pi/strategize', { idea: state.idea })
  state.strategize = strategize

  const repoSeeds = Array.isArray(strategize.graph?.repos)
    ? strategize.graph.repos.map((repo) => repo?.full_name).filter(Boolean).slice(0, 8)
    : []

  const liveResearch = await post('/api/factory/research/live', {
    idea: state.idea,
    repos: repoSeeds,
    graph: strategize.graph,
  })
  state.liveResearch = liveResearch

  const customerContext = {
    audience: 'People affected by the cited public problem',
    priority: 'balanced',
    platform: 'Web app',
    privacy: 'Privacy-conscious defaults',
    budget: 'Balance cost and quality',
  }

  const manager = await post('/api/factory/manager', {
    idea: state.idea,
    runId: strategize.run_id,
    graph: strategize.graph,
    liveResearch,
    customerContext,
  })
  state.manager = manager

  const compositions = manager.report?.compositionSuggestions || []
  const gatePassed = manager.report?.researchProof?.gatePassed === true

  if (!gatePassed || compositions.length === 0) {
    state.status = 'VERIFIED_GUARDRAIL'
    return
  }

  const selected = compositions[0]
  const strategyId = manager.report?.recommendedStrategy?.id || strategize.strategies?.[0]?.id
  if (!strategyId) throw new Error('research gate passed but no strategy was available for approval')

  const approved = await post('/api/factory/pi/approve', {
    runId: strategize.run_id,
    strategyId,
  })
  state.approved = approved

  const finalManager = await post('/api/factory/manager', {
    idea: state.idea,
    runId: strategize.run_id,
    graph: approved.graph,
    liveResearch,
    customerContext,
    selectedCompositionId: selected.id,
  })
  state.finalManager = finalManager
  state.selectedComposition = finalManager.report?.compositionSuggestions?.[0] || selected

  const selectedRepos = state.selectedComposition?.repos || []
  if (selectedRepos.length < 1 || selectedRepos.length > 3) {
    throw new Error(`selected plan has ${selectedRepos.length} repositories; build API requires 1-3`)
  }

  const build = await post('/api/factory/build/approved', {
    idea: state.idea,
    runId: strategize.run_id,
    strategyId,
    selectedRepos: selectedRepos.map((repo) => ({
      fullName: repo.fullName,
      url: repo.url,
      description: repo.description,
      language: repo.language,
      license: repo.license,
      healthScore: repo.healthScore,
      capabilities: repo.capabilities,
      whySelected: repo.whySelected,
      integrationMode: repo.integrationMode,
    })),
  })
  state.build = build

  const v = build.verification || {}
  const required = [
    v.approvedRepoLock,
    v.productGenerated,
    v.capabilityGraphBuilt,
    v.starterBlueprintGenerated,
    v.architectureGenerated,
    v.pipelineCompleted,
    build.pipelineVerified,
  ]
  state.status = required.every((value) => value === true) ? 'VERIFIED_END_TO_END' : 'FAILED'
  if (state.status === 'FAILED') {
    state.error = `build verification incomplete: ${JSON.stringify(v)}`
  }
}

async function main() {
  const state = {
    status: 'FAILED',
    discovery: null,
    problem: null,
    idea: null,
    error: null,
  }

  try {
    state.discovery = await discoverProblems()
    state.problem = state.discovery.ranked[0] || null

    if (!state.problem && !OVERRIDE_IDEA) {
      throw new Error('no usable public problem statements were discovered from the configured sources')
    }

    if (!state.problem && OVERRIDE_IDEA) {
      state.problem = {
        source: 'Manual workflow override',
        title: OVERRIDE_IDEA,
        excerpt: 'FACTORY_DAILY_IDEA was supplied to workflow_dispatch.',
        url: 'n/a',
        score: 'override',
      }
    }

    state.idea = makeProductIdea(state.problem)
    console.log(`[daily-proof] selected problem from ${state.problem.source}: ${state.problem.title}`)
    await runFactory(state)
  } catch (error) {
    state.status = 'FAILED'
    state.error = String(error?.stack || error?.message || error)
  } finally {
    if (runtimeSessionId) {
      try {
        await request('/api/factory/llm/configure', {
          method: 'DELETE',
          headers: { 'X-LLM-Session': runtimeSessionId },
        })
      } catch (error) {
        console.warn(`[daily-proof] session cleanup warning: ${error?.message || error}`)
      }
    }
    await writeOutputs(state)
  }

  console.log(`[daily-proof] ${state.status}`)
  if (state.status === 'FAILED') process.exitCode = 1
}

await main()
