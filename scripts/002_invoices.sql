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
CREATE POLICY invoices_policy ON invoices FOR ALL USING (true) WITH CHECK (true);
GRANT ALL PRIVILEGES ON invoices TO authenticated;
GRANT SELECT ON invoices TO anon;
