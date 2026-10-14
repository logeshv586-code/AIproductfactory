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
  const { workspace_id, task } = payload as { workspace_id?: unknown; task?: unknown }
  if (typeof workspace_id !== 'string' || workspace_id.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'workspace_id is required.' }, { status: 400 })
  }
  if (!task || typeof task !== 'object' || Array.isArray(task)) {
    return NextResponse.json({ success: false, error: 'task must be an object.' }, { status: 400 })
  }
  try {
    const t = task as Record<string, unknown>
    const normalizedTask = {
      ...t,
      title: typeof t.title === 'string' && t.title.trim() ? t.title : typeof t.name === 'string' && t.name.trim() ? t.name : 'Implementation Task',
      description: typeof t.description === 'string' && t.description.trim() ? t.description : typeof t.summary === 'string' ? t.summary : typeof t.detail === 'string' ? t.detail : 'Implement the selected pipeline task.',
    }
    
    const res = await fetch(`${PYTHON_BACKEND}/execution/run_task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id, task: normalizedTask }),
      signal: AbortSignal.timeout(45000),
    })
    
    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Execution failed' }, { status: res.status })
    }
    
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
