-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS admin_config CASCADE;

-- Create admin_config table
CREATE TABLE admin_config (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  master_wallet_address TEXT NOT NULL,
  gas_wallet_address TEXT NOT NULL
);

-- Create invoices table
CREATE TABLE invoices (
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

-- Create indexes for better query performance
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_wallet ON invoices(wallet_address);
CREATE INDEX idx_invoices_created_at ON invoices(created_at DESC);

-- Enable Row Level Security
ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (for demo purposes)
CREATE POLICY "admin_config_allow_all" ON admin_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "invoices_allow_all" ON invoices FOR ALL USING (true) WITH CHECK (true);

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON admin_config TO authenticated;
GRANT ALL PRIVILEGES ON invoices TO authenticated;
GRANT SELECT ON admin_config TO anon;
GRANT SELECT ON invoices TO anon;
