# Step-by-Step Setup Guide (With Screenshots Description)

## Phase 1: Prepare Your Environment (5 minutes)

### Step 1.1: Create .env.local File
**What to do:**
- Create a file named `.env.local` in your project root
- Add these variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

MASTER_MNEMONIC=word1 word2 word3... (your 12 or 24 word seed phrase)

ADMIN_TOKEN=your_secret_admin_token_here

NEXT_PUBLIC_RPC_URL=https://mainnet.optimism.io
NEXT_PUBLIC_USDT_CONTRACT_ADDRESS=0x7F5c764cBc14f9669B88837ca1490cCa17c31607
```

**Where to find these:**
- `NEXT_PUBLIC_SUPABASE_URL` → Supabase Dashboard → Settings → General
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Supabase Dashboard → Settings → API
- `MASTER_MNEMONIC` → Generate with your preferred wallet tool
- `ADMIN_TOKEN` → Create any strong password/token

### Step 1.2: Install Dependencies
```bash
npm install
```

### Step 1.3: Start Dev Server
```bash
npm run dev
```

Browser should open to http://localhost:3000

---

## Phase 2: Setup Database (2 minutes) ⭐ CRITICAL

### Step 2.1: Open Supabase Dashboard
1. Go to https://supabase.com
2. Sign in to your project
3. Left sidebar → Click **"SQL Editor"**

### Step 2.2: Create First Table (admin_config)
1. Click **"New Query"** button (top right)
2. You'll see an empty SQL editor
3. Copy this SQL code:

```sql
CREATE TABLE IF NOT EXISTS admin_config (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  master_wallet_address TEXT NOT NULL,
  gas_wallet_address TEXT NOT NULL
);

ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_config_allow_all" ON admin_config 
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL PRIVILEGES ON admin_config TO authenticated;
GRANT SELECT ON admin_config TO anon;
```

4. Paste it into the editor
5. Click the **blue ▶ (Run)** button at bottom right
6. Wait for success message (green checkmark)

### Step 2.3: Create Second Table (invoices)
1. Click **"New Query"** again
2. Copy this SQL:

```sql
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  currency TEXT NOT NULL,
  amount_expected NUMERIC NOT NULL,
  wallet_address TEXT NOT NULL UNIQUE,
  derivation_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  current_balance NUMERIC DEFAULT 0,
  confirmation_count INTEGER DEFAULT 0,
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sweep_tx_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_wallet ON invoices(wallet_address);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_allow_all" ON invoices 
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL PRIVILEGES ON invoices TO authenticated;
GRANT SELECT ON invoices TO anon;
```

3. Paste into editor
4. Click **Run**
5. Wait for success (you should see 3 green checkmarks for the CREATE TABLE and two CREATE INDEX commands)

### Step 2.4: Verify Tables Were Created
1. Left sidebar → Click **"Table Editor"**
2. You should see in the list:
   - `admin_config`
   - `invoices`
3. Both should show 0 rows (they're empty, which is correct)

✅ **Database is now ready!**

---

## Phase 3: Configure Admin Panel (2 minutes)

### Step 3.1: Access Admin Panel
1. In your browser, go to: http://localhost:3000/admin
2. You should see a login screen

### Step 3.2: Enter Admin Token
1. Enter your admin token (the one you set in .env.local as `ADMIN_TOKEN`)
2. Click **"Login"**

### Step 3.3: Configure Master Wallet
1. You should see "Configuration" section
2. In the **"Master Wallet Address"** field, enter an Ethereum address
   - Example: `0x742d35Cc6634C0532925a3b844Bc234e4cC84fC1`
   - This is where your funds will be swept to
3. Click **"Save Configuration"**

✅ **You should see success message** (no more 500 errors!)

### Step 3.4: Note the Gas Wallet
1. Below the form, you'll see **"Gas Wallet Address"**
2. This is the address you need to fund with ETH for USDT fees
3. Copy this address (you'll need it later)

---

## Phase 4: Fund Your Gas Wallet (Optional but Recommended)

### For Testnet (Optimism Sepolia):
1. Get testnet ETH from a faucet
2. Send some ETH to the gas wallet address
3. You'll see the balance update in the admin panel

### For Mainnet (Optimism):
1. Send real ETH to the gas wallet address
2. This will be used for USDT transaction fees
3. Check balance in admin panel under "Gas Wallet Balance"

---

## Phase 5: Create Your First Invoice (3 minutes)

### Step 5.1: Go to Invoice Page
1. In browser, go to: http://localhost:3000/invoice
2. You should see a form

### Step 5.2: Create an Invoice
1. **Amount**: Enter a test amount (e.g., 0.001)
2. **Currency**: Choose "ETH" for your first test
3. Click **"Create Invoice"**

### Step 5.3: You'll See
- **Invoice ID**: Unique identifier for this payment
- **Wallet Address**: Where the user should send funds
- **Status**: "Pending" (waiting for payment)
- **Real-time Monitor**: Shows live updates

---

## Phase 6: Test a Payment (2 minutes)

### Option A: Using Testnet (Safe, Free)
1. Get testnet funds from Optimism Sepolia faucet
2. Send the exact amount to the invoice wallet address
3. Watch the real-time monitor update every 2 seconds
4. See confirmation count increase
5. Watch auto-sweep happen

### Option B: Using Mainnet (Real Money)
1. Use your wallet app (MetaMask, etc.)
2. Send exact amount to invoice wallet on Optimism
3. Wait for it to be detected
4. Watch it get swept to your master wallet

---

## Phase 7: Monitor in Admin Panel (Ongoing)

### Step 7.1: View All Invoices
1. Go to http://localhost:3000/admin
2. Login with your admin token
3. Click **"Transactions"** tab
4. See all invoices and their status

### Step 7.2: Check Transaction Details
- Click on any invoice to see:
  - Invoice wallet address
  - Expected amount
  - Current status
  - Confirmations
  - Sweep transaction hash (if completed)

---

## Common Issues & Quick Fixes

### Issue: "Unauthorized" on Admin Login
**Fix**: Make sure `ADMIN_TOKEN` in .env.local matches what you enter

### Issue: "Failed to save configuration"
**Fix**: Check that tables were created (go to Supabase Table Editor and verify)

### Issue: Invoice wallet doesn't receive funds
**Fix**: Make sure you're sending to the correct address and on Optimism network

### Issue: Funds not being swept
**Fix**: Check that gas wallet has ETH (for USDT) or master wallet is configured

---

## Success Checklist

- [ ] .env.local file created with all variables
- [ ] `npm install` completed
- [ ] `npm run dev` running
- [ ] admin_config table created in Supabase
- [ ] invoices table created in Supabase
- [ ] Tables visible in Supabase Table Editor
- [ ] Admin panel accessible at /admin
- [ ] Can login to admin panel with your token
- [ ] Can save master wallet address (no 500 error!)
- [ ] Gas wallet address is displayed
- [ ] Can create an invoice at /invoice
- [ ] Invoice shows pending status

✅ **All checked? You're ready to use the payment gateway!**

---

## What's Happening Behind the Scenes

### When You Create an Invoice:
1. App generates a unique wallet from your master mnemonic
2. Stores invoice info in `invoices` table
3. Shows wallet address to user
4. Starts polling for payments

### When User Sends Payment:
1. Frontend polls every 2 seconds
2. Checks wallet balance on Optimism
3. Detects payment when balance > 0
4. Waits for 1 confirmation

### When Payment Confirmed:
1. Backend gets gas wallet balance
2. For USDT: Sends ETH to invoice wallet (prefunding)
3. After prefund confirmed: Sweeps all funds to master wallet
4. Updates invoice status to "completed"

### Everything is Non-Custodial:
- User sends directly to invoice wallet
- Gateway never holds funds
- Only moves funds after confirmed payment
- All operations transparent on blockchain

---

## Next Steps

1. ✅ Complete all setup steps above
2. Test with testnet funds first
3. Review QUICK_REFERENCE.md for common tasks
4. Check TROUBLESHOOTING.md if issues arise
5. Read API_DOCUMENTATION.md if you want to build on top
6. Review ARCHITECTURE.md to understand the system

You're now ready to process payments! 🎉
