import { NextRequest, NextResponse } from 'next/server'
import { getAdminConfig } from '@/lib/db/admin'
import { sweepETH, getGasWalletPrivateKey, getWalletBalance } from '@/lib/web3/wallet'

export async function POST(request: NextRequest) {
  try {
    console.log('[API:GAS-WALLET:SWEEP] Starting sweep operation')
    
    // Verify admin access
    const authHeader = request.headers.get('authorization')
    const adminToken = process.env.ADMIN_TOKEN
    
    if (!adminToken) {
      console.error('[API:GAS-WALLET:SWEEP] ADMIN_TOKEN not set')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }
    
    if (authHeader !== `Bearer ${adminToken}`) {
      console.warn('[API:GAS-WALLET:SWEEP] Unauthorized access attempt')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get admin config to find master wallet address
    const config = await getAdminConfig()
    
    if (!config?.master_wallet_address) {
      return NextResponse.json({ 
        error: 'Master wallet address not configured' 
      }, { status: 400 })
    }

    // Get gas wallet balance first
    const gasWalletBalance = await getWalletBalance(config.gas_wallet_address, 'ETH')
    
    if (gasWalletBalance <= 0) {
      return NextResponse.json({ 
        error: 'Gas wallet has no balance to sweep' 
      }, { status: 400 })
    }

    console.log('[API:GAS-WALLET:SWEEP] Current gas wallet balance:', gasWalletBalance)
    console.log('[API:GAS-WALLET:SWEEP] Sweeping to master wallet:', config.master_wallet_address)

    // Get gas wallet private key and sweep
    const gasWalletPrivateKey = getGasWalletPrivateKey()
    const result = await sweepETH(gasWalletPrivateKey, config.master_wallet_address)

    if (!result) {
      return NextResponse.json({ 
        error: 'Failed to sweep funds. Balance may be too low to cover gas fees.' 
      }, { status: 400 })
    }

    console.log('[API:GAS-WALLET:SWEEP] Sweep successful:', result)

    // Get new balance
    const newBalance = await getWalletBalance(config.gas_wallet_address, 'ETH')

    return NextResponse.json({
      success: true,
      transactionHash: result.hash,
      amountSwept: result.amountSwept,
      gasCost: result.gasCost,
      previousBalance: gasWalletBalance.toFixed(6),
      newBalance: newBalance.toFixed(6),
      destinationAddress: config.master_wallet_address,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[API:GAS-WALLET:SWEEP] ERROR:', errorMsg)
    return NextResponse.json({ 
      error: 'Failed to sweep gas wallet',
      details: errorMsg 
    }, { status: 500 })
  }
}
