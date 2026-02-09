import {
  JsonRpcProvider,
  Wallet,
  Contract,
  HDNodeWallet,
  Mnemonic,
  parseUnits,
  formatUnits,
  formatEther,
  parseEther,
  isAddress,
  getAddress,
} from 'ethers'

const RPC_URL = process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io'
const USDT_CONTRACT = getAddress(
  (process.env.OPTIMISM_USDT_CONTRACT || '0x94b008aa00579c1307b0ef2c499ad98a8ce58e68').toLowerCase()
)

// Minimal ERC20 ABI for balanceOf and transfer
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
]

/**
 * Get an ethers JSON-RPC provider for Optimism
 */
function getProvider(): JsonRpcProvider {
  return new JsonRpcProvider(RPC_URL)
}

/**
 * Get an ethers Wallet (signer) connected to the provider
 */
function getSigner(privateKey: string): Wallet {
  return new Wallet(privateKey, getProvider())
}

/**
 * Derive an invoice wallet from master mnemonic.
 * Uses BIP44 path: m/44'/60'/0'/0/{index}
 * Index 0 = gas wallet, Index 1+ = invoice wallets
 */
export function deriveInvoiceWallet(
  mnemonic: string,
  index: number
): { address: string; privateKey: string; derivationPath: string } {
  const derivationPath = `m/44'/60'/0'/0/${index}`
  const wallet = HDNodeWallet.fromPhrase(mnemonic, '', derivationPath)
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    derivationPath,
  }
}

/**
 * Derive a merchant wallet from master mnemonic.
 * Uses BIP44 path: m/44'/60'/1'/0/{index}
 * Separate account (1) from invoice wallets (account 0)
 */
export function deriveMerchantWallet(
  mnemonic: string,
  index: number
): { address: string; privateKey: string; derivationPath: string } {
  const derivationPath = `m/44'/60'/1'/0/${index}`
  const wallet = HDNodeWallet.fromPhrase(mnemonic, '', derivationPath)
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    derivationPath,
  }
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
  const mnemonic = process.env.MASTER_MNEMONIC
  if (!mnemonic) {
    throw new Error('MASTER_MNEMONIC not set in environment')
  }
  return mnemonic
}

/**
 * Get ETH balance of an address (in ETH)
 */
export async function getETHBalance(address: string): Promise<number> {
  try {
    const provider = getProvider()
    const balance = await provider.getBalance(address)
    return parseFloat(formatEther(balance))
  } catch (error) {
    console.error('Error getting ETH balance:', error)
    return 0
  }
}

/**
 * Get USDT ERC20 balance of an address (in USDT, 6 decimals)
 */
export async function getUSDTBalance(address: string): Promise<number> {
  try {
    const provider = getProvider()
    const contract = new Contract(USDT_CONTRACT, ERC20_ABI, provider)
    const balance = await contract.balanceOf(address)
    return parseFloat(formatUnits(balance, 6))
  } catch (error) {
    console.error('Error getting USDT balance:', error)
    return 0
  }
}

/**
 * Send ETH from wallet to address
 */
export async function sendETH(
  privateKey: string,
  to: string,
  amountETH: number
): Promise<{ txid: string } | null> {
  try {
    const signer = getSigner(privateKey)

    console.log(`[EVM] Sending ${amountETH} ETH to ${to}`)

    const tx = await signer.sendTransaction({
      to,
      value: parseEther(amountETH.toFixed(18)),
    })

    const receipt = await tx.wait()
    if (receipt && receipt.status === 1) {
      console.log(`[EVM] ETH transfer successful: ${tx.hash}`)
      return { txid: tx.hash }
    } else {
      console.error('[EVM] ETH transfer failed')
      return null
    }
  } catch (error) {
    console.error('Error sending ETH:', error)
    return null
  }
}

/**
 * Send USDT ERC20 from wallet to address
 */
export async function sendUSDT(
  privateKey: string,
  to: string,
  amount: number
): Promise<{ txid: string } | null> {
  try {
    const signer = getSigner(privateKey)
    const contract = new Contract(USDT_CONTRACT, ERC20_ABI, signer)
    const rawAmount = parseUnits(amount.toFixed(6), 6)

    console.log(`[EVM] Sending ${amount} USDT to ${to}`)

    const tx = await contract.transfer(to, rawAmount)
    const receipt = await tx.wait()

    if (receipt && receipt.status === 1) {
      console.log(`[EVM] USDT transfer successful: ${tx.hash}`)
      return { txid: tx.hash }
    } else {
      console.error('[EVM] USDT transfer failed')
      return null
    }
  } catch (error) {
    console.error('Error sending USDT:', error)
    return null
  }
}

/**
 * Sweep all ETH from a wallet to destination
 */
export async function sweepETH(
  privateKey: string,
  to: string
): Promise<{ txid: string; amountSwept: number } | null> {
  try {
    const signer = getSigner(privateKey)
    const balance = await signer.provider!.getBalance(signer.address)

    // Estimate gas cost for a simple ETH transfer
    const feeData = await signer.provider!.getFeeData()
    const gasLimit = 21000n
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || parseUnits('0.1', 'gwei')
    const gasCost = gasLimit * gasPrice

    const sendAmount = balance - gasCost
    if (sendAmount <= 0n) {
      console.log('[EVM] Balance too low to sweep ETH')
      return null
    }

    const tx = await signer.sendTransaction({
      to,
      value: sendAmount,
      gasLimit,
    })

    const receipt = await tx.wait()
    if (receipt && receipt.status === 1) {
      return { txid: tx.hash, amountSwept: parseFloat(formatEther(sendAmount)) }
    }

    return null
  } catch (error) {
    console.error('Error sweeping ETH:', error)
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
    const signer = getSigner(privateKey)
    const contract = new Contract(USDT_CONTRACT, ERC20_ABI, signer)
    const balance = await contract.balanceOf(signer.address)

    if (balance <= 0n) {
      console.log('[EVM] No USDT balance to sweep')
      return null
    }

    const tx = await contract.transfer(to, balance)
    const receipt = await tx.wait()

    if (receipt && receipt.status === 1) {
      return {
        txid: tx.hash,
        amountSwept: parseFloat(formatUnits(balance, 6)),
      }
    }

    return null
  } catch (error) {
    console.error('Error sweeping USDT:', error)
    return null
  }
}

/**
 * Prefund an invoice wallet with ETH from the gas wallet.
 * Estimates actual gas cost for USDT ERC20 transfers on Optimism, adds 25% buffer.
 * @param invoiceAddress - Target invoice wallet
 * @param numTransfers - Number of USDT transfers expected (default 2: commission + merchant)
 */
export async function prefundInvoiceWallet(
  invoiceAddress: string,
  numTransfers: number = 2
): Promise<{ txid: string; amountSent: number } | null> {
  try {
    const gasWallet = getGasWallet()
    const provider = getProvider()

    // Estimate gas for a single USDT ERC20 transfer
    const contract = new Contract(USDT_CONTRACT, ERC20_ABI, provider)
    let estimatedGasPerTransfer: bigint
    try {
      // Estimate gas for transfer(address, uint256) — use a dummy call
      estimatedGasPerTransfer = await contract.transfer.estimateGas(
        gasWallet.address, // dummy "to"
        1n,                // dummy amount (1 wei of USDT)
        { from: invoiceAddress }
      )
    } catch {
      // Fallback: typical ERC20 transfer on Optimism uses ~65,000 gas
      estimatedGasPerTransfer = 65000n
      console.log('[EVM:PREFUND] Gas estimate failed, using fallback 65000')
    }

    // Get current fee data
    const feeData = await provider.getFeeData()
    const maxFeePerGas = feeData.maxFeePerGas || feeData.gasPrice || parseUnits('0.1', 'gwei')

    // Total gas for all USDT transfers
    const totalGas = estimatedGasPerTransfer * BigInt(numTransfers)
    const totalGasCost = totalGas * maxFeePerGas

    // Add 25% buffer
    const withBuffer = totalGasCost * 125n / 100n
    const prefundAmount = parseFloat(formatEther(withBuffer))

    console.log(
      `[EVM:PREFUND] Estimated gas: ${estimatedGasPerTransfer} per transfer × ${numTransfers} = ${totalGas} total gas`
    )
    console.log(
      `[EVM:PREFUND] Fee: ${formatEther(maxFeePerGas)} ETH/gas → ${formatEther(totalGasCost)} ETH + 25% buffer = ${prefundAmount.toFixed(8)} ETH`
    )

    const gasBalance = await getETHBalance(gasWallet.address)
    // Need prefund amount + gas for the ETH transfer itself (~21000 gas)
    const ethTransferCost = parseFloat(formatEther(21000n * maxFeePerGas * 2n))
    const totalNeeded = prefundAmount + ethTransferCost

    if (gasBalance < totalNeeded) {
      console.error(
        `[EVM:PREFUND] Gas wallet insufficient. Has: ${gasBalance} ETH, Needs: ${totalNeeded.toFixed(8)} ETH`
      )
      return null
    }

    console.log(
      `[EVM:PREFUND] Sending ${prefundAmount.toFixed(8)} ETH to ${invoiceAddress} for ${numTransfers} USDT transfers`
    )

    const result = await sendETH(gasWallet.privateKey, invoiceAddress, prefundAmount)

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
 * Prefund a merchant wallet with ETH from the gas wallet (for sweeping)
 */
export async function prefundMerchantWallet(
  merchantAddress: string
): Promise<{ txid: string; amountSent: number } | null> {
  return prefundInvoiceWallet(merchantAddress, 1)
}

/**
 * Wait for a transaction to be confirmed on Optimism
 */
export async function waitForConfirmation(
  txHash: string,
  timeoutMs: number = 30000
): Promise<boolean> {
  try {
    const provider = getProvider()
    const receipt = await provider.waitForTransaction(txHash, 1, timeoutMs)
    return receipt !== null && receipt.status === 1
  } catch {
    return false
  }
}

/**
 * Validate if a string is a valid EVM address
 */
export function isValidAddress(address: string): boolean {
  return isAddress(address)
}

/**
 * Validate mnemonic phrase
 */
export function isValidMnemonic(mnemonic: string): boolean {
  try {
    Mnemonic.fromPhrase(mnemonic)
    return true
  } catch {
    return false
  }
}

/**
 * Get USDT contract address
 */
export function getUSDTContractAddress(): string {
  return USDT_CONTRACT
}
