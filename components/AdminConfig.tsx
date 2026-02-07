'use client'

import React from "react"

import { useState, useEffect, useCallback, useRef } from 'react'
import { Copy, Check, RefreshCw, AlertCircle, ArrowUpRight, Loader2, ExternalLink, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

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
  const [isConfigured, setIsConfigured] = useState(false)
  const [isFullyConfigured, setIsFullyConfigured] = useState(false)
  
  // Gas wallet recharging state
  const [isRecharging, setIsRecharging] = useState(false)
  const [rechargePolling, setRechargePolling] = useState(false)
  const [previousBalance, setPreviousBalance] = useState<number | null>(null)
  const [pollingCount, setPollingCount] = useState(0)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // Sweep state
  const [isSweeping, setIsSweeping] = useState(false)
  const [sweepResult, setSweepResult] = useState<any>(null)

  const fetchConfig = useCallback(async () => {
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
        setIsConfigured(data.configured)
        setIsFullyConfigured(data.masterWalletAddress && data.gasWalletFunded)
        return data
      } else {
        setError(data.error || 'Failed to fetch configuration')
        return null
      }
    } catch (err) {
      console.error('[v0] Config fetch error:', err)
      setError('Failed to fetch configuration')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [adminToken])

  // Polling for balance updates during recharge
  const pollForBalanceUpdate = useCallback(async () => {
    if (!rechargePolling) return
    
    try {
      const response = await fetch('/api/admin/config', {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        const currentBalance = data.gasWalletBalance || 0
        
        if (previousBalance !== null && currentBalance > previousBalance) {
          // Balance increased! Stop polling
          setRechargePolling(false)
          setIsRecharging(false)
          setSuccess(`Gas wallet funded successfully! Balance increased by ${(currentBalance - previousBalance).toFixed(6)} ETH`)
          setConfig(data)
          setIsFullyConfigured(data.masterWalletAddress && data.gasWalletFunded)
          setPreviousBalance(null)
          setPollingCount(0)
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
        } else {
          setConfig(data)
          setPollingCount(prev => prev + 1)
        }
      }
    } catch (err) {
      console.error('Polling error:', err)
    }
  }, [adminToken, previousBalance, rechargePolling])

  useEffect(() => {
    if (rechargePolling && !pollingIntervalRef.current) {
      pollingIntervalRef.current = setInterval(pollForBalanceUpdate, 5000) // Poll every 5 seconds
    }
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [rechargePolling, pollForBalanceUpdate])

  useEffect(() => {
    fetchConfig()
  }, [adminToken, fetchConfig])

  const startRecharging = () => {
    setPreviousBalance(config?.gasWalletBalance || 0)
    setIsRecharging(true)
    setRechargePolling(true)
    setPollingCount(0)
    setSuccess('')
    setSweepResult(null)
  }

  const cancelRecharging = () => {
    setIsRecharging(false)
    setRechargePolling(false)
    setPreviousBalance(null)
    setPollingCount(0)
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }

  const handleSweepGasWallet = async () => {
    setIsSweeping(true)
    setError('')
    setSuccess('')
    setSweepResult(null)
    
    try {
      const response = await fetch('/api/admin/gas-wallet/sweep', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setSweepResult(data)
        setSuccess(`Successfully swept ${data.amountSwept} ETH to master wallet!`)
        // Refresh config to get new balance
        await fetchConfig()
      } else {
        setError(data.error || 'Failed to sweep gas wallet')
      }
    } catch (err) {
      setError('Failed to sweep gas wallet')
    } finally {
      setIsSweeping(false)
    }
  }

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
      {config?.gasWalletAddress && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Gas Wallet</h2>
            <button
              onClick={fetchConfig}
              disabled={rechargePolling}
              className="p-2 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw size={20} className={`text-slate-400 ${rechargePolling ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-slate-400 mb-6">
            This wallet holds ETH for prefunding gas fees when processing USDC payments. Ensure this wallet
            has sufficient ETH balance.
          </p>

          <div className="space-y-4">
            {/* Gas Wallet Address */}
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

            {/* Current Balance */}
            <div className="p-4 bg-slate-900/50 rounded-lg">
              <p className="text-xs text-slate-400 mb-2">Current Balance</p>
              <p className="text-2xl font-bold text-blue-400">
                {config.gasWalletBalance?.toFixed(6) || '0.000000'} ETH
              </p>
              {rechargePolling && previousBalance !== null && (
                <p className="text-xs text-slate-500 mt-1">
                  Watching for changes... (checked {pollingCount} times)
                </p>
              )}
            </div>

            {/* Recharge Flow */}
            {!isRecharging ? (
              <div className="flex gap-3">
                <button
                  onClick={startRecharging}
                  className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowUpRight size={18} />
                  Recharge Gas Wallet
                </button>
                {config.gasWalletBalance > 0 && (
                  <button
                    onClick={handleSweepGasWallet}
                    disabled={isSweeping}
                    className="py-3 px-4 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {isSweeping ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <ArrowUpRight size={18} />
                    )}
                    {isSweeping ? 'Sweeping...' : 'Sweep to Master'}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Recharge Instructions */}
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-green-300 font-medium mb-3 flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Waiting for deposit...
                  </p>
                  <div className="space-y-3">
                    {/* QR Code */}
                    <div className="flex justify-center">
                      <div className="p-3 bg-white rounded-lg">
                        <QRCodeSVG value={config.gasWalletAddress} size={200} level="H" />
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-xs text-green-300/70 mb-1">Send ETH to this address:</p>
                      <div className="flex items-center gap-2 p-2 bg-slate-900/50 rounded">
                        <code className="text-sm text-green-300 font-mono break-all flex-1">
                          {config.gasWalletAddress}
                        </code>
                        <button
                          onClick={() => copyToClipboard(config.gasWalletAddress, 'recharge-address')}
                          className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                        >
                          {copied === 'recharge-address' ? (
                            <Check size={16} className="text-green-400" />
                          ) : (
                            <Copy size={16} className="text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-green-300/70">
                      <span>Starting balance: {previousBalance?.toFixed(6)} ETH</span>
                      <span>Current: {config.gasWalletBalance?.toFixed(6)} ETH</span>
                    </div>
                    <p className="text-xs text-green-300/70">
                      The system is polling every 5 seconds to detect your deposit.
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={cancelRecharging}
                  className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Sweep Result */}
            {sweepResult && (
              <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <p className="text-orange-300 font-medium mb-2">Sweep Completed</p>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount Swept:</span>
                    <span className="text-orange-300">{sweepResult.amountSwept} ETH</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Gas Cost:</span>
                    <span className="text-slate-300">{sweepResult.gasCost} ETH</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Transaction:</span>
                    <a
                      href={`https://sepolia-optimism.etherscan.io/tx/${sweepResult.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      View <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Status Message */}
            <div className={`p-4 rounded-lg ${
              config.gasWalletBalance < 0.0001 
                ? 'bg-red-500/10 border border-red-500/30' 
                : config.gasWalletBalance < 0.00025 
                ? 'bg-yellow-500/10 border border-yellow-500/30'
                : 'bg-green-500/10 border border-green-500/30'
            }`}>
              <p className={`text-xs font-medium mb-1 ${
                config.gasWalletBalance < 0.0001 
                  ? 'text-red-300' 
                  : config.gasWalletBalance < 0.00025 
                  ? 'text-yellow-300'
                  : 'text-green-300'
              }`}>
                {config.gasWalletBalance < 0.0001 
                  ? '⚠️ Critical: Gas wallet needs funding!' 
                  : config.gasWalletBalance < 0.00025 
                  ? '⚠️ Warning: Gas wallet balance is low'
                  : '✓ Gas wallet has sufficient balance'}
              </p>
              <p className={`text-xs ${
                config.gasWalletBalance < 0.0001 
                  ? 'text-red-300/70' 
                  : config.gasWalletBalance < 0.00025 
                  ? 'text-yellow-300/70'
                  : 'text-green-300/70'
              }`}>
                {config.gasWalletBalance < 0.00025
                  ? 'Click "Recharge Gas Wallet" above to add funds.'
                  : 'System is ready to process payments.'}
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
