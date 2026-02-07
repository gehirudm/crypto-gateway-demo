/**
 * Get current ETH price in USD using CoinGecko API
 */
export async function getETHPrice(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      { next: { revalidate: 60 } } // Cache for 60 seconds
    )
    
    if (!response.ok) {
      throw new Error('Failed to fetch ETH price')
    }
    
    const data = await response.json()
    return data.ethereum?.usd || 0
  } catch (error) {
    console.error('Error fetching ETH price:', error)
    // Return fallback price if API fails
    return 2500 // Fallback approximate ETH price
  }
}

/**
 * Calculate USD equivalent for crypto amount
 * @param amount - Amount in crypto
 * @param currency - ETH or USDC
 * @param ethPrice - Current ETH price in USD
 */
export function calculateUSDValue(
  amount: number,
  currency: 'ETH' | 'USDC',
  ethPrice: number
): number {
  if (currency === 'USDC') {
    return amount // USDC is pegged 1:1 to USD
  }
  return amount * ethPrice
}
