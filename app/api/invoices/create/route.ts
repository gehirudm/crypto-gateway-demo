import { createClient } from '@/lib/supabase/server'
import { deriveInvoiceWallet, getUSDTBalance, getMasterMnemonic } from '@/lib/tron/wallet'
import { createInvoice } from '@/lib/db/invoices'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { amount, merchantId } = body

    if (!amount || !merchantId) {
      return NextResponse.json({ error: 'Amount and merchant ID required' }, { status: 400 })
    }

    if (parseFloat(amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be positive' }, { status: 400 })
    }

    const mnemonic = getMasterMnemonic()

    // Verify merchant exists
    const supabase = await createClient()
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', merchantId)
      .eq('is_active', true)
      .single()

    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Merchant not found or inactive' }, { status: 400 })
    }

    // Get next invoice derivation index (starts at 1, 0 is gas wallet)
    const { count } = await supabase.from('invoices').select('id', { count: 'exact' })
    const invoiceIndex = (count || 0) + 1

    const wallet = deriveInvoiceWallet(mnemonic, invoiceIndex)

    const invoice = await createInvoice({
      merchantId,
      amount: parseFloat(amount),
      walletAddress: wallet.address,
      derivationIndex: invoiceIndex,
    })

    const balance = await getUSDTBalance(wallet.address)

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        amount: parseFloat(amount),
        currency: 'USDT',
        walletAddress: wallet.address,
        balance,
        status: invoice.status,
        createdAt: invoice.created_at,
        merchantName: merchant.name,
      },
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to create invoice', details: errorMsg },
      { status: 500 }
    )
  }
}
