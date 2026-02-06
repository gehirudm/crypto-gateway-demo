import { createClient } from '@/lib/supabase/server'
import { deriveWalletFromMnemonic, getWalletBalance } from '@/lib/web3/wallet'
import { createInvoice } from '@/lib/db/invoices'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { amount, currency } = await request.json()

    // Validate input
    if (!amount || !currency) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['ETH', 'USDT'].includes(currency)) {
      return NextResponse.json({ error: 'Unsupported currency' }, { status: 400 })
    }

    // Get master mnemonic from environment
    const masterMnemonic = process.env.MASTER_MNEMONIC
    if (!masterMnemonic) {
      return NextResponse.json(
        { error: 'Gateway not configured: Master mnemonic missing' },
        { status: 500 }
      )
    }

    // Derive unique wallet for this invoice
    const supabase = await createClient()
    const invoiceCountResult = await supabase.from('invoices').select('id', { count: 'exact' })
    const invoiceIndex = (invoiceCountResult.count || 0) + 1

    const wallet = deriveWalletFromMnemonic(masterMnemonic, invoiceIndex)

    // Create invoice in database
    const invoice = await createInvoice({
      currency,
      amount: parseFloat(amount),
      walletAddress: wallet.address,
      derivationIndex: invoiceIndex,
    })

    // Get initial wallet balance
    const balance = await getWalletBalance(wallet.address, currency)

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        amount,
        currency,
        walletAddress: wallet.address,
        balance,
        status: invoice.status,
        createdAt: invoice.created_at,
      },
    })
  } catch (error) {
    console.error('Error creating invoice:', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
