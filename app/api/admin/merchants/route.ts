import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { createMerchant, getMerchants, updateMerchant } from '@/lib/db/merchants'
import {
  getUSDTBalance,
  getETHBalance,
  isValidAddress,
  deriveMerchantWallet,
  getMasterMnemonic,
  prefundMerchantWallet,
  sweepUSDT,
} from '@/lib/evm/wallet'

function verifyAdmin(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const adminToken = process.env.ADMIN_TOKEN
  return !!adminToken && authHeader === `Bearer ${adminToken}`
}

export async function GET(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const merchants = await getMerchants(false)

    // Fetch balances for each merchant
    const merchantsWithBalances = await Promise.all(
      merchants.map(async (merchant) => {
        const [usdtBalance, ethBalance] = await Promise.all([
          getUSDTBalance(merchant.derived_wallet_address),
          getETHBalance(merchant.derived_wallet_address),
        ])
        return { ...merchant, usdtBalance, ethBalance }
      })
    )

    return NextResponse.json({ success: true, merchants: merchantsWithBalances })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to fetch merchants', details: errorMsg },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'create': {
        const { name, externalWalletAddress } = body
        if (!name) {
          return NextResponse.json({ error: 'Merchant name required' }, { status: 400 })
        }
        if (externalWalletAddress && !isValidAddress(externalWalletAddress)) {
          return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
        }
        const merchant = await createMerchant(name, externalWalletAddress || '')
        return NextResponse.json({ success: true, merchant })
      }

      case 'update': {
        const { merchantId, name, externalWalletAddress, isActive } = body
        if (!merchantId) {
          return NextResponse.json({ error: 'Merchant ID required' }, { status: 400 })
        }
        if (externalWalletAddress && !isValidAddress(externalWalletAddress)) {
          return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
        }
        const updates: Record<string, any> = {}
        if (name !== undefined) updates.name = name
        if (externalWalletAddress !== undefined)
          updates.external_wallet_address = externalWalletAddress
        if (isActive !== undefined) updates.is_active = isActive

        const merchant = await updateMerchant(merchantId, updates)
        if (!merchant) {
          return NextResponse.json({ error: 'Merchant not found' }, { status: 404 })
        }
        return NextResponse.json({ success: true, merchant })
      }

      case 'sweep': {
        const { merchantId } = body
        if (!merchantId) {
          return NextResponse.json({ error: 'Merchant ID required' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: merchant } = await supabase
          .from('merchants')
          .select('*')
          .eq('id', merchantId)
          .single()

        if (!merchant) {
          return NextResponse.json({ error: 'Merchant not found' }, { status: 404 })
        }

        if (!merchant.external_wallet_address) {
          return NextResponse.json(
            { error: 'Merchant has no external wallet address configured' },
            { status: 400 }
          )
        }

        // Check USDT balance
        const usdtBalance = await getUSDTBalance(merchant.derived_wallet_address)
        if (usdtBalance <= 0) {
          return NextResponse.json({ error: 'No USDT to sweep' }, { status: 400 })
        }

        // Check ETH for gas
        const ethBalance = await getETHBalance(merchant.derived_wallet_address)
        if (ethBalance < 0.0005) {
          const prefundResult = await prefundMerchantWallet(merchant.derived_wallet_address)
          if (!prefundResult) {
            return NextResponse.json(
              { error: 'Failed to prefund merchant wallet with ETH for gas' },
              { status: 500 }
            )
          }
          // Wait for the TRX transfer to confirm
          await new Promise((resolve) => setTimeout(resolve, 5000))
        }

        // Get merchant's private key
        const mnemonic = getMasterMnemonic()
        const merchantWallet = deriveMerchantWallet(mnemonic, merchant.derivation_index)

        // Sweep USDT to external wallet
        const sweepResult = await sweepUSDT(
          merchantWallet.privateKey,
          merchant.external_wallet_address
        )
        if (!sweepResult) {
          return NextResponse.json({ error: 'Failed to sweep USDT' }, { status: 500 })
        }

        return NextResponse.json({
          success: true,
          txid: sweepResult.txid,
          amountSwept: sweepResult.amountSwept,
          destination: merchant.external_wallet_address,
        })
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to process merchant action', details: errorMsg },
      { status: 500 }
    )
  }
}
