import { createClient } from '@/lib/supabase/server';

export interface Invoice {
  id: string;
  created_at: string;
  updated_at: string;
  amount_required: string;
  payment_method: 'ETH' | 'USDT';
  status: 'pending' | 'deposit_received' | 'sweeping' | 'completed' | 'failed';
  description?: string;
  metadata: Record<string, any>;
  deposit_deadline?: string;
}

export interface InvoiceWallet {
  id: string;
  created_at: string;
  invoice_id: string;
  wallet_address: string;
  derivation_path: string;
  balance: string;
  required_gas_balance?: string;
  has_received_gas: boolean;
  gas_prefunded_at?: string;
}

export interface Transaction {
  id: string;
  created_at: string;
  updated_at: string;
  invoice_id: string;
  wallet_address: string;
  transaction_hash?: string;
  transaction_type: 'deposit' | 'gas_prefund' | 'sweep';
  amount: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  block_number?: number;
  from_address?: string;
  to_address?: string;
  payment_method: 'ETH' | 'USDT';
}

/**
 * Create a new invoice
 */
export async function createInvoice(
  amount: string,
  paymentMethod: 'ETH' | 'USDT',
  description?: string,
  metadata?: Record<string, any>
): Promise<Invoice | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('invoices')
    .insert([
      {
        amount_required: amount,
        payment_method: paymentMethod,
        status: 'pending',
        description,
        metadata: metadata || {},
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating invoice:', error);
    return null;
  }

  return data as Invoice;
}

/**
 * Get invoice by ID
 */
export async function getInvoice(invoiceId: string): Promise<Invoice | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('invoices')
    .select()
    .eq('id', invoiceId)
    .single();

  if (error) {
    console.error('Error getting invoice:', error);
    return null;
  }

  return data as Invoice;
}

/**
 * Get all invoices
 */
export async function getAllInvoices(): Promise<Invoice[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('invoices')
    .select()
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error getting invoices:', error);
    return [];
  }

  return data as Invoice[];
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  status: Invoice['status']
): Promise<Invoice | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('invoices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .select()
    .single();

  if (error) {
    console.error('Error updating invoice status:', error);
    return null;
  }

  return data as Invoice;
}

/**
 * Create invoice wallet
 */
export async function createInvoiceWallet(
  invoiceId: string,
  walletAddress: string,
  derivationPath: string,
  requiredGasBalance?: string
): Promise<InvoiceWallet | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('invoice_wallets')
    .insert([
      {
        invoice_id: invoiceId,
        wallet_address: walletAddress,
        derivation_path: derivationPath,
        required_gas_balance: requiredGasBalance,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating invoice wallet:', error);
    return null;
  }

  return data as InvoiceWallet;
}

/**
 * Get invoice wallet by invoice ID
 */
export async function getInvoiceWallet(
  invoiceId: string
): Promise<InvoiceWallet | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('invoice_wallets')
    .select()
    .eq('invoice_id', invoiceId)
    .single();

  if (error) {
    console.error('Error getting invoice wallet:', error);
    return null;
  }

  return data as InvoiceWallet;
}

/**
 * Update invoice wallet balance
 */
export async function updateInvoiceWalletBalance(
  invoiceId: string,
  balance: string
): Promise<InvoiceWallet | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('invoice_wallets')
    .update({ balance, updated_at: new Date().toISOString() })
    .eq('invoice_id', invoiceId)
    .select()
    .single();

  if (error) {
    console.error('Error updating invoice wallet balance:', error);
    return null;
  }

  return data as InvoiceWallet;
}

/**
 * Mark invoice wallet as gas prefunded
 */
export async function markWalletAsPrefunded(
  invoiceId: string
): Promise<InvoiceWallet | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('invoice_wallets')
    .update({
      has_received_gas: true,
      gas_prefunded_at: new Date().toISOString(),
    })
    .eq('invoice_id', invoiceId)
    .select()
    .single();

  if (error) {
    console.error('Error marking wallet as prefunded:', error);
    return null;
  }

  return data as InvoiceWallet;
}

/**
 * Create transaction record
 */
export async function createTransaction(
  invoiceId: string,
  walletAddress: string,
  transactionType: Transaction['transaction_type'],
  amount: string,
  paymentMethod: 'ETH' | 'USDT',
  txHash?: string,
  metadata?: Record<string, any>
): Promise<Transaction | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transactions')
    .insert([
      {
        invoice_id: invoiceId,
        wallet_address: walletAddress,
        transaction_type: transactionType,
        amount,
        payment_method: paymentMethod,
        transaction_hash: txHash,
        status: 'pending',
        confirmations: 0,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating transaction:', error);
    return null;
  }

  return data as Transaction;
}

/**
 * Get transactions for invoice
 */
export async function getInvoiceTransactions(
  invoiceId: string
): Promise<Transaction[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transactions')
    .select()
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error getting transactions:', error);
    return [];
  }

  return data as Transaction[];
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  txId: string,
  status: Transaction['status'],
  confirmations?: number,
  blockNumber?: number
): Promise<Transaction | null> {
  const supabase = await createClient();

  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (confirmations !== undefined) {
    updateData.confirmations = confirmations;
  }

  if (blockNumber !== undefined) {
    updateData.block_number = blockNumber;
  }

  const { data, error } = await supabase
    .from('transactions')
    .update(updateData)
    .eq('id', txId)
    .select()
    .single();

  if (error) {
    console.error('Error updating transaction:', error);
    return null;
  }

  return data as Transaction;
}

/**
 * Get transaction by hash
 */
export async function getTransactionByHash(
  txHash: string
): Promise<Transaction | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('transactions')
    .select()
    .eq('transaction_hash', txHash)
    .single();

  if (error) {
    console.error('Error getting transaction by hash:', error);
    return null;
  }

  return data as Transaction;
}
