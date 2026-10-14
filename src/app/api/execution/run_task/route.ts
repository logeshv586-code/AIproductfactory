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
    const { workspace_id, task } = (body || {}) as { workspace_id?: unknown; task?: Record<string, unknown> }
    if (typeof workspace_id !== 'string' || !workspace_id.trim() || workspace_id.length > 128) {
      return NextResponse.json({ success: false, error: 'workspace_id is required and must be a non-empty string.' }, { status: 400 })
    }
    if (!task || typeof task !== 'object') {
      return NextResponse.json({ success: false, error: 'task is required and must be an object.' }, { status: 400 })
    }
    const PYTHON_BACKEND = getPythonBackendUrl()
    const normalizedTask = {
      ...task,
      title: task?.title || task?.name || 'Implementation Task',
      description: task?.description || task?.summary || task?.detail || 'Implement the selected pipeline task.',
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
