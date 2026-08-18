import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPythonBackendUrl, getPythonHealth } from '@/lib/factory/python-health'

export const runtime = 'nodejs'
export const maxDuration = 240

const PYTHON_BACKEND = getPythonBackendUrl()

const RepoSchema = z.object({
  fullName: z.string().trim().min(3),
  url: z.string().url().optional(),
  description: z.string().optional(),
  language: z.string().optional(),
  license: z.string().optional(),
  healthScore: z.number().optional(),
  capabilities: z.array(z.string()).optional(),
  whySelected: z.array(z.string()).optional(),
  integrationMode: z.string().optional(),
})

const RequestSchema = z.object({
  idea: z.string().trim().min(3),
  selectedRepos: z.array(RepoSchema).min(1).max(3),
  strategyId: z.string().trim().optional(),
  runId: z.string().trim().optional(),
})

function repoPayload(repo: z.infer<typeof RepoSchema>) {
  const fullName = repo.fullName
  return {
    name: fullName.split('/').pop() || fullName,
    full_name: fullName,
    description: repo.description || `Approved Product Factory component for ${(repo.capabilities || []).join(', ') || 'the requested product'}`,
    stars: 0,
    language: repo.language || '',
    topics: repo.capabilities || [],
    url: repo.url || `https://github.com/${fullName}`,
    cloneUrl: `https://github.com/${fullName}.git`,
    capability: (repo.capabilities || []).join(', '),
    reason: (repo.whySelected || []).join(' | '),
    selection_reasoning: (repo.whySelected || []).join(' | '),
    suggested_role: (repo.capabilities || []).slice(0, 3).join(', '),
    approved_by_manager: true,
    integration_mode: repo.integrationMode || '',
    license: repo.license || 'unknown',
    health_score: repo.healthScore || 0,
  }
}

function outputPath(timeline: unknown) {
  if (!Array.isArray(timeline)) return null
  for (const item of timeline) {
    const detail = item && typeof item === 'object' && 'detail' in item ? String((item as { detail?: unknown }).detail || '') : ''
    const match = detail.match(/saved to (output\/[A-Za-z0-9_-]+)/i)
    if (match) return match[1]
  }
  return null
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || randomUUID()
  try {
    const parsed = RequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ success: false, status: 'failed', errors: parsed.error.issues.map((issue) => issue.message) }, { status: 400 })
    }

    const { idea, selectedRepos, strategyId, runId } = parsed.data
    const health = await getPythonHealth(PYTHON_BACKEND)
    if (!health.available) {
      return NextResponse.json({
        success: false,
        status: 'failed',
        errors: [`Python Product Factory backend unavailable: ${health.error || health.status}`],
      }, { status: 503 })
    }

    const approvedRepos = selectedRepos.map(repoPayload)
    const allowed = new Set(approvedRepos.map((repo) => repo.full_name))
    const buildId = `approved_${Date.now().toString(36)}`

    const response = await fetch(`${health.url}/pipeline/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': requestId },
      body: JSON.stringify({
        idea,
        repos: approvedRepos,
        strategy: 'all',
        use_embeddings: true,
        max_repos: approvedRepos.length,
      }),
      signal: AbortSignal.timeout(220000),
    })

    if (!response.ok) {
      const body = await response.text()
      return NextResponse.json({
        success: false,
        status: 'failed',
        buildId,
        errors: [`Approved-composition Python pipeline failed (${response.status}): ${body || 'no response body'}`],
      }, { status: response.status >= 500 ? 503 : response.status })
    }

    const envelope = await response.json()
    if (!envelope?.success || !envelope?.data) {
      return NextResponse.json({ success: false, status: 'failed', buildId, errors: [envelope?.detail || envelope?.error || 'Python pipeline returned no data'] }, { status: 500 })
    }

    const result = envelope.data
    const returnedRepos = Array.isArray(result.selected_repos) ? result.selected_repos : []
    const returnedNames = returnedRepos.map((repo: { name?: string }) => String(repo?.name || '')).filter(Boolean)
    const repoLockPassed = returnedNames.length > 0 && returnedNames.every((name: string) => allowed.has(name))
    const products = Array.isArray(result.composed_products) ? result.composed_products : []
    const graphNodes = Array.isArray(result?.capability_graph_engine?.nodes) ? result.capability_graph_engine.nodes : []
    const topProduct = products[0] || null
    const starterBlueprintPresent = Boolean(topProduct?.starter_blueprint)

    const verification = {
      approvedRepoLock: repoLockPassed,
      requestedRepos: [...allowed],
      returnedRepos: returnedNames,
      productGenerated: products.length > 0,
      capabilityGraphBuilt: graphNodes.length > 0,
      starterBlueprintGenerated: starterBlueprintPresent,
      architectureGenerated: Boolean(topProduct?.architecture),
      pipelineCompleted: Array.isArray(result.timeline) && result.timeline.some((entry: { step?: string }) => entry?.step === 'COMPLETE'),
    }

    const failedGates = Object.entries(verification)
      .filter(([key, value]) => !['requestedRepos', 'returnedRepos'].includes(key) && value === false)
      .map(([key]) => key)

    if (!repoLockPassed) {
      return NextResponse.json({
        success: false,
        status: 'failed_repo_lock',
        buildId,
        runId: runId || null,
        strategyId: strategyId || null,
        verification,
        errors: ['Build drift detected: the Python pipeline selected a repository outside the manager-approved composition.'],
      }, { status: 409 })
    }

    return NextResponse.json({
      success: failedGates.length === 0,
      status: failedGates.length === 0 ? 'pipeline_verified' : 'completed_with_unverified_gates',
      buildId,
      runId: runId || null,
      strategyId: strategyId || null,
      source: 'python-approved-composition',
      outputPath: outputPath(result.timeline),
      selectedRepos: returnedRepos,
      composedProducts: products,
      graphStats: result.graph_stats || result?.capability_graph_engine?.stats || null,
      verification,
      errors: failedGates.length ? [`Unverified pipeline gates: ${failedGates.join(', ')}`] : [],
      note: 'pipeline_verified means the approved repository lock and Python composition pipeline completed. It does not replace clean-install, runtime, security or end-to-end release verification.',
    }, { status: failedGates.length === 0 ? 200 : 422 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Approved-composition build failed'
    return NextResponse.json({ success: false, status: 'failed', errors: [message] }, { status: 500 })
  }
}
