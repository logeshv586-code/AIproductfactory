import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

const PYTHON_BACKEND = getPythonBackendUrl()

export async function POST(request: NextRequest) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Request body must be valid JSON.' }, { status: 400 })
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ success: false, error: 'Request body must be a JSON object.' }, { status: 400 })
  }
  const { idea, architecture, repos } = payload as { idea?: unknown; architecture?: unknown; repos?: unknown }
  if (typeof idea !== 'string' || idea.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'idea is required.' }, { status: 400 })
  }
  if (!Array.isArray(repos)) {
    return NextResponse.json({ success: false, error: 'repos must be an array.' }, { status: 400 })
  }
  try {
    const backendRepos = repos
      .filter((repo): repo is Record<string, unknown> => !!repo && typeof repo === 'object')
      .slice(0, 50)
      .map((repo: any) => ({
          ...repo,
          full_name: repo.full_name || repo.fullName || repo.name,
          suggested_role: repo.suggested_role || repo.role || repo.summary || '',
        })))
    
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
