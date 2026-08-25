const BASE = process.env.FACTORY_BASE_URL || 'http://127.0.0.1:3000'
const workspaceId = (process.env.FACTORY_ARTIFACT_WORKSPACE || '').trim()

if (!workspaceId) {
  console.log('[artifact] skipped: FACTORY_ARTIFACT_WORKSPACE is not set')
  process.exit(0)
}

const response = await fetch(`${BASE}/api/factory/build/artifact/${encodeURIComponent(workspaceId)}`)
if (!response.ok) throw new Error(`artifact download failed (${response.status}): ${await response.text()}`)
if (!(response.headers.get('content-type') || '').includes('application/zip')) {
  throw new Error(`unexpected content type: ${response.headers.get('content-type')}`)
}
const bytes = new Uint8Array(await response.arrayBuffer())
if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
  throw new Error('downloaded artifact is not a ZIP archive')
}
console.log(`[artifact] downloaded ${bytes.length} byte ZIP for ${workspaceId}`)
