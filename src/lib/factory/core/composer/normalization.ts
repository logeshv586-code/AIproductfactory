import { classifyIntent } from '../intent-classifier'
import { REGULATED_INDUSTRIES, FIELD_ALIASES } from './constants'
import { slugify, unique } from './utils'
import type { FieldTag, NormalizedBrief, ProductSystemRequest } from './types'

function normalizeFields(inputFields: string[], seedText: string): FieldTag[] {
  const tags: FieldTag[] = []
  const combined = `${inputFields.join(' ')} ${seedText}`.toLowerCase()

  for (const alias of FIELD_ALIASES) {
    if (alias.matches.some(match => combined.includes(match))) {
      tags.push(alias.tag)
    }
  }

  if (!tags.includes('ai')) tags.push('ai')
  if (!tags.includes('workflow')) tags.push('workflow')
  if (!tags.includes('automation')) tags.push('automation')

  return unique(tags)
}

export function normalizeBrief(input: ProductSystemRequest): NormalizedBrief {
  const industry = input.industry.trim()
  const seedText = `${industry} ${input.idea || ''}`
  const intent = classifyIntent(seedText)
  const fields = normalizeFields(input.fields, seedText)
  const industrySlug = slugify(industry)
  const isRegulated = REGULATED_INDUSTRIES.has(industrySlug)
  const needsVectorMemory = fields.includes('rag') || fields.includes('ai') || intent.tags.includes('rag')
  const needsExternalAutomation = fields.includes('automation') || intent.tags.includes('browser-automation')
  const preferredOutput: NormalizedBrief['preferredOutput'] = fields.includes('analytics')
    ? 'dashboard'
    : fields.includes('integration')
      ? 'api'
      : 'automation'

  return {
    industry,
    industrySlug,
    idea: input.idea?.trim() || undefined,
    fields,
    intentTags: intent.tags,
    maxRepos: Math.min(10, Math.max(5, input.maxRepos)),
    isRegulated,
    needsExternalAutomation,
    needsVectorMemory,
    preferredOutput,
  }
}
