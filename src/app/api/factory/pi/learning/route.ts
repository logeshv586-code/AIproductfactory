import { NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

const PYTHON_BACKEND = getPythonBackendUrl()

export const maxDuration = 60

/**
 * GET /api/factory/pi/learning
 *
 * Proxy for the v6 Experience-Based Learning endpoint. Returns everything the
 * system has learned across past approved products — repository success stats,
 * capability → repository rankings, architecture pattern success rates and
 * confidence calibration. No LLM call.
 */
export async function GET() {
  try {
    const res = await fetch(`${PYTHON_BACKEND}/pi/learning`, {
      method: 'GET',
      signal: AbortSignal.timeout(50000),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { success: false, error: `PI learning failed (${res.status}): ${text || 'no response body'}` },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'PI learning proxy failed' },
      { status: 500 },
    )
  }
}
