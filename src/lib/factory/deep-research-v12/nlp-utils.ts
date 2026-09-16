import { STOP, SYNONYMS } from './constants'

export function text(value: unknown) { return typeof value === 'string' ? value.trim() : '' }
export function list<T = any>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : [] }
export function clamp(value: number, min = 0, max = 1) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0)) }

export function stem(value: string) {
  let token = value.toLowerCase().replace(/[^a-z0-9+#.-]/g, '')
  if (token.length > 6 && token.endsWith('ing')) token = token.slice(0, -3)
  else if (token.length > 5 && token.endsWith('ed')) token = token.slice(0, -2)
  else if (token.length > 5 && token.endsWith('es')) token = token.slice(0, -2)
  else if (token.length > 4 && token.endsWith('s')) token = token.slice(0, -1)
  return token
}

export function terms(value: string, max = 50) {
  return [...new Set(value.toLowerCase().match(/[a-z0-9+#.-]{3,}/g) || [])]
    .map(stem).filter((term) => term && !STOP.has(term)).slice(0, max)
}

export function expand(values: string[]) {
  const output = new Set(values.map(stem))
  for (const [anchor, synonyms] of Object.entries(SYNONYMS)) {
    const group = [anchor, ...synonyms].map(stem)
    if (group.some((term) => output.has(term))) group.forEach((term) => output.add(term))
  }
  return [...output]
}

export function normalize(value: string) { return terms(value).join(' ') }

export function daysSince(value: string | undefined) {
  const time = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(time) ? Math.max(0, (Date.now() - time) / 86_400_000) : 3650
}
