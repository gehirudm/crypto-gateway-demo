-- Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  amount_required DECIMAL(36, 18) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('ETH', 'USDT')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'deposit_received', 'sweeping', 'completed', 'failed')),
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  deposit_deadline TIMESTAMP WITH TIME ZONE
);

-- Create invoice wallets table
CREATE TABLE IF NOT EXISTS public.invoice_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invoice_id UUID NOT NULL UNIQUE REFERENCES public.invoices(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL UNIQUE,
  derivation_path TEXT NOT NULL,
  balance DECIMAL(36, 18) DEFAULT 0,
  required_gas_balance DECIMAL(36, 18),
  has_received_gas BOOLEAN DEFAULT FALSE,
  gas_prefunded_at TIMESTAMP WITH TIME ZONE
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  transaction_hash TEXT UNIQUE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'gas_prefund', 'sweep')),
  amount DECIMAL(36, 18) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  confirmations INT DEFAULT 0,
  block_number INT,
  from_address TEXT,
  to_address TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('ETH', 'USDT'))
);

-- Create admin configuration table
CREATE TABLE IF NOT EXISTS public.admin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  config_key TEXT NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  description TEXT
);

-- Create gas wallet table
CREATE TABLE IF NOT EXISTS public.gas_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  wallet_address TEXT NOT NULL UNIQUE,
  balance DECIMAL(36, 18) DEFAULT 0,
  balance_last_updated TIMESTAMP WITH TIME ZONE,
  derivation_path TEXT NOT NULL
);

-- Create master wallet table
CREATE TABLE IF NOT EXISTS public.master_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  wallet_address TEXT NOT NULL UNIQUE,
  balance DECIMAL(36, 18) DEFAULT 0,
  balance_last_updated TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all tables
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gas_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_wallet ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow all for admin operations
-- For this demo, we'll allow all authenticated users to read and write admin data
-- In production, you'd restrict these to admin roles only

CREATE POLICY "allow_all_admin_config_read" ON public.admin_config FOR SELECT USING (TRUE);
CREATE POLICY "allow_all_admin_config_write" ON public.admin_config FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "allow_all_admin_config_update" ON public.admin_config FOR UPDATE USING (TRUE);

CREATE POLICY "allow_all_invoices_read" ON public.invoices FOR SELECT USING (TRUE);
CREATE POLICY "allow_all_invoices_write" ON public.invoices FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "allow_all_invoices_update" ON public.invoices FOR UPDATE USING (TRUE);

CREATE POLICY "allow_all_invoice_wallets_read" ON public.invoice_wallets FOR SELECT USING (TRUE);
CREATE POLICY "allow_all_invoice_wallets_write" ON public.invoice_wallets FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "allow_all_invoice_wallets_update" ON public.invoice_wallets FOR UPDATE USING (TRUE);

CREATE POLICY "allow_all_transactions_read" ON public.transactions FOR SELECT USING (TRUE);
CREATE POLICY "allow_all_transactions_write" ON public.transactions FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "allow_all_transactions_update" ON public.transactions FOR UPDATE USING (TRUE);

CREATE POLICY "allow_all_gas_wallet_read" ON public.gas_wallet FOR SELECT USING (TRUE);
CREATE POLICY "allow_all_gas_wallet_write" ON public.gas_wallet FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "allow_all_gas_wallet_update" ON public.gas_wallet FOR UPDATE USING (TRUE);

CREATE POLICY "allow_all_master_wallet_read" ON public.master_wallet FOR SELECT USING (TRUE);
CREATE POLICY "allow_all_master_wallet_write" ON public.master_wallet FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "allow_all_master_wallet_update" ON public.master_wallet FOR UPDATE USING (TRUE);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_method ON public.invoices(payment_method);
CREATE INDEX IF NOT EXISTS idx_invoice_wallets_invoice_id ON public.invoice_wallets(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_wallets_address ON public.invoice_wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_id ON public.transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_hash ON public.transactions(transaction_hash);
