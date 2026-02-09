import { createClient } from '@/lib/supabase/server'
import { deriveInvoiceWallet, sendUSDT, getUSDTBalance, getMasterMnemonic } from '@/lib/evm/wallet'

export interface Invoice {
  id: string
  created_at: string
  merchant_id: string
  amount_expected: number
  wallet_address: string
  derivation_index: number
  status: 'pending' | 'received' | 'prefunding' | 'sweeping' | 'completed' | 'failed'
  current_balance: number
  confirmation_count: number
  last_checked_at: string
  sweep_tx_hash?: string
  commission_tx_hash?: string
  merchant_tx_hash?: string
  gas_prefund_amount?: number
  gas_prefund_tx_hash?: string
  commission_amount?: number
  merchant_amount?: number
}

/**
 * Create a new invoice with derived EVM wallet
 */
export async function createInvoice(params: {
  merchantId: string
  amount: number
  walletAddress: string
  derivationIndex: number
}): Promise<Invoice> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      merchant_id: params.merchantId,
      amount_expected: params.amount,
      wallet_address: params.walletAddress,
      derivation_index: params.derivationIndex,
      status: 'pending',
      current_balance: 0,
      confirmation_count: 0,
      last_checked_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create invoice: ${error.message}`)
  }

  return data as Invoice
}

/**
 * Get invoice by ID
 */
export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()

  if (error) {
    console.error('Error getting invoice:', error)
    return null
  }

  return data as Invoice
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: Invoice['status']
): Promise<Invoice | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .update({ status, last_checked_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .select()
    .single()

  if (error) {
    console.error('Error updating invoice status:', error)
    return null
  }

  return data as Invoice
}

/**
 * Sweep invoice USDT: commission to master wallet, remainder to merchant's derived wallet
 */
export async function checkAndSweepInvoice(invoiceId: string): Promise<{
  swept: boolean
  commissionTxHash?: string
  merchantTxHash?: string
}> {
  try {
    const supabase = await createClient()

    // Atomic lock: only proceed if we can claim this invoice
    // This prevents concurrent sweeps on the same invoice
    const { data: claimed, error: claimError } = await supabase
      .from('invoices')
      .update({ status: 'sweeping', last_checked_at: new Date().toISOString() })
      .eq('id', invoiceId)
      .in('status', ['received', 'prefunding', 'sweeping'])
      .select()
      .single()

    if (claimError || !claimed) {
      console.log(`[SWEEP] Invoice ${invoiceId} already completed or locked, skipping`)
      // Check if it was already completed successfully
      const invoice = await getInvoice(invoiceId)
      return { swept: invoice?.status === 'completed' }
    }

    const invoice = claimed as Invoice
    const mnemonic = getMasterMnemonic()

    // Get admin config for master wallet and commission rate
    const { data: config } = await supabase
      .from('admin_config')
      .select('*')
      .eq('id', 'default')
      .single()

    if (!config?.master_wallet_address) {
      throw new Error('Master wallet not configured')
    }

    // Get merchant's derived wallet
    const { data: merchant } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', invoice.merchant_id)
      .single()

    if (!merchant) {
      throw new Error('Merchant not found')
    }

    // Derive invoice wallet private key
    const invoiceWallet = deriveInvoiceWallet(mnemonic, invoice.derivation_index)

    // Get actual USDT balance in invoice wallet
    const usdtBalance = await getUSDTBalance(invoice.wallet_address)

    if (usdtBalance <= 0) {
      throw new Error('No USDT balance in invoice wallet')
    }

    // Calculate commission and merchant amounts
    const commissionRate = Number(config.commission_rate) / 100
    const commissionAmount = Math.floor(usdtBalance * commissionRate * 1_000_000) / 1_000_000

    let commissionTxHash: string | undefined
    let merchantTxHash: string | undefined

    // Send commission to master wallet (if > 0)
    if (commissionAmount > 0.001) {
      console.log(
        `[SWEEP] Sending ${commissionAmount} USDT commission to master: ${config.master_wallet_address}`
      )
      const commissionResult = await sendUSDT(
        invoiceWallet.privateKey,
        config.master_wallet_address,
        commissionAmount
      )

      if (!commissionResult) {
        throw new Error('Failed to send commission to master wallet')
      }

      commissionTxHash = commissionResult.txid

      // Wait for confirmation before next transfer
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }

    // Re-read actual remaining balance for merchant transfer
    // This ensures we send exactly what's left, not a pre-calculated amount
    const remainingBalance = await getUSDTBalance(invoice.wallet_address)
    const merchantAmount = Math.floor(remainingBalance * 1_000_000) / 1_000_000

    // Send remainder to merchant's derived wallet
    if (merchantAmount > 0.001) {
      console.log(
        `[SWEEP] Sending ${merchantAmount} USDT to merchant wallet: ${merchant.derived_wallet_address}`
      )
      const merchantResult = await sendUSDT(
        invoiceWallet.privateKey,
        merchant.derived_wallet_address,
        merchantAmount
      )

      if (!merchantResult) {
        throw new Error('Failed to send funds to merchant wallet')
      }

      merchantTxHash = merchantResult.txid
    }

    // Update invoice with results
    await supabase
      .from('invoices')
      .update({
        status: 'completed',
        sweep_tx_hash: commissionTxHash || merchantTxHash,
        commission_tx_hash: commissionTxHash,
        merchant_tx_hash: merchantTxHash,
        commission_amount: commissionAmount,
        merchant_amount: merchantAmount,
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    return { swept: true, commissionTxHash, merchantTxHash }
  } catch (error) {
    console.error('Error sweeping invoice:', error)
    return { swept: false }
  }
}
