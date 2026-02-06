# Crypto Payment Gateway - Setup Guide

This is a sophisticated cryptocurrency payment gateway demonstrating ETH and USDT payment processing on the Optimism network with automatic invoice wallet generation, real-time balance monitoring, and smart fund sweeping.

## Prerequisites

- Node.js 18+
- A Supabase project (Database & Auth configured)
- An Optimism wallet for testing
- A master BIP-44 mnemonic phrase for HD wallet derivation

## Environment Variables

You must set the following environment variables in your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Master Mnemonic (NEVER expose this in frontend code)
# This is loaded securely on the server-side only
MASTER_MNEMONIC="your bip-44 mnemonic phrase here"

# Network Configuration
NEXT_PUBLIC_RPC_URL=https://mainnet.optimism.io
# Or for testnet:
# NEXT_PUBLIC_RPC_URL=https://sepolia.optimism.io

# USDT Contract Address on Optimism
NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=0x7F5c764cBc14f9669B88837ca1490cCa17c31607

# Admin Authentication
ADMIN_TOKEN=your_secure_admin_token_here
```

## Database Setup

1. Run the migration script to create tables:

```bash
# The script is located at: scripts/setup-database.sql
# Copy the SQL and run it in your Supabase SQL editor
```

2. The following tables will be created:
   - `admin_config` - Gateway configuration and wallet addresses
   - `invoices` - Invoice records with payment status and wallet tracking

## Key Features

### 1. **Non-Custodial Invoice Wallets**
- Each invoice generates a unique wallet address derived from your master mnemonic using BIP-44 path `m/44'/60'/0'/0/{index}`
- Funds are never held by the gateway - only in the user's invoice wallet
- Only the master mnemonic is sensitive; invoice private keys are derived on-the-fly

### 2. **Dual Currency Support**
- **ETH**: Native Optimism ETH, no gas prefunding needed
- **USDT**: OETH requires gas prefunding after payment received

### 3. **Real-time Payment Monitoring**
- Client-side polling system (2-second intervals) checks invoice wallet balance
- Automatic status transitions: pending → received → prefunding/sweeping → completed
- Transaction confirmation tracking

### 4. **Automatic Fund Sweeping**
- After payment confirmation, funds are automatically swept to master wallet
- For USDT: Gas is automatically prefunded from the gas wallet before sweep
- No manual intervention required

### 5. **Admin Panel**
- **Configuration**: Set master wallet address and view gas wallet details
- **Transactions**: View all invoices, their status, balances, and transaction history
- **Security**: Admin token authentication for access

## Usage

### For Customers (Payment)

1. Navigate to `/invoice`
2. Select currency (ETH or USDT) and enter amount
3. Click "Create Invoice" to generate a unique payment wallet
4. Send the exact amount to the invoice wallet address
5. Monitor payment progress with real-time status updates
6. See the magic happen: funds are automatically swept once confirmed!

### For Admins

1. Navigate to `/admin`
2. Enter your admin token to authenticate
3. **Configuration Tab**:
   - Set your master wallet address (where funds will be swept to)
   - View the gas wallet address (fund this with ETH for USDT prefunding)
   - Monitor gas wallet balance
4. **Transactions Tab**:
   - View all invoices with their payment status
   - Monitor transaction confirmations
   - Track sweep transactions

## Architecture

### Client-Side
- Pure client-side invoice creation and polling
- No private keys handled on frontend
- Real-time balance and confirmation monitoring
- Status timeline tracking

### Server-Side (API Routes)
- `/api/invoices/create` - Create new invoice with derived wallet
- `/api/invoices/poll` - Check invoice balance and trigger sweeping
- `/admin/config` - Manage gateway configuration
- `/admin/transactions` - Fetch all invoices and transactions

### Security Model
1. **Master Mnemonic**: Stored only in environment variables, never sent to frontend
2. **Invoice Keys**: Derived on-the-fly from master mnemonic during sweep operations
3. **Admin Access**: Token-based authentication for admin operations
4. **No Fund Custody**: The gateway never holds user funds

## Testing on Testnet

To test on Optimism Sepolia:

```env
NEXT_PUBLIC_RPC_URL=https://sepolia.optimism.io
```

Then use testnet ETH/USDT:
- Get testnet ETH from Optimism Sepolia faucets
- USDT contract on testnet: `0x7F5c764cBc14f9669B88837ca1490cCa17c31607` (same address works)

## Wallet Generation

The gateway uses BIP-44 HD wallet derivation:

```
Master Seed (from MASTER_MNEMONIC)
    └── m/44'/60'/0'/0/0 → Gas Wallet (for USDT prefunding)
    └── m/44'/60'/0'/0/1 → Invoice 1
    └── m/44'/60'/0'/0/2 → Invoice 2
    └── m/44'/60'/0'/0/n → Invoice N
```

Each invoice gets a unique, deterministic wallet address that you can always regenerate if needed.

## Payment Flow

### ETH Payment Flow
1. User sends ETH to invoice wallet
2. Client polls every 2 seconds
3. Once payment confirmed, sweep transaction initiates immediately
4. Funds arrive at master wallet
5. Status changes to "Completed"

### USDT Payment Flow
1. User sends USDT to invoice wallet
2. Client polls every 2 seconds
3. Once USDT received, status changes to "Prefunding"
4. Server sends gas (ETH) from gas wallet to invoice wallet
5. Once gas confirmed, "Sweeping" status begins
6. All USDT transferred to master wallet
7. Status changes to "Completed"

## Important Notes

⚠️ **Security Warnings**:
- NEVER share your master mnemonic
- NEVER commit `.env.local` to version control
- Use strong admin tokens
- Test thoroughly on testnet before mainnet

⚠️ **Gas Wallet**:
- Must have sufficient ETH for USDT gas fees
- Monitor gas wallet balance in admin panel
- Add more ETH when balance drops below 0.1 ETH

⚠️ **Invoice Expiry**:
- Invoices have a 10-minute default timeout
- After expiry, wallets can still receive funds but won't be automatically swept

## Troubleshooting

**"Gateway not configured: Master mnemonic missing"**
- Ensure `MASTER_MNEMONIC` is set in environment variables
- Restart the dev server after adding the variable

**"Master wallet address required"**
- Log into admin panel and set your master wallet address
- This is required before the gateway can sweep funds

**"Polling shows 0 balance but I sent funds"**
- Check the invoice wallet address is correct
- Confirm the transaction was sent on Optimism (not wrong network)
- May take a few blocks for visibility

**Gas wallet balance too low**
- Send ETH to the gas wallet address shown in admin panel
- Wait for confirmation before attempting USDT payments

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Deployment

This app is designed for Vercel deployment:

1. Connect your GitHub repository
2. Set environment variables in Vercel project settings
3. Deploy - the app will auto-build and deploy

The serverless architecture with polling-based status checks ensures it works perfectly in a stateless environment.
