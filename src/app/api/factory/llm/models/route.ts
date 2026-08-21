import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

export const runtime = 'nodejs'
export const maxDuration = 15

const PYTHON_BACKEND = getPythonBackendUrl()

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get('provider')?.trim() || ''
  const baseUrl = request.nextUrl.searchParams.get('baseUrl')?.trim() || ''

  if (!['ollama', 'lmstudio'].includes(provider)) {
    return NextResponse.json(
      { success: false, error: 'Local model discovery supports Ollama and LM Studio.' },
      { status: 400 },
    )
  }

  const params = new URLSearchParams({ provider })
  if (baseUrl) params.set('base_url', baseUrl)

  try {
    const response = await fetch(`${PYTHON_BACKEND}/llm/runtime/models?${params.toString()}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data?.detail || data?.error || 'Could not discover local models.' },
        { status: response.status },
      )
    }
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reach the local model service.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
