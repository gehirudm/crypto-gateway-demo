# API Error Debugging Guide

## Overview

All API endpoints now include detailed logging with `[API:...]` prefixes. This guide shows you how to read and debug errors.

## Where to Look for Errors

### 1. Browser Console
When you get a response error on the frontend:
- Open DevTools (F12 or Cmd+Option+I)
- Go to **Console** tab
- Look for errors in red
- Error responses now include a `details` field with the actual error

### 2. Server Terminal
When running `npm run dev`, your terminal shows all server logs:
- Look for lines starting with `[API:...]`
- These show the exact execution flow
- Errors appear in the flow as they happen

### 3. Browser Network Tab
For detailed request/response inspection:
- Go to DevTools → **Network** tab
- Click on the API request
- View the response body for error details

## API Logging Reference

### Config API Endpoints

**GET /api/admin/config**
```
[API:CONFIG:GET] Starting config fetch
[API:CONFIG:GET] Fetching admin config from database
[API:CONFIG:GET] Config found, fetching gas wallet balance
[API:CONFIG:GET] Config status - Master: true/false, Gas funded: true/false
```

**POST /api/admin/config**
```
[API:CONFIG:POST] Starting config update
[API:CONFIG:POST] Received body: {...}
[API:CONFIG:POST] Getting or creating gas wallet
[API:CONFIG:POST] Gas wallet address: 0x...
[API:CONFIG:POST] Connecting to Supabase
[API:CONFIG:POST] Checking for existing config
[API:CONFIG:POST] Creating new config OR Updating existing config
[API:CONFIG:POST] Config saved successfully, fetching gas balance
[API:CONFIG:POST] Gas balance: 0.5
[API:CONFIG:POST] Returning success response
```

### Invoice Creation API

**POST /api/invoices/create**
```
[API:CREATE:INVOICE] Starting invoice creation
[API:CREATE:INVOICE] Request body: {amount: "1.5", currency: "ETH"}
[API:CREATE:INVOICE] Checking for MASTER_MNEMONIC environment variable
[API:CREATE:INVOICE] Connecting to Supabase to get invoice count
[API:CREATE:INVOICE] Invoice index: 5
[API:CREATE:INVOICE] Deriving wallet from mnemonic at index 5
[API:CREATE:INVOICE] Derived wallet address: 0x...
[API:CREATE:INVOICE] Creating invoice in database
[API:CREATE:INVOICE] Invoice created with ID: <uuid>
[API:CREATE:INVOICE] Fetching initial wallet balance
[API:CREATE:INVOICE] Initial balance: 0
[API:CREATE:INVOICE] Returning success response
```

### Invoice Polling API

**POST /api/invoices/poll**
```
[API:POLL:INVOICE] Starting invoice poll
[API:POLL:INVOICE] Request body: {invoiceId: "<uuid>"}
[API:POLL:INVOICE] Fetching invoice: <uuid>
[API:POLL:INVOICE] Invoice found: {currency: "ETH", ...}
[API:POLL:INVOICE] Fetching wallet balance for: 0x...
[API:POLL:INVOICE] Current balance: 1.5, Required: 1.5
[API:POLL:INVOICE] Getting transaction count
[API:POLL:INVOICE] Transaction count: 1
[API:POLL:INVOICE] Updating invoice balance and confirmation count
[API:POLL:INVOICE] Payment received! Updating status
[API:POLL:INVOICE] ETH detected, initiating sweep
[API:POLL:INVOICE] Attempting to sweep invoice
[API:POLL:INVOICE] Sweep successful, TX: 0x...
[API:POLL:INVOICE] Fetching updated invoice data
[API:POLL:INVOICE] Returning success response - status: completed
```

### Transactions API

**GET /api/admin/transactions**
```
[API:ADMIN:TRANSACTIONS] Starting transaction list fetch
[API:ADMIN:TRANSACTIONS] Connecting to Supabase
[API:ADMIN:TRANSACTIONS] Fetching all invoices
[API:ADMIN:TRANSACTIONS] Found 3 invoices
[API:ADMIN:TRANSACTIONS] Returning success response
```

## Common Error Scenarios

### Error: "Server configuration error: ADMIN_TOKEN not set"
**What went wrong:** Environment variable `ADMIN_TOKEN` is missing

**Solution:**
1. Add to `.env.local`:
   ```
   ADMIN_TOKEN=your-secure-token
   ```
2. Restart dev server (`npm run dev`)
3. Retry the request

### Error: "Gateway not configured: Master mnemonic missing"
**What went wrong:** Environment variable `MASTER_MNEMONIC` is not set

**Solution:**
1. Add to `.env.local`:
   ```
   MASTER_MNEMONIC=your-seed-phrase-here
   ```
2. Restart dev server
3. Try creating an invoice again

### Error: "Failed to fetch config" with details "relation \"admin_config\" does not exist"
**What went wrong:** Database tables were never created

**Solution:**
1. Open `/scripts/clean_setup.sql`
2. Copy the entire content
3. Go to Supabase → SQL Editor → New Query
4. Paste and click Run
5. Retry your request

### Error: "Invoice not found"
**What went wrong:** Invoice ID doesn't exist or was misspelled

**Check in logs:**
```
[API:POLL:INVOICE] Invoice not found - ID: <uuid>
```

**Solution:**
1. Verify the invoice ID is correct (copy from previous response)
2. Check that you created an invoice first
3. Go to Supabase → Table Editor → invoices
4. Verify the invoice row exists

### Error: "Database error: permission denied"
**What went wrong:** Supabase RLS policies are blocking access

**Solution:**
1. Go to Supabase → Authentication → Policies
2. Verify the `invoices` and `admin_config` tables have RLS enabled with permissive policies
3. Check that authenticated users have SELECT, INSERT, UPDATE permissions

## Step-by-Step Error Diagnosis

When you get an error:

1. **Check the error message**
   - Frontend: `error` and `details` fields
   - Server logs: `[API:...] ERROR:` lines

2. **Look at the execution flow**
   - Find where it stopped in the logs
   - This shows exactly what failed

3. **Check prerequisites**
   - Is ADMIN_TOKEN set? `[API:CONFIG:GET] ADMIN_TOKEN not set in environment`
   - Is MASTER_MNEMONIC set? `[API:CREATE:INVOICE] MASTER_MNEMONIC not set in environment`
   - Do tables exist? Look for "relation does not exist"

4. **Review the detailed error**
   - The `details` field in API response often contains the actual error
   - This is more helpful than the generic error message

5. **Check Supabase directly**
   - Go to SQL Editor
   - Run: `SELECT * FROM admin_config;`
   - Run: `SELECT COUNT(*) FROM invoices;`
   - Verify tables exist and have data

## Example: Debugging a 500 Error

**Scenario:** You get a 500 error when creating an invoice

**Step 1: Check the error response**
```json
{
  "error": "Failed to create invoice",
  "details": "Error getting wallet address: Invalid mnemonic"
}
```

**Step 2: Check server logs**
```
[API:CREATE:INVOICE] Starting invoice creation
[API:CREATE:INVOICE] Request body: {amount: "1.5", currency: "ETH"}
[API:CREATE:INVOICE] Checking for MASTER_MNEMONIC environment variable
[API:CREATE:INVOICE] Connecting to Supabase to get invoice count
[API:CREATE:INVOICE] Invoice index: 1
[API:CREATE:INVOICE] Deriving wallet from mnemonic at index 1
[API:CREATE:INVOICE] ERROR: Error getting wallet address: Invalid mnemonic
[API:CREATE:INVOICE] Full error: Error: Invalid mnemonic...
```

**Step 3: Identify the problem**
- The logs show the mnemonic derivation failed
- This means the MASTER_MNEMONIC value is invalid

**Step 4: Fix it**
- Go to `.env.local`
- Check that MASTER_MNEMONIC is a valid seed phrase
- Get a valid seed phrase and update it
- Restart dev server
- Try again

## Viewing Full Error Stack Traces

Sometimes you need more detail. The logs include:
- `ERROR:` - Short error message
- `Full error:` - Full error object
- `Stack trace:` - Where in code the error happened

Example in logs:
```
[API:CREATE:INVOICE] ERROR: Invalid mnemonic length
[API:CREATE:INVOICE] Full error: Error: Invalid mnemonic length
[API:CREATE:INVOICE] Stack trace: at bip39Module.mnemonicToSeed...
```

This helps you understand exactly which function failed and why.

## Testing Error Handling

To test that error logging works:

1. Remove MASTER_MNEMONIC from `.env.local`
2. Try to create an invoice
3. You should see: `[API:CREATE:INVOICE] MASTER_MNEMONIC not set in environment`
4. API returns: `"details": "MASTER_MNEMONIC not set in environment"`

This confirms logging is working!

## Tips for Debugging

- **Always check server logs first** - They show the complete execution flow
- **Pay attention to the step that failed** - It's pinpointed in the logs
- **Use the `details` field** - It usually contains the actual error
- **Verify prerequisites** - ADMIN_TOKEN, MASTER_MNEMONIC, database tables
- **Check Supabase directly** - Verify tables and data exist
- **Look for timing issues** - Some errors only happen after specific sequences

If you can't find the issue, share:
1. The exact error from API response
2. The server logs (starting with `[API:...]`)
3. The action you were trying to do

That will pinpoint the problem quickly!
