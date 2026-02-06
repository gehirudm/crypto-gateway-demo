import { ethers } from 'ethers';

const OPTIMISM_RPC = 'https://mainnet.optimism.io';
const OPTIMISM_SEPOLIA_RPC = 'https://sepolia.optimism.io';

export const provider = new ethers.JsonRpcProvider(
  process.env.NEXT_PUBLIC_RPC_URL || OPTIMISM_SEPOLIA_RPC
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
  const hdNode = ethers.HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromPhrase(masterMnemonic)
  );

  const derivationPath = `m/44'/60'/0'/0/${index}`;
  const childNode = hdNode.derivePath(derivationPath);

  return {
    address: childNode.address,
    privateKey: childNode.privateKey,
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
 * Get USDT balance of an address
 * @param address - Ethereum address
 * @param contractAddress - USDT contract address on Optimism
 */
export async function getUSDTBalance(
  address: string,
  contractAddress: string
): Promise<string> {
  try {
    const abi = ['function balanceOf(address) public view returns (uint256)'];
    const contract = new ethers.Contract(contractAddress, abi, provider);
    const balance = await contract.balanceOf(address);
    return ethers.formatUnits(balance, 6); // USDT uses 6 decimals
  } catch (error) {
    console.error('Error getting USDT balance:', error);
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
    const gasPrice = await provider.getGasPrice();
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
  paymentMethod: 'ETH' | 'USDT',
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
    } else if (paymentMethod === 'USDT' && contractAddress) {
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
  paymentMethod: 'ETH' | 'USDT',
  contractAddress?: string
): Promise<string> {
  try {
    if (paymentMethod === 'ETH') {
      const gasEstimate = await provider.estimateGas({
        to,
        value: ethers.parseEther(amount),
      });
      return ethers.formatEther(gasEstimate);
    } else if (paymentMethod === 'USDT' && contractAddress) {
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
  currency: 'ETH' | 'USDT'
): Promise<number> {
  try {
    if (currency === 'ETH') {
      const balance = await getETHBalance(address);
      return parseFloat(balance);
    } else if (currency === 'USDT') {
      const contractAddress = process.env.NEXT_PUBLIC_USDT_CONTRACT_ADDRESS || '0x7F5c764cBc14f9669B88837ca1490cCa17c31607';
      const balance = await getUSDTBalance(address, contractAddress);
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
