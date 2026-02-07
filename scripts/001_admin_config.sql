CREATE TABLE IF NOT EXISTS admin_config (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  master_wallet_address TEXT NOT NULL,
  gas_wallet_address TEXT NOT NULL
);

ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_config_policy ON admin_config FOR ALL USING (true) WITH CHECK (true);
GRANT ALL PRIVILEGES ON admin_config TO authenticated;
GRANT SELECT ON admin_config TO anon;
