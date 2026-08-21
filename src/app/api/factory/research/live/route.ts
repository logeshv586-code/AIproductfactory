import { NextRequest, NextResponse } from 'next/server'
import { runDeepResearchV12 } from '@/lib/factory/deep-research-v12'

export const runtime = 'nodejs'
export const maxDuration = 90

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const idea = typeof body.idea === 'string' ? body.idea.trim() : ''
    if (!idea) {
      return NextResponse.json({ success: false, error: 'A product idea is required' }, { status: 400 })
    }

    const graph = body?.graph && typeof body.graph === 'object' && !Array.isArray(body.graph)
      ? body.graph
      : {}
    const repos = Array.isArray(body?.repos)
      ? body.repos.filter((value: unknown): value is string => typeof value === 'string' && Boolean(value.trim())).map((value: string) => value.trim()).slice(0, 8)
      : []

    const research = await runDeepResearchV12(idea, graph, repos)
    return NextResponse.json(research)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Deep product research failed' },
      { status: 500 },
    )
  }
}
