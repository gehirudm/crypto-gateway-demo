import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkAndSweepInvoice } from '@/lib/db/invoices'
import { getWalletBalance, prefundInvoiceWallet } from '@/lib/web3/wallet'

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

    // Check for invoices that need sweeping (received, prefunding, or sweeping status with sufficient balance)
    const invoicesToSweep = invoices?.filter(inv => 
      (inv.status === 'received' || inv.status === 'sweeping' || inv.status === 'prefunding') && 
      inv.current_balance >= inv.amount_expected
    ) || []

    console.log('[API:ADMIN:TRANSACTIONS] Found', invoicesToSweep.length, 'invoices to sweep')

    // Attempt to sweep each eligible invoice
    const sweepResults: { id: string; success: boolean; txHash?: string; error?: string }[] = []
    for (const invoice of invoicesToSweep) {
      console.log('[API:ADMIN:TRANSACTIONS] Processing invoice:', invoice.id, 'Currency:', invoice.currency, 'Status:', invoice.status)
      try {
        // For USDC invoices that need prefunding
        if (invoice.currency === 'USDC' && (invoice.status === 'received' || invoice.status === 'prefunding')) {
          console.log('[API:ADMIN:TRANSACTIONS] Prefunding USDC invoice:', invoice.id)
          
          // Check if already has ETH
          const ethBalance = await getWalletBalance(invoice.wallet_address, 'ETH')
          
          if (ethBalance <= 0) {
            const prefundResult = await prefundInvoiceWallet(invoice.wallet_address)
            if (!prefundResult) {
              console.error('[API:ADMIN:TRANSACTIONS] Failed to prefund invoice:', invoice.id)
              sweepResults.push({ id: invoice.id, success: false, error: 'Failed to prefund - gas wallet may have insufficient balance' })
              continue
            }
            console.log('[API:ADMIN:TRANSACTIONS] Prefunded invoice:', invoice.id, 'TX:', prefundResult.hash)
            
            // Record gas prefund amount and tx hash
            await supabase.from('invoices').update({
              gas_prefund_amount: parseFloat(prefundResult.amountSent),
              gas_prefund_tx_hash: prefundResult.hash,
            }).eq('id', invoice.id)
          }
          
          // Update status to sweeping
          await supabase.from('invoices').update({ status: 'sweeping' }).eq('id', invoice.id)
        }

        const result = await checkAndSweepInvoice(invoice.id)
        sweepResults.push({ 
          id: invoice.id, 
          success: result.swept, 
          txHash: result.txHash 
        })
        console.log('[API:ADMIN:TRANSACTIONS] Sweep result for', invoice.id, ':', result.swept ? 'success' : 'failed')
      } catch (sweepError) {
        const errorMsg = sweepError instanceof Error ? sweepError.message : 'Unknown error'
        console.error('[API:ADMIN:TRANSACTIONS] Sweep error for', invoice.id, ':', errorMsg)
        sweepResults.push({ 
          id: invoice.id, 
          success: false, 
          error: errorMsg 
        })
      }
    }

    // Re-fetch invoices to get updated statuses after sweeping
    const { data: updatedInvoices, error: refetchError } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false })

    if (refetchError) {
      console.error('[API:ADMIN:TRANSACTIONS] Error re-fetching invoices:', refetchError)
    }

    console.log('[API:ADMIN:TRANSACTIONS] Returning success response')

    return NextResponse.json({
      success: true,
      invoices: updatedInvoices || invoices,
      sweepResults: sweepResults.length > 0 ? sweepResults : undefined,
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
