import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

const PATH = /^(status|capabilities|products|plan)$/

export async function proxyOfflineFactory(request: NextRequest, path: string) {
  if (!PATH.test(path)) {
    return NextResponse.json({ success: false, error: 'Unknown offline Factory endpoint' }, { status: 404 })
  }

  const origin = request.headers.get('origin')
  if (request.method !== 'GET' && origin) {
    try {
      if (new URL(origin).host !== request.headers.get('host')) throw new Error('Origin mismatch')
    } catch {
      return NextResponse.json({ success: false, error: 'Cross-origin mutation rejected' }, { status: 403 })
    }
  }

  try {
    const backend = getPythonBackendUrl()
    const headers = new Headers()
    const modelSession = request.headers.get('x-llm-session')
    if (modelSession) headers.set('X-LLM-Session', modelSession)
    if (request.method !== 'GET') headers.set('Content-Type', 'application/json')

    const response = await fetch(`${backend}/offline/${path}`, {
      method: request.method,
      headers,
      body: request.method === 'GET' ? undefined : (await request.text()) || '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    const data = await response.json()
    return NextResponse.json(
      response.ok ? data : { success: false, error: typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail || data) },
      { status: response.status, headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Offline Factory request failed' },
      { status: 503 },
    )
  }
}
