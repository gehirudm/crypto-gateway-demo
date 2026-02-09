import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Verify admin_config table exists by attempting a select
    const { error: adminConfigError } = await supabase.from('admin_config').select('*').limit(1)

    if (adminConfigError && adminConfigError.code === 'PGRST116') {
      console.log('[INIT] admin_config table not found. Please create it in Supabase Dashboard.')
      console.log(`
        CREATE TABLE admin_config (
          id TEXT PRIMARY KEY DEFAULT 'default',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          master_wallet_address TEXT NOT NULL DEFAULT '',
          gas_wallet_address TEXT NOT NULL DEFAULT '',
          commission_rate NUMERIC DEFAULT 5.0
        );
      `)
    } else {
      // Ensure a default row exists
      const { data: existing } = await supabase
        .from('admin_config')
        .select('id')
        .eq('id', 'default')
        .single()

      if (!existing) {
        await supabase.from('admin_config').insert({
          id: 'default',
          master_wallet_address: '',
          gas_wallet_address: '',
          commission_rate: 5.0,
        })
      }
    }

    // Verify merchants table
    const { error: merchantsError } = await supabase.from('merchants').select('*').limit(1)

    if (merchantsError && merchantsError.code === 'PGRST116') {
      console.log('[INIT] merchants table not found. Please create it in Supabase Dashboard.')
      console.log(`
        CREATE TABLE merchants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          name TEXT NOT NULL,
          external_wallet_address TEXT DEFAULT '',
          derivation_index INTEGER NOT NULL UNIQUE,
          derived_wallet_address TEXT NOT NULL,
          is_active BOOLEAN DEFAULT true
        );
      `)
    }

    // Verify invoices table
    const { error: invoicesError } = await supabase.from('invoices').select('*').limit(1)

    if (invoicesError && invoicesError.code === 'PGRST116') {
      console.log('[INIT] invoices table not found. Please create it in Supabase Dashboard.')
      console.log(`
        CREATE TABLE invoices (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          merchant_id UUID NOT NULL REFERENCES merchants(id),
          amount_expected NUMERIC NOT NULL,
          wallet_address TEXT NOT NULL,
          derivation_index INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending','received','prefunding','sweeping','completed','failed')),
          current_balance NUMERIC DEFAULT 0,
          confirmation_count INTEGER DEFAULT 0,
          last_checked_at TIMESTAMPTZ,
          sweep_tx_hash TEXT,
          commission_tx_hash TEXT,
          merchant_tx_hash TEXT,
          gas_prefund_amount NUMERIC,
          gas_prefund_tx_hash TEXT,
          commission_amount NUMERIC,
          merchant_amount NUMERIC
        );
      `)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Database tables checked. Review server logs if tables need creation.',
        schema: {
          admin_config: !adminConfigError ? 'OK' : 'MISSING',
          merchants: !merchantsError ? 'OK' : 'MISSING',
          invoices: !invoicesError ? 'OK' : 'MISSING',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[INIT] Database initialization error:', error)
    return new Response(
      JSON.stringify({
        error: 'Database initialization failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
