# TRON USDT Recovery & Sweep Tool

Emergency recovery tool to manually sweep funds from invoice and merchant wallets on the TRON network.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure your `.env` file in the project root contains:
   - `TRON_MASTER_MNEMONIC` - The mnemonic phrase for TRON wallet derivation
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
   - `TRON_USDT_CONTRACT` - USDT TRC20 contract address (optional, defaults to mainnet)
   - `TRON_RPC_URL` - TronGrid API URL (optional, defaults to https://api.trongrid.io)
   - `TRON_API_KEY` - TronGrid API key (optional)

3. The script will automatically load environment variables from the `.env` file.

## Usage

Run the script:
```bash
python check_and_sweep.py
```

The interactive menu provides:
1. **Check gas wallet status** - View TRX balance of the gas wallet (derivation index 0)
2. **List recent invoices** - Show all invoices with status and balances
3. **List merchants & balances** - Show all merchants with USDT/TRX balances
4. **Sweep all pending invoices** - Auto-sweep paid invoices (commission + merchant split)
5. **Sweep merchant to external** - Move USDT from merchant derived wallet to external wallet
6. **Prefund a wallet** - Send TRX from gas wallet to any address
7. **Check invoice wallet** - Look up balance by derivation index
3. Ask you to select an invoice by ID (you can use the first 8 characters)
4. Monitor the wallet for payment (for ETH) or ask for manual verification (for USDC)
5. Sweep the funds to the master wallet address configured in the database
6. Wait for confirmations
7. Update the invoice status to "completed" in the database

## Features

- ✅ Reads invoices directly from Supabase
- ✅ Fetches master wallet address from admin config
- ✅ Supports ETH sweeping with proper gas calculation
- ✅ Interactive invoice selection
- ✅ Real-time balance monitoring
- ✅ Automatic status updates in database
- ⚠️  USDC sweeping requires manual implementation

## Important Notes

- **ETH Sweeping**: Fully supported. The script calculates gas costs and sends the maximum possible amount.
- **USDC Sweeping**: Not fully implemented. You'll need to manually verify USDC balances and implement ERC-20 transfer logic if needed.
- **Gas Buffer**: Uses 1.5x gas price multiplier to ensure transactions go through even with price fluctuations.
- **Confirmations**: Waits for 6 confirmations before marking the sweep as complete.

## Safety

- The script requires manual confirmation before sweeping
- All transaction details are displayed before execution
- Invoice status is only updated after successful confirmation
- Uses the same mnemonic and derivation paths as the main application

## Troubleshooting

**"MASTER_MNEMONIC not set"**
- Ensure your `.env` file contains the `MASTER_MNEMONIC` variable

**"SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"**
- Check that both Supabase environment variables are set in `.env`

**"Not enough ETH to cover gas"**
- The invoice wallet doesn't have enough ETH to pay for the transaction gas
- You'll need to send a small amount of ETH to the invoice wallet first

**Connection errors**
- Verify your RPC URL is correct and accessible
- Check your internet connection
- Try using a different RPC endpoint

## Example Output

```
🔧 Crypto Gateway Recovery Tool
================================

Master Wallet: 0x1234...5678

=== AVAILABLE INVOICES ===

Invoice ID: abc12345...
  Full ID: abc12345-6789-...
  Address: 0x9876...4321
  Currency: ETH
  Expected: 0.001 ETH
  Current Balance: 0.0015 ETH
  Status: pending
  Derivation Index: 1
  Created: 2026-02-07T10:30:00.000Z

Enter Invoice ID (full or first 8 chars) to monitor and sweep: abc12345

🔍 Selected Invoice ID: abc12345-6789-...
📍 Address: 0x9876...4321
💰 Currency: ETH
📊 Expected: 0.001 ETH
Current balance: 0.0015 ETH
✅ Wallet already has sufficient funds!
Proceeding to sweep...

💸 Sweeping ETH...
  Balance: 0.0015 ETH
  Gas cost (with buffer): 0.000063 ETH
  Net amount: 0.001437 ETH
📤 Sweep transaction sent: 0xabcd...
⏳ Waiting for confirmations...
Confirmations: 6/6
✅ Sweep confirmed with 6 confirmations

✅ SWEEP COMPLETE
💰 Funds transferred to: 0x1234...5678
🔗 Transaction: 0xabcd...
```
