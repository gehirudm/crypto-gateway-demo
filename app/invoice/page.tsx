'use client'

import React from "react"

import { useState, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import InvoicePaymentMonitor from '@/components/InvoicePaymentMonitor'

interface MerchantOption {
  id: string
  name: string
}

export default function InvoicePage() {
  const [step, setStep] = useState<'form' | 'payment'>('form')
  const [invoiceData, setInvoiceData] = useState<any>(null)
  const [amount, setAmount] = useState('')
  const [merchantId, setMerchantId] = useState('')
  const [merchants, setMerchants] = useState<MerchantOption[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [isLoadingMerchants, setIsLoadingMerchants] = useState(true)
  const [error, setError] = useState('')

  // Fetch active merchants
  useEffect(() => {
    const fetchMerchants = async () => {
      try {
        const response = await fetch('/api/merchants')
        if (response.ok) {
          const data = await response.json()
          const active = data.merchants || []
          setMerchants(active.map((m: any) => ({ id: m.id, name: m.name })))
          if (active.length > 0) setMerchantId(active[0].id)
        }
      } catch (err) {
        console.error('Failed to load merchants:', err)
      } finally {
        setIsLoadingMerchants(false)
      }
    }
    fetchMerchants()
  }, [])

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsCreating(true)

    try {
      if (!amount || parseFloat(amount) <= 0) throw new Error('Please enter a valid amount')
      if (!merchantId) throw new Error('Please select a merchant')

      const response = await fetch('/api/invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amount), merchantId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create invoice')
      }

      const data = await response.json()
      setInvoiceData(data.invoice)
      setStep('payment')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
            <ArrowLeft size={20} />
            <span>Back to Home</span>
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {step === 'form' && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
            <h1 className="text-3xl font-bold text-white mb-2">Create Payment</h1>
            <p className="text-slate-400 mb-8">
              Generate a unique wallet and receive USDT (ERC20) payments on Optimism
            </p>

            <form onSubmit={handleCreateInvoice} className="space-y-6">
              {/* Merchant Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Merchant</label>
                {isLoadingMerchants ? (
                  <p className="text-sm text-slate-400">Loading merchants...</p>
                ) : merchants.length === 0 ? (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-300">
                      No merchants configured. Please ask an admin to add a merchant first.
                    </p>
                  </div>
                ) : (
                  <select
                    value={merchantId}
                    onChange={(e) => setMerchantId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                  >
                    {merchants.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Amount (USDT)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter USDT amount"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                  />
                  {amount && parseFloat(amount) > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                      ≈ ${parseFloat(amount).toFixed(2)}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  USDT is pegged 1:1 to USD. Amount shown is approximate USD value.
                </p>
              </div>

              {/* Currency Badge */}
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center text-green-400 font-bold text-xs">₮</div>
                <div>
                  <p className="text-sm font-medium text-white">USDT (ERC20)</p>
                  <p className="text-xs text-slate-400">Tether USD on Optimism Network</p>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isCreating || !amount || !merchantId || merchants.length === 0}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors"
              >
                {isCreating ? 'Creating Invoice...' : 'Create Invoice'}
              </button>
            </form>
          </div>
        )}

        {step === 'payment' && invoiceData && (
          <InvoicePaymentMonitor invoice={invoiceData} onBack={() => setStep('form')} />
        )}
      </div>
    </div>
  )
}
