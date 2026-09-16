import { CAPABILITY_RULES } from './constants'
import { text, terms, expand, stem, clamp, daysSince } from './nlp-utils'
import type { ResearchProfileV12 } from './types'

export function evidenceForCapability(capability: string, corpus: string) {
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

export function matchedCapabilities(profile: ResearchProfileV12, corpus: string) {
  return profile.capabilities.filter((capability) => evidenceForCapability(capability, corpus))
}

export function lexicalRelevance(profile: ResearchProfileV12, corpus: string) {
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

export function repositoryHealth(item: any) {
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
