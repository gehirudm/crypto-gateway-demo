# Optimism USDT ERC20 Recovery & Sweep Tool

Emergency recovery tool to manually sweep funds from invoice and merchant wallets on the Optimism (L2) network.

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Ensure your `.env` file in the project root contains:
   - `MASTER_MNEMONIC` - The BIP39 mnemonic phrase for HD wallet derivation
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database access
   - `OPTIMISM_USDT_CONTRACT` - USDT ERC20 contract address (optional, defaults to `0x94b008aA00579c1307B0EF2c499aD98a8ce58e68`)
   - `OPTIMISM_RPC_URL` - Optimism RPC URL (optional, defaults to `https://mainnet.optimism.io`)

3. The script will automatically load environment variables from the `.env` file.

## Usage

### Recovery & Sweep Tool (check_and_sweep.py)

Run the interactive tool:
```bash
python check_and_sweep.py
```

The interactive menu provides:
1. **Check gas wallet status** - View ETH balance of the gas wallet (derivation index 0)
2. **List recent invoices** - Show all invoices with status and balances
3. **List merchants & balances** - Show all merchants with USDT/ETH balances
4. **Sweep all pending invoices** - Auto-sweep paid invoices (commission + merchant split)
5. **Sweep merchant to external** - Move USDT from merchant derived wallet to external wallet
6. **Prefund a wallet** - Send ETH from gas wallet to any address for gas
7. **Check invoice wallet** - Look up balance by derivation index

### Simple Payment Demo (payment.py)

A standalone ETH payment flow (create invoice, wait for payment, sweep):
```bash
python payment.py
```

## Wallet Derivation

| Wallet Type | BIP44 Path | Notes |
|---|---|---|
| Gas Wallet | `m/44'/60'/0'/0/0` | Holds ETH for gas, funds invoice wallets |
| Invoice Wallets | `m/44'/60'/0'/0/{index}` | Index 1+ for each invoice |
| Merchant Wallets | `m/44'/60'/1'/0/{index}` | Separate account path for merchants |

## Features

- ✅ HD wallet derivation from mnemonic (BIP44, EVM coin type 60)
- ✅ USDT ERC20 balance checking and transfers
- ✅ ETH balance checking and transfers
- ✅ Invoice sweep with commission split (USDT → commission to master + remainder to merchant)
- ✅ Merchant sweep to external wallet
- ✅ Auto-prefunding with ETH for gas
- ✅ Interactive menu for manual operations
- ✅ Supabase database integration
- ✅ EIP-1559 transaction support (Optimism L2)

## Important Notes

- **Gas**: Optimism L2 has very low gas fees. ~0.002 ETH is enough for multiple ERC20 transfers.
- **USDT Contract**: Uses the official Optimism USDT contract (`0x94b008aA00579c1307B0EF2c499aD98a8ce58e68`), 6 decimals.
- **Explorer**: View transactions at `https://optimistic.etherscan.io/`
- **Safety**: All sweep operations show details before execution. Invoice status is only updated after successful confirmation.

## Troubleshooting

**"MASTER_MNEMONIC not set"**
- Ensure your `.env` file contains the `MASTER_MNEMONIC` variable

**"SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"**
- Check that both Supabase environment variables are set in `.env`

**Gas wallet LOW warning**
- The gas wallet (index 0) needs ETH to prefund invoice wallets
- Send a small amount of ETH on Optimism to the gas wallet address

**Connection errors**
- Verify your RPC URL is correct and accessible
- Default: `https://mainnet.optimism.io`
- Alternative: Use Alchemy, Infura, or another Optimism RPC provider
