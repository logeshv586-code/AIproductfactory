import { CAPABILITY_RULES, GENERIC_CAPABILITIES } from './constants'
import { terms, expand, stem, clamp } from './nlp-utils'
import { inferCapabilities } from './capability-inference'
import { inferDomain, productArchetype } from './domain-inference'
import type { QueryPlan, ResearchProfileV12 } from './types'

export function buildProfile(idea: string, graph: Record<string, any>): ResearchProfileV12 {
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
