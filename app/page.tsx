'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Zap, Shield, Wallet } from 'lucide-react'

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white">
                ₿
              </div>
              <span className="text-xl font-bold text-white">CryptoGate</span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Admin Panel
              </Link>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">
                Connect Wallet
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-5xl sm:text-6xl font-bold text-white mb-6 leading-tight">
            Decentralized Payment Processing
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Accept ETH and USDT payments instantly on Optimism with dedicated invoice wallets,
            automatic fund sweeping, and complete transaction transparency.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/invoice"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-all hover:gap-3"
            >
              Create Invoice
              <ArrowRight size={20} />
            </Link>
            <button className="px-8 py-4 border border-slate-600 hover:border-slate-400 text-white rounded-lg font-semibold transition-colors hover:bg-slate-800/50">
              Learn More
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 hover:bg-slate-800/80 transition-colors">
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
              <Zap className="text-blue-400" size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Instant Payments</h3>
            <p className="text-slate-400">
              Process crypto payments instantly with real-time balance monitoring and automatic
              transaction confirmation.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 hover:bg-slate-800/80 transition-colors">
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
              <Shield className="text-blue-400" size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Secure & Non-Custodial</h3>
            <p className="text-slate-400">
              Each invoice generates a unique wallet from your master mnemonic. Funds are never held
              in our system.
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 hover:bg-slate-800/80 transition-colors">
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
              <Wallet className="text-blue-400" size={24} />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Smart Fund Sweeping</h3>
            <p className="text-slate-400">
              Automatic fund sweeping to your master wallet with intelligent gas prefunding for
              USDT transactions.
            </p>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="mt-20 bg-slate-800/30 border border-slate-700 rounded-xl p-12">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Powered By</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">⚙️</div>
              <p className="text-slate-300 font-medium">Optimism Network</p>
              <p className="text-sm text-slate-500">ETH + USDT</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">🔐</div>
              <p className="text-slate-300 font-medium">HD Wallets</p>
              <p className="text-sm text-slate-500">BIP-44 Derivation</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">📊</div>
              <p className="text-slate-300 font-medium">Real-time Monitoring</p>
              <p className="text-sm text-slate-500">Live Polling</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="text-3xl font-bold text-blue-400 mb-2">🗄️</div>
              <p className="text-slate-300 font-medium">Full Transparency</p>
              <p className="text-sm text-slate-500">Transaction History</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 backdrop-blur-sm mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white text-sm">
                ₿
              </div>
              <span className="font-semibold text-white">CryptoGate Demo</span>
            </div>
            <p className="text-sm text-slate-400">
              Non-custodial decentralized payments on Optimism
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
