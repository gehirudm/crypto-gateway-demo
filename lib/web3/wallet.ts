import { ethers } from 'ethers';

const OPTIMISM_RPC = 'https://mainnet.optimism.io';
const OPTIMISM_SEPOLIA_RPC = 'https://sepolia.optimism.io';

export const provider = new ethers.JsonRpcProvider(
  process.env.NEXT_PUBLIC_RPC_URL || OPTIMISM_RPC
);

/**
 * Derives a child wallet from master mnemonic using BIP44 path
 * @param masterMnemonic - Master mnemonic phrase from environment
 * @param index - Derivation index for the invoice
 * @returns Wallet object with address and private key
 */
export function deriveWalletFromMnemonic(
  masterMnemonic: string,
  index: number
): { address: string; privateKey: string; derivationPath: string } {
  const mnemonic = ethers.Mnemonic.fromPhrase(masterMnemonic);
  const derivationPath = `m/44'/60'/0'/0/${index}`;
  const hdNode = ethers.HDNodeWallet.fromMnemonic(mnemonic, derivationPath);

  return {
    address: hdNode.address,
    privateKey: hdNode.privateKey,
    derivationPath,
  };
}

/**
 * Gets the master wallet address from master mnemonic
 */
export function getMasterWalletAddress(masterMnemonic: string): string {
  const hdNode = ethers.HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromPhrase(masterMnemonic)
  );
  return hdNode.address;
}

/**
 * Validate if a string is a valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

/**
 * Validate mnemonic phrase
 */
export function isValidMnemonic(mnemonic: string): boolean {
  try {
    ethers.Mnemonic.fromPhrase(mnemonic);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get ETH balance of an address
 */
export async function getETHBalance(address: string): Promise<string> {
  try {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (error) {
    console.error('Error getting ETH balance:', error);
    return '0';
  }
}

/**
 * Get USDC balance of an address
 * @param address - Ethereum address
 * @param contractAddress - USDC contract address on Optimism
 */
export async function getUSDCBalance(
  address: string,
  contractAddress: string
): Promise<string> {
  try {
    const abi = ['function balanceOf(address) public view returns (uint256)'];
    const contract = new ethers.Contract(contractAddress, abi, provider);
    const balance = await contract.balanceOf(address);
    return ethers.formatUnits(balance, 6); // USDC uses 6 decimals
  } catch (error) {
    console.error('Error getting USDC balance:', error);
    return '0';
  }
}

/**
 * Get network name
 */
export async function getNetworkName(): Promise<string> {
  try {
    const network = await provider.getNetwork();
    return network.name;
  } catch (error) {
    return 'Unknown';
  }
}

/**
 * Get current gas price
 */
export async function getGasPrice(): Promise<string> {
  try {
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(0);
    return ethers.formatUnits(gasPrice, 'gwei');
  } catch (error) {
    console.error('Error getting gas price:', error);
    return '0';
  }
}

/**
 * Get transaction details
 */
export async function getTransactionDetails(
  txHash: string
): Promise<ethers.TransactionResponse | null> {
  try {
    return await provider.getTransaction(txHash);
  } catch (error) {
    console.error('Error getting transaction details:', error);
    return null;
  }
}

/**
 * Get transaction receipt
 */
export async function getTransactionReceipt(
  txHash: string
): Promise<ethers.TransactionReceipt | null> {
  try {
    return await provider.getTransactionReceipt(txHash);
  } catch (error) {
    console.error('Error getting transaction receipt:', error);
    return null;
  }
}

/**
 * Send transaction (for sweeping funds)
 */
export async function sendTransaction(
  privateKey: string,
  to: string,
  amount: string,
  paymentMethod: 'ETH' | 'USDC',
  contractAddress?: string
): Promise<{ hash: string; wait: () => Promise<any> } | null> {
  try {
    const wallet = new ethers.Wallet(privateKey, provider);

    if (paymentMethod === 'ETH') {
      const tx = await wallet.sendTransaction({
        to,
        value: ethers.parseEther(amount),
      });
      return tx;
    } else if (paymentMethod === 'USDC' && contractAddress) {
      const abi = [
        'function transfer(address to, uint256 amount) public returns (bool)',
      ];
      const contract = new ethers.Contract(contractAddress, abi, wallet);
      const tx = await contract.transfer(to, ethers.parseUnits(amount, 6));
      return tx;
    }

    return null;
  } catch (error) {
    console.error('Error sending transaction:', error);
    return null;
  }
}

/**
 * Estimate gas for transfer
 */
export async function estimateGasForTransfer(
  to: string,
  amount: string,
  paymentMethod: 'ETH' | 'USDC',
  contractAddress?: string
): Promise<string> {
  try {
    if (paymentMethod === 'ETH') {
      const gasEstimate = await provider.estimateGas({
        to,
        value: ethers.parseEther(amount),
      });
      return ethers.formatEther(gasEstimate);
    } else if (paymentMethod === 'USDC' && contractAddress) {
      const abi = [
        'function transfer(address to, uint256 amount) public returns (bool)',
      ];
      const contract = new ethers.Contract(contractAddress, abi, provider);
      const gasEstimate = await contract.transfer.estimateGas(
        to,
        ethers.parseUnits(amount, 6)
      );
      return ethers.formatEther(gasEstimate);
    }

    return '0.01'; // Default estimate
  } catch (error) {
    console.error('Error estimating gas:', error);
    return '0.01';
  }
}

/**
 * Get block number
 */
export async function getBlockNumber(): Promise<number> {
  try {
    return await provider.getBlockNumber();
  } catch (error) {
    console.error('Error getting block number:', error);
    return 0;
  }
}

/**
 * Get wallet balance for any currency
 */
export async function getWalletBalance(
  address: string,
  currency: 'ETH' | 'USDC'
): Promise<number> {
  try {
    if (currency === 'ETH') {
      const balance = await getETHBalance(address);
      return parseFloat(balance);
    } else if (currency === 'USDC') {
      const contractAddress = process.env.NEXT_PUBLIC_USDC_CONTRACT_ADDRESS || '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85';
      const balance = await getUSDCBalance(address, contractAddress);
      return parseFloat(balance);
    }
    return 0;
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    return 0;
  }
}

/**
 * Get transaction count for an address
 */
export async function getTransactionCount(address: string): Promise<number> {
  try {
    const blockTag = 'latest';
    return await provider.getTransactionCount(address, blockTag);
  } catch (error) {
    console.error('Error getting transaction count:', error);
    return 0;
  }
}

/**
 * Sweep all ETH from a wallet to a destination address, accounting for gas fees
 * @param privateKey - Private key of the source wallet
 * @param toAddress - Destination address
 * @returns Transaction hash and amount swept, or null if failed
 */
export async function sweepETH(
  privateKey: string,
  toAddress: string
): Promise<{ hash: string; amountSwept: string; gasCost: string } | null> {
  try {
    const wallet = new ethers.Wallet(privateKey, provider);
    const balance = await provider.getBalance(wallet.address);
    
    if (balance === BigInt(0)) {
      console.log('No balance to sweep');
      return null;
    }

    // Get current gas price and estimate gas limit for a simple transfer (21000 gas)
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('0.001', 'gwei');
    const gasLimit = BigInt(21000);
    
    // Calculate base gas cost
    const baseGasCost = gasPrice * gasLimit;
    
    // Add 50% buffer to ensure we leave enough for the transaction even if gas price increases
    const gasCostWithBuffer = (baseGasCost * BigInt(150)) / BigInt(100);

    // Calculate amount to send (balance - buffered gas cost)
    const amountToSend = balance - gasCostWithBuffer;

    if (amountToSend <= BigInt(0)) {
      console.log('Balance too low to cover gas fees with buffer');
      return null;
    }

    // Send transaction using the base gas price (not buffered)
    // The buffer just ensures we don't try to send too much
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: amountToSend,
      gasLimit: gasLimit,
      gasPrice: gasPrice,
    });

    // Wait for confirmation
    await tx.wait();

    return {
      hash: tx.hash,
      amountSwept: ethers.formatEther(amountToSend),
      gasCost: ethers.formatEther(gasCostWithBuffer),
    };
  } catch (error) {
    console.error('Error sweeping ETH:', error);
    return null;
  }
}

/**
 * Get the private key for the gas wallet (index 0)
 */
export function getGasWalletPrivateKey(): string {
  const masterMnemonic = process.env.MASTER_MNEMONIC;
  if (!masterMnemonic) {
    throw new Error('Master mnemonic not configured');
  }
  const gasWallet = deriveWalletFromMnemonic(masterMnemonic, 0);
  return gasWallet.privateKey;
}

/**
 * Prefund an invoice wallet with ETH from the gas wallet for USDC transfer gas fees.
 * Estimates the gas needed for a USDC transfer and sends that amount (with 50% buffer) to the invoice wallet.
 * @param invoiceWalletAddress - The invoice wallet address to prefund
 * @returns Transaction hash and amount sent, or null if failed
 */
export async function prefundInvoiceWallet(
  invoiceWalletAddress: string
): Promise<{ hash: string; amountSent: string } | null> {
  try {
    const gasWalletPrivateKey = getGasWalletPrivateKey();
    const gasWallet = new ethers.Wallet(gasWalletPrivateKey, provider);

    // Estimate gas needed for a USDC transfer (ERC-20 transfer ~65000 gas)
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('0.001', 'gwei');
    const usdcTransferGasLimit = BigInt(65000);
    const usdcTransferCost = gasPrice * usdcTransferGasLimit;

    // Add 50% buffer to the gas cost
    const amountToSend = (usdcTransferCost * BigInt(150)) / BigInt(100);

    console.log(`[PREFUND] Estimated USDC transfer gas cost: ${ethers.formatEther(usdcTransferCost)} ETH`);
    console.log(`[PREFUND] Sending with 50% buffer: ${ethers.formatEther(amountToSend)} ETH`);

    // Check gas wallet balance
    const gasWalletBalance = await provider.getBalance(gasWallet.address);
    
    // We need amountToSend + gas to send this ETH transfer
    const ethTransferGasLimit = BigInt(21000);
    const ethTransferCost = gasPrice * ethTransferGasLimit;
    const totalNeeded = amountToSend + (ethTransferCost * BigInt(150)) / BigInt(100);

    if (gasWalletBalance < totalNeeded) {
      console.error(`[PREFUND] Gas wallet insufficient balance. Has: ${ethers.formatEther(gasWalletBalance)} ETH, Needs: ${ethers.formatEther(totalNeeded)} ETH`);
      return null;
    }

    // Send ETH from gas wallet to invoice wallet
    const tx = await gasWallet.sendTransaction({
      to: invoiceWalletAddress,
      value: amountToSend,
      gasLimit: ethTransferGasLimit,
      gasPrice: gasPrice,
    });

    // Wait for confirmation
    await tx.wait();

    console.log(`[PREFUND] Successfully prefunded ${invoiceWalletAddress} with ${ethers.formatEther(amountToSend)} ETH`);

    return {
      hash: tx.hash,
      amountSent: ethers.formatEther(amountToSend),
    };
  } catch (error) {
    console.error('Error prefunding invoice wallet:', error);
    return null;
  }
}

