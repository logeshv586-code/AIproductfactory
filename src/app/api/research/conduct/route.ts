import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Request body must be valid JSON.' }, { status: 400 })
    }
    const { idea, domain } = (body || {}) as { idea?: unknown; domain?: unknown }
    if (typeof idea !== 'string' || !idea.trim() || idea.length > 2000) {
      return NextResponse.json({ success: false, error: 'idea is required, must be a non-empty string under 2000 characters.' }, { status: 400 })
    }
    if (domain !== undefined && (typeof domain !== 'string' || domain.length > 120)) {
      return NextResponse.json({ success: false, error: 'domain must be a string under 120 characters.' }, { status: 400 })
    }
    const PYTHON_BACKEND = getPythonBackendUrl()
    const res = await fetch(`${PYTHON_BACKEND}/research/conduct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea, domain }),
      signal: AbortSignal.timeout(45000),
    })
    
    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Research failed' }, { status: res.status })
    }
    
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
