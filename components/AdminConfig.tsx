'use client'

import React from "react"

import { useState, useEffect } from 'react'
import { Copy, Check, RefreshCw, AlertCircle } from 'lucide-react'

interface AdminConfigProps {
  adminToken: string
}

export default function AdminConfig({ adminToken }: AdminConfigProps) {
  const [config, setConfig] = useState<any>(null)
  const [masterWalletAddress, setMasterWalletAddress] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isConfigured, setIsConfigured] = useState(false); // Declare isConfigured variable
  const [isFullyConfigured, setIsFullyConfigured] = useState(false); // Declare isFullyConfigured variable

  const fetchConfig = async () => {
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/admin/config', {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })

      const data = await response.json()

      if (response.ok) {
        setConfig(data)
        if (data.masterWalletAddress) {
          setMasterWalletAddress(data.masterWalletAddress)
        }
        setIsConfigured(data.configured); // Update isConfigured state
        setIsFullyConfigured(data.masterWalletAddress && data.gasWalletFunded); // Update isFullyConfigured state
      } else {
        setError(data.error || 'Failed to fetch configuration')
      }
    } catch (err) {
      console.error('[v0] Config fetch error:', err)
      setError('Failed to fetch configuration')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchConfig()
  }, [adminToken])

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError('')
    setSuccess('')

    try {
      if (!masterWalletAddress) {
        throw new Error('Master wallet address is required')
      }

      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ masterWalletAddress }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('[v0] Save config error:', data)
        throw new Error(data.error || 'Failed to save configuration')
      }

      setConfig(data.config)
      setSuccess('Configuration saved successfully!')
      // Refresh config after successful save
      setTimeout(() => fetchConfig(), 1000)
    } catch (err) {
      console.error('[v0] Error saving config:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading configuration...</div>
      </div>
    )
  }

  const hasMasterWallet = config?.masterWalletAddress
  const gasWalletFunded = config?.gasWalletFunded

  return (
    <div className="space-y-8">
      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-2">System Status</p>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-xl font-bold text-white">
              {isConfigured ? 'Ready' : 'Pending'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {isConfigured ? 'Ready to accept payments' : 'Waiting for configuration'}
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-2">Master Wallet</p>
          <div className={`text-lg font-bold ${hasMasterWallet ? 'text-green-400' : 'text-red-400'}`}>
            {hasMasterWallet ? '✓ Added' : '✗ Missing'}
          </div>
          <p className="text-xs text-slate-400 mt-2">Fund destination wallet</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-2">Gas Wallet Balance</p>
          <div className={`text-lg font-bold ${gasWalletFunded ? 'text-green-400' : 'text-red-400'}`}>
            {config?.gasWalletBalance?.toFixed(6) || '0'} ETH
          </div>
          <p className="text-xs text-slate-400 mt-2">{gasWalletFunded ? 'Funded' : 'Needs funding'}</p>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Gateway Configuration</h2>
          <button
            onClick={fetchConfig}
            className="p-2 hover:bg-slate-700 rounded transition-colors"
          >
            <RefreshCw size={20} className="text-slate-400" />
          </button>
        </div>

        {!isFullyConfigured && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle size={18} className="text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-yellow-300">Configuration Incomplete</p>
              <p className="text-sm text-yellow-300 mt-1">
                {!hasMasterWallet && 'Add your master wallet address'}
                {hasMasterWallet && !gasWalletFunded && 'Send funds to the gas wallet'}
                {!hasMasterWallet && !gasWalletFunded && 'Complete both steps below'}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveConfig} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Master Wallet Address</label>
            <p className="text-xs text-slate-500 mb-3">
              The wallet address where all funds will be swept after payment confirmation
            </p>
            <input
              type="text"
              value={masterWalletAddress}
              onChange={(e) => setMasterWalletAddress(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition font-mono text-sm"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-500/10 border border-green-500/50 rounded-lg p-4">
              <p className="text-green-400 text-sm">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving || !masterWalletAddress}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
        </form>
      </div>

      {/* Gas Wallet Info */}
      {isConfigured && config?.gasWalletAddress && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Gas Wallet</h2>
          <p className="text-slate-400 mb-4">
            This wallet holds ETH for prefunding gas fees when processing USDT payments. Ensure this wallet
            has sufficient ETH balance.
          </p>

          <div className="space-y-4">
            <div className="p-4 bg-slate-900/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-2">Gas Wallet Address</p>
              <div className="flex items-center justify-between">
                <code className="text-sm text-blue-300 font-mono break-all">{config.gasWalletAddress}</code>
                <button
                  onClick={() => copyToClipboard(config.gasWalletAddress, 'gas-wallet')}
                  className="ml-2 p-2 hover:bg-slate-700 rounded transition-colors"
                >
                  {copied === 'gas-wallet' ? (
                    <Check size={18} className="text-green-400" />
                  ) : (
                    <Copy size={18} className="text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-900/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-2">Current Balance</p>
              <p className="text-2xl font-bold text-blue-400">{config.gasWalletBalance?.toFixed(6)} ETH</p>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-xs text-blue-300 font-medium mb-1">⚠️ Action Required</p>
              <p className="text-xs text-blue-300">
                {config.gasWalletBalance < 0.1
                  ? 'Gas wallet balance is low. Please send ETH to the address above.'
                  : 'Gas wallet has sufficient balance for operations.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Summary */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
        <h2 className="text-2xl font-bold text-white mb-6">Configuration Status</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-slate-700">
            <span className="text-slate-300">1. Master Wallet Address</span>
            <span className={`font-medium ${hasMasterWallet ? 'text-green-400' : 'text-slate-400'}`}>
              {hasMasterWallet ? '✓ Complete' : '⏳ Pending'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-slate-700">
            <span className="text-slate-300">2. Gas Wallet Funded</span>
            <span className={`font-medium ${gasWalletFunded ? 'text-green-400' : 'text-slate-400'}`}>
              {gasWalletFunded ? '✓ Complete' : '⏳ Pending'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-slate-700">
            <span className="text-slate-300">Master Mnemonic</span>
            <span className="text-green-400 font-medium">✓ Environment Variable</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-slate-300">System Ready</span>
            <span className={`font-bold text-lg ${isFullyConfigured ? 'text-green-400' : 'text-yellow-400'}`}>
              {isFullyConfigured ? '✓ Ready' : '⏳ Not Ready'}
            </span>
          </div>
        </div>

        {isFullyConfigured && (
          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm font-medium">
              System is fully configured and ready to accept payments!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
