# Manual Database Setup Guide

If the automated database setup doesn't work, follow these steps to manually create the required tables in Supabase.

## Option 1: Using Supabase Dashboard (Easiest)

### Step 1: Go to SQL Editor
1. Open your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"

### Step 2: Create Admin Config Table
Copy and paste this SQL into the editor:

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

Then click "Run" (the play button)

### Step 3: Create Invoices Table
Create a new query and paste this:

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

Click "Run"

### Step 4: Verify Tables
1. Click on "Table Editor" in the left sidebar
2. You should see both `admin_config` and `invoices` tables listed
3. Both tables should be empty initially

## Option 2: Using the Setup Wizard (In-App)

1. Start your dev server: `npm run dev`
2. Visit: `http://localhost:3000/setup`
3. Click "Initialize Database"
4. The wizard will attempt to create all tables automatically

## Option 3: Manual API Initialization

Once you have the dev server running:

```bash
# Initialize tables via API
curl -X POST http://localhost:3000/api/init-tables \
  -H "Content-Type: application/json"
```

## Verify Setup

After creating the tables, verify they're set up correctly:

### From Supabase Dashboard:
1. Go to "Table Editor"
2. Click on `admin_config` - should see the table structure
3. Click on `invoices` - should see the table structure

### From the App:
1. Go to http://localhost:3000/admin
2. You should be able to enter your master wallet address
3. Should be able to save the configuration without errors

## If You Get Errors

### "Table already exists"
- This is normal if you ran the setup multiple times
- The tables are already created, proceed to the next step

### "Permission denied"
- Ensure your Supabase user has permission to create tables
- Use the service role key if available

### "Column ... does not exist"
- The table structure may be incomplete
- Delete the table and recreate it following the SQL above exactly

## Troubleshooting

### Tables not showing in Table Editor
- Refresh the page
- Log out and log back in to Supabase dashboard
- Check that you're in the correct project and schema (public)

### Can't connect to Supabase
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
- Make sure Supabase project is active

### API returns 500 error when saving config
- Check browser console for detailed error messages
- Verify tables were created successfully
- Ensure RLS policies are enabled

## Next Steps

After successfully creating the tables:

1. Visit `/admin`
2. Enter your **Master Wallet Address** (Ethereum address)
3. Click "Save Configuration"
4. The system will automatically generate a gas wallet address
5. Fund the gas wallet with some ETH for USDT transaction fees
6. You're ready to create invoices!

## Table Structure Reference

### admin_config
- `id` (TEXT PRIMARY KEY) - Always 'default'
- `created_at` (TIMESTAMP) - When record was created
- `updated_at` (TIMESTAMP) - When record was last updated
- `master_wallet_address` (TEXT) - Your main wallet address
- `gas_wallet_address` (TEXT) - Derived wallet for gas prefunding

### invoices
- `id` (UUID PRIMARY KEY) - Unique invoice identifier
- `created_at` (TIMESTAMP) - When invoice was created
- `currency` (TEXT) - 'ETH' or 'USDT'
- `amount_expected` (NUMERIC) - Amount in wei
- `wallet_address` (TEXT UNIQUE) - Invoice wallet address
- `derivation_index` (INTEGER) - BIP-44 derivation index
- `status` (TEXT) - pending, received, prefunding, sweeping, completed
- `current_balance` (NUMERIC) - Current wallet balance in wei
- `confirmation_count` (INTEGER) - Block confirmations
- `last_checked_at` (TIMESTAMP) - Last time we checked the wallet
- `sweep_tx_hash` (TEXT) - Transaction hash of the sweep transfer

## Support

If you're still having issues:
1. Check the TROUBLESHOOTING.md file
2. Review the API_DOCUMENTATION.md for endpoint details
3. Check browser console logs for detailed error messages
