'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Copy, Check, ExternalLink } from 'lucide-react'

interface AdminTransactionsProps {
  adminToken: string
}

export default function AdminTransactions({ adminToken }: AdminTransactionsProps) {
  const [invoices, setInvoices] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  const fetchTransactions = async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/admin/transactions', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      if (response.ok) {
        const data = await response.json()
        setInvoices(data.invoices)
      } else {
        setError('Failed to fetch transactions')
      }
    } catch (err) {
      setError('Failed to fetch transactions')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [adminToken])

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500/10 text-green-300 border-green-500/30'
      case 'sweeping': return 'bg-purple-500/10 text-purple-300 border-purple-500/30'
      case 'prefunding': return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30'
      case 'received': return 'bg-blue-500/10 text-blue-300 border-blue-500/30'
      case 'pending': return 'bg-slate-500/10 text-slate-300 border-slate-500/30'
      case 'failed': return 'bg-red-500/10 text-red-300 border-red-500/30'
      default: return 'bg-slate-500/10 text-slate-300 border-slate-500/30'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return '✓ Completed'
      case 'sweeping': return '⚡ Sweeping'
      case 'prefunding': return '⛽ Prefunding'
      case 'received': return '💰 Received'
      case 'pending': return '⏳ Pending'
      case 'failed': return '✗ Failed'
      default: return status
    }
  }

  const tronscanTx = (hash: string) => `https://tronscan.org/#/transaction/${hash}`
  const tronscanAddr = (addr: string) => `https://tronscan.org/#/address/${addr}`

  const filteredInvoices = filterStatus
    ? invoices.filter((inv) => inv.status === filterStatus)
    : invoices

  const stats = {
    total: invoices.length,
    completed: invoices.filter((i) => i.status === 'completed').length,
    pending: invoices.filter((i) => i.status === 'pending').length,
    processing: invoices.filter((i) => ['received', 'sweeping', 'prefunding'].includes(i.status)).length,
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">Total Invoices</p>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <p className="text-xs text-green-300 mb-1">Completed</p>
          <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-xs text-yellow-300 mb-1">Processing</p>
          <p className="text-2xl font-bold text-yellow-400">{stats.processing}</p>
        </div>
        <div className="bg-slate-500/10 border border-slate-500/30 rounded-xl p-4">
          <p className="text-xs text-slate-300 mb-1">Pending</p>
          <p className="text-2xl font-bold text-slate-300">{stats.pending}</p>
        </div>
      </div>

      {/* Filter & Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Filter:</span>
          <select
            value={filterStatus || ''}
            onChange={(e) => setFilterStatus(e.target.value || null)}
            className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-300 text-sm focus:border-blue-500 outline-none"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="received">Received</option>
            <option value="prefunding">Prefunding</option>
            <option value="sweeping">Sweeping</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <button
          onClick={fetchTransactions}
          disabled={isLoading}
          className="p-2 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
        >
          <RefreshCw size={20} className={`text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Transactions */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-slate-400">Loading transactions...</div>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
          <p className="text-slate-400">No invoices found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredInvoices.map((invoice) => (
            <div key={invoice.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:bg-slate-800/80 transition-colors">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Invoice ID</p>
                  <p className="font-mono text-sm text-slate-300">{invoice.id.slice(0, 12)}...</p>
                  {invoice.merchants?.name && (
                    <p className="text-xs text-blue-400 mt-1">Merchant: {invoice.merchants.name}</p>
                  )}
                </div>
                <div className={`px-3 py-1 rounded-full border text-xs font-medium ${getStatusColor(invoice.status)}`}>
                  {getStatusLabel(invoice.status)}
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Amount</p>
                  <p className="font-semibold text-white">
                    {Number(invoice.amount_expected)?.toFixed(2) || '0'} USDT
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Balance</p>
                  <p className={`font-semibold ${
                    (invoice.current_balance || 0) >= (invoice.amount_expected || 0)
                      ? 'text-green-400' : 'text-slate-300'
                  }`}>
                    {Number(invoice.current_balance)?.toFixed(2) || '0'} USDT
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Commission</p>
                  <p className="font-semibold text-orange-400">
                    {invoice.commission_amount != null ? `${Number(invoice.commission_amount).toFixed(2)} USDT` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">To Merchant</p>
                  <p className="font-semibold text-green-400">
                    {invoice.merchant_amount != null ? `${Number(invoice.merchant_amount).toFixed(2)} USDT` : '—'}
                  </p>
                </div>
              </div>

              {/* Wallet Address */}
              <div className="mb-4 p-3 bg-slate-900/50 rounded-lg">
                <p className="text-xs text-slate-400 mb-1">Invoice Wallet</p>
                <div className="flex items-center justify-between">
                  <a
                    href={tronscanAddr(invoice.wallet_address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-300 font-mono break-all hover:text-blue-200"
                  >
                    {invoice.wallet_address}
                  </a>
                  <button
                    onClick={() => copyToClipboard(invoice.wallet_address, `wallet-${invoice.id}`)}
                    className="ml-2 p-2 hover:bg-slate-700 rounded transition-colors flex-shrink-0"
                  >
                    {copied === `wallet-${invoice.id}` ? (
                      <Check size={16} className="text-green-400" />
                    ) : (
                      <Copy size={16} className="text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              {invoice.amount_expected && (
                <div className="mb-4">
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                      style={{
                        width: `${Math.min(((invoice.current_balance || 0) / invoice.amount_expected) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Transaction Links */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                {invoice.created_at && (
                  <div>
                    <p className="text-slate-400">Created</p>
                    <p className="text-slate-200">{new Date(invoice.created_at).toLocaleString()}</p>
                  </div>
                )}
                {invoice.last_checked_at && (
                  <div>
                    <p className="text-slate-400">Last Checked</p>
                    <p className="text-slate-200">{new Date(invoice.last_checked_at).toLocaleTimeString()}</p>
                  </div>
                )}
                {invoice.gas_prefund_amount != null && Number(invoice.gas_prefund_amount) > 0 && (
                  <div>
                    <p className="text-slate-400">Gas Prefunded</p>
                    <p className="text-yellow-300 font-medium">{Number(invoice.gas_prefund_amount).toFixed(2)} TRX</p>
                  </div>
                )}
                {invoice.gas_prefund_tx_hash && (
                  <div>
                    <p className="text-slate-400">Prefund Tx</p>
                    <a href={tronscanTx(invoice.gas_prefund_tx_hash)} target="_blank" rel="noopener noreferrer"
                      className="text-yellow-300 hover:text-yellow-200 flex items-center gap-1">
                      {invoice.gas_prefund_tx_hash.slice(0, 10)}... <ExternalLink size={10} />
                    </a>
                  </div>
                )}
                {invoice.commission_tx_hash && (
                  <div>
                    <p className="text-slate-400">Commission Tx</p>
                    <a href={tronscanTx(invoice.commission_tx_hash)} target="_blank" rel="noopener noreferrer"
                      className="text-orange-300 hover:text-orange-200 flex items-center gap-1">
                      {invoice.commission_tx_hash.slice(0, 10)}... <ExternalLink size={10} />
                    </a>
                  </div>
                )}
                {invoice.merchant_tx_hash && (
                  <div>
                    <p className="text-slate-400">Merchant Tx</p>
                    <a href={tronscanTx(invoice.merchant_tx_hash)} target="_blank" rel="noopener noreferrer"
                      className="text-green-300 hover:text-green-200 flex items-center gap-1">
                      {invoice.merchant_tx_hash.slice(0, 10)}... <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
