import { createClient } from '@/lib/supabase/server'
import { sendTransaction, deriveWalletFromMnemonic, sweepETH } from '@/lib/web3/wallet'

export interface Invoice {
  id: string
  created_at: string
  currency: 'ETH' | 'USDC'
  amount_expected: number
  wallet_address: string
  derivation_index: number
  status: 'pending' | 'received' | 'prefunding' | 'sweeping' | 'completed'
  current_balance: number
  confirmation_count: number
  last_checked_at: string
  sweep_tx_hash?: string
  gas_prefund_amount?: number
  gas_prefund_tx_hash?: string
}

/**
 * Create a new invoice with wallet
 */
export async function createInvoice(params: {
  currency: 'ETH' | 'USDC'
  amount: number
  walletAddress: string
  derivationIndex: number
}): Promise<Invoice> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('invoices')
    .insert([
      {
        currency: params.currency,
        amount_expected: params.amount,
        wallet_address: params.walletAddress,
        derivation_index: params.derivationIndex,
        status: 'pending',
        current_balance: 0,
        confirmation_count: 0,
        last_checked_at: new Date().toISOString(),
      },
    ])
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
export async function updateInvoiceStatus(invoiceId: string, status: Invoice['status']): Promise<Invoice | null> {
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
 * Sweep invoice funds to master wallet
 */
export async function checkAndSweepInvoice(invoiceId: string): Promise<{ swept: boolean; txHash?: string }> {
  try {
    const supabase = await createClient()

    // Get invoice
    const invoice = await getInvoice(invoiceId)
    if (!invoice) {
      throw new Error('Invoice not found')
    }

    // Get master mnemonic
    const masterMnemonic = process.env.MASTER_MNEMONIC
    if (!masterMnemonic) {
      throw new Error('Master mnemonic not configured')
    }

    // Get admin config to get master wallet address
    const { data: config } = await supabase.from('admin_config').select('*').eq('id', 'default').single()

    if (!config || !config.master_wallet_address) {
      throw new Error('Master wallet not configured')
    }

    // Derive the wallet for this invoice
    const invoiceWallet = deriveWalletFromMnemonic(masterMnemonic, invoice.derivation_index)

    let txHash: string

    if (invoice.currency === 'ETH') {
      // For ETH, use sweepETH which properly accounts for gas fees
      const sweepResult = await sweepETH(invoiceWallet.privateKey, config.master_wallet_address)
      
      if (!sweepResult) {
        throw new Error('Failed to sweep ETH - balance may be too low to cover gas')
      }
      
      txHash = sweepResult.hash
    } else {
      // For USDC, use regular sendTransaction (gas is prefunded separately)
      const txResult = await sendTransaction(
        invoiceWallet.privateKey,
        config.master_wallet_address,
        invoice.current_balance.toString(),
        invoice.currency,
        process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS
      )

      if (!txResult) {
        throw new Error('Failed to send transaction')
      }

      // Wait for confirmation
      await txResult.wait()
      
      txHash = txResult.hash
    }

    // Update invoice with sweep tx hash
    await supabase
      .from('invoices')
      .update({
        status: 'completed',
        sweep_tx_hash: txHash,
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    return { swept: true, txHash }
  } catch (error) {
    console.error('Error sweeping invoice:', error)
    return { swept: false }
  }
}
