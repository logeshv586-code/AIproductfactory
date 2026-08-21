const BASE = process.env.FACTORY_BASE_URL || 'http://127.0.0.1:3000'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function main() {
  const idea = 'Build a Windows desktop computer-use agent that understands screenshots with vision, clicks and types in applications, plans multi-step tasks, and learns reusable workflows.'
  const response = await fetch(`${BASE}/api/factory/research/live`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idea,
      graph: {},
      repos: ['microsoft/UFO'],
      researchMode: 'public-local',
    }),
  })
  const data = await response.json()
  if (!response.ok || data?.success === false) {
    throw new Error(`tokenless research failed (${response.status}): ${JSON.stringify(data).slice(0, 2000)}`)
  }

  assert(data.researchRuntime?.mode === 'public-local-clone', `unexpected mode: ${data.researchRuntime?.mode}`)
  assert(data.researchRuntime?.tokenOptional === true, 'GitHub token should be optional in public-local mode')
  assert(data.researchRuntime?.localCloneInspection === true, 'local clone inspection was not enabled')
  assert(Number(data.researchRuntime?.localCloneRepositoriesInspected || 0) > 0, 'no public repository was locally inspected')

  const repos = (data.signals || []).filter((signal) => signal.kind === 'github-repository')
  assert(repos.length > 0, 'tokenless research produced no source-qualified repository')
  const sourceProof = repos.some((repo) =>
    repo.inspection?.inspected === true &&
    Number(repo.inspection?.sourceFilesSampled || 0) > 0 &&
    (repo.inspection?.sourceLinks || []).some((link) => /\/blob\/[0-9a-f]{40}\//i.test(link.url || '')),
  )
  assert(sourceProof, 'tokenless local clone did not produce commit-pinned source proof')

  console.log('[tokenless-e2e] PASS — public discovery + shallow local clone + pinned README/source inspection')
  console.log(JSON.stringify({
    mode: data.researchRuntime.mode,
    discovered: data.summary?.repositoriesDiscovered,
    locallyInspected: data.researchRuntime.localCloneRepositoriesInspected,
    qualified: data.summary?.githubCandidates,
    cacheHits: data.researchRuntime.localCloneCacheHits,
    rateLimited: data.researchRuntime.publicDiscoveryRateLimited,
    repositories: repos.map((repo) => repo.repository?.fullName || repo.title),
  }, null, 2))
}

main().catch((error) => {
  console.error('[tokenless-e2e] FAIL', error)
  process.exit(1)
})
