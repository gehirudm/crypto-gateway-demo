# Quick Reference Card

## Database Setup (Most Important First!)

### ⚡ Fastest Way (2 minutes)
1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Copy SQL from **MANUAL_DB_SETUP.md** 
4. Run it - Done! ✅

### Alternative: In-App Setup Wizard
```bash
npm run dev
# Visit http://localhost:3000/setup
```

---

## Environment Variables (.env.local)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key

# Web3
MASTER_MNEMONIC="your seed phrase here"

# Admin Access
ADMIN_TOKEN=your_secret_token

# Optional (defaults work)
NEXT_PUBLIC_RPC_URL=https://mainnet.optimism.io
NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=0x7F5c764cBc14f9669B88837ca1490cCa17c31607
```

---

## File Structure Quick Guide

```
app/
  ├── page.tsx              # Homepage
  ├── admin/page.tsx        # Admin dashboard
  ├── invoice/page.tsx      # Create invoices
  ├── setup/page.tsx        # Database setup wizard
  └── api/
      ├── admin/config/     # Config saving
      ├── invoices/create/  # Create invoice
      ├── invoices/poll/    # Check payment status
      └── init-tables/      # Initialize DB

components/
  ├── AdminConfig.tsx       # Master wallet config
  ├── AdminTransactions.tsx # Transaction history
  └── InvoicePaymentMonitor.tsx # Payment status

lib/
  ├── web3/wallet.ts       # Wallet operations
  ├── db/invoices.ts       # Invoice functions
  └── db/admin.ts          # Admin functions
```

---

## Common Tasks

### 1. Create an Invoice
**URL**: `/invoice`
1. Enter amount in ETH or USDT
2. Choose currency
3. Click "Create Invoice"
4. Get wallet address to send funds to

### 2. Monitor Payment
**Real-time on invoice page**
- Shows wallet address to send to
- Live balance updates every 2 seconds
- Shows confirmation count
- Auto-completes when received

### 3. Access Admin Panel
**URL**: `/admin`
1. Enter your admin token (from ADMIN_TOKEN env var)
2. Configure master wallet address
3. View gas wallet balance
4. See all transactions

### 4. Check Transaction History
**In Admin Panel**
- Click "Transactions" tab
- See all invoices and their status
- View sweep transaction hashes

---

## Typical Workflow

```
1. Configure Admin Panel
   └─ Set master wallet address
   └─ See generated gas wallet
   
2. Fund Gas Wallet
   └─ Send some ETH to gas wallet address
   └─ Used for USDT transaction fees
   
3. Create Invoice
   └─ Choose ETH or USDT
   └─ Enter amount
   
4. User Pays Invoice
   └─ Sends funds to invoice wallet
   
5. Monitor Payment
   └─ System polls every 2 seconds
   └─ Detects deposit automatically
   
6. Auto-Sweep
   └─ If USDT: Prefund with ETH
   └─ Send all funds to master wallet
   └─ Invoice marked complete
```

---

## Important URLs

| Page | URL | Purpose |
|------|-----|---------|
| Home | `/` | Landing page |
| Create Invoice | `/invoice` | Create new payment invoice |
| Admin Panel | `/admin` | Configure & monitor |
| Setup | `/setup` | Database initialization |

---

## Environment Variables Reference

| Variable | Required | Purpose |
|----------|----------|---------|
| `MASTER_MNEMONIC` | YES | BIP-39 seed phrase for wallet derivation |
| `ADMIN_TOKEN` | YES | Secret token for admin access |
| `NEXT_PUBLIC_SUPABASE_URL` | YES | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | YES | Supabase anonymous key |
| `NEXT_PUBLIC_RPC_URL` | NO | Optimism RPC (has default) |
| `NEXT_PUBLIC_USDT_CONTRACT_ADDRESS` | NO | USDT contract (has default) |

---

## Troubleshooting Quick Links

| Issue | Link |
|-------|------|
| Database won't initialize | MANUAL_DB_SETUP.md |
| Can't save config | TROUBLESHOOTING.md |
| API errors | API_DOCUMENTATION.md |
| Questions about system | ARCHITECTURE.md |
| Full setup details | SETUP.md |

---

## Key Concepts

### Invoice Wallet
- Unique wallet address for each payment
- Derived from master mnemonic using BIP-44
- User sends funds directly to this address
- Never stored anywhere - generated on demand

### Master Wallet
- Your main wallet where all funds end up
- Configure in admin panel
- Gateway sweeps invoice wallets to here
- Never touches your private keys

### Gas Wallet
- Derived from master mnemonic at index 0
- Used to prefund USDT invoice wallets
- Top it up with ETH for transaction fees
- Shows balance in admin panel

### Polling System
- Every 2 seconds, checks invoice wallet balance
- Detects when payment is received
- Waits for 1 confirmation
- Then sweeps funds automatically

---

## Debug Tips

### See What's Happening
```bash
# Open browser console
# Look for messages like:
[v0] User data received: ...
[v0] Payment detected: ...
[v0] Sweeping invoice: ...
```

### Test with Testnet
- Use Optimism Sepolia RPC
- Get free testnet ETH from faucet
- Create invoices with test amounts
- Test full payment flow risk-free

### Check Supabase
- Dashboard → Table Editor
- See `admin_config` and `invoices` tables
- View all stored data
- Check Row Level Security policies

---

## Next Steps

1. **Right now**: Copy SQL from MANUAL_DB_SETUP.md and run it
2. **Then**: Set up .env.local with your values
3. **Then**: `npm run dev`
4. **Then**: Go to /admin and configure master wallet
5. **Then**: Go to /invoice and test creating a payment

**You're ready to go!** 🎉
