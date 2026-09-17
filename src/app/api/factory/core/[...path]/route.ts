import { NextRequest } from 'next/server'
import { proxyCore } from '@/lib/factory/core-proxy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 600

type Context = { params: Promise<{ path: string[] }> }
export async function GET(request: NextRequest, context: Context) {
  return proxyCore(request, (await context.params).path.join('/'))
}
export async function POST(request: NextRequest, context: Context) {
  return proxyCore(request, (await context.params).path.join('/'))
}
