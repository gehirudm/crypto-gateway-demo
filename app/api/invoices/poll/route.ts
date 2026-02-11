import { createClient } from '@/lib/supabase/server'
import { getUSDTBalance, getETHBalance, prefundInvoiceWallet } from '@/lib/evm/wallet'
import { checkAndSweepInvoice } from '@/lib/db/invoices'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { invoiceId } = body

    if (!invoiceId) {
      return NextResponse.json({ error: 'Missing invoice ID' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    // Get current USDT balance
    const balance = await getUSDTBalance(invoice.wallet_address)
    const requiredAmount = invoice.amount_expected

    // Update balance in database
    await supabase
      .from('invoices')
      .update({
        current_balance: balance,
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    let updatedStatus = invoice.status

    // === ATOMIC DB LOCK: Use conditional update as a distributed lock ===
    // Only the first serverless invocation that wins the status transition proceeds.
    // IMPORTANT: Only the initial pending→prefunding path sends ETH from the gas wallet.
    // Retry paths NEVER send new ETH — they only attempt the sweep if ETH is already there.
    // This prevents nonce collisions on the shared gas wallet.

    // Payment received — atomically claim pending → prefunding
    if (balance >= requiredAmount && invoice.status === 'pending') {
      const { data: claimed } = await supabase
        .from('invoices')
        .update({ status: 'prefunding' })
        .eq('id', invoiceId)
        .eq('status', 'pending') // only succeeds if still pending
        .select('id')

      if (claimed && claimed.length > 0) {
        // We won the lock — proceed with prefund + sweep
        updatedStatus = 'prefunding'
        try {
          const prefundResult = await prefundInvoiceWallet(invoice.wallet_address, 2)

          if (prefundResult) {
            await supabase
              .from('invoices')
              .update({
                gas_prefund_amount: prefundResult.amountSent,
                gas_prefund_tx_hash: prefundResult.txid,
              })
              .eq('id', invoiceId)

            // Wait for ETH confirmation
            await new Promise((resolve) => setTimeout(resolve, 5000))

            // Sweep USDT with commission split
            const result = await checkAndSweepInvoice(invoiceId)
            if (result.swept) {
              updatedStatus = 'completed'
            }
          } else {
            console.error('[POLL] Failed to prefund invoice wallet')
          }
        } catch (err) {
          console.error('[POLL] Error in prefund/sweep flow:', err)
        }
      }
      // else: another invocation already claimed it — skip
    }

    // Retry: invoice is stuck in prefunding or sweeping.
    // Only attempt the sweep if ETH gas is already present — NEVER send new ETH here.
    // checkAndSweepInvoice has its own atomic claim (received/prefunding → sweeping),
    // so concurrent calls are safe — only one will win, others get { swept: false }.
    else if (invoice.status === 'prefunding' || invoice.status === 'sweeping') {
      try {
        const ethBalance = await getETHBalance(invoice.wallet_address)
        if (ethBalance > 0.00001) {
          // ETH is available from earlier prefund, attempt sweep
          const result = await checkAndSweepInvoice(invoiceId)
          if (result.swept) updatedStatus = 'completed'
        }
        // else: ETH not yet confirmed — just wait for next poll
      } catch (err) {
        console.error('[POLL] Error retrying sweep:', err)
      }
    }

    // Fetch final state
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
        isPaymentReceived: balance >= requiredAmount,
        lastChecked: updatedInvoice.last_checked_at,
      },
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to poll invoice', details: errorMsg },
      { status: 500 }
    )
  }
}
