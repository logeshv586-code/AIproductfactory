import { NextResponse } from 'next/server'
import { getPythonBackendUrl, getPythonHealth } from '@/lib/factory/python-health'

export async function GET() {
  const health = await getPythonHealth()

  return NextResponse.json(health, {
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'x-python-backend-url': getPythonBackendUrl(),
      'x-python-available': health.available ? 'true' : 'false',
    },
  })
}
