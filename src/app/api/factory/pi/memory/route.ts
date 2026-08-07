import { NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

const PYTHON_BACKEND = getPythonBackendUrl()

export const maxDuration = 60

/**
 * GET /api/factory/pi/memory
 *
 * Proxy for the v6 Phase 6 Product Memory endpoint. Returns the store of
 * complete past products (DNA, intent, capabilities, repos, architecture,
 * strategy, debates, outcomes). No LLM call.
 */
export async function GET() {
  try {
    const res = await fetch(`${PYTHON_BACKEND}/pi/memory`, {
      method: 'GET',
      signal: AbortSignal.timeout(50000),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { success: false, error: `PI memory failed (${res.status}): ${text || 'no response body'}` },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'PI memory proxy failed' },
      { status: 500 },
    )
  }
}
