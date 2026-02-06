import { createClient } from '@/lib/supabase/server';

export interface AdminConfig {
  id: string;
  created_at: string;
  updated_at: string;
  config_key: string;
  config_value: string;
  description?: string;
}

export interface GasWallet {
  id: string;
  created_at: string;
  updated_at: string;
  wallet_address: string;
  balance: string;
  balance_last_updated?: string;
  derivation_path: string;
}

export interface MasterWallet {
  id: string;
  created_at: string;
  wallet_address: string;
  balance: string;
  balance_last_updated?: string;
}

/**
 * Get admin config by key
 */
export async function getAdminConfig(
  configKey: string
): Promise<AdminConfig | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('admin_config')
    .select()
    .eq('config_key', configKey)
    .single();

  if (error) {
    return null;
  }

  return data as AdminConfig;
}

/**
 * Get all admin configs
 */
export async function getAllAdminConfigs(): Promise<AdminConfig[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('admin_config')
    .select()
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error getting admin configs:', error);
    return [];
  }

  return data as AdminConfig[];
}

/**
 * Set admin config
 */
export async function setAdminConfig(
  configKey: string,
  configValue: string,
  description?: string
): Promise<AdminConfig | null> {
  const supabase = await createClient();

  const existing = await getAdminConfig(configKey);

  if (existing) {
    const { data, error } = await supabase
      .from('admin_config')
      .update({
        config_value: configValue,
        updated_at: new Date().toISOString(),
        description: description || existing.description,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating admin config:', error);
      return null;
    }

    return data as AdminConfig;
  } else {
    const { data, error } = await supabase
      .from('admin_config')
      .insert([
        {
          config_key: configKey,
          config_value: configValue,
          description,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating admin config:', error);
      return null;
    }

    return data as AdminConfig;
  }
}

/**
 * Get gas wallet
 */
export async function getGasWallet(): Promise<GasWallet | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('gas_wallet')
    .select()
    .single();

  if (error) {
    return null;
  }

  return data as GasWallet;
}

/**
 * Create gas wallet
 */
export async function createGasWallet(
  walletAddress: string,
  derivationPath: string
): Promise<GasWallet | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('gas_wallet')
    .insert([
      {
        wallet_address: walletAddress,
        derivation_path: derivationPath,
        balance: '0',
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating gas wallet:', error);
    return null;
  }

  return data as GasWallet;
}

/**
 * Update gas wallet balance
 */
export async function updateGasWalletBalance(
  balance: string
): Promise<GasWallet | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('gas_wallet')
    .update({
      balance,
      balance_last_updated: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating gas wallet balance:', error);
    return null;
  }

  return data as GasWallet;
}

/**
 * Get master wallet
 */
export async function getMasterWallet(): Promise<MasterWallet | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('master_wallet')
    .select()
    .single();

  if (error) {
    return null;
  }

  return data as MasterWallet;
}

/**
 * Create master wallet
 */
export async function createMasterWallet(
  walletAddress: string
): Promise<MasterWallet | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('master_wallet')
    .insert([
      {
        wallet_address: walletAddress,
        balance: '0',
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating master wallet:', error);
    return null;
  }

  return data as MasterWallet;
}

/**
 * Update master wallet balance
 */
export async function updateMasterWalletBalance(
  balance: string
): Promise<MasterWallet | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('master_wallet')
    .update({
      balance,
      balance_last_updated: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating master wallet balance:', error);
    return null;
  }

  return data as MasterWallet;
}
