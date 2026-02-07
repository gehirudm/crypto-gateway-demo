import { createClient } from '@/lib/supabase/server'
import { deriveWalletFromMnemonic, getWalletBalance } from '@/lib/web3/wallet'
import { getOrCreateGasWallet, getAdminConfig } from '@/lib/db/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const authHeader = request.headers.get('authorization')
    const adminToken = process.env.ADMIN_TOKEN
    
    if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config = await getAdminConfig()
    
    if (!config) {
      return NextResponse.json({
        configured: false,
        error: 'Gateway not configured. Master wallet key required.',
        requiredSettings: ['Master Wallet Key'],
      })
    }

    // Get gas wallet balance
    const gasWalletBalance = await getWalletBalance(config.gas_wallet_address, 'ETH')

    return NextResponse.json({
      configured: true,
      masterWalletAddress: config.master_wallet_address,
      gasWalletAddress: config.gas_wallet_address,
      gasWalletBalance,
      createdAt: config.created_at,
    })
  } catch (error) {
    console.error('Error fetching admin config:', error)
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const authHeader = request.headers.get('authorization')
    const adminToken = process.env.ADMIN_TOKEN
    
    if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { masterWalletAddress } = await request.json()

    if (!masterWalletAddress) {
      return NextResponse.json({ error: 'Master wallet address required' }, { status: 400 })
    }

    // Get or create gas wallet
    const gasWalletAddress = await getOrCreateGasWallet()

    // Save configuration
    const supabase = await createClient()
    
    // First check if config exists
    const { data: existingConfig, error: fetchError } = await supabase
      .from('admin_config')
      .select('*')
      .eq('id', 'default')
      .single()
    
    let result
    if (existingConfig) {
      // Update existing config
      result = await supabase
        .from('admin_config')
        .update({
          master_wallet_address: masterWalletAddress,
          gas_wallet_address: gasWalletAddress,
          updated_at: new Date().toISOString(),
        })
        .eq('id', 'default')
    } else {
      // Insert new config
      result = await supabase
        .from('admin_config')
        .insert({
          id: 'default',
          master_wallet_address: masterWalletAddress,
          gas_wallet_address: gasWalletAddress,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
    }
    
    const { error } = result
    
    if (error) {
      console.error('Supabase error:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    const gasBalance = await getWalletBalance(gasWalletAddress, 'ETH')

    return NextResponse.json({
      success: true,
      config: {
        masterWalletAddress,
        gasWalletAddress,
        gasWalletBalance: gasBalance,
      },
    })
  } catch (error) {
    console.error('Error updating admin config:', error)
    return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
  }
}
