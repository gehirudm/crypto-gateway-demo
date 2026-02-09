import { NextRequest, NextResponse } from 'next/server'
import { getAdminConfig } from '@/lib/db/admin'
import { sweepETH, getGasWallet, getETHBalance } from '@/lib/evm/wallet'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const adminToken = process.env.ADMIN_TOKEN

    if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config = await getAdminConfig()
    if (!config?.master_wallet_address) {
      return NextResponse.json({ error: 'Master wallet not configured' }, { status: 400 })
    }

    const gasWallet = getGasWallet()
    const gasBalance = await getETHBalance(gasWallet.address)

    if (gasBalance <= 0) {
      return NextResponse.json({ error: 'Gas wallet has no balance to sweep' }, { status: 400 })
    }

    const result = await sweepETH(gasWallet.privateKey, config.master_wallet_address)
    if (!result) {
      return NextResponse.json(
        { error: 'Failed to sweep. Balance too low for fees.' },
        { status: 400 }
      )
    }

    const newBalance = await getETHBalance(gasWallet.address)

    return NextResponse.json({
      success: true,
      transactionHash: result.txid,
      amountSwept: result.amountSwept,
      previousBalance: gasBalance,
      newBalance,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to sweep gas wallet', details: errorMsg },
      { status: 500 }
    )
  }
}
