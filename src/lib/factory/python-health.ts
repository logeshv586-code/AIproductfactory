export interface PythonHealthStatus {
  available: boolean
  status: string
  url: string
  version?: string | null
  error?: string | null
}

function resolvePythonBackendUrl(): string {
  const raw = (process.env.PYTHON_BACKEND_URL || '').trim().replace(/\/+$/, '')
  return raw || 'http://localhost:8001'
}

function getHealthProbeUrls(url: string): string[] {
  const urls = new Set<string>([url])
  if (url.includes('localhost')) {
    urls.add(url.replace('localhost', '127.0.0.1'))
  }
  if (url.includes('127.0.0.1')) {
    urls.add(url.replace('127.0.0.1', 'localhost'))
  }
  return Array.from(urls)
}

async function probePythonHealth(url: string): Promise<PythonHealthStatus> {
  try {
    const response = await fetch(`${url}/health`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        available: false,
        status: 'unhealthy',
        url,
        error: `Health check failed with status ${response.status}`,
      }
    }

    const data = await response.json()
    return {
      available: data?.status === 'running',
      status: data?.status || 'unknown',
      url,
      version: data?.version || null,
      error: null,
    }
  } catch (error) {
    return {
      available: false,
      status: 'unreachable',
      url,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function getPythonHealth(url?: string): Promise<PythonHealthStatus> {
  const resolved = url || resolvePythonBackendUrl()
  const candidates = getHealthProbeUrls(resolved)
  let lastFailure: PythonHealthStatus | null = null

  for (const candidate of candidates) {
    const result = await probePythonHealth(candidate)
    if (result.available) {
      return result
    }
    lastFailure = result
  }

  return lastFailure || {
    available: false,
    status: 'unreachable',
    url: resolved,
    error: 'Health probe failed',
  }
}

export function getPythonBackendUrl() {
  return resolvePythonBackendUrl()
}
