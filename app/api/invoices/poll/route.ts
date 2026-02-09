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

    // Payment received - start prefund + sweep flow
    if (balance >= requiredAmount && invoice.status === 'pending') {
      updatedStatus = 'received'
      await supabase.from('invoices').update({ status: 'received' }).eq('id', invoiceId)

      // Prefund with ETH for 2 USDT transfers (commission + merchant)
      updatedStatus = 'prefunding'
      await supabase.from('invoices').update({ status: 'prefunding' }).eq('id', invoiceId)

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

          // Wait for TRX confirmation
          await new Promise((resolve) => setTimeout(resolve, 5000))

          // Sweep USDT with commission split
          updatedStatus = 'sweeping'
          await supabase.from('invoices').update({ status: 'sweeping' }).eq('id', invoiceId)

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

    // Retry stuck prefunding
    if (invoice.status === 'prefunding') {
      try {
        const ethBalance = await getETHBalance(invoice.wallet_address)

        if (ethBalance > 0.0005) {
          updatedStatus = 'sweeping'
          await supabase.from('invoices').update({ status: 'sweeping' }).eq('id', invoiceId)

          const result = await checkAndSweepInvoice(invoiceId)
          if (result.swept) updatedStatus = 'completed'
        } else {
          const prefundResult = await prefundInvoiceWallet(invoice.wallet_address, 2)
          if (prefundResult) {
            await supabase
              .from('invoices')
              .update({
                gas_prefund_amount: prefundResult.amountSent,
                gas_prefund_tx_hash: prefundResult.txid,
              })
              .eq('id', invoiceId)

            await new Promise((resolve) => setTimeout(resolve, 5000))

            updatedStatus = 'sweeping'
            await supabase.from('invoices').update({ status: 'sweeping' }).eq('id', invoiceId)

            const result = await checkAndSweepInvoice(invoiceId)
            if (result.swept) updatedStatus = 'completed'
          }
        }
      } catch (err) {
        console.error('[POLL] Error retrying prefund:', err)
      }
    }

    // Retry stuck sweeping
    if (invoice.status === 'sweeping') {
      try {
        const result = await checkAndSweepInvoice(invoiceId)
        if (result.swept) updatedStatus = 'completed'
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
