# Complete Setup Checklist

## Pre-Setup
- [ ] Supabase project created
- [ ] Project cloned/downloaded
- [ ] `.env.local` file exists in root

## Environment Variables
- [ ] Added `ADMIN_TOKEN` to `.env.local`
- [ ] Added `MASTER_MNEMONIC` to `.env.local`
  - Get from BIP39 mnemonic generator or use an existing seed phrase
  - Example: `witch collapse practice feed shame open despair community know lion album`
- [ ] Verified no quotes around values (unless needed)
- [ ] Saved `.env.local`

## Database Setup
- [ ] Opened `/scripts/clean_setup.sql`
- [ ] Logged into Supabase Dashboard
- [ ] Navigated to SQL Editor
- [ ] Created a new query
- [ ] Copied entire `clean_setup.sql` content
- [ ] Pasted into SQL editor
- [ ] Clicked the Run button ▶️
- [ ] Confirmed no errors in the response

## Database Verification
- [ ] Went to Supabase Table Editor
- [ ] Verified `admin_config` table exists
- [ ] Verified `invoices` table exists
- [ ] Checked both tables are empty (0 rows)

## Application Setup
- [ ] Opened terminal in project root
- [ ] Ran `npm install` (if first time)
- [ ] Ran `npm run dev`
- [ ] Verified dev server started (usually http://localhost:3000)

## Configuration
- [ ] Opened http://localhost:3000
- [ ] Clicked "Configuration" button
- [ ] Observed admin panel loading
- [ ] Saw gas wallet address displayed
- [ ] Copied gas wallet address to somewhere safe
- [ ] Entered your master wallet address
- [ ] Clicked "Save Configuration"
- [ ] Checked server logs for `[API:CONFIG:POST]` messages
- [ ] Confirmed successful response in UI

## Funding Gas Wallet (For USDT Support)
- [ ] Opened Optimism testnet/mainnet wallet
- [ ] Sent 0.1+ ETH to the displayed gas wallet address
- [ ] Waited for transaction to confirm
- [ ] Refreshed admin panel
- [ ] Verified gas wallet balance shows > 0 ETH
- [ ] Confirmed system shows "Ready" status

## Testing Payment Creation
- [ ] Went to home page (http://localhost:3000)
- [ ] Clicked "Create Payment" button
- [ ] Entered amount (e.g., 0.1)
- [ ] Selected currency (ETH or USDT)
- [ ] Clicked "Create Payment"
- [ ] Checked server logs for `[API:CREATE:INVOICE]` messages
- [ ] Received wallet address for payment
- [ ] Saw payment status page

## Testing Payment Monitoring
- [ ] From payment page, entered test wallet details
- [ ] Clicked "Check Status" (if available)
- [ ] Observed polling happening
- [ ] Checked server logs for `[API:POLL:INVOICE]` messages
- [ ] Confirmed balance updates in real-time

## Troubleshooting (If Needed)
- [ ] Checked server logs for `ERROR:` messages
- [ ] Opened `DEBUGGING.md` for the error
- [ ] Followed troubleshooting steps
- [ ] Verified all environment variables are set
- [ ] Verified database tables exist
- [ ] Restarted dev server after env changes

## Final Verification
- [ ] Admin panel shows "Ready" status
- [ ] Can create payments
- [ ] Server logs show proper `[API:...]` messages
- [ ] No errors in browser console
- [ ] No errors in server terminal

## Optional: Production Preparation
- [ ] Updated .env for mainnet RPC URLs
- [ ] Changed USDT contract address to mainnet version
- [ ] Updated RLS policies in Supabase (if needed)
- [ ] Configured proper authentication (not permissive)
- [ ] Set up proper error monitoring
- [ ] Tested with real funds in staging

## Documentation
- [ ] Read `README.md` for overview
- [ ] Read `DATABASE_SETUP.md` for schema details
- [ ] Read `DEBUGGING.md` for error resolution
- [ ] Bookmarked key docs for quick reference

---

## Next Steps

After completing this checklist, you're ready to:
1. ✅ Accept test payments on testnet
2. ✅ Monitor payment status in real-time
3. ✅ Automatically sweep funds
4. ✅ Deploy to production

## Help

If something fails:
1. Check the server logs for `[API:...]` messages
2. Look at the error `details` field
3. Search in `DEBUGGING.md` for that error
4. Follow the troubleshooting steps

You should be able to identify and fix any issue!
