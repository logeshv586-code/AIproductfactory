import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

const SESSION_COOKIE = 'factory-owner'
const PATH = /^(plans|approve|builds|runs\/run_[a-f0-9]{32}|builds\/build_[a-f0-9]{32}(\/(resume|cancel|artifact))?)$/

/** Ownership is independent from the model session so changing providers preserves a project. */
export async function proxyCore(request: NextRequest, path: string) {
  if (!PATH.test(path)) return NextResponse.json({ success: false, error: 'Unknown Factory endpoint' }, { status: 404 })
  const origin = request.headers.get('origin')
  if (request.method !== 'GET' && origin) {
    try {
      if (new URL(origin).host !== request.headers.get('host')) throw new Error('Origin mismatch')
    } catch {
      return NextResponse.json({ success: false, error: 'Cross-origin mutation rejected' }, { status: 403 })
    }
  }
  const backend = getPythonBackendUrl()
  let token = request.cookies.get(SESSION_COOKIE)?.value || ''
  let newSession = false
  try {
    if (!token && request.method === 'POST' && path === 'plans') {
      const created = await fetch(`${backend}/factory/session`, { method: 'POST', signal: AbortSignal.timeout(10000) })
      if (!created.ok) throw new Error('Could not create Factory session')
      const session = await created.json()
      token = session.token
      newSession = true
    }
    if (!token) return NextResponse.json({ success: false, error: 'Start a product plan in this browser before continuing.' }, { status: 401 })
    const headers = new Headers({ Authorization: `Bearer ${token}` })
    const modelSession = request.headers.get('x-llm-session')
    if (modelSession) headers.set('X-LLM-Session', modelSession)
    if (request.method !== 'GET') headers.set('Content-Type', 'application/json')
    let outboundBody: string | undefined
    if (request.method !== 'GET') {
      const rawBody = await request.text()
      const MAX_PROXY_BODY = 256 * 1024
      if (rawBody.length > MAX_PROXY_BODY) {
        return NextResponse.json({ success: false, error: 'Request body exceeds 256KB limit.' }, { status: 413 })
      }
      outboundBody = rawBody || '{}'
    }
    const response = await fetch(`${backend}/factory/${path}`, {
      method: request.method, headers,
      body: outboundBody,
      signal: AbortSignal.timeout(path === 'plans' ? 570000 : 30000), cache: 'no-store',
    })
    let result: NextResponse
    if (response.ok && path.endsWith('/artifact')) {
      result = new NextResponse(response.body, { status: response.status, headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': response.headers.get('Content-Disposition') || 'attachment; filename="product.zip"',
        'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      } })
    } else {
      const contentType = response.headers.get('content-type') || ''
      let data: unknown = null
      if (contentType.includes('application/json')) {
        try {
          data = await response.json()
        } catch {
          const fallback = await response.text().catch(() => '')
          return NextResponse.json({ success: false, error: `Backend returned malformed JSON: ${fallback.slice(0, 300)}` }, { status: 502, headers: { 'Cache-Control': 'private, no-store' } })
        }
      } else {
        const textBody = await response.text().catch(() => '')
        if (!response.ok) {
          return NextResponse.json({ success: false, error: textBody.slice(0, 500) || `Backend responded with status ${response.status}` }, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } })
        }
        data = { raw: textBody.slice(0, 2000) }
      }
      const payload = data as Record<string, unknown>
      result = NextResponse.json(response.ok ? payload : { success: false, error: typeof payload.detail === 'string' ? payload.detail : JSON.stringify(payload.detail || payload).slice(0, 2000) }, { status: response.status, headers: { 'Cache-Control': 'private, no-store' } })
    }
    if (newSession) result.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: request.nextUrl.protocol === 'https:', sameSite: 'strict', path: '/api/factory', maxAge: 30 * 86400 })
    return result
  } catch (error) {
    const result = NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Factory request failed' }, { status: 503 })
    if (newSession) result.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: request.nextUrl.protocol === 'https:', sameSite: 'strict', path: '/api/factory', maxAge: 30 * 86400 })
    return result
  }
}
