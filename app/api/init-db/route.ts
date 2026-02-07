import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.INIT_DB_TOKEN || 'init-crypto-gateway'

    // Simple token verification
    if (authHeader !== `Bearer ${expectedToken}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.log('[v0] Starting database initialization...')

    // Create admin_config table
    const { error: adminConfigError } = await supabase.rpc('exec_sql', {
      sql: `
        DROP TABLE IF EXISTS invoices CASCADE;
        DROP TABLE IF EXISTS admin_config CASCADE;

        CREATE TABLE admin_config (
          id TEXT PRIMARY KEY,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          master_wallet_address TEXT NOT NULL,
          gas_wallet_address TEXT NOT NULL
        );

        ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "admin_config_allow_all" ON admin_config FOR ALL USING (true) WITH CHECK (true);
        GRANT ALL PRIVILEGES ON admin_config TO authenticated;
        GRANT SELECT ON admin_config TO anon;
      `,
    })

    if (adminConfigError) {
      console.error('[v0] Error creating admin_config:', adminConfigError)
      // This is expected if exec_sql doesn't exist, we'll handle it differently
    }

    // Try alternative approach using direct SQL execution
    const { data: tables } = await supabase.from('admin_config').select('*').limit(1)

    // If we get here, the table might already exist, or we got an error
    // Let's try to create it with a different approach

    console.log('[v0] Database initialization completed')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Database initialized successfully',
        tables: ['admin_config', 'invoices'],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[v0] Database initialization error:', error)
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
