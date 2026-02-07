'use client'

import React from "react"

import { useState, useEffect } from 'react'
import { ArrowLeft, Copy, Check, DollarSign } from 'lucide-react'
import Link from 'next/link'
import InvoicePaymentMonitor from '@/components/InvoicePaymentMonitor'

export default function InvoicePage() {
  const [step, setStep] = useState<'form' | 'payment'>('form')
  const [invoiceData, setInvoiceData] = useState<any>(null)
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('ETH')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [ethPrice, setEthPrice] = useState<number>(0)
  const [isLoadingPrice, setIsLoadingPrice] = useState(true)
  const [usdEstimate, setUsdEstimate] = useState<number>(0)

  // Fetch ETH price on component mount
  useEffect(() => {
    const fetchETHPrice = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
        )
        
        if (response.ok) {
          const data = await response.json()
          const price = data.ethereum?.usd || 2500
          setEthPrice(price)
        } else {
          setEthPrice(2500) // Fallback price
        }
      } catch (error) {
        console.error('Error fetching ETH price:', error)
        setEthPrice(2500) // Fallback price
      } finally {
        setIsLoadingPrice(false)
      }
    }
    
    fetchETHPrice()
  }, [])

  // Calculate USD estimate whenever amount or currency changes
  useEffect(() => {
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setUsdEstimate(0)
      return
    }
    
    if (currency === 'USDC') {
      setUsdEstimate(numAmount)
    } else if (currency === 'ETH') {
      setUsdEstimate(numAmount * ethPrice)
    }
  }, [amount, currency, ethPrice])

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsCreating(true)

    try {
      if (!amount || parseFloat(amount) <= 0) {
        throw new Error('Please enter a valid amount')
      }

      const response = await fetch('/api/invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amount), currency }),
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
              Generate a unique payment wallet and receive ETH or USDC funds
            </p>

            <form onSubmit={handleCreateInvoice} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.000001"
                    min="0.000001"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                  />
                  {!isLoadingPrice && usdEstimate > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-sm text-slate-400">
                      <DollarSign size={14} />
                      <span>≈ ${usdEstimate.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                {!isLoadingPrice && amount && parseFloat(amount) > 0 && (
                  <p className="text-xs text-slate-400 mt-2">
                    USD Estimate: ${usdEstimate.toFixed(2)} {currency === 'ETH' && `(ETH @ $${ethPrice.toFixed(2)})`}
                  </p>
                )}
                {isLoadingPrice && (
                  <p className="text-xs text-slate-400 mt-2">Loading price data...</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Currency</label>
                <div className="grid grid-cols-2 gap-4">
                  {['ETH', 'USDC'].map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setCurrency(curr)}
                      className={`py-3 px-4 rounded-lg font-medium transition-all ${
                        currency === curr
                          ? 'bg-blue-600 text-white border border-blue-500'
                          : 'bg-slate-700 text-slate-300 border border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {currency === 'ETH'
                    ? 'Native ETH on Optimism (no gas prefunding needed)'
                    : 'USDC token (gas will be prefunded automatically after payment received)'}
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isCreating || !amount}
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
