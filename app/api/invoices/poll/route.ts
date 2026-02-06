import { createClient } from '@/lib/supabase/server'
import { getWalletBalance, getTransactionCount } from '@/lib/web3/wallet'
import { checkAndSweepInvoice } from '@/lib/db/invoices'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { invoiceId } = await request.json()

    if (!invoiceId) {
      return NextResponse.json({ error: 'Missing invoice ID' }, { status: 400 })
    }

    const supabase = await createClient()

    // Fetch invoice
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Get current wallet balance
    const balance = await getWalletBalance(invoice.wallet_address, invoice.currency)
    const requiredAmount = invoice.amount_expected

    // Check transaction count for confirmation status
    const txCount = await getTransactionCount(invoice.wallet_address)

    // Update balance in database
    await supabase
      .from('invoices')
      .update({
        current_balance: balance,
        last_checked_at: new Date().toISOString(),
        confirmation_count: txCount,
      })
      .eq('id', invoiceId)

    let updatedStatus = invoice.status

    // Check if payment received
    if (balance >= requiredAmount && invoice.status === 'pending') {
      // Payment received, initiate sweep
      updatedStatus = 'received'
      
      // Update status
      await supabase.from('invoices').update({ status: 'received' }).eq('id', invoiceId)

      // If this is USDT, we need to prefund with gas first
      if (invoice.currency === 'USDT') {
        updatedStatus = 'prefunding'
        await supabase.from('invoices').update({ status: 'prefunding' }).eq('id', invoiceId)
        // Gas prefunding will happen in background
      } else {
        // For ETH, we can sweep directly
        updatedStatus = 'sweeping'
        await supabase.from('invoices').update({ status: 'sweeping' }).eq('id', invoiceId)
        
        // Attempt sweep
        try {
          const result = await checkAndSweepInvoice(invoiceId)
          if (result.swept) {
            updatedStatus = 'completed'
          }
        } catch (err) {
          console.error('Error sweeping invoice:', err)
        }
      }
    }

    // Fetch updated invoice
    const { data: updatedInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    return NextResponse.json({
      success: true,
      invoice: {
        id: updatedInvoice.id,
        status: updatedInvoice.status,
        balance,
        requiredAmount,
        confirmationCount: txCount,
        isPaymentReceived: balance >= requiredAmount,
        lastChecked: updatedInvoice.last_checked_at,
      },
    })
  } catch (error) {
    console.error('Error polling invoice:', error)
    return NextResponse.json({ error: 'Failed to poll invoice' }, { status: 500 })
  }
}
