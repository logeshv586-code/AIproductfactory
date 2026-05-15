import { NextRequest, NextResponse } from 'next/server'
import { getPythonBackendUrl } from '@/lib/factory/python-health'

const PYTHON_BACKEND = getPythonBackendUrl()

export async function POST(request: NextRequest) {
  try {
    const { idea, domain } = await request.json()
    
    const res = await fetch(`${PYTHON_BACKEND}/research/conduct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea, domain }),
    })
    
    if (!res.ok) {
      return NextResponse.json({ success: false, error: 'Research failed' }, { status: res.status })
    }
    
    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
