import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

export const runtime = 'nodejs'
export const maxDuration = 15

const PYTHON_BACKEND = getPythonBackendUrl()

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get('role')?.trim() || ''
  const fallback = request.nextUrl.searchParams.get('fallback') !== 'false'

  if (!role) {
    return NextResponse.json(
      { success: false, error: 'A role parameter is required (e.g. chat, reasoning, coding, embedding, reranker, vision).' },
      { status: 400 },
    )
  }

  const params = new URLSearchParams({ role, fallback: String(fallback) })

  try {
    const response = await fetch(`${PYTHON_BACKEND}/llm/registry/resolve?${params.toString()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data?.detail || data?.error || `Could not resolve model for role: ${role}` },
        { status: response.status },
      )
    }
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reach the model registry resolver service.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
