/**
 * RAG Memory — Persistent store for ideas, repos, builds, debug logs, probability weights
 * Ported from rag_memory.py — adapted for Next.js with file-backed + Prisma storage
 */
import fs from 'fs'
import path from 'path'

export interface MemoryEntry {
  kind: 'idea' | 'repo' | 'build' | 'debug' | 'prob_weight'
  key: string
  content: any
  ts: number
  tags: string[]
}

const MEMORY_DIR = path.join(process.cwd(), '.rag_memory')

export class RAGMemory {
  private entries: MemoryEntry[] = []
  private filePath: string

  constructor(memoryPath = '.rag_memory.json') {
    this.filePath = path.join(MEMORY_DIR, memoryPath)
    this.load()
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8')
        this.entries = JSON.parse(raw)
      }
    } catch {
      this.entries = []
    }
  }

  private save() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
      fs.writeFileSync(this.filePath, JSON.stringify(this.entries, null, 2))
    } catch (err) {
      console.error('[RAGMemory] save error:', err)
    }
  }

  store(kind: MemoryEntry['kind'], key: string, content: any, tags: string[] = []) {
    this.entries = this.entries.filter(e => e.key !== key)
    this.entries.push({ kind, key, content, ts: Date.now() / 1000, tags })
    this.save()
  }

  get(key: string): MemoryEntry | null {
    return this.entries.find(e => e.key === key) || null
  }

  search(query: string, kind?: string, topK = 5): MemoryEntry[] {
    const qTokens = new Set(query.toLowerCase().split(' '))
    const scored: [number, MemoryEntry][] = []

    for (const entry of this.entries) {
      if (kind && entry.kind !== kind) continue
      const text = JSON.stringify(entry.content).toLowerCase()
      let overlap = 0
      for (const token of qTokens) {
        if (text.includes(token)) overlap++
      }
      if (overlap > 0) scored.push([overlap, entry])
    }

    scored.sort((a, b) => b[0] - a[0])
    return scored.slice(0, topK).map(([, e]) => e)
  }

  // Specialized helpers
  storeIdea(ideaId: string, data: any) {
    this.store('idea', `idea:${ideaId}`, data, ['idea'])
  }

  storeRepo(repoFullName: string, data: any) {
    this.store('repo', `repo:${repoFullName}`, data, ['repo'])
  }

  storeBuild(buildId: string, data: any) {
    this.store('build', `build:${buildId}`, data, ['build'])
  }

  storeDebug(debugId: string, data: any) {
    this.store('debug', `debug:${debugId}`, data, ['debug'])
  }

  storeProbWeights(weights: Record<string, number>) {
    this.store('prob_weight', 'prob_weights:global', weights, ['prob'])
  }

  getProbWeights(): Record<string, number> {
    const entry = this.get('prob_weights:global')
    return entry?.content || {}
  }

  recallContext(query: string, topK = 5): any[] {
    const hits = this.search(query, undefined, topK)
    return hits.map(h => ({ kind: h.kind, key: h.key, content: h.content }))
  }

  summary(): { totalEntries: number; byKind: Record<string, number> } {
    const byKind: Record<string, number> = {}
    for (const e of this.entries) {
      byKind[e.kind] = (byKind[e.kind] || 0) + 1
    }
    return { totalEntries: this.entries.length, byKind }
  }
}

// Singleton
let memoryInstance: RAGMemory | null = null
export function getMemory(): RAGMemory {
  if (!memoryInstance) {
    memoryInstance = new RAGMemory()
  }
  return memoryInstance
}
