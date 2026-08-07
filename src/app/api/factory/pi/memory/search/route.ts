import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

const PYTHON_BACKEND = getPythonBackendUrl()

export const maxDuration = 60

/**
 * POST /api/factory/pi/memory/search
 *
 * Proxy for the v6 Phase 6 Product Memory retrieval. Drafts a Product DNA from
 * the idea (deterministic) and returns similar past products as structured
 * guidance: similarity, matching capabilities, shared repos/architectures,
 * differences, historical outcome. No LLM call.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const idea: string = typeof body.idea === 'string' ? body.idea.trim() : ''

    if (!idea) {
      return NextResponse.json(
        { success: false, error: 'A product idea is required' },
        { status: 400 },
      )
    }

    const res = await fetch(`${PYTHON_BACKEND}/pi/memory/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea }),
      signal: AbortSignal.timeout(50000),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { success: false, error: `PI memory search failed (${res.status}): ${text || 'no response body'}` },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'PI memory search proxy failed' },
      { status: 500 },
    )
  }
}
