import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WORKSPACE_RE = /^[A-Za-z0-9_-]{1,96}$/

function artifactCandidates(workspaceId: string) {
  const roots = [
    process.env.FACTORY_OUTPUT_DIR ? path.resolve(process.env.FACTORY_OUTPUT_DIR) : '',
    path.resolve(process.cwd(), 'python-backend', 'output'),
    path.resolve(process.cwd(), '..', 'python-backend', 'output'),
    path.resolve(process.cwd(), '..', '..', 'python-backend', 'output'),
  ].filter(Boolean)

  return [...new Set(roots)].map((root) => path.join(root, `${workspaceId}.zip`))
}

async function findArtifact(workspaceId: string) {
  for (const filePath of artifactCandidates(workspaceId)) {
    try {
      const info = await stat(filePath)
      if (info.isFile()) return { filePath, info }
    } catch {
      // Try the next supported runtime root. Next standalone runs from
      // .next/standalone while local dev normally runs from the repository root.
    }
  }
  return null
}

export async function GET(_request: NextRequest, context: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await context.params
  if (!WORKSPACE_RE.test(workspaceId)) {
    return NextResponse.json({ success: false, error: 'Invalid build workspace id.' }, { status: 400 })
  }

  const artifact = await findArtifact(workspaceId)
  if (!artifact) {
    return NextResponse.json({
      success: false,
      error: 'Generated source ZIP is unavailable on this Product Factory runtime.',
    }, { status: 404 })
  }

  const stream = Readable.toWeb(createReadStream(artifact.filePath)) as ReadableStream
  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': String(artifact.info.size),
      'Content-Disposition': `attachment; filename="${workspaceId}.zip"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
