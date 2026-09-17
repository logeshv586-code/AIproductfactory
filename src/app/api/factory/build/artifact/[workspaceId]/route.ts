import { NextRequest } from 'next/server'
import { proxyCore } from '@/lib/factory/core-proxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, context: { params: Promise<{ workspaceId: string }> }) {
  return proxyCore(request, `builds/${(await context.params).workspaceId}/artifact`)
}
