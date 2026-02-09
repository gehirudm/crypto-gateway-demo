import { createClient } from '@/lib/supabase/server'
import { deriveInvoiceWallet } from '@/lib/tron/wallet'

export interface AdminConfig {
  id: string
  created_at: string
  updated_at: string
  master_wallet_address: string
  gas_wallet_address: string
  commission_rate: number
}

/**
 * Get admin configuration
 */
export async function getAdminConfig(): Promise<AdminConfig | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.from('admin_config').select('*').eq('id', 'default').single()

  if (error) {
    return null
  }

  return data as AdminConfig
}

/**
 * Get or create gas wallet address (derived at index 0)
 */
export async function getOrCreateGasWallet(): Promise<string> {
  const mnemonic = process.env.TRON_MASTER_MNEMONIC
  if (!mnemonic) {
    throw new Error('TRON_MASTER_MNEMONIC not configured')
  }

  const gasWallet = deriveInvoiceWallet(mnemonic, 0)
  return gasWallet.address
}

