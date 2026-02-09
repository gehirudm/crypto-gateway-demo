import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { checkAndSweepInvoice } from '@/lib/db/invoices'
import { getTRXBalance, prefundInvoiceWallet } from '@/lib/tron/wallet'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const adminToken = process.env.ADMIN_TOKEN

    if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Fetch all invoices with merchant info
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*, merchants(name)')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Auto-sweep eligible invoices
    const toSweep =
      invoices?.filter(
        (inv) =>
          ['received', 'sweeping', 'prefunding'].includes(inv.status) &&
          inv.current_balance >= inv.amount_expected
      ) || []

    const sweepResults: { id: string; success: boolean; error?: string }[] = []
    for (const invoice of toSweep) {
      try {
        if (['received', 'prefunding'].includes(invoice.status)) {
          const trxBalance = await getTRXBalance(invoice.wallet_address)
          if (trxBalance < 30) {
            const prefundResult = await prefundInvoiceWallet(invoice.wallet_address, 2)
            if (!prefundResult) {
              sweepResults.push({ id: invoice.id, success: false, error: 'Failed to prefund' })
              continue
            }
            await supabase
              .from('invoices')
              .update({
                gas_prefund_amount: prefundResult.amountSent,
                gas_prefund_tx_hash: prefundResult.txid,
              })
              .eq('id', invoice.id)
            await new Promise((resolve) => setTimeout(resolve, 5000))
          }
          await supabase.from('invoices').update({ status: 'sweeping' }).eq('id', invoice.id)
        }

        const result = await checkAndSweepInvoice(invoice.id)
        sweepResults.push({ id: invoice.id, success: result.swept })
      } catch (err) {
        sweepResults.push({ id: invoice.id, success: false, error: String(err) })
      }
    }

    // Re-fetch with updated statuses
    const { data: updated } = await supabase
      .from('invoices')
      .select('*, merchants(name)')
      .order('created_at', { ascending: false })

    return NextResponse.json({
      success: true,
      invoices: updated || invoices,
      sweepResults: sweepResults.length > 0 ? sweepResults : undefined,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions', details: errorMsg },
      { status: 500 }
    )
  }
}
