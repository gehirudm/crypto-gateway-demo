import { NextResponse } from 'next/server'
import { getMerchants } from '@/lib/db/merchants'

// Public endpoint — returns only active merchants (id + name) for invoice creation
export async function GET() {
  try {
    const merchants = await getMerchants(true) // activeOnly = true

    const publicList = merchants.map((m) => ({
      id: m.id,
      name: m.name,
    }))

    return NextResponse.json({ success: true, merchants: publicList })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to fetch merchants', details: errorMsg },
      { status: 500 }
    )
  }
}
