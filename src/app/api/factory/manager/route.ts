import { NextRequest, NextResponse } from 'next/server'
import { createFactoryManagerV10Report } from '@/lib/factory/manager-v10'

export const runtime = 'nodejs'
export const maxDuration = 30

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeRecommendedStrategy(report: ReturnType<typeof createFactoryManagerV10Report>, graph: Record<string, any>) {
  const strategies = Array.isArray(graph.strategies)
    ? graph.strategies.filter((strategy: unknown): strategy is Record<string, any> => Boolean(strategy) && typeof strategy === 'object' && !Array.isArray(strategy))
    : []
  if (!strategies.length) return

  const reportedId = text(report.recommendedStrategy?.id)
  const tournamentId = text(graph?.tournament?.winner?.id)
  const approvedId = typeof graph?.approved_strategy === 'object'
    ? text(graph.approved_strategy?.id)
    : typeof graph?.approvedStrategy === 'object'
      ? text(graph.approvedStrategy?.id)
      : ''

  const selected =
    strategies.find((strategy) => text(strategy.id) === reportedId) ||
    strategies.find((strategy) => text(strategy.id) === approvedId) ||
    strategies.find((strategy) => text(strategy.id) === tournamentId) ||
    strategies.find((strategy) => Boolean(text(strategy.id)))

  if (!selected) return

  const id = text(selected.id)
  if (!id) return
  report.recommendedStrategy = {
    id,
    name: text(selected.name) || report.recommendedStrategy?.name || 'Recommended strategy',
    why: text(selected.why) || text(selected.description) || report.recommendedStrategy?.why || '',
    confidence: typeof selected.confidence === 'number'
      ? Math.max(0, Math.min(1, selected.confidence > 1 ? selected.confidence / 100 : selected.confidence))
      : report.recommendedStrategy?.confidence ?? 0.68,
  }
}

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

    const report = createFactoryManagerV10Report({
      idea: typeof body.idea === 'string' ? body.idea.trim() : undefined,
      runId: typeof body.runId === 'string' ? body.runId : undefined,
      graph,
      liveResearch: body?.liveResearch && typeof body.liveResearch === 'object' ? body.liveResearch : null,
      customerContext: body?.customerContext && typeof body.customerContext === 'object' ? body.customerContext : null,
    })

    // Approval accepts only strategy IDs that actually exist in graph.strategies.
    // Display labels and recommendation-plan IDs must never leak into this API contract.
    normalizeRecommendedStrategy(report, graph)

    return NextResponse.json({ success: true, report })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Factory manager failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
