import { createClient } from '@/lib/supabase/server'
import { deriveWalletFromMnemonic } from '@/lib/web3/wallet'
import { GasWallet, MasterWallet } from '@/lib/types/wallet' // Assuming GasWallet and MasterWallet are defined in a separate file

export interface AdminConfig {
  id: string
  created_at: string
  updated_at: string
  master_wallet_address: string
  gas_wallet_address: string
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
 * Get or create gas wallet address
 */
export async function getOrCreateGasWallet(): Promise<string> {
  try {
    const masterMnemonic = process.env.MASTER_MNEMONIC
    if (!masterMnemonic) {
      throw new Error('Master mnemonic not configured')
    }

    // Derive gas wallet from index 0
    const gasWallet = deriveWalletFromMnemonic(masterMnemonic, 0)
    return gasWallet.address
  } catch (error) {
    console.error('Error getting gas wallet:', error)
    throw error
  }
}

