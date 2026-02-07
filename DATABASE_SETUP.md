# Database Setup Guide

## Overview

This payment gateway uses **two simple tables**:
1. **admin_config** - Stores master wallet and gas wallet addresses
2. **invoices** - Stores all payment requests and their status

## Quick Setup (2 minutes)

### Step 1: Copy the SQL Script

Open `/scripts/clean_setup.sql` in your project - it contains the complete SQL to create both tables.

### Step 2: Run in Supabase

1. **Go to Supabase Dashboard** → Your Project
2. Click **SQL Editor** (left sidebar)
3. Click **"New Query"**
4. **Copy the entire contents** of `scripts/clean_setup.sql`
5. **Paste** into the SQL editor
6. Click the blue **Run** button ▶️

That's it! Both tables will be created in seconds.

### Step 3: Verify

Run these queries to verify:
```sql
SELECT * FROM admin_config;
SELECT COUNT(*) FROM invoices;
```

You should see:
- Empty `admin_config` table (no rows yet)
- Empty `invoices` table with 0 rows

## Table Schemas

### admin_config
```sql
id TEXT PRIMARY KEY                    -- 'default' (only one config)
created_at TIMESTAMP                   -- When created
updated_at TIMESTAMP                   -- When last updated
master_wallet_address TEXT NOT NULL    -- Where sweeps go
gas_wallet_address TEXT NOT NULL       -- For prefunding USDT
```

### invoices
```sql
id UUID PRIMARY KEY                    -- Unique invoice ID
created_at TIMESTAMP                   -- When created
currency TEXT NOT NULL                 -- 'ETH' or 'USDT'
amount_expected NUMERIC NOT NULL       -- How much user must send
wallet_address TEXT NOT NULL UNIQUE    -- Where user sends funds
derivation_index INTEGER NOT NULL      -- BIP-44 index for this wallet
status TEXT NOT NULL                   -- pending, received, prefunding, sweeping, completed, failed
current_balance NUMERIC DEFAULT 0      -- Current funds in wallet
confirmation_count INTEGER DEFAULT 0   -- Block confirmations
last_checked_at TIMESTAMP              -- When balance was last checked
sweep_tx_hash TEXT                     -- Transaction hash after sweep
```

## Troubleshooting

### "Table already exists" error
The tables were created before. You have two options:

**Option A: Keep existing data**
- Comment out the `DROP TABLE` lines in the SQL script (they're commented by default)
- Run the SQL - it will skip existing tables

**Option B: Start fresh (loses data)**
- Uncomment the `DROP TABLE` lines
- Run the SQL - tables will be recreated

### "Missing table" error
- Verify you ran the SQL script completely
- Check that both tables appear in Supabase "Table Editor"
- Look at server logs for exact error messages

### "Permission denied" error
- Ensure your Supabase user has permissions to create tables
- Try running as the admin/superuser account

## API Endpoints and Error Logging

All API endpoints now include detailed error logging. When something goes wrong:

1. **Check Browser Console** - Any errors will show details
2. **Check Server Logs** - Look for `[API:...]` log messages
3. **Error Response** - API returns both `error` and `details` fields

### Example Error Response
```json
{
  "error": "Failed to create invoice",
  "details": "Failed to create invoice: relation \"invoices\" does not exist"
}
```

This tells you exactly what went wrong!

## What the Logging Shows

Each API endpoint logs its execution flow:

**Admin Config Endpoint** - `[API:CONFIG:GET]` and `[API:CONFIG:POST]`
- ADMIN_TOKEN check
- Config fetch/update progress
- Gas wallet balance
- Final status

**Create Invoice Endpoint** - `[API:CREATE:INVOICE]`
- Parameter validation
- Mnemonic check
- Wallet derivation
- Database insertion
- Balance check

**Poll Invoice Endpoint** - `[API:POLL:INVOICE]`
- Invoice fetch
- Balance update
- Payment detection
- Status transitions
- Sweep attempts

**Transactions Endpoint** - `[API:ADMIN:TRANSACTIONS]`
- Authorization check
- Invoice list fetch
- Success/error details

## Testing the Setup

Once tables are created:

1. **Go to localhost:3000**
2. **Configure Admin Panel**
   - Look at server logs for `[API:CONFIG:...]` messages
   - Add master wallet address
3. **Create Payment**
   - Look for `[API:CREATE:INVOICE]...` messages
   - Should create invoice and derive wallet
4. **Monitor Payment**
   - Look for `[API:POLL:INVOICE]...` messages
   - System will auto-detect when funds arrive

All logs appear in your dev server terminal with the `[API:...]` prefix.

## Database Row-Level Security (RLS)

Both tables have RLS enabled with permissive policies for this demo:
- All authenticated users can read/write
- Anonymous users can only read

For production, adjust the RLS policies in Supabase.

## Indexes

For performance, indexes are created on:
- `invoices.status` - For status queries
- `invoices.wallet_address` - For wallet lookups
- `invoices.created_at` - For sorting by date
- `invoices.derivation_index` - For duplicate prevention

These help queries run fast even with thousands of invoices.
