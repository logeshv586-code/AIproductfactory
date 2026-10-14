import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

export const runtime = 'nodejs'
export const maxDuration = 15

const PYTHON_BACKEND = getPythonBackendUrl()

function isLocalHttpUrl(value: string) {
  try {
    const u = new URL(value)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    if (host === 'localhost') return true
    if (host === '::1' || host === '[::1]') return true
    if (/^127(\.\d{1,3}){3}$/.test(host)) return true
    return false
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get('provider')?.trim() || ''
  const baseUrl = request.nextUrl.searchParams.get('baseUrl')?.trim() || ''

  if (!['ollama', 'lmstudio'].includes(provider)) {
    return NextResponse.json(
      { success: false, error: 'Local model discovery supports Ollama and LM Studio.' },
      { status: 400 },
    )
  }

  if (baseUrl && !isLocalHttpUrl(baseUrl)) {
    return NextResponse.json(
      { success: false, error: 'baseUrl must be a local http(s) address.' },
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
