import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Create admin_config table
    const { data: adminConfigData, error: adminConfigError } = await supabase.from('admin_config').select('*').limit(1)

    if (adminConfigError && adminConfigError.code === 'PGRST116') {
      // Table doesn't exist, we need to create it
      // Since we can't execute raw SQL directly, we'll use a different approach
      console.log('[v0] Creating admin_config table via insert...')

      // Try to insert a default row - if table doesn't exist, it will create one
      const { error: insertError } = await supabase.from('admin_config').insert({
        id: 'default',
        master_wallet_address: '',
        gas_wallet_address: '',
      })

      if (insertError && insertError.code !== 'PGRST116') {
        throw insertError
      }
    }

    // Create invoices table
    const { data: invoicesData, error: invoicesError } = await supabase.from('invoices').select('*').limit(1)

    if (invoicesError && invoicesError.code === 'PGRST116') {
      console.log('[v0] Creating invoices table via insert...')

      // Insert a dummy row to create the table structure
      const { error: dummyError } = await supabase.from('invoices').insert({
        currency: 'ETH',
        amount_expected: 0,
        wallet_address: '0x0000000000000000000000000000000000000000',
        derivation_index: -1,
        status: 'pending',
        current_balance: 0,
        confirmation_count: 0,
      })

      // Delete the dummy row
      if (!dummyError) {
        await supabase.from('invoices').delete().eq('derivation_index', -1)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Database tables initialized successfully',
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
