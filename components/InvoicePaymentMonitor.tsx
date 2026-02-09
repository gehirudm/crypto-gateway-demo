'use client'

import { useState, useEffect } from 'react'
import { Copy, Check, ArrowLeft, Clock } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

interface Invoice {
  id: string
  amount: number
  currency: string
  walletAddress: string
  balance: number
  status: string
  createdAt: string
  merchantName?: string
}

interface InvoicePaymentMonitorProps {
  invoice: Invoice
  onBack: () => void
}

export default function InvoicePaymentMonitor({ invoice, onBack }: InvoicePaymentMonitorProps) {
  const [copied, setCopied] = useState(false)
  const [pollStatus, setPollStatus] = useState<any>(null)
  const [isPolling, setIsPolling] = useState(true)
  const [statusHistory, setStatusHistory] = useState<string[]>([invoice.status])
  const [lastUpdate, setLastUpdate] = useState(new Date())

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pollInvoiceStatus = async () => {
    try {
      const response = await fetch('/api/invoices/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      })

      if (response.ok) {
        const data = await response.json()
        setPollStatus(data.invoice)
        setLastUpdate(new Date())

        if (data.invoice.status !== statusHistory[statusHistory.length - 1]) {
          setStatusHistory([...statusHistory, data.invoice.status])
        }

        if (data.invoice.status === 'completed') {
          setIsPolling(false)
        }
      }
    } catch (error) {
      console.error('Polling error:', error)
    }
  }

  useEffect(() => {
    if (isPolling) {
      pollInvoiceStatus()
      const interval = setInterval(pollInvoiceStatus, 3000)
      return () => clearInterval(interval)
    }
  }, [isPolling])

  const currentStatus = pollStatus || invoice
  const progress = currentStatus.balance / invoice.amount
  const timeLeft = Math.max(0, 1800 - Math.floor((Date.now() - new Date(invoice.createdAt).getTime()) / 1000))

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400'
      case 'sweeping': return 'text-purple-400'
      case 'prefunding': return 'text-yellow-400'
      case 'received': return 'text-blue-400'
      case 'pending': return 'text-slate-400'
      default: return 'text-slate-400'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return '✓ Completed'
      case 'sweeping': return '⚡ Sweeping Funds'
      case 'prefunding': return '⛽ Prefunding TRX for Gas'
      case 'received': return '💰 Payment Received'
      case 'pending': return '⏳ Waiting for Payment'
      default: return status
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Create Another Invoice</span>
        </button>
        <div className="text-right">
          <p className="text-xs text-slate-400">Invoice ID</p>
          <p className="text-sm font-mono text-slate-300">{invoice.id.slice(0, 8)}...</p>
        </div>
      </div>

      {/* Main Status Card */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
        <div className="mb-6">
          <p className="text-sm text-slate-400 mb-2">Current Status</p>
          <div className={`text-3xl font-bold mb-4 ${getStatusColor(currentStatus.status)}`}>
            {getStatusLabel(currentStatus.status)}
          </div>
          {invoice.merchantName && (
            <p className="text-sm text-blue-400">Merchant: {invoice.merchantName}</p>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300">Payment Progress</span>
            <span className="text-sm font-mono text-slate-300">
              {currentStatus.balance.toFixed(2)} / {invoice.amount.toFixed(2)} USDT
            </span>
          </div>
          <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
              style={{ width: `${Math.min(progress * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {Math.round(progress * 100)}% of required amount received
          </p>
        </div>

        {/* Time Remaining */}
        {timeLeft > 0 && currentStatus.status === 'pending' && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-yellow-400" />
              <p className="text-sm text-yellow-300">
                Invoice expires in {Math.floor(timeLeft / 60)}m {timeLeft % 60}s
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Payment Instructions */}
      {currentStatus.status === 'pending' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
          <h3 className="text-lg font-bold text-white mb-4">Payment Instructions</h3>

          <div className="space-y-4">
            {/* QR Code */}
            <div className="flex justify-center p-6 bg-white rounded-lg">
              <QRCodeSVG
                value={invoice.walletAddress}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="p-4 bg-slate-900/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-2">Send USDT (TRC20) to:</p>
              <div className="flex items-center justify-between">
                <code className="text-sm text-blue-300 font-mono break-all">{invoice.walletAddress}</code>
                <button
                  onClick={() => copyToClipboard(invoice.walletAddress)}
                  className="ml-2 p-2 hover:bg-slate-700 rounded transition-colors"
                >
                  {copied ? <Check size={18} className="text-green-400" /> : <Copy size={18} className="text-slate-400" />}
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-900/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-2">Amount Required:</p>
              <p className="text-xl font-bold text-white">
                {invoice.amount.toFixed(2)} USDT
              </p>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-xs text-blue-300 font-medium mb-1">⚠️ Important:</p>
              <p className="text-xs text-blue-300">
                Send <strong>USDT (TRC20)</strong> on the <strong>TRON network</strong> only. 
                Do not send tokens on other networks (ERC20, BEP20, etc.) — they will be lost.
                Gas fees (TRX) are handled automatically after payment is detected.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Status Timeline */}
      {statusHistory.length > 1 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
          <h3 className="text-lg font-bold text-white mb-4">Status Timeline</h3>
          <div className="space-y-2">
            {statusHistory.map((status, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-slate-300">{getStatusLabel(status)}</span>
                {idx === statusHistory.length - 1 && (
                  <span className="text-xs text-slate-500">current</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completion Message */}
      {currentStatus.status === 'completed' && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-8">
          <div className="text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-green-400 mb-2">Payment Completed!</h2>
            <p className="text-slate-300">
              Your USDT payment has been successfully received and processed.
            </p>
            <button
              onClick={onBack}
              className="mt-6 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Create Another Invoice
            </button>
          </div>
        </div>
      )}

      {/* Debug Info */}
      <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4">
        <p className="text-xs text-slate-500 mb-2">Debug Info</p>
        <div className="text-xs font-mono text-slate-500 space-y-1">
          <p>Last Updated: {lastUpdate.toLocaleTimeString()}</p>
          <p>Polling: {isPolling ? 'Active (every 3s)' : 'Stopped'}</p>
          <p>Network: TRON Mainnet</p>
          <p>Token: USDT TRC20</p>
        </div>
      </div>
    </div>
  )
}
