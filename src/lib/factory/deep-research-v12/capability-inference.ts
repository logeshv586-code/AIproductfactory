import { CAPABILITY_RULES, GENERIC_CAPABILITIES } from './constants'
import { text, list, normalize, terms, expand } from './nlp-utils'

export function graphCapabilities(graph: Record<string, any>) {
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

export function inferCapabilities(idea: string, graph: Record<string, any>) {
  const inferred = CAPABILITY_RULES.filter((rule) => rule.pattern.test(idea)).map((rule) => rule.name)
  const graphCaps = graphCapabilities(graph)
  const specializedGraph = graphCaps.filter((item) => !GENERIC_CAPABILITIES.has(item))
  const genericGraph = graphCaps.filter((item) => GENERIC_CAPABILITIES.has(item))
  return [...new Set([...inferred, ...specializedGraph, ...genericGraph])].slice(0, 20)
}
