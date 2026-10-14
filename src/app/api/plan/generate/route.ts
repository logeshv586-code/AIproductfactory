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
    const { idea, architecture, repos } = (body || {}) as { idea?: unknown; architecture?: unknown; repos?: unknown }
    if (typeof idea !== 'string' || !idea.trim() || idea.length > 2000) {
      return NextResponse.json({ success: false, error: 'idea is required, must be a non-empty string under 2000 characters.' }, { status: 400 })
    }
    if (repos !== undefined && !Array.isArray(repos)) {
      return NextResponse.json({ success: false, error: 'repos must be an array when provided.' }, { status: 400 })
    }
    if (Array.isArray(repos) && repos.length > 50) {
      return NextResponse.json({ success: false, error: 'repos is limited to 50 entries.' }, { status: 400 })
    }
    const PYTHON_BACKEND = getPythonBackendUrl()
    const backendRepos = Array.isArray(repos)
      ? repos.map((repo: any) => ({
          ...repo,
          full_name: repo.full_name || repo.fullName || repo.name,
          suggested_role: repo.suggested_role || repo.role || repo.summary || '',
        }))
      : []
    
    const res = await fetch(`${PYTHON_BACKEND}/plan/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea, architecture, repos: backendRepos }),
      signal: AbortSignal.timeout(45000),
    })
    
    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Planning failed' }, { status: res.status })
    }
    
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
