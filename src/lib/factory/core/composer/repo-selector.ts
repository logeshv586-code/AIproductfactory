import { REPO_CATALOG } from './constants'
import type { RepoRole, RepoCatalogItem, NormalizedBrief, SelectedRepo } from './types'

export function scoreRepoForRole(repo: RepoCatalogItem, role: RepoRole, brief: NormalizedBrief): number {
  let score = repo.maturity
  if (repo.roles.includes(role)) score += 25
  if (brief.fields.includes('analytics') && repo.tags.includes('analytics')) score += 10
  if (brief.fields.includes('devops') && repo.tags.includes('observability')) score += 10
  if (brief.needsExternalAutomation && repo.tags.includes('browser')) score += 14
  if (!brief.needsExternalAutomation && repo.fullName === 'celery/celery') score += 12
  if (brief.needsVectorMemory && repo.tags.includes('vector')) score += 12
  if (brief.isRegulated && repo.tags.includes('compliance')) score += 12
  if (brief.intentTags.includes('workflow') && repo.tags.includes('workflow')) score += 8
  if (brief.intentTags.includes('agents') && repo.tags.includes('agent')) score += 8
  if (brief.preferredOutput === 'dashboard' && repo.tags.includes('dashboard')) score += 8
  return score
}

export function chooseRepo(
  role: RepoRole,
  brief: NormalizedBrief,
  chosenNames: Set<string>,
  preferred?: string
): RepoCatalogItem | null {
  const candidates = REPO_CATALOG
    .filter(repo => repo.roles.includes(role))
    .sort((a, b) => {
      const preferredBoostA = preferred && a.fullName === preferred ? 1000 : 0
      const preferredBoostB = preferred && b.fullName === preferred ? 1000 : 0
      return (scoreRepoForRole(b, role, brief) + preferredBoostB) - (scoreRepoForRole(a, role, brief) + preferredBoostA)
    })

  return candidates.find(repo => !chosenNames.has(repo.fullName)) || candidates[0] || null
}

export async function hydrateRepoStars(repos: SelectedRepo[]): Promise<SelectedRepo[]> {
  const token = process.env.GITHUB_TOKEN
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'ai-product-factory',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const hydrated = await Promise.allSettled(
    repos.map(async repo => {
      const response = await fetch(`https://api.github.com/repos/${repo.name}`, {
        headers,
        next: { revalidate: 900 },
      })
      if (!response.ok) return repo
      const data = await response.json()
      return {
        ...repo,
        stars: typeof data.stargazers_count === 'number' ? data.stargazers_count : repo.stars,
      }
    })
  )

  return hydrated.map((result, index) => result.status === 'fulfilled' ? result.value : repos[index])
}

export async function selectRepos(brief: NormalizedBrief, blueprint: { productName: string }): Promise<SelectedRepo[]> {
  const { ROLE_ORDER } = await import('./constants')
  const chosenNames = new Set<string>()
  const selections: SelectedRepo[] = []

  const workflowPreferred = brief.fields.includes('integration') ? 'n8n-io/n8n' : 'temporalio/temporal'
  const executionPreferred = brief.needsExternalAutomation ? 'microsoft/playwright' : 'celery/celery'
  const storagePreferred = brief.needsVectorMemory ? 'qdrant/qdrant' : 'supabase/supabase'

  for (const role of ROLE_ORDER) {
    const preferred =
      role === 'workflow' ? workflowPreferred :
      role === 'execution' ? executionPreferred :
      role === 'storage' ? storagePreferred :
      undefined
    const repo = chooseRepo(role, brief, chosenNames, preferred)
    if (!repo) continue

    chosenNames.add(repo.fullName)
    selections.push({
      name: repo.fullName,
      role,
      url: repo.url,
      description: repo.description,
      reason: `${repo.selectionHint} For ${blueprint.productName}, it anchors the ${role} layer.`,
      tags: repo.tags,
      maturity: repo.maturity,
      active_signal: repo.activeSignal,
      stars: null,
    })
  }

  if (brief.needsVectorMemory && !chosenNames.has('supabase/supabase') && selections.length < brief.maxRepos) {
    const repo = REPO_CATALOG.find(item => item.fullName === 'supabase/supabase')
    if (repo) {
      chosenNames.add(repo.fullName)
      selections.push({
        name: repo.fullName,
        role: 'storage',
        url: repo.url,
        description: repo.description,
        reason: `Pairs relational case state with vector retrieval so ${blueprint.productName} can persist both workflow records and operational state.`,
        tags: repo.tags,
        maturity: repo.maturity,
        active_signal: repo.activeSignal,
        stars: null,
      })
    }
  }

  if (brief.isRegulated && selections.length < brief.maxRepos) {
    const repo = chooseRepo('security', brief, chosenNames)
    if (repo) {
      chosenNames.add(repo.fullName)
      selections.push({
        name: repo.fullName,
        role: 'security',
        url: repo.url,
        description: repo.description,
        reason: `Adds SSO, RBAC, and audit-friendly identity controls required for ${brief.industry} workflows.`,
        tags: repo.tags,
        maturity: repo.maturity,
        active_signal: repo.activeSignal,
        stars: null,
      })
    }
  }

  if (brief.fields.includes('devops') && selections.length < brief.maxRepos && !chosenNames.has('open-telemetry/opentelemetry-collector')) {
    const repo = REPO_CATALOG.find(item => item.fullName === 'open-telemetry/opentelemetry-collector')
    if (repo) {
      chosenNames.add(repo.fullName)
      selections.push({
        name: repo.fullName,
        role: 'monitoring',
        url: repo.url,
        description: repo.description,
        reason: `Complements dashboard monitoring with a telemetry backbone for traces, metrics, and logs.`,
        tags: repo.tags,
        maturity: repo.maturity,
        active_signal: repo.activeSignal,
        stars: null,
      })
    }
  }

  const limited = selections.slice(0, brief.maxRepos)
  return hydrateRepoStars(limited)
}
