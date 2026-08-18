import { NextRequest, NextResponse } from 'next/server'
import { createFactoryManagerReport } from '@/lib/factory/manager'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const graph = body?.graph
    if (!graph || typeof graph !== 'object' || Array.isArray(graph)) {
      return NextResponse.json(
        { success: false, error: 'A Product Knowledge Graph is required' },
        { status: 400 },
      )
    }

    const report = createFactoryManagerReport({
      idea: typeof body.idea === 'string' ? body.idea.trim() : undefined,
      runId: typeof body.runId === 'string' ? body.runId : undefined,
      graph,
    })

    return NextResponse.json({ success: true, report })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Factory manager failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
