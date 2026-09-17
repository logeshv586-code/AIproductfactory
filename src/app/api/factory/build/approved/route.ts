import { NextRequest } from 'next/server'
import { proxyCore } from '@/lib/factory/core-proxy'

export const runtime = 'nodejs'
export const maxDuration = 60

/** Only persisted approval identities are accepted. Caller-supplied idea/repos cannot authorize a build. */
export async function POST(request: NextRequest) {
  return proxyCore(request, 'builds')
}
