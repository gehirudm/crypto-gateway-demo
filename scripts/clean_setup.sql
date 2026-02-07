-- ============================================================================
-- CRYPTO PAYMENT GATEWAY - DATABASE SCHEMA
-- Clean SQL script for Supabase
-- ============================================================================

-- Drop existing tables if they exist (optional - comment out if you want to keep existing data)
-- DROP TABLE IF EXISTS invoices CASCADE;
-- DROP TABLE IF EXISTS admin_config CASCADE;

-- ============================================================================
-- TABLE: admin_config
-- Purpose: Store gateway configuration (master wallet, gas wallet addresses)
-- ============================================================================
CREATE TABLE IF NOT EXISTS admin_config (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  master_wallet_address TEXT NOT NULL,
  gas_wallet_address TEXT NOT NULL
);

-- Add comment to table
COMMENT ON TABLE admin_config IS 'Stores the gateway configuration including master wallet and gas wallet addresses';

-- Enable RLS for admin_config
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policy - allow all access for demo (adjust as needed for production)
CREATE POLICY "admin_config_allow_all" ON admin_config FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL PRIVILEGES ON admin_config TO authenticated;
GRANT SELECT ON admin_config TO anon;

-- ============================================================================
-- TABLE: invoices
-- Purpose: Track all invoice/payment requests and their status
-- ============================================================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  currency TEXT NOT NULL CHECK (currency IN ('ETH', 'USDT')),
  amount_expected NUMERIC NOT NULL,
  wallet_address TEXT NOT NULL UNIQUE,
  derivation_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'prefunding', 'sweeping', 'completed', 'failed')),
  current_balance NUMERIC DEFAULT 0,
  confirmation_count INTEGER DEFAULT 0,
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sweep_tx_hash TEXT
);

-- Add comments to columns
COMMENT ON TABLE invoices IS 'Stores all payment invoices with their wallet addresses and status';
COMMENT ON COLUMN invoices.id IS 'Unique invoice identifier (UUID)';
COMMENT ON COLUMN invoices.currency IS 'Payment currency: ETH or USDT';
COMMENT ON COLUMN invoices.amount_expected IS 'Expected payment amount in the specified currency';
COMMENT ON COLUMN invoices.wallet_address IS 'Unique wallet address derived from master mnemonic';
COMMENT ON COLUMN invoices.derivation_index IS 'BIP-44 derivation index for this invoice wallet';
COMMENT ON COLUMN invoices.status IS 'Invoice status: pending, received, prefunding, sweeping, completed, or failed';
COMMENT ON COLUMN invoices.current_balance IS 'Current balance in the invoice wallet';
COMMENT ON COLUMN invoices.confirmation_count IS 'Number of block confirmations for received funds';
COMMENT ON COLUMN invoices.last_checked_at IS 'Timestamp of last balance check';
COMMENT ON COLUMN invoices.sweep_tx_hash IS 'Transaction hash when funds were swept to master wallet';

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_wallet ON invoices(wallet_address);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_derivation_index ON invoices(derivation_index);

-- Enable RLS for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create RLS policy - allow all access for demo (adjust as needed for production)
CREATE POLICY "invoices_allow_all" ON invoices FOR ALL USING (true) WITH CHECK (true);

-- Grant permissions
GRANT ALL PRIVILEGES ON invoices TO authenticated;
GRANT SELECT ON invoices TO anon;

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these to verify the tables were created correctly
-- ============================================================================
-- SELECT * FROM admin_config;
-- SELECT COUNT(*) FROM invoices;
-- SELECT * FROM invoices ORDER BY created_at DESC LIMIT 5;
