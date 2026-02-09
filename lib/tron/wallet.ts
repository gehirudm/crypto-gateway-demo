import { TronWeb } from 'tronweb'
import { HDKey } from '@scure/bip32'
import { mnemonicToSeedSync, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'

const TRON_RPC = process.env.TRON_RPC_URL || 'https://api.trongrid.io'
const TRON_API_KEY = process.env.TRON_API_KEY || ''
const USDT_CONTRACT = process.env.TRON_USDT_CONTRACT || 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

// Default prefund amount in TRX (enough for 2 USDT transfers + buffer)
const DEFAULT_PREFUND_TRX = 80
// Max fee limit per TRC20 transfer (in SUN) - 150 TRX
const FEE_LIMIT = 150_000_000
const SUN_PER_TRX = 1_000_000

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Create a TronWeb instance
 */
export function createTronWeb(privateKey?: string): InstanceType<typeof TronWeb> {
  const options: Record<string, any> = {
    fullHost: TRON_RPC,
  }

  if (TRON_API_KEY) {
    options.headers = { 'TRON-PRO-API-KEY': TRON_API_KEY }
  }

  if (privateKey) {
    options.privateKey = privateKey
  }

  return new TronWeb(options)
}

/**
 * Derive an invoice wallet from master mnemonic.
 * Uses BIP44 path: m/44'/195'/0'/0/{index}
 * Index 0 = gas wallet, Index 1+ = invoice wallets
 */
export function deriveInvoiceWallet(
  mnemonic: string,
  index: number
): { address: string; privateKey: string; derivationPath: string } {
  const seed = mnemonicToSeedSync(mnemonic)
  const hdKey = HDKey.fromMasterSeed(seed)
  const derivationPath = `m/44'/195'/0'/0/${index}`
  const child = hdKey.derive(derivationPath)

  if (!child.privateKey) {
    throw new Error(`Failed to derive private key at path ${derivationPath}`)
  }

  const privateKeyHex = bytesToHex(child.privateKey)
  const tronWeb = createTronWeb()
  const address = tronWeb.address.fromPrivateKey(privateKeyHex)
  if (!address) throw new Error(`Failed to derive address at path ${derivationPath}`)

  return { address: address as string, privateKey: privateKeyHex, derivationPath }
}

/**
 * Derive a merchant wallet from master mnemonic.
 * Uses BIP44 path: m/44'/195'/1'/0/{index}
 * Separate account (1) from invoice wallets (account 0)
 */
export function deriveMerchantWallet(
  mnemonic: string,
  index: number
): { address: string; privateKey: string; derivationPath: string } {
  const seed = mnemonicToSeedSync(mnemonic)
  const hdKey = HDKey.fromMasterSeed(seed)
  const derivationPath = `m/44'/195'/1'/0/${index}`
  const child = hdKey.derive(derivationPath)

  if (!child.privateKey) {
    throw new Error(`Failed to derive private key at path ${derivationPath}`)
  }

  const privateKeyHex = bytesToHex(child.privateKey)
  const tronWeb = createTronWeb()
  const address = tronWeb.address.fromPrivateKey(privateKeyHex)
  if (!address) throw new Error(`Failed to derive address at path ${derivationPath}`)

  return { address: address as string, privateKey: privateKeyHex, derivationPath }
}

/**
 * Get the gas wallet (invoice wallet at index 0)
 */
export function getGasWallet(): { address: string; privateKey: string } {
  const mnemonic = getMasterMnemonic()
  const wallet = deriveInvoiceWallet(mnemonic, 0)
  return { address: wallet.address, privateKey: wallet.privateKey }
}

/**
 * Get master mnemonic from environment
 */
export function getMasterMnemonic(): string {
  const mnemonic = process.env.TRON_MASTER_MNEMONIC
  if (!mnemonic) {
    throw new Error('TRON_MASTER_MNEMONIC not set in environment')
  }
  return mnemonic
}

/**
 * Get TRX balance of an address (in TRX)
 */
export async function getTRXBalance(address: string): Promise<number> {
  try {
    const tronWeb = createTronWeb()
    const balanceSun = await tronWeb.trx.getBalance(address)
    return Number(balanceSun) / SUN_PER_TRX
  } catch (error) {
    console.error('Error getting TRX balance:', error)
    return 0
  }
}

/**
 * Get USDT TRC20 balance of an address (in USDT, 6 decimals)
 */
export async function getUSDTBalance(address: string): Promise<number> {
  try {
    const tronWeb = createTronWeb()
    tronWeb.setAddress(address)
    const contract = await tronWeb.contract().at(USDT_CONTRACT)
    const balance = await contract.balanceOf(address).call()
    return Number(balance) / 1_000_000
  } catch (error) {
    console.error('Error getting USDT balance:', error)
    return 0
  }
}

/**
 * Send TRX from wallet to address
 */
export async function sendTRX(
  privateKey: string,
  to: string,
  amountTRX: number
): Promise<{ txid: string } | null> {
  try {
    const tronWeb = createTronWeb(privateKey)
    const amountSun = Math.floor(amountTRX * SUN_PER_TRX)

    console.log(`[TRON] Sending ${amountTRX} TRX (${amountSun} SUN) to ${to}`)

    const tx = await tronWeb.trx.sendTransaction(to, amountSun)

    if (tx.result) {
      console.log(`[TRON] TRX transfer successful: ${tx.txid}`)
      return { txid: tx.txid }
    } else {
      console.error('[TRON] TRX transfer failed:', tx)
      return null
    }
  } catch (error) {
    console.error('Error sending TRX:', error)
    return null
  }
}

/**
 * Send USDT TRC20 from wallet to address
 */
export async function sendUSDT(
  privateKey: string,
  to: string,
  amount: number
): Promise<{ txid: string } | null> {
  try {
    const tronWeb = createTronWeb(privateKey)
    const rawAmount = Math.floor(amount * 1_000_000)

    console.log(`[TRON] Sending ${amount} USDT (${rawAmount} raw) to ${to}`)

    const contract = await tronWeb.contract().at(USDT_CONTRACT)
    const txid = await contract.transfer(to, rawAmount).send({
      feeLimit: FEE_LIMIT,
      callValue: 0,
    })

    const txidStr = typeof txid === 'string' ? txid : String(txid)
    console.log(`[TRON] USDT transfer successful: ${txidStr}`)
    return { txid: txidStr }
  } catch (error) {
    console.error('Error sending USDT:', error)
    return null
  }
}

/**
 * Sweep all TRX from a wallet to destination
 */
export async function sweepTRX(
  privateKey: string,
  to: string
): Promise<{ txid: string; amountSwept: number } | null> {
  try {
    const tronWeb = createTronWeb(privateKey)
    const fromAddress = tronWeb.address.fromPrivateKey(privateKey)
    if (!fromAddress) throw new Error('Failed to derive address from private key')
    const balanceSun = await tronWeb.trx.getBalance(fromAddress as string)

    // TRX transfer bandwidth cost ~= 0.267 TRX; buffer: 1.5 TRX
    const feeSun = 1_500_000
    const sendAmountSun = Number(balanceSun) - feeSun

    if (sendAmountSun <= 0) {
      console.log('[TRON] Balance too low to sweep TRX')
      return null
    }

    const tx = await tronWeb.trx.sendTransaction(to, sendAmountSun)

    if (tx.result) {
      return { txid: tx.txid, amountSwept: sendAmountSun / SUN_PER_TRX }
    }

    return null
  } catch (error) {
    console.error('Error sweeping TRX:', error)
    return null
  }
}

/**
 * Sweep all USDT from a wallet to destination
 */
export async function sweepUSDT(
  privateKey: string,
  to: string
): Promise<{ txid: string; amountSwept: number } | null> {
  try {
    const tronWeb = createTronWeb(privateKey)
    const fromAddress = tronWeb.address.fromPrivateKey(privateKey)
    if (!fromAddress) throw new Error('Failed to derive address from private key')

    tronWeb.setAddress(fromAddress as string)
    const contract = await tronWeb.contract().at(USDT_CONTRACT)
    const rawBalance = await contract.balanceOf(fromAddress).call()
    const balance = Number(rawBalance)

    if (balance <= 0) {
      console.log('[TRON] No USDT balance to sweep')
      return null
    }

    const txid = await contract.transfer(to, balance).send({
      feeLimit: FEE_LIMIT,
      callValue: 0,
    })

    return {
      txid: typeof txid === 'string' ? txid : String(txid),
      amountSwept: balance / 1_000_000,
    }
  } catch (error) {
    console.error('Error sweeping USDT:', error)
    return null
  }
}

/**
 * Prefund an invoice wallet with TRX from the gas wallet.
 * Sends enough TRX to cover energy costs for USDT transfers.
 * @param invoiceAddress - Target invoice wallet
 * @param numTransfers - Number of USDT transfers expected (default 2: commission + merchant)
 */
export async function prefundInvoiceWallet(
  invoiceAddress: string,
  numTransfers: number = 2
): Promise<{ txid: string; amountSent: number } | null> {
  try {
    const gasWallet = getGasWallet()

    // ~40 TRX per USDT transfer (with buffer)
    const prefundAmount = DEFAULT_PREFUND_TRX * (numTransfers / 2)

    console.log(
      `[TRON:PREFUND] Sending ${prefundAmount} TRX to ${invoiceAddress} for ${numTransfers} USDT transfers`
    )

    const gasBalance = await getTRXBalance(gasWallet.address)
    const totalNeeded = prefundAmount + 2 // +2 TRX for the TRX transfer itself

    if (gasBalance < totalNeeded) {
      console.error(
        `[TRON:PREFUND] Gas wallet insufficient. Has: ${gasBalance} TRX, Needs: ${totalNeeded} TRX`
      )
      return null
    }

    const result = await sendTRX(gasWallet.privateKey, invoiceAddress, prefundAmount)

    if (result) {
      return { txid: result.txid, amountSent: prefundAmount }
    }

    return null
  } catch (error) {
    console.error('Error prefunding invoice wallet:', error)
    return null
  }
}

/**
 * Prefund a merchant wallet with TRX from the gas wallet (for sweeping)
 */
export async function prefundMerchantWallet(
  merchantAddress: string
): Promise<{ txid: string; amountSent: number } | null> {
  return prefundInvoiceWallet(merchantAddress, 1)
}

/**
 * Wait for a transaction to be confirmed on TRON
 */
export async function waitForConfirmation(
  txid: string,
  timeoutMs: number = 30000
): Promise<boolean> {
  const start = Date.now()
  const tronWeb = createTronWeb()

  while (Date.now() - start < timeoutMs) {
    try {
      const txInfo = await tronWeb.trx.getTransactionInfo(txid)
      if (txInfo && txInfo.id) {
        return true
      }
    } catch {
      // Transaction not yet confirmed
    }

    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  return false
}

/**
 * Validate if a string is a valid TRON address
 */
export function isValidTronAddress(address: string): boolean {
  try {
    const tronWeb = createTronWeb()
    return tronWeb.isAddress(address)
  } catch {
    return false
  }
}

/**
 * Validate mnemonic phrase
 */
export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic, wordlist)
}

/**
 * Get USDT contract address
 */
export function getUSDTContractAddress(): string {
  return USDT_CONTRACT
}
