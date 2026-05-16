import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

const PYTHON_BACKEND = getPythonBackendUrl()

export async function POST(request: NextRequest) {
  try {
    const { workspace_id, task } = await request.json()
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
