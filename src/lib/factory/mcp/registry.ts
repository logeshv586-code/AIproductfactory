/**
 * MCP Tool Registry — Central registry for all MCP tools
 * Ported from mcp_registry.py — adapted for TypeScript
 */
import { webSearch } from '@/lib/search'

export interface MCPTool {
  name: string
  description: string
  tags: string[]
  handler: (...args: any[]) => any
  schema: Record<string, any>
  validateResult?: (result: any) => boolean
  timeoutMs?: number
  maxAttempts?: number
  fallbackResult?: any | ((args: any[], error: unknown) => any)
}

export interface MCPRunnerOptions {
  timeoutMs?: number
  validateResult?: (result: any) => boolean
  maxAttempts?: number
  fallbackResult?: any | ((args: any[], error: unknown) => any)
}

export interface MCPToolMetrics {
  calls: number
  successes: number
  failures: number
  successRate: number
  avgLatencyMs: number
  lastLatencyMs: number
  lastErrorAt: string | null
  healthScore: number
}

const DEFAULT_TOOL_TIMEOUT_MS = Number(process.env.MCP_TOOL_TIMEOUT_MS || 10000)
const DEFAULT_TOOL_MAX_ATTEMPTS = Number(process.env.MCP_TOOL_MAX_ATTEMPTS || 2)
const MIN_TOOL_SUCCESS_RATE = Number(process.env.MCP_TOOL_MIN_SUCCESS_RATE || 0.6)
const MIN_TOOL_HEALTH_SCORE = Number(process.env.MCP_TOOL_MIN_HEALTH_SCORE || 0.45)
const MIN_TOOL_CALLS_BEFORE_SKIP = Number(process.env.MCP_TOOL_MIN_CALLS_BEFORE_SKIP || 3)

export class MCPRegistry {
  private tools: Map<string, MCPTool> = new Map()
  private metrics: Map<string, { calls: number; successes: number; failures: number; totalLatencyMs: number; lastLatencyMs: number; lastErrorAt: string | null }> = new Map()

  register(tool: MCPTool) {
    this.tools.set(tool.name, tool)
    this.metrics.set(tool.name, {
      calls: 0,
      successes: 0,
      failures: 0,
      totalLatencyMs: 0,
      lastLatencyMs: 0,
      lastErrorAt: null,
    })
    console.log(`[MCP] registered: ${tool.name}`)
  }

  listTools(tag?: string): string[] {
    return this.getRankedTools(tag).map(tool => tool.name)
  }

  describe(name: string): Record<string, any> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`Tool '${name}' not found`)
    return {
      name: tool.name,
      description: tool.description,
      schema: tool.schema,
      tags: tool.tags,
      metrics: this.getMetrics(name),
    }
  }

  async mcpRunner(toolName: string, ...args: any[]): Promise<any> {
    const tool = this.tools.get(toolName)
    if (!tool) throw new Error(`Tool '${toolName}' not registered in MCP registry`)
    console.log(`[MCP] calling ${toolName}(${JSON.stringify(args).slice(0, 100)})`)
    return this.runIsolated(tool, args)
  }

  async runTool(toolName: string, args: any[] = [], options: MCPRunnerOptions = {}): Promise<any> {
    const tool = this.tools.get(toolName)
    if (!tool) throw new Error(`Tool '${toolName}' not registered in MCP registry`)
    console.log(`[MCP] calling ${toolName}(${JSON.stringify(args).slice(0, 100)})`)
    return this.runIsolated(tool, args, options)
  }

  private async runIsolated(tool: MCPTool, args: any[], options: MCPRunnerOptions = {}): Promise<any> {
    const timeoutMs = options.timeoutMs ?? tool.timeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS
    const maxAttempts = Math.max(1, options.maxAttempts ?? tool.maxAttempts ?? DEFAULT_TOOL_MAX_ATTEMPTS)
    const validateResult = options.validateResult ?? tool.validateResult
    const startedAt = Date.now()

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const result = await Promise.race([
          Promise.resolve(tool.handler(...args)),
          new Promise((_, reject) => {
            controller.signal.addEventListener('abort', () => {
              reject(new Error(`Tool '${tool.name}' timed out after ${timeoutMs}ms`))
            }, { once: true })
          }),
        ])

        if (validateResult && !validateResult(result)) {
          throw new Error(`Tool '${tool.name}' returned invalid data`)
        }

        this.recordResult(tool.name, true, Date.now() - startedAt)
        return result
      } catch (error) {
        const isFinalAttempt = attempt === maxAttempts
        if (!isFinalAttempt) {
          console.warn(`[MCP] ${tool.name} attempt ${attempt}/${maxAttempts} failed, retrying`, error)
          continue
        }

        this.recordResult(tool.name, false, Date.now() - startedAt)
        console.warn(`[MCP] ${tool.name} failed:`, error)

        const fallbackResult = options.fallbackResult ?? tool.fallbackResult
        if (fallbackResult !== undefined) {
          return typeof fallbackResult === 'function'
            ? fallbackResult(args, error)
            : fallbackResult
        }
        throw error
      } finally {
        clearTimeout(timeout)
      }
    }

    throw new Error(`Tool '${tool.name}' failed without a terminal error`)
  }

  toLLMTools(): Record<string, any>[] {
    return this.getRankedTools(undefined, { healthyOnly: true }).map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.schema || { type: 'object', properties: {} },
      },
    }))
  }

  getAll(): MCPTool[] {
    return this.getRankedTools()
  }

  getRankedTools(tag?: string, options: { healthyOnly?: boolean } = {}): MCPTool[] {
    return Array.from(this.tools.values())
      .filter(tool => !tag || tool.tags.includes(tag))
      .filter(tool => !options.healthyOnly || this.isToolHealthy(tool.name))
      .sort((a, b) => this.getToolRankScore(b.name) - this.getToolRankScore(a.name))
  }

  getMetrics(name?: string): MCPToolMetrics | Record<string, MCPToolMetrics> {
    if (name) {
      const metric = this.metrics.get(name)
      if (!metric) throw new Error(`Metrics for tool '${name}' not found`)
      return this.formatMetrics(metric)
    }

    return Object.fromEntries(
      Array.from(this.metrics.entries()).map(([toolName, metric]) => [toolName, this.formatMetrics(metric)])
    )
  }

  private recordResult(toolName: string, success: boolean, latencyMs: number) {
    const metric = this.metrics.get(toolName)
    if (!metric) return
    metric.calls += 1
    metric.totalLatencyMs += latencyMs
    metric.lastLatencyMs = latencyMs
    if (success) {
      metric.successes += 1
    } else {
      metric.failures += 1
      metric.lastErrorAt = new Date().toISOString()
    }
  }

  private formatMetrics(metric: { calls: number; successes: number; failures: number; totalLatencyMs: number; lastLatencyMs: number; lastErrorAt: string | null }): MCPToolMetrics {
    const successRate = metric.calls > 0 ? metric.successes / metric.calls : 1
    const avgLatencyMs = metric.calls > 0 ? Math.round(metric.totalLatencyMs / metric.calls) : 0
    const latencyPenalty = avgLatencyMs === 0 ? 0 : Math.min(avgLatencyMs / DEFAULT_TOOL_TIMEOUT_MS, 1) * 0.25
    const healthScore = Math.max(0, Math.min(1, successRate - latencyPenalty))

    return {
      calls: metric.calls,
      successes: metric.successes,
      failures: metric.failures,
      successRate: Number(successRate.toFixed(3)),
      avgLatencyMs,
      lastLatencyMs: metric.lastLatencyMs,
      lastErrorAt: metric.lastErrorAt,
      healthScore: Number(healthScore.toFixed(3)),
    }
  }

  private isToolHealthy(toolName: string): boolean {
    const metrics = this.getMetrics(toolName) as MCPToolMetrics
    if (metrics.calls < MIN_TOOL_CALLS_BEFORE_SKIP) return true
    return metrics.successRate >= MIN_TOOL_SUCCESS_RATE && metrics.healthScore >= MIN_TOOL_HEALTH_SCORE
  }

  private getToolRankScore(toolName: string): number {
    const metrics = this.getMetrics(toolName) as MCPToolMetrics
    const experienceBonus = Math.min(metrics.calls / 20, 0.15)
    return metrics.healthScore * 0.7 + metrics.successRate * 0.2 + experienceBonus - Math.min(metrics.avgLatencyMs / DEFAULT_TOOL_TIMEOUT_MS, 1) * 0.1
  }
}

// ── Built-in tool factories ──────────────────────────────────────────────────

export function makeGitHubSearchTool(token?: string): MCPTool {
  const githubToken = token || process.env.GITHUB_TOKEN

  async function handler(query: string, sort = 'stars', perPage = 5): Promise<any> {
    const params = new URLSearchParams({ q: query, sort, per_page: perPage.toString() })
    const headers: Record<string, string> = {
      'User-Agent': 'ai-product-factory',
      Accept: 'application/vnd.github.v3+json',
    }
    if (githubToken) headers['Authorization'] = `token ${githubToken}`

    const res = await fetch(`https://api.github.com/search/repositories?${params}`, { headers })
    const data = await res.json()

    return {
      items: (data.items || []).map((i: any) => ({
        fullName: i.full_name,
        stars: i.stargazers_count,
        description: i.description || '',
        url: i.html_url,
        cloneUrl: i.clone_url,
        language: i.language,
        topics: i.topics || [],
      })),
    }
  }

  return {
    name: 'github_search',
    description: 'Search GitHub repositories by keyword. Returns name, stars, description, clone URL.',
    tags: ['github', 'search'],
    handler,
    maxAttempts: 3,
    fallbackResult: { items: [] },
    validateResult: (result) => Array.isArray(result?.items),
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        sort: { type: 'string', enum: ['stars', 'forks', 'updated'] },
        per_page: { type: 'integer' },
      },
      required: ['query'],
    },
  }
}

export function makeWebSearchTool(): MCPTool {
  async function handler(query: string, maxResults = 5): Promise<any> {
    try {
      const results = await webSearch(query, { maxResults })
      return { query, results }
    } catch {
      return { query, results: [] }
    }
  }

  return {
    name: 'web_search',
    description: 'Search the web for information about a topic (market research, trends, competitors).',
    tags: ['web', 'search'],
    handler,
    maxAttempts: 2,
    fallbackResult: (args: any[]) => ({ query: args[0] || '', results: [] }),
    validateResult: (result) => Array.isArray(result?.results),
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        max_results: { type: 'integer' },
      },
      required: ['query'],
    },
  }
}

export function makeRAGQueryTool(memory: any): MCPTool {
  function handler(query: string, topK = 5): any {
    const hits = memory.recallContext(query, topK)
    return { hits }
  }

  return {
    name: 'rag_query',
    description: 'Retrieve relevant past ideas, repos, builds, and debug logs from memory.',
    tags: ['rag', 'memory'],
    handler,
    maxAttempts: 1,
    fallbackResult: { hits: [] },
    validateResult: (result) => Array.isArray(result?.hits),
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        top_k: { type: 'integer' },
      },
      required: ['query'],
    },
  }
}
