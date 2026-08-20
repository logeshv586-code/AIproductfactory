import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

const PYTHON_BACKEND = getPythonBackendUrl()

export const maxDuration = 600

/**
 * POST /api/factory/pi/strategize
 *
 * Proxy for the v4 Product Intelligence Operating System. Runs the 12-agent
 * reasoning stages (Product Thinking → Intent → Requirement → Market →
 * Competitor → Innovation → Evolution → Gap → Capability → GitHub →
 * Repository → Strategy → Review) and stops at the Review-gated approval
 * screen. Nothing is built until /pi/approve is called.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const idea: string = typeof body.idea === 'string' ? body.idea.trim() : ''
    const llmSession = request.headers.get('x-llm-session') || ''

    if (!idea) {
      return NextResponse.json(
        { success: false, error: 'A product idea is required' },
        { status: 400 },
      )
    }

    const res = await fetch(`${PYTHON_BACKEND}/pi/strategize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(llmSession ? { 'X-LLM-Session': llmSession } : {}),
      },
      body: JSON.stringify({
        idea,
        github_token: body.githubToken ?? null,
        tavily_key: body.tavilyKey ?? null,
      }),
      signal: AbortSignal.timeout(570000),
    })

    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { success: false, error: `PI strategize failed (${res.status}): ${text || 'no response body'}` },
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
          ? 'PI strategize timed out after 9.5 min — the reasoning stages were still running. Try again or check the Python backend logs.'
          : error.message || 'PI strategize proxy failed',
      },
      { status: timedOut ? 504 : 500 },
    )
  }
}
