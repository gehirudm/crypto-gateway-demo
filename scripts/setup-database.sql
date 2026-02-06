-- Create admin_config table
CREATE TABLE IF NOT EXISTS admin_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  master_wallet_address TEXT NOT NULL,
  gas_wallet_address TEXT NOT NULL
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP DEFAULT NOW(),
  currency TEXT NOT NULL CHECK (currency IN ('ETH', 'USDT')),
  amount_expected NUMERIC NOT NULL,
  wallet_address TEXT NOT NULL UNIQUE,
  derivation_index INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'prefunding', 'sweeping', 'completed')),
  current_balance NUMERIC DEFAULT 0,
  confirmation_count INTEGER DEFAULT 0,
  last_checked_at TIMESTAMP DEFAULT NOW(),
  sweep_tx_hash TEXT
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_wallet ON invoices(wallet_address);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

-- Add row level security
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Admin config policies
CREATE POLICY "Allow all access to admin config" ON admin_config FOR ALL USING (true);

-- Invoices policies - allow public read for specific invoice ID via query parameter
CREATE POLICY "Allow all access to invoices" ON invoices FOR ALL USING (true);

-- Grant permissions
GRANT ALL ON admin_config TO authenticated;
GRANT ALL ON invoices TO authenticated;
GRANT SELECT ON admin_config TO anon;
GRANT SELECT ON invoices TO anon;
