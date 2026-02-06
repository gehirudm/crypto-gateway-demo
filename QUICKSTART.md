# Quick Start Guide

Get your crypto payment gateway running in 5 minutes!

## Step 1: Generate Your Master Mnemonic

Generate a new BIP-39 mnemonic phrase. For testing only, use:

```bash
node -e "const ethers = require('ethers'); console.log(ethers.Mnemonic.entropyToMnemonic(require('crypto').randomBytes(16)).phrase)"
```

Or import an existing wallet's seed phrase from MetaMask/other wallets.

## Step 2: Create Your Master Wallet Address

Use your master mnemonic to get the master wallet address:

```bash
node -e "
const ethers = require('ethers');
const mnemonic = 'your mnemonic here';
const hdNode = ethers.HDNodeWallet.fromMnemonic(
  ethers.Mnemonic.fromPhrase(mnemonic)
);
console.log('Master Wallet:', hdNode.address);
"
```

## Step 3: Configure Environment Variables

Create `.env.local` in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_RPC_URL=https://sepolia.optimism.io
NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=0x7F5c764cBc14f9669B88837ca1490cCa17c31607
MASTER_MNEMONIC=your_12_or_24_word_phrase
ADMIN_TOKEN=$(openssl rand -hex 16)
```

## Step 4: Setup Database

1. Go to your Supabase SQL Editor
2. Copy contents of `scripts/setup-database.sql`
3. Paste and execute
4. Tables are created!

## Step 5: Fund Your Wallets

### For Testing on Optimism Sepolia:

1. **Get testnet ETH**:
   - Visit https://sepoliafaucet.com or https://optimismfaucet.xyz
   - Paste your master wallet address
   - Request testnet ETH

2. **Get testnet USDT**:
   - Most faucets provide USDT alongside ETH
   - Or bridge from other testnet networks

### For Production:

1. Transfer real ETH and USDT to your master wallet on Optimism mainnet

## Step 6: Run the App

```bash
npm install
npm run dev
```

Visit http://localhost:3000

## Step 7: Configure Admin Panel

1. Go to http://localhost:3000/admin
2. Enter your ADMIN_TOKEN
3. Click "Sign In"
4. In Configuration tab:
   - Paste your master wallet address
   - Note the generated gas wallet address
   - Fund gas wallet with ETH (0.1+ recommended)

## Step 8: Create Your First Invoice

1. Go to http://localhost:3000/invoice
2. Enter amount (e.g., 0.01 ETH)
3. Select currency (ETH or USDT)
4. Click "Create Invoice"
5. You'll get a unique wallet address to send payment to
6. Send the exact amount from another wallet
7. Watch the magic happen - real-time updates show:
   - Payment received
   - Confirmations increasing
   - Automatic sweeping to master wallet
   - Completion!

## Testing Flow

### Test ETH Payment:
1. Create invoice for 0.01 ETH
2. Send 0.01 ETH from test wallet to invoice address
3. Watch balance update in real-time
4. See automatic sweep to master wallet

### Test USDT Payment:
1. Create invoice for 10 USDT
2. Send 10 USDT from test wallet to invoice address
3. Gateway automatically:
   - Detects USDT received
   - Prefunds gas from gas wallet
   - Sweeps USDT to master wallet
4. Done!

## Admin Dashboard Features

### Configuration Tab
- View gateway status
- Set master wallet address
- Monitor gas wallet balance
- See all configurations

### Transactions Tab
- List all invoices
- Filter by status (pending, received, sweeping, completed)
- View payment progress bars
- See transaction hashes
- Monitor confirmation counts

## Useful Commands

```bash
# Check master wallet balance
node -e "
const ethers = require('ethers');
const provider = new ethers.JsonRpcProvider('https://sepolia.optimism.io');
const masterAddr = 'your_address_here';
provider.getBalance(masterAddr).then(b => console.log(ethers.formatEther(b), 'ETH'));
"

# Check USDT balance
node -e "
const ethers = require('ethers');
const provider = new ethers.JsonRpcProvider('https://sepolia.optimism.io');
const abi = ['function balanceOf(address) view returns (uint256)'];
const contract = new ethers.Contract('0x7F5c764cBc14f9669B88837ca1490cCa17c31607', abi, provider);
contract.balanceOf('your_address_here').then(b => console.log(ethers.formatUnits(b, 6), 'USDT'));
"

# Deploy to Vercel
vercel

# View logs
vercel logs
```

## Next Steps

### Before Production:
1. Switch RPC_URL to mainnet: `https://mainnet.optimism.io`
2. Use real ETH and USDT (not testnet)
3. Generate secure admin token
4. Fund master wallet with production funds
5. Fund gas wallet with enough ETH (0.5-1 ETH recommended)
6. Test thoroughly with small amounts

### Customize:
1. Update branding (logo, colors, text)
2. Add custom domain
3. Integrate with your backend
4. Add email notifications
5. Implement webhook notifications

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Gateway not configured" | Set MASTER_MNEMONIC in env vars and restart |
| "Master wallet address required" | Log into admin and set your wallet address |
| Balance stays at 0 | Check invoice wallet, send correct amount to correct address |
| USDT sweep fails | Ensure gas wallet has >= 0.005 ETH |
| Admin login fails | Verify ADMIN_TOKEN matches what you set |

## Support

For detailed setup: See `SETUP.md`
For environment variables: See `ENV_EXAMPLE.md`
For API documentation: Check route files in `app/api/`

## Security Reminders

- Never commit `.env.local`
- Never share your MASTER_MNEMONIC
- Rotate ADMIN_TOKEN periodically
- Monitor gas wallet balance
- Test extensively before production
