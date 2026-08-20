import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

const PYTHON_BACKEND = getPythonBackendUrl()

export const maxDuration = 600

/**
 * POST /api/factory/pi/approve
 *
 * Proxy for the v4 Product Intelligence Operating System. Continues from an
 * approved strategy for a prior /pi/strategize run, running deep research,
 * repository composition, multi-view architecture, blueprint, engineering,
 * execution plan and the Learning System.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const runId: string = typeof body.runId === 'string' ? body.runId.trim() : ''
    const strategyId: string = typeof body.strategyId === 'string' ? body.strategyId.trim() : ''
    const llmSession = request.headers.get('x-llm-session') || ''

    if (!runId || !strategyId) {
      return NextResponse.json(
        { success: false, error: 'runId and strategyId are required' },
        { status: 400 },
      )
    }

    const res = await fetch(`${PYTHON_BACKEND}/pi/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(llmSession ? { 'X-LLM-Session': llmSession } : {}),
      },
      body: JSON.stringify({ run_id: runId, strategy_id: strategyId }),
      signal: AbortSignal.timeout(570000),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { success: false, error: `PI approve failed (${res.status}): ${text || 'no response body'}` },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    const timedOut =
      error?.name === 'TimeoutError' ||
      error?.name === 'AbortError' ||
      /aborted|timed? ?out/i.test(error?.message || '')
    return NextResponse.json(
      {
        success: false,
        error: timedOut
          ? 'PI approve timed out after 9.5 min — the engineering agents were still running. Try again or check the Python backend logs.'
          : error.message || 'PI approve proxy failed',
      },
      { status: timedOut ? 504 : 500 },
    )
  }
}
