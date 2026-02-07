# Troubleshooting Guide

## 500 Error When Saving Master Wallet Address

### ✅ What Was Fixed
The admin config save endpoint had an issue with the database operation. It has been corrected to:
1. Check if config exists first
2. Update if exists, insert if not
3. Return proper error messages
4. Better error logging

### Step-by-Step Recovery

#### 1. **Ensure Database Tables Exist**
First, you MUST run the database migration:

```bash
# In your Supabase SQL Editor, run:
# scripts/setup-database.sql
```

The migration creates these tables:
- `admin_config` - Stores gateway configuration
- `invoices` - Stores invoice records

#### 2. **Check Environment Variables**
Ensure you have these set in your `.env.local`:

```
# Required
MASTER_MNEMONIC=your-12-or-24-word-mnemonic-here
ADMIN_TOKEN=your-secure-admin-token

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

#### 3. **Try Saving Again**
1. Go to Admin Panel at `/admin`
2. Ensure your admin token is correct
3. Enter a valid Ethereum address for Master Wallet
4. Click "Save Configuration"
5. Check browser console for detailed error messages

#### 4. **Check Browser Console**
Open Developer Tools (F12) and look for `[v0]` debug messages:
- `[v0] Config fetch error` - Problem loading config
- `[v0] Error saving config` - Problem saving config

### Common Issues & Solutions

#### Issue: "Unauthorized" Error
**Solution:** Your admin token is incorrect or not set.
- Ensure `ADMIN_TOKEN` env var is set
- In Admin Panel, use the same token in the password field
- The API expects: `Authorization: Bearer YOUR_TOKEN_HERE`

#### Issue: "Failed to fetch configuration"
**Solution:** Database tables don't exist.
- Run `scripts/setup-database.sql` in Supabase SQL Editor
- Wait 5 seconds for tables to create
- Refresh the page

#### Issue: Error about master_wallet_address column
**Solution:** Database schema doesn't match.
- Drop existing tables: `DROP TABLE IF EXISTS admin_config;`
- Run the migration script again
- Clear browser cache and refresh

#### Issue: "Failed to save configuration" with 500 error
**Solution:** Multiple possible causes:

**Check 1: Verify Admin Token**
```bash
# Make sure ADMIN_TOKEN is set and matches what you're using
echo $ADMIN_TOKEN
```

**Check 2: Verify Supabase Connection**
- Open Supabase Dashboard
- Check if admin_config table exists
- Check if you have write permissions

**Check 3: Validate Input**
- Master wallet address must be a valid Ethereum address (0x...)
- Use an actual address like: `0x1234567890123456789012345678901234567890`

**Check 4: Check Supabase Logs**
1. Go to Supabase Dashboard
2. Navigate to Logs
3. Look for the failed query
4. Check if the column names match the migration

### Manual Database Check

To verify your database is set up correctly:

1. **Open Supabase SQL Editor**
2. **Run this query:**
```sql
SELECT * FROM admin_config LIMIT 1;
```

3. **Expected result:**
- Should return empty or one row
- Columns: id, created_at, updated_at, master_wallet_address, gas_wallet_address

4. **If error "table does not exist":**
- Run `scripts/setup-database.sql` immediately

### Verify Everything is Working

After fixes, test with this sequence:

1. **Open Admin Panel** → `/admin`
2. **Enter Admin Token** → Your `ADMIN_TOKEN` value
3. **Enter Master Wallet** → Any valid 0x address
4. **Click Save** → Should succeed and show green checkmark
5. **Refresh Page** → Address should still be there

### Getting Help with Errors

When seeking help, provide:
1. Full error message from browser console
2. Output of running this query in Supabase:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```
3. Your `.env.local` file (WITHOUT sensitive values)
4. Screenshot of the error

### Recovery Steps

If nothing works, try a full reset:

```sql
-- In Supabase SQL Editor
DROP TABLE IF EXISTS admin_config CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;

-- Then re-run scripts/setup-database.sql
```

Then:
1. Refresh browser
2. Try saving again

## Other Common Issues

### "Gas Wallet Balance is Low"
- The gateway automatically derived a gas wallet address
- You need to send ETH to this address for USDT transactions
- Amount needed depends on gas prices (typically 0.01-0.1 ETH)

### "Master Mnemonic Not Configured"
- Set `MASTER_MNEMONIC` env variable
- Use a valid 12 or 24-word BIP39 mnemonic
- Restart the dev server after setting it

### Invoice Creation Fails
- Ensure admin config is saved first
- Check that master mnemonic is valid
- Verify Supabase connection is working

---

## Quick Checklist

Before you report an issue, verify:

- [ ] Database migration was run (`scripts/setup-database.sql`)
- [ ] `MASTER_MNEMONIC` is set in `.env.local`
- [ ] `ADMIN_TOKEN` is set in `.env.local`
- [ ] Supabase credentials are correct
- [ ] Browser console shows no network errors
- [ ] You can see the admin_config table in Supabase
- [ ] You've cleared browser cache
- [ ] You've restarted the dev server

If all boxes are checked and you still have issues, check the browser console for `[v0]` debug messages and share them when asking for help.
