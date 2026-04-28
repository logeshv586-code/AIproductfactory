import { NextRequest, NextResponse } from 'next/server'
import {
  ProductSystemRequestSchema,
  composeProductSystem,
} from '@/lib/factory/core/product-system-composer'

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unknown error'
}

export async function POST(request: NextRequest) {
  try {
    const parsed = ProductSystemRequestSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid request body' },
        { status: 400 }
      )
    }

    const result = await composeProductSystem(parsed.data)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error) },
      { status: 500 }
    )
  }
}
