export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function toTitleCase(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

export function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some(needle => haystack.includes(needle))
}
