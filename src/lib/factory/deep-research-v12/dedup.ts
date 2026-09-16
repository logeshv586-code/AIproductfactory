import { text } from './nlp-utils'
import type { DeepResearchSignalV12 } from './types'

export function dedupeSignals(signals: DeepResearchSignalV12[]) {
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
