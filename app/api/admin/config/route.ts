import { createClient } from '@/lib/supabase/server'
import { getETHBalance, isValidAddress } from '@/lib/evm/wallet'
import { getOrCreateGasWallet, getAdminConfig } from '@/lib/db/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const adminToken = process.env.ADMIN_TOKEN

    if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const config = await getAdminConfig()

    // Ensure gas wallet is always derived and stored
    const gasWalletAddress = config?.gas_wallet_address || (await getOrCreateGasWallet())

    // If config exists but gas_wallet_address was empty, update it
    if (config && !config.gas_wallet_address) {
      const supabase = await createClient()
      await supabase
        .from('admin_config')
        .update({ gas_wallet_address: gasWalletAddress })
        .eq('id', 'default')
    }

    if (!config) {
      const gasWalletBalance = await getETHBalance(gasWalletAddress)

      return NextResponse.json({
        configured: false,
        gasWalletAddress,
        gasWalletBalance,
        gasWalletFunded: gasWalletBalance > 0.001,
        commissionRate: 5.0,
      })
    }

    const gasWalletBalance = await getETHBalance(gasWalletAddress)
    const isFullyConfigured = !!config.master_wallet_address && gasWalletBalance > 0.001

    return NextResponse.json({
      configured: isFullyConfigured,
      masterWalletAddress: config.master_wallet_address,
      gasWalletAddress,
      gasWalletBalance,
      gasWalletFunded: gasWalletBalance > 10,
      commissionRate: Number(config.commission_rate),
      createdAt: config.created_at,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to fetch config', details: errorMsg },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const adminToken = process.env.ADMIN_TOKEN

    if (!adminToken || authHeader !== `Bearer ${adminToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { masterWalletAddress, commissionRate } = body

    if (!masterWalletAddress) {
      return NextResponse.json({ error: 'Master wallet address required' }, { status: 400 })
    }

    if (!isValidAddress(masterWalletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
    }

    if (commissionRate !== undefined && (commissionRate < 0 || commissionRate > 100)) {
      return NextResponse.json(
        { error: 'Commission rate must be between 0 and 100' },
        { status: 400 }
      )
    }

    const gasWalletAddress = await getOrCreateGasWallet()

    const supabase = await createClient()

    const { data: existingConfig } = await supabase
      .from('admin_config')
      .select('*')
      .eq('id', 'default')
      .single()

    const updateData: Record<string, any> = {
      master_wallet_address: masterWalletAddress,
      gas_wallet_address: gasWalletAddress,
      updated_at: new Date().toISOString(),
    }

    if (commissionRate !== undefined) {
      updateData.commission_rate = commissionRate
    }

    if (existingConfig) {
      await supabase.from('admin_config').update(updateData).eq('id', 'default')
    } else {
      await supabase.from('admin_config').insert({
        id: 'default',
        ...updateData,
        commission_rate: commissionRate ?? 5.0,
        created_at: new Date().toISOString(),
      })
    }

    const gasBalance = await getETHBalance(gasWalletAddress)

    return NextResponse.json({
      success: true,
      config: {
        masterWalletAddress,
        gasWalletAddress,
        gasWalletBalance: gasBalance,
        commissionRate: commissionRate ?? existingConfig?.commission_rate ?? 5.0,
      },
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to update config', details: errorMsg },
      { status: 500 }
    )
  }
}
