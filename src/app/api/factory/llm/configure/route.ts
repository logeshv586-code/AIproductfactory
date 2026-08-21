import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

export const runtime = 'nodejs'
export const maxDuration = 60

const PYTHON_BACKEND = getPythonBackendUrl()

function sessionHeader(request: NextRequest) {
  return request.headers.get('x-llm-session') || ''
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const provider = typeof body.provider === 'string' ? body.provider.trim() : ''
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : ''
    const model = typeof body.model === 'string' ? body.model.trim() : ''
    const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim() : ''

    if (!provider) {
      return NextResponse.json({ success: false, error: 'Choose an AI provider.' }, { status: 400 })
    }

    const response = await fetch(`${PYTHON_BACKEND}/llm/runtime/configure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, api_key: apiKey, model, base_url: baseUrl }),
      signal: AbortSignal.timeout(55000),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data?.detail || data?.error || 'Model connection failed.' },
        { status: response.status },
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Model setup failed.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const sessionId = sessionHeader(request)
  if (!sessionId) {
    return NextResponse.json({ success: false, configured: false })
  }

  try {
    const response = await fetch(`${PYTHON_BACKEND}/llm/runtime/status`, {
      method: 'GET',
      headers: { 'X-LLM-Session': sessionId },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    const data = await response.json().catch(() => ({ success: false, configured: false }))
    return NextResponse.json(data, { status: response.ok ? 200 : response.status })
  } catch {
    return NextResponse.json({ success: false, configured: false })
  }
}

export async function DELETE(request: NextRequest) {
  const sessionId = sessionHeader(request)
  if (!sessionId) {
    return NextResponse.json({ success: true, configured: false })
  }

  try {
    await fetch(`${PYTHON_BACKEND}/llm/runtime/session`, {
      method: 'DELETE',
      headers: { 'X-LLM-Session': sessionId },
      signal: AbortSignal.timeout(10000),
    })
  } catch {
    // Session is also removed client-side, so backend restart/unavailability is safe.
  }
  return NextResponse.json({ success: true, configured: false })
}
