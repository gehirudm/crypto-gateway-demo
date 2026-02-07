import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('[API:ADMIN:TRANSACTIONS] Starting transaction list fetch')
    
    // Verify admin access
    const authHeader = request.headers.get('authorization')
    const adminToken = process.env.ADMIN_TOKEN
    
    if (!adminToken) {
      console.error('[API:ADMIN:TRANSACTIONS] ADMIN_TOKEN not set in environment')
      return NextResponse.json({ error: 'Server configuration error: ADMIN_TOKEN not set' }, { status: 500 })
    }
    
    if (authHeader !== `Bearer ${adminToken}`) {
      console.warn('[API:ADMIN:TRANSACTIONS] Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[API:ADMIN:TRANSACTIONS] Connecting to Supabase')
    const supabase = await createClient()

    // Fetch all invoices (invoices table stores all transaction history)
    console.log('[API:ADMIN:TRANSACTIONS] Fetching all invoices')
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[API:ADMIN:TRANSACTIONS] Database error:', error)
      throw error
    }

    console.log('[API:ADMIN:TRANSACTIONS] Found', invoices?.length || 0, 'invoices')
    console.log('[API:ADMIN:TRANSACTIONS] Returning success response')

    return NextResponse.json({
      success: true,
      invoices,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[API:ADMIN:TRANSACTIONS] ERROR:', errorMsg)
    console.error('[API:ADMIN:TRANSACTIONS] Full error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch transactions',
      details: errorMsg 
    }, { status: 500 })
  }
}
