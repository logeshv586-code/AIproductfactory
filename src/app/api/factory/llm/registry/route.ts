import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

export const runtime = 'nodejs'
export const maxDuration = 15

const PYTHON_BACKEND = getPythonBackendUrl()

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get('role')?.trim() || ''

  const params = new URLSearchParams()
  if (role) params.set('role', role)

  try {
    const url = `${PYTHON_BACKEND}/llm/registry${params.toString() ? `?${params.toString()}` : ''}`
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data?.detail || data?.error || 'Could not query local model registry.' },
        { status: response.status },
      )
    }
    return NextResponse.json(data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not reach the local model registry service.'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
