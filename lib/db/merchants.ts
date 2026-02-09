import { createClient } from '@/lib/supabase/server'
import { deriveMerchantWallet, getMasterMnemonic } from '@/lib/tron/wallet'

export interface Merchant {
  id: string
  created_at: string
  name: string
  external_wallet_address: string
  derivation_index: number
  derived_wallet_address: string
  is_active: boolean
}

/**
 * Create a new merchant with a derived TRON wallet
 */
export async function createMerchant(
  name: string,
  externalWalletAddress: string = ''
): Promise<Merchant> {
  const supabase = await createClient()
  const mnemonic = getMasterMnemonic()

  // Get next derivation index
  const { data: existingMerchants } = await supabase
    .from('merchants')
    .select('derivation_index')
    .order('derivation_index', { ascending: false })
    .limit(1)

  const nextIndex =
    existingMerchants && existingMerchants.length > 0
      ? existingMerchants[0].derivation_index + 1
      : 0

  // Derive wallet at m/44'/195'/1'/0/{nextIndex}
  const wallet = deriveMerchantWallet(mnemonic, nextIndex)

  const { data, error } = await supabase
    .from('merchants')
    .insert({
      name,
      external_wallet_address: externalWalletAddress,
      derivation_index: nextIndex,
      derived_wallet_address: wallet.address,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create merchant: ${error.message}`)
  }

  return data as Merchant
}

/**
 * Get all merchants
 */
export async function getMerchants(activeOnly: boolean = true): Promise<Merchant[]> {
  const supabase = await createClient()

  let query = supabase.from('merchants').select('*').order('created_at', { ascending: false })

  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error getting merchants:', error)
    return []
  }

  return data as Merchant[]
}

/**
 * Get a single merchant
 */
export async function getMerchant(id: string): Promise<Merchant | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.from('merchants').select('*').eq('id', id).single()

  if (error) {
    console.error('Error getting merchant:', error)
    return null
  }

  return data as Merchant
}

/**
 * Update a merchant
 */
export async function updateMerchant(
  id: string,
  updates: { name?: string; external_wallet_address?: string; is_active?: boolean }
): Promise<Merchant | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('merchants')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating merchant:', error)
    return null
  }

  return data as Merchant
}
