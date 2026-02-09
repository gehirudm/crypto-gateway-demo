'use client'

import Link from 'next/link'
import { Settings, Send } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">PaymentGateway</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Crypto Payment Gateway
          </h1>
          <p className="text-lg text-slate-300">
            Accept USDT (ERC20) payments on Optimism
          </p>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Configuration Card */}
          <Link
            href="/admin"
            className="group bg-slate-800/50 border border-slate-700 rounded-xl p-8 hover:bg-slate-800/80 hover:border-blue-600/50 transition-all"
          >
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600/30 transition-colors">
              <Settings className="text-blue-400" size={28} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Configuration</h2>
            <p className="text-slate-400 mb-4">
              Set up your master wallet, manage merchants, and configure commission
            </p>
            <div className="inline-block px-4 py-2 bg-blue-600/20 group-hover:bg-blue-600/30 text-blue-400 rounded-lg font-medium transition-colors">
              Go to Admin
            </div>
          </Link>

          {/* Payment Card */}
          <Link
            href="/invoice"
            className="group bg-slate-800/50 border border-slate-700 rounded-xl p-8 hover:bg-slate-800/80 hover:border-blue-600/50 transition-all"
          >
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600/30 transition-colors">
              <Send className="text-blue-400" size={28} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Create Payment</h2>
            <p className="text-slate-400 mb-4">
              Generate a new invoice and receive USDT payments on Optimism
            </p>
            <div className="inline-block px-4 py-2 bg-blue-600/20 group-hover:bg-blue-600/30 text-blue-400 rounded-lg font-medium transition-colors">
              New Invoice
            </div>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 backdrop-blur-sm mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-2 mb-4 md:mb-0">
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
