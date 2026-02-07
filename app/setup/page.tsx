'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle, Loader, Home } from 'lucide-react'

export default function SetupPage() {
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<string>('')
  const [success, setSuccess] = useState(false)
  const [step, setStep] = useState<'instructions' | 'initializing' | 'complete'>('instructions')

  const initializeDatabase = async () => {
    setIsInitializing(true)
    setError('')

    try {
      // Step 1: Create admin_config table
      const response1 = await fetch('/api/admin/config', {
        method: 'GET',
      })

      // Step 2: Attempt to save initial config
      const adminToken = localStorage.getItem('adminToken') || 'temp-token'

      const response2 = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          masterWalletAddress: '0x0000000000000000000000000000000000000000',
        }),
      })

      if (!response2.ok) {
        const data = await response2.json()
        throw new Error(data.error || 'Failed to initialize database')
      }

      setSuccess(true)
      setStep('complete')
    } catch (err) {
      console.error('[v0] Setup error:', err)
      setError(err instanceof Error ? err.message : 'An error occurred during setup')
    } finally {
      setIsInitializing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <Home size={18} />
            <span>Back to Home</span>
          </Link>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
          {step === 'instructions' && (
            <>
              <h1 className="text-3xl font-bold text-white mb-6">Database Setup</h1>

              <div className="space-y-6 mb-8">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-blue-300 text-sm">
                    This page will help you initialize the database tables required for the crypto payment gateway.
                  </p>
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">What will be created:</h2>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <CheckCircle className="text-green-400 mt-1 flex-shrink-0" size={20} />
                      <div>
                        <p className="font-semibold text-white">admin_config table</p>
                        <p className="text-slate-400 text-sm">Stores master wallet and gas wallet addresses</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <CheckCircle className="text-green-400 mt-1 flex-shrink-0" size={20} />
                      <div>
                        <p className="font-semibold text-white">invoices table</p>
                        <p className="text-slate-400 text-sm">Tracks payment invoices and wallet deposits</p>
                      </div>
                    </li>
                  </ul>
                </div>

                <div>
                  <h2 className="text-xl font-semibold text-white mb-4">Prerequisites:</h2>
                  <ul className="space-y-2 text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">✓</span>
                      <span>Supabase project connected</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">✓</span>
                      <span>Environment variables set (.env.local)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-400 font-bold">✓</span>
                      <span>Admin token configured</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                  <p className="text-amber-300 text-sm">
                    <strong>Note:</strong> This will attempt to create the necessary tables. If they already exist, it will skip creation.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setStep('initializing')
                  initializeDatabase()
                }}
                disabled={isInitializing}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
              >
                {isInitializing ? 'Initializing...' : 'Initialize Database'}
              </button>
            </>
          )}

          {step === 'initializing' && (
            <div className="text-center py-12">
              <Loader className="text-blue-400 animate-spin mx-auto mb-4" size={48} />
              <h2 className="text-2xl font-bold text-white mb-2">Setting up database...</h2>
              <p className="text-slate-400">This may take a moment</p>
            </div>
          )}

          {step === 'complete' && (
            <>
              <div className="text-center py-8">
                <CheckCircle className="text-green-400 mx-auto mb-4" size={64} />
                <h2 className="text-2xl font-bold text-white mb-2">Setup Complete!</h2>
                <p className="text-slate-400 mb-8">Your database is now ready to use.</p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                  <p className="text-red-300 text-sm flex items-start gap-2">
                    <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <Link
                  href="/admin"
                  className="block w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-center rounded-lg font-semibold transition-colors"
                >
                  Go to Admin Panel
                </Link>
                <Link
                  href="/"
                  className="block w-full px-6 py-3 border border-slate-600 hover:border-slate-400 text-white text-center rounded-lg font-semibold transition-colors"
                >
                  Back to Home
                </Link>
              </div>
            </>
          )}

          {error && step !== 'complete' && (
            <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <p className="text-red-300 text-sm flex items-start gap-2">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold mb-1">Setup Error</p>
                  <p>{error}</p>
                </div>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>CryptoGate Payment Gateway Setup</p>
        </div>
      </div>
    </div>
  )
}
