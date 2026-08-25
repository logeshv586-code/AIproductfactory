import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WORKSPACE_RE = /^[A-Za-z0-9_-]{1,96}$/

function artifactPath(workspaceId: string) {
  const outputRoot = process.env.FACTORY_OUTPUT_DIR
    ? path.resolve(process.env.FACTORY_OUTPUT_DIR)
    : path.join(process.cwd(), 'python-backend', 'output')
  return path.join(outputRoot, `${workspaceId}.zip`)
}

export async function GET(_request: NextRequest, context: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await context.params
  if (!WORKSPACE_RE.test(workspaceId)) {
    return NextResponse.json({ success: false, error: 'Invalid build workspace id.' }, { status: 400 })
  }

  const filePath = artifactPath(workspaceId)
  try {
    const info = await stat(filePath)
    if (!info.isFile()) throw new Error('Artifact path is not a file')

    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream
    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(info.size),
        'Content-Disposition': `attachment; filename="${workspaceId}.zip"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({
      success: false,
      error: 'Generated source ZIP is unavailable on this Product Factory runtime.',
    }, { status: 404 })
  }
}
