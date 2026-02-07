import { createClient } from '@/lib/supabase/server'
import { deriveWalletFromMnemonic, getWalletBalance } from '@/lib/web3/wallet'
import { createInvoice } from '@/lib/db/invoices'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('[API:CREATE:INVOICE] Starting invoice creation')
    
    const body = await request.json()
    console.log('[API:CREATE:INVOICE] Request body:', body)
    
    const { amount, currency } = body

    // Validate input
    if (!amount || !currency) {
      console.error('[API:CREATE:INVOICE] Missing required fields - amount:', amount, 'currency:', currency)
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['ETH', 'USDT'].includes(currency)) {
      console.error('[API:CREATE:INVOICE] Unsupported currency:', currency)
      return NextResponse.json({ error: 'Unsupported currency' }, { status: 400 })
    }

    // Get master mnemonic from environment
    console.log('[API:CREATE:INVOICE] Checking for MASTER_MNEMONIC environment variable')
    const masterMnemonic = process.env.MASTER_MNEMONIC
    if (!masterMnemonic) {
      console.error('[API:CREATE:INVOICE] MASTER_MNEMONIC not set in environment')
      return NextResponse.json(
        { error: 'Gateway not configured: Master mnemonic missing' },
        { status: 500 }
      )
    }

    // Derive unique wallet for this invoice
    console.log('[API:CREATE:INVOICE] Connecting to Supabase to get invoice count')
    const supabase = await createClient()
    const invoiceCountResult = await supabase.from('invoices').select('id', { count: 'exact' })
    const invoiceIndex = (invoiceCountResult.count || 0) + 1
    console.log('[API:CREATE:INVOICE] Invoice index:', invoiceIndex)

    console.log('[API:CREATE:INVOICE] Deriving wallet from mnemonic at index', invoiceIndex)
    const wallet = deriveWalletFromMnemonic(masterMnemonic, invoiceIndex)
    console.log('[API:CREATE:INVOICE] Derived wallet address:', wallet.address)

    // Create invoice in database
    console.log('[API:CREATE:INVOICE] Creating invoice in database')
    const invoice = await createInvoice({
      currency,
      amount: parseFloat(amount),
      walletAddress: wallet.address,
      derivationIndex: invoiceIndex,
    })
    console.log('[API:CREATE:INVOICE] Invoice created with ID:', invoice.id)

    // Get initial wallet balance
    console.log('[API:CREATE:INVOICE] Fetching initial wallet balance')
    const balance = await getWalletBalance(wallet.address, currency)
    console.log('[API:CREATE:INVOICE] Initial balance:', balance)

    console.log('[API:CREATE:INVOICE] Returning success response')
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
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[API:CREATE:INVOICE] ERROR:', errorMsg)
    console.error('[API:CREATE:INVOICE] Full error:', error)
    console.error('[API:CREATE:INVOICE] Stack trace:', error instanceof Error ? error.stack : 'N/A')
    return NextResponse.json({ 
      error: 'Failed to create invoice',
      details: errorMsg 
    }, { status: 500 })
  }
}
