import { createClient } from '@/lib/supabase/server'
import { deriveWalletFromMnemonic, getWalletBalance } from '@/lib/web3/wallet'
import { getOrCreateGasWallet, getAdminConfig } from '@/lib/db/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    console.log('[API:CONFIG:GET] Starting config fetch')
    
    // Verify admin access
    const authHeader = request.headers.get('authorization')
    const adminToken = process.env.ADMIN_TOKEN
    
    if (!adminToken) {
      console.error('[API:CONFIG:GET] ADMIN_TOKEN not set in environment')
      return NextResponse.json({ error: 'Server configuration error: ADMIN_TOKEN not set' }, { status: 500 })
    }
    
    if (authHeader !== `Bearer ${adminToken}`) {
      console.warn('[API:CONFIG:GET] Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[API:CONFIG:GET] Fetching admin config from database')
    const config = await getAdminConfig()
    
    if (!config) {
      console.log('[API:CONFIG:GET] No config found, generating gas wallet')
      // Generate gas wallet even if not fully configured
      const gasWalletAddress = await getOrCreateGasWallet()
      const gasWalletBalance = await getWalletBalance(gasWalletAddress, 'ETH')
      
      console.log('[API:CONFIG:GET] Gas wallet:', gasWalletAddress, 'Balance:', gasWalletBalance)
      
      return NextResponse.json({
        configured: false,
        error: 'Gateway not fully configured. Master wallet address required.',
        gasWalletAddress,
        gasWalletBalance,
        gasWalletFunded: gasWalletBalance > 0.0001,
        requiredSettings: ['Master Wallet Address', 'Gas Wallet Funding'],
      })
    }

    // Get gas wallet balance
    console.log('[API:CONFIG:GET] Config found, fetching gas wallet balance')
    const gasWalletBalance = await getWalletBalance(config.gas_wallet_address, 'ETH')
    const isFullyConfigured = config.master_wallet_address && gasWalletBalance > 0.0001

    console.log('[API:CONFIG:GET] Config status - Master:', !!config.master_wallet_address, 'Gas funded:', gasWalletBalance > 0.001)

    return NextResponse.json({
      configured: isFullyConfigured,
      masterWalletAddress: config.master_wallet_address,
      gasWalletAddress: config.gas_wallet_address,
      gasWalletBalance,
      gasWalletFunded: gasWalletBalance > 0.0001,
      createdAt: config.created_at,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[API:CONFIG:GET] ERROR:', errorMsg)
    console.error('[API:CONFIG:GET] Full error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch config',
      details: errorMsg 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[API:CONFIG:POST] Starting config update')
    
    // Verify admin access
    const authHeader = request.headers.get('authorization')
    const adminToken = process.env.ADMIN_TOKEN
    
    if (!adminToken) {
      console.error('[API:CONFIG:POST] ADMIN_TOKEN not set in environment')
      return NextResponse.json({ error: 'Server configuration error: ADMIN_TOKEN not set' }, { status: 500 })
    }
    
    if (authHeader !== `Bearer ${adminToken}`) {
      console.warn('[API:CONFIG:POST] Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('[API:CONFIG:POST] Received body:', body)
    
    const { masterWalletAddress } = body

    if (!masterWalletAddress) {
      console.error('[API:CONFIG:POST] Missing master wallet address')
      return NextResponse.json({ error: 'Master wallet address required' }, { status: 400 })
    }

    // Get or create gas wallet
    console.log('[API:CONFIG:POST] Getting or creating gas wallet')
    const gasWalletAddress = await getOrCreateGasWallet()
    console.log('[API:CONFIG:POST] Gas wallet address:', gasWalletAddress)

    // Save configuration
    console.log('[API:CONFIG:POST] Connecting to Supabase')
    const supabase = await createClient()
    
    // First check if config exists
    console.log('[API:CONFIG:POST] Checking for existing config')
    const { data: existingConfig, error: fetchError } = await supabase
      .from('admin_config')
      .select('*')
      .eq('id', 'default')
      .single()
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[API:CONFIG:POST] Error fetching existing config:', fetchError)
      throw new Error(`Failed to fetch config: ${fetchError.message}`)
    }
    
    let result
    if (existingConfig) {
      console.log('[API:CONFIG:POST] Updating existing config')
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
      console.log('[API:CONFIG:POST] Creating new config')
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
      console.error('[API:CONFIG:POST] Database error:', error)
      throw new Error(`Database error: ${error.message}`)
    }

    console.log('[API:CONFIG:POST] Config saved successfully, fetching gas balance')
    const gasBalance = await getWalletBalance(gasWalletAddress, 'ETH')
    console.log('[API:CONFIG:POST] Gas balance:', gasBalance)

    console.log('[API:CONFIG:POST] Returning success response')
    return NextResponse.json({
      success: true,
      config: {
        masterWalletAddress,
        gasWalletAddress,
        gasWalletBalance: gasBalance,
      },
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[API:CONFIG:POST] ERROR:', errorMsg)
    console.error('[API:CONFIG:POST] Full error:', error)
    return NextResponse.json({ 
      error: 'Failed to update config',
      details: errorMsg 
    }, { status: 500 })
  }
}
