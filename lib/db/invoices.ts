import { createClient } from '@/lib/supabase/server'
import { sendTransaction, deriveWalletFromMnemonic } from '@/lib/web3/wallet'
import { InvoiceWallet, Transaction } from '@/lib/db/types' // Assuming InvoiceWallet and Transaction are defined in a separate file

export interface Invoice {
  id: string
  created_at: string
  currency: 'ETH' | 'USDT'
  amount_expected: number
  wallet_address: string
  derivation_index: number
  status: 'pending' | 'received' | 'prefunding' | 'sweeping' | 'completed'
  current_balance: number
  confirmation_count: number
  last_checked_at: string
  sweep_tx_hash?: string
}

/**
 * Create a new invoice with wallet
 */
export async function createInvoice(params: {
  currency: 'ETH' | 'USDT'
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

    // Send funds to master wallet
    const txResult = await sendTransaction(
      invoiceWallet.privateKey,
      config.master_wallet_address,
      invoice.current_balance.toString(),
      invoice.currency,
      invoice.currency === 'USDT' ? process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS : undefined
    )

    if (!txResult) {
      throw new Error('Failed to send transaction')
    }

    // Wait for confirmation
    await txResult.wait(1)

    // Update invoice with sweep tx hash
    await supabase
      .from('invoices')
      .update({
        status: 'completed',
        sweep_tx_hash: txResult.hash,
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    return { swept: true, txHash: txResult.hash }
  } catch (error) {
    console.error('Error sweeping invoice:', error)
    return { swept: false }
  }
}
