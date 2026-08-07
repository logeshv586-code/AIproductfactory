import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

const PYTHON_BACKEND = getPythonBackendUrl()

export const maxDuration = 60

/**
 * POST /api/factory/pi/explain
 *
 * Proxy for the v5 Evidence Graph. Returns a plain-English explanation of why
 * the recommendation was made — drawing on the stored decisions, agent debates,
 * evidence items, confidence propagation and self-critique. No new LLM call.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const runId: string = typeof body.runId === 'string' ? body.runId.trim() : ''

    if (!runId) {
      return NextResponse.json(
        { success: false, error: 'runId is required' },
        { status: 400 },
      )
    }

    const res = await fetch(`${PYTHON_BACKEND}/pi/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ run_id: runId }),
      signal: AbortSignal.timeout(50000),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { success: false, error: `PI explain failed (${res.status}): ${text || 'no response body'}` },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'PI explain proxy failed' },
      { status: 500 },
    )
  }
}
