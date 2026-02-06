# Environment Variables Configuration

Copy this template to `.env.local` and fill in your values.

## Supabase Setup

Get these from your Supabase project settings:

```env
# Found in Project Settings > API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Blockchain Configuration

### For Optimism Mainnet (Production)
```env
# Use the official Optimism RPC endpoint
NEXT_PUBLIC_RPC_URL=https://mainnet.optimism.io

# Standard USDT contract on Optimism
NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=0x7F5c764cBc14f9669B88837ca1490cCa17c31607
```

### For Optimism Sepolia (Testing)
```env
# Use the testnet RPC endpoint
NEXT_PUBLIC_RPC_URL=https://sepolia.optimism.io

# USDT address is the same on testnet
NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=0x7F5c764cBc14f9669B88837ca1490cCa17c31607
```

## Master Mnemonic

Generate a new BIP-39 mnemonic or use an existing one:

```bash
# Generate a new mnemonic (if needed)
# You can use tools like:
# - https://iancoleman.io/bip39/ (for testing only, not secure for production)
# - MetaMask (create new wallet and export seed)
# - ethers.js: npx ts-node -e "console.log(require('ethers').Mnemonic.entropyToMnemonic(require('crypto').randomBytes(16)).phrase)"
```

Then set it in your environment:

```env
# 12-word or 24-word BIP-39 mnemonic phrase
# SECURITY: Never commit this to version control!
MASTER_MNEMONIC=abandon ability able about above absent absorb abstract abuse access accident account
```

## Admin Authentication

Create a secure token for admin panel access:

```bash
# Generate a random token
# Option 1: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Using openssl
openssl rand -hex 32

# Option 3: Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Then set it:

```env
# Generate this securely and keep it secret
ADMIN_TOKEN=your_randomly_generated_hex_token_here
```

## Complete Example

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Blockchain
NEXT_PUBLIC_RPC_URL=https://sepolia.optimism.io
NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=0x7F5c764cBc14f9669B88837ca1490cCa17c31607

# Master Mnemonic (KEEP SECURE!)
MASTER_MNEMONIC=abandon ability able about above absent absorb abstract abuse access accident account

# Admin Access
ADMIN_TOKEN=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

## Verification Steps

After setting up environment variables:

1. **Start the dev server**:
   ```bash
   npm run dev
   ```

2. **Test invoice creation**:
   - Navigate to http://localhost:3000/invoice
   - You should see the invoice form without errors

3. **Test admin access**:
   - Navigate to http://localhost:3000/admin
   - Enter your ADMIN_TOKEN
   - You should see the configuration form

4. **Check Supabase connection**:
   - The API should communicate with Supabase without CORS errors

## Security Best Practices

1. ✅ **Use `.env.local`**: This file is gitignored and won't be committed
2. ✅ **Never share your mnemonic**: Treat it like a password
3. ✅ **Use strong admin tokens**: Generate cryptographically random tokens
4. ✅ **Rotate tokens**: Change admin tokens periodically
5. ✅ **Use testnet first**: Test thoroughly before mainnet deployment
6. ✅ **Monitor gas wallet**: Keep sufficient ETH for USDT transactions

## Troubleshooting

### "NEXT_PUBLIC_SUPABASE_URL is not set"
- Ensure your `.env.local` file exists in the project root
- Check variable names are exactly as specified (they're case-sensitive)
- Restart the dev server after adding variables

### "Invalid mnemonic phrase"
- Ensure your mnemonic has exactly 12 or 24 words
- Words must be valid BIP-39 words
- Check for extra spaces or typos

### "RPC endpoint not responding"
- Verify the RPC URL is correct for your network
- Check your internet connection
- Try alternative RPC endpoints if primary is down

### "USDT contract not found"
- Verify you're using the correct contract address for your network
- Ensure you're on Optimism (not Ethereum mainnet)
