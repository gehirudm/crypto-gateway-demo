'use client'

import React from "react"

import { useState, useEffect } from 'react'
import { ArrowLeft, Settings, Wallet, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import AdminConfig from '@/components/AdminConfig'
import AdminTransactions from '@/components/AdminTransactions'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'transactions'>('config')
  const [adminToken, setAdminToken] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authError, setAuthError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    setIsAuthenticating(true)

    try {
      const response = await fetch('/api/admin/config', {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })

      if (response.ok) {
        setIsAuthenticated(true)
        localStorage.setItem('adminToken', adminToken)
      } else if (response.status === 401) {
        setAuthError('Invalid admin token')
      } else {
        setAuthError('Authentication failed')
      }
    } catch (error) {
      setAuthError('Failed to authenticate')
    } finally {
      setIsAuthenticating(false)
    }
  }

  useEffect(() => {
    const savedToken = localStorage.getItem('adminToken')
    if (savedToken) {
      setAdminToken(savedToken)
      setIsAuthenticated(true)
    }
  }, [])

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <nav className="border-b border-slate-700/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link href="/" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
              <ArrowLeft size={20} />
              <span>Back to Home</span>
            </Link>
          </div>
        </nav>

        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
            <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
            <p className="text-slate-400 mb-8">
              Enter your admin token to access the admin panel
            </p>

            <form onSubmit={handleAuthSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Admin Token</label>
                <input
                  type="password"
                  value={adminToken}
                  onChange={(e) => setAdminToken(e.target.value)}
                  placeholder="Enter your admin token"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
                />
              </div>

              {authError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
                  <p className="text-red-400 text-sm">{authError}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isAuthenticating || !adminToken}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors"
              >
                {isAuthenticating ? 'Authenticating...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors">
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
                <p className="text-xs text-slate-400">Gateway Configuration & Management</p>
              </div>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem('adminToken')
                setIsAuthenticated(false)
              }}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      {/* Tabs */}
      <div className="border-b border-slate-700/50 backdrop-blur-sm sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('config')}
              className={`py-4 px-2 font-medium transition-colors border-b-2 ${
                activeTab === 'config'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Settings size={18} />
                Configuration
              </div>
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-4 px-2 font-medium transition-colors border-b-2 ${
                activeTab === 'transactions'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp size={18} />
                Transactions
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {activeTab === 'config' && <AdminConfig adminToken={adminToken} />}
        {activeTab === 'transactions' && <AdminTransactions adminToken={adminToken} />}
      </div>
    </div>
  )
}
