import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

const PYTHON_BACKEND = getPythonBackendUrl()

export const maxDuration = 120

/**
 * POST /api/factory/pipeline/approve
 *
 * Proxy for the canonical Python pipeline's stages 10-17. Continues from an
 * approved strategy id for a prior strategize run, building deep research,
 * composition plan, architecture, blueprint, engineering and execution plan.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const runId: string = typeof body.runId === 'string' ? body.runId.trim() : ''
    const strategyId: string = typeof body.strategyId === 'string' ? body.strategyId.trim() : ''

    if (!runId || !strategyId) {
      return NextResponse.json(
        { success: false, error: 'runId and strategyId are required' },
        { status: 400 },
      )
    }

    const res = await fetch(`${PYTHON_BACKEND}/pipeline/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id: runId, strategy_id: strategyId }),
      signal: AbortSignal.timeout(110000),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { success: false, error: `Approve failed (${res.status}): ${text || 'no response body'}` },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Approve proxy failed' },
      { status: 500 },
    )
  }
}
