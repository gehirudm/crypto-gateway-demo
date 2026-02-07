import { createClient } from '@/lib/supabase/server'
import { getWalletBalance, getTransactionCount, prefundInvoiceWallet } from '@/lib/web3/wallet'
import { checkAndSweepInvoice } from '@/lib/db/invoices'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('[API:POLL:INVOICE] Starting invoice poll')
    
    const body = await request.json()
    console.log('[API:POLL:INVOICE] Request body:', body)
    
    const { invoiceId } = body

    if (!invoiceId) {
      console.error('[API:POLL:INVOICE] Missing invoice ID')
      return NextResponse.json({ error: 'Missing invoice ID' }, { status: 400 })
    }

    console.log('[API:POLL:INVOICE] Fetching invoice:', invoiceId)
    const supabase = await createClient()

    // Fetch invoice
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    if (error) {
      console.error('[API:POLL:INVOICE] Database error fetching invoice:', error)
    }

    if (error || !invoice) {
      console.error('[API:POLL:INVOICE] Invoice not found - ID:', invoiceId)
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    console.log('[API:POLL:INVOICE] Invoice found:', {
      currency: invoice.currency,
      walletAddress: invoice.wallet_address,
      expectedAmount: invoice.amount_expected,
      status: invoice.status,
    })

    // Get current wallet balance
    console.log('[API:POLL:INVOICE] Fetching wallet balance for:', invoice.wallet_address)
    const balance = await getWalletBalance(invoice.wallet_address, invoice.currency)
    const requiredAmount = invoice.amount_expected
    console.log('[API:POLL:INVOICE] Current balance:', balance, 'Required:', requiredAmount)

    // Check transaction count for confirmation status
    console.log('[API:POLL:INVOICE] Getting transaction count')
    const txCount = await getTransactionCount(invoice.wallet_address)
    console.log('[API:POLL:INVOICE] Transaction count:', txCount)

    // Update balance in database
    console.log('[API:POLL:INVOICE] Updating invoice balance and confirmation count')
    const updateResult = await supabase
      .from('invoices')
      .update({
        current_balance: balance,
        last_checked_at: new Date().toISOString(),
        confirmation_count: txCount,
      })
      .eq('id', invoiceId)
    
    if (updateResult.error) {
      console.error('[API:POLL:INVOICE] Error updating invoice:', updateResult.error)
    }

    let updatedStatus = invoice.status

    // Check if payment received
    if (balance >= requiredAmount && invoice.status === 'pending') {
      console.log('[API:POLL:INVOICE] Payment received! Updating status')
      // Payment received, initiate sweep
      updatedStatus = 'received'
      
      // Update status
      await supabase.from('invoices').update({ status: 'received' }).eq('id', invoiceId)

      // If this is USDC, we need to prefund with gas first
      if (invoice.currency === 'USDC') {
        console.log('[API:POLL:INVOICE] USDC detected, prefunding invoice wallet with gas')
        updatedStatus = 'prefunding'
        await supabase.from('invoices').update({ status: 'prefunding' }).eq('id', invoiceId)
        
        // Actually prefund the invoice wallet with ETH for gas
        try {
          const prefundResult = await prefundInvoiceWallet(invoice.wallet_address)
          if (prefundResult) {
            console.log('[API:POLL:INVOICE] Prefunding successful, TX:', prefundResult.hash, 'Amount:', prefundResult.amountSent, 'ETH')
            
            // Record gas prefund amount and tx hash
            await supabase.from('invoices').update({
              gas_prefund_amount: parseFloat(prefundResult.amountSent),
              gas_prefund_tx_hash: prefundResult.hash,
            }).eq('id', invoiceId)

            // Now sweep the USDC
            updatedStatus = 'sweeping'
            await supabase.from('invoices').update({ status: 'sweeping' }).eq('id', invoiceId)
            
            const result = await checkAndSweepInvoice(invoiceId)
            if (result.swept) {
              console.log('[API:POLL:INVOICE] USDC sweep successful, TX:', result.txHash)
              updatedStatus = 'completed'
            } else {
              console.log('[API:POLL:INVOICE] USDC sweep failed after prefunding')
            }
          } else {
            console.error('[API:POLL:INVOICE] Failed to prefund invoice wallet - gas wallet may have insufficient balance')
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          console.error('[API:POLL:INVOICE] Error in USDC prefund/sweep flow:', errorMsg)
        }
      } else {
        // For ETH, we can sweep directly
        console.log('[API:POLL:INVOICE] ETH detected, initiating sweep')
        updatedStatus = 'sweeping'
        await supabase.from('invoices').update({ status: 'sweeping' }).eq('id', invoiceId)
        
        // Attempt sweep
        try {
          console.log('[API:POLL:INVOICE] Attempting to sweep invoice')
          const result = await checkAndSweepInvoice(invoiceId)
          if (result.swept) {
            console.log('[API:POLL:INVOICE] Sweep successful, TX:', result.txHash)
            updatedStatus = 'completed'
          } else {
            console.log('[API:POLL:INVOICE] Sweep failed')
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err)
          console.error('[API:POLL:INVOICE] Error sweeping invoice:', errorMsg)
        }
      }
    }

    // Handle invoices stuck in prefunding status (retry on next poll)
    if (invoice.status === 'prefunding') {
      console.log('[API:POLL:INVOICE] Invoice stuck in prefunding, retrying prefund + sweep')
      try {
        // Check if wallet already has ETH (might have been prefunded already)
        const ethBalance = await getWalletBalance(invoice.wallet_address, 'ETH')
        
        if (ethBalance > 0) {
          console.log('[API:POLL:INVOICE] Invoice wallet already has ETH, proceeding to sweep')
          updatedStatus = 'sweeping'
          await supabase.from('invoices').update({ status: 'sweeping' }).eq('id', invoiceId)
          
          const result = await checkAndSweepInvoice(invoiceId)
          if (result.swept) {
            console.log('[API:POLL:INVOICE] USDC sweep successful on retry, TX:', result.txHash)
            updatedStatus = 'completed'
          }
        } else {
          // Retry prefunding
          const prefundResult = await prefundInvoiceWallet(invoice.wallet_address)
          if (prefundResult) {
            // Record gas prefund amount and tx hash
            await supabase.from('invoices').update({
              gas_prefund_amount: parseFloat(prefundResult.amountSent),
              gas_prefund_tx_hash: prefundResult.hash,
            }).eq('id', invoiceId)

            updatedStatus = 'sweeping'
            await supabase.from('invoices').update({ status: 'sweeping' }).eq('id', invoiceId)
            
            const result = await checkAndSweepInvoice(invoiceId)
            if (result.swept) {
              console.log('[API:POLL:INVOICE] USDC sweep successful on retry, TX:', result.txHash)
              updatedStatus = 'completed'
            }
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error('[API:POLL:INVOICE] Error retrying USDC prefund/sweep:', errorMsg)
      }
    }

    // Handle invoices stuck in sweeping status (retry on next poll)
    if (invoice.status === 'sweeping') {
      console.log('[API:POLL:INVOICE] Invoice stuck in sweeping, retrying sweep')
      try {
        const result = await checkAndSweepInvoice(invoiceId)
        if (result.swept) {
          console.log('[API:POLL:INVOICE] Sweep successful on retry, TX:', result.txHash)
          updatedStatus = 'completed'
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error('[API:POLL:INVOICE] Error retrying sweep:', errorMsg)
      }
    }

    // Fetch updated invoice
    console.log('[API:POLL:INVOICE] Fetching updated invoice data')
    const { data: updatedInvoice } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single()

    console.log('[API:POLL:INVOICE] Returning success response - status:', updatedInvoice?.status)
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
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[API:POLL:INVOICE] ERROR:', errorMsg)
    console.error('[API:POLL:INVOICE] Full error:', error)
    console.error('[API:POLL:INVOICE] Stack trace:', error instanceof Error ? error.stack : 'N/A')
    return NextResponse.json({ 
      error: 'Failed to poll invoice',
      details: errorMsg 
    }, { status: 500 })
  }
}
