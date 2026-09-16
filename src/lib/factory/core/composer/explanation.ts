import { ROLE_ORDER } from './constants'
import { reposForRole } from './architecture'
import type { ProductBlueprint, SelectedRepo, NormalizedBrief, ProductSystemOutput } from './types'

export function buildCompositionExplanation(
  blueprint: ProductBlueprint,
  selected: SelectedRepo[],
  brief: NormalizedBrief,
  scores: ProductSystemOutput['scores']
): string {
  const roleLines = ROLE_ORDER
    .map(role => {
      const repos = reposForRole(selected, role)
      if (repos.length === 0) return null
      return `${role}: ${repos.map(repo => repo.name).join(', ')}`
    })
    .filter(Boolean)
    .join('; ')

  const securityLine = reposForRole(selected, 'security').length > 0
    ? ` Security is enforced by ${reposForRole(selected, 'security').map(repo => repo.name).join(', ')}.`
    : ''

  return `${blueprint.productName} is composed as a layered operations system. ${roleLines}. The interface captures cases, the agent structures the work item, the planner turns it into a durable workflow, the execution layer performs integrations and automation, storage preserves evidence and state, and monitoring exposes reliability plus business KPIs.${securityLine} This stack scores ${scores.coherence}/100 on coherence because the control-plane layers are separated cleanly, required roles are covered, and the selected repositories are mature production frameworks rather than tutorials or list repos.`
}
