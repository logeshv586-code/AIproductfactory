import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

const PYTHON_BACKEND = getPythonBackendUrl()

export const maxDuration = 180

/**
 * POST /api/factory/pipeline/strategize
 *
 * Proxy for the canonical Python pipeline's reasoning-first stages 1-9.
 * Returns up to 3 product strategies + the full Product Knowledge Graph,
 * stopping at the approval gate (nothing is built yet).
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

    const res = await fetch(`${PYTHON_BACKEND}/pipeline/strategize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idea,
        github_token: body.githubToken ?? null,
        tavily_key: body.tavilyKey ?? null,
      }),
      signal: AbortSignal.timeout(170000),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { success: false, error: `Strategize failed (${res.status}): ${text || 'no response body'}` },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Strategize proxy failed' },
      { status: 500 },
    )
  }
}
