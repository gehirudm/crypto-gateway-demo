'use client'

import React from "react"

import { useState, useEffect, useCallback, useRef } from 'react'
import { Copy, Check, RefreshCw, AlertCircle, ArrowUpRight, Loader2, ExternalLink, Plus, Trash2, Edit2, Save, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

interface AdminConfigProps {
  adminToken: string
}

interface MerchantData {
  id: string
  name: string
  external_wallet_address: string
  derivation_index: number
  derived_wallet_address: string
  is_active: boolean
  usdtBalance?: number
  trxBalance?: number
}

export default function AdminConfig({ adminToken }: AdminConfigProps) {
  const [config, setConfig] = useState<any>(null)
  const [masterWalletAddress, setMasterWalletAddress] = useState('')
  const [commissionRate, setCommissionRate] = useState<number>(5.0)
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

  // Merchant state
  const [merchants, setMerchants] = useState<MerchantData[]>([])
  const [isMerchantsLoading, setIsMerchantsLoading] = useState(false)
  const [newMerchantName, setNewMerchantName] = useState('')
  const [newMerchantWallet, setNewMerchantWallet] = useState('')
  const [isCreatingMerchant, setIsCreatingMerchant] = useState(false)
  const [merchantError, setMerchantError] = useState('')
  const [merchantSuccess, setMerchantSuccess] = useState('')
  const [editingMerchantId, setEditingMerchantId] = useState<string | null>(null)
  const [editMerchantName, setEditMerchantName] = useState('')
  const [editMerchantWallet, setEditMerchantWallet] = useState('')
  const [sweepingMerchantId, setSweepingMerchantId] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch('/api/admin/config', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      const data = await response.json()

      if (response.ok) {
        setConfig(data)
        if (data.masterWalletAddress) setMasterWalletAddress(data.masterWalletAddress)
        if (data.commissionRate !== undefined) setCommissionRate(data.commissionRate)
        setIsConfigured(data.configured)
        setIsFullyConfigured(data.masterWalletAddress && data.gasWalletFunded)
        return data
      } else {
        setError(data.error || 'Failed to fetch configuration')
        return null
      }
    } catch (err) {
      console.error('Config fetch error:', err)
      setError('Failed to fetch configuration')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [adminToken])

  const fetchMerchants = useCallback(async () => {
    setIsMerchantsLoading(true)
    try {
      const response = await fetch('/api/admin/merchants', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      if (response.ok) {
        const data = await response.json()
        setMerchants(data.merchants || [])
      }
    } catch (err) {
      console.error('Error fetching merchants:', err)
    } finally {
      setIsMerchantsLoading(false)
    }
  }, [adminToken])

  // Polling for balance updates during recharge
  const pollForBalanceUpdate = useCallback(async () => {
    if (!rechargePolling) return
    
    try {
      const response = await fetch('/api/admin/config', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      
      if (response.ok) {
        const data = await response.json()
        const currentBalance = data.gasWalletBalance || 0
        
        if (previousBalance !== null && currentBalance > previousBalance) {
          setRechargePolling(false)
          setIsRecharging(false)
          setSuccess(`Gas wallet funded! Balance increased by ${(currentBalance - previousBalance).toFixed(2)} TRX`)
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
      pollingIntervalRef.current = setInterval(pollForBalanceUpdate, 5000)
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
    fetchMerchants()
  }, [adminToken, fetchConfig, fetchMerchants])

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
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setSweepResult(data)
        setSuccess(`Successfully swept ${data.amountSwept.toFixed(2)} TRX to master wallet!`)
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
      if (!masterWalletAddress) throw new Error('Master wallet address is required')

      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ masterWalletAddress, commissionRate }),
      })

      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Failed to save configuration')

      setConfig(data.config)
      setSuccess('Configuration saved successfully!')
      setTimeout(() => fetchConfig(), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  // Merchant handlers
  const handleCreateMerchant = async () => {
    if (!newMerchantName.trim()) return
    setIsCreatingMerchant(true)
    setMerchantError('')
    setMerchantSuccess('')

    try {
      const response = await fetch('/api/admin/merchants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          action: 'create',
          name: newMerchantName.trim(),
          externalWalletAddress: newMerchantWallet.trim() || undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setMerchantSuccess(`Merchant "${newMerchantName}" created!`)
      setNewMerchantName('')
      setNewMerchantWallet('')
      await fetchMerchants()
    } catch (err) {
      setMerchantError(err instanceof Error ? err.message : 'Failed to create merchant')
    } finally {
      setIsCreatingMerchant(false)
    }
  }

  const handleUpdateMerchant = async (merchantId: string) => {
    setMerchantError('')
    try {
      const response = await fetch('/api/admin/merchants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          action: 'update',
          merchantId,
          name: editMerchantName,
          externalWalletAddress: editMerchantWallet,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setEditingMerchantId(null)
      setMerchantSuccess('Merchant updated!')
      await fetchMerchants()
    } catch (err) {
      setMerchantError(err instanceof Error ? err.message : 'Failed to update merchant')
    }
  }

  const handleToggleMerchant = async (merchantId: string, isActive: boolean) => {
    try {
      await fetch('/api/admin/merchants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ action: 'update', merchantId, isActive: !isActive }),
      })
      await fetchMerchants()
    } catch (err) {
      setMerchantError('Failed to toggle merchant')
    }
  }

  const handleSweepMerchant = async (merchantId: string) => {
    setSweepingMerchantId(merchantId)
    setMerchantError('')
    setMerchantSuccess('')

    try {
      const response = await fetch('/api/admin/merchants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ action: 'sweep', merchantId }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      setMerchantSuccess(`Swept ${data.amountSwept.toFixed(6)} USDT to ${data.destination}`)
      await fetchMerchants()
    } catch (err) {
      setMerchantError(err instanceof Error ? err.message : 'Failed to sweep merchant')
    } finally {
      setSweepingMerchantId(null)
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
            {isConfigured ? 'Ready to accept USDT payments' : 'Waiting for configuration'}
          </p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-2">Commission Rate</p>
          <div className="text-lg font-bold text-blue-400">
            {config?.commissionRate ?? 5.0}%
          </div>
          <p className="text-xs text-slate-400 mt-2">Per invoice commission cut</p>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <p className="text-sm text-slate-400 mb-2">Gas Wallet (TRX)</p>
          <div className={`text-lg font-bold ${gasWalletFunded ? 'text-green-400' : 'text-red-400'}`}>
            {config?.gasWalletBalance?.toFixed(2) || '0'} TRX
          </div>
          <p className="text-xs text-slate-400 mt-2">{gasWalletFunded ? 'Funded' : 'Needs funding (>10 TRX)'}</p>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Gateway Configuration</h2>
          <button onClick={fetchConfig} className="p-2 hover:bg-slate-700 rounded transition-colors">
            <RefreshCw size={20} className="text-slate-400" />
          </button>
        </div>

        {!isFullyConfigured && (
          <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-3">
            <AlertCircle size={18} className="text-yellow-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-yellow-300">Configuration Incomplete</p>
              <p className="text-sm text-yellow-300 mt-1">
                {!hasMasterWallet && !gasWalletFunded && 'Set master wallet and fund gas wallet'}
                {!hasMasterWallet && gasWalletFunded && 'Add your master TRON wallet address'}
                {hasMasterWallet && !gasWalletFunded && 'Send TRX to the gas wallet for energy fees'}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveConfig} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Master Wallet Address (TRON)</label>
            <p className="text-xs text-slate-500 mb-3">
              Commission fees will be sent to this TRON address
            </p>
            <input
              type="text"
              value={masterWalletAddress}
              onChange={(e) => setMasterWalletAddress(e.target.value)}
              placeholder="T..."
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Commission Rate (%)</label>
            <p className="text-xs text-slate-500 mb-3">
              Percentage cut taken from each invoice and sent to master wallet
            </p>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={commissionRate}
              onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition text-sm"
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
            <h2 className="text-2xl font-bold text-white">Gas Wallet (TRX)</h2>
            <button
              onClick={fetchConfig}
              disabled={rechargePolling}
              className="p-2 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw size={20} className={`text-slate-400 ${rechargePolling ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-slate-400 mb-6">
            This wallet holds TRX for energy fees when processing USDT TRC20 transfers. Ensure it has
            sufficient TRX balance.
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
                {config.gasWalletBalance?.toFixed(2) || '0.00'} TRX
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
                    {isSweeping ? <Loader2 size={18} className="animate-spin" /> : <ArrowUpRight size={18} />}
                    {isSweeping ? 'Sweeping...' : 'Sweep to Master'}
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-green-300 font-medium mb-3 flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Waiting for TRX deposit...
                  </p>
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <div className="p-3 bg-white rounded-lg">
                        <QRCodeSVG value={config.gasWalletAddress} size={200} level="H" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-green-300/70 mb-1">Send TRX to this TRON address:</p>
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
                      <span>Starting balance: {previousBalance?.toFixed(2)} TRX</span>
                      <span>Current: {config.gasWalletBalance?.toFixed(2)} TRX</span>
                    </div>
                    <p className="text-xs text-green-300/70">
                      Polling every 5 seconds to detect your deposit. Min 10 TRX recommended.
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
                    <span className="text-orange-300">{sweepResult.amountSwept?.toFixed(2)} TRX</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Transaction:</span>
                    <a
                      href={`https://tronscan.org/#/transaction/${sweepResult.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      View on TronScan <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Status Message */}
            <div className={`p-4 rounded-lg ${
              (config.gasWalletBalance || 0) < 10
                ? 'bg-red-500/10 border border-red-500/30' 
                : (config.gasWalletBalance || 0) < 50
                ? 'bg-yellow-500/10 border border-yellow-500/30'
                : 'bg-green-500/10 border border-green-500/30'
            }`}>
              <p className={`text-xs font-medium mb-1 ${
                (config.gasWalletBalance || 0) < 10
                  ? 'text-red-300' 
                  : (config.gasWalletBalance || 0) < 50
                  ? 'text-yellow-300'
                  : 'text-green-300'
              }`}>
                {(config.gasWalletBalance || 0) < 10
                  ? '⚠️ Critical: Gas wallet needs TRX for energy fees!'
                  : (config.gasWalletBalance || 0) < 50
                  ? '⚠️ Warning: Gas wallet TRX balance is low'
                  : '✓ Gas wallet has sufficient TRX'}
              </p>
              <p className={`text-xs ${
                (config.gasWalletBalance || 0) < 50
                  ? 'text-yellow-300/70'
                  : 'text-green-300/70'
              }`}>
                {(config.gasWalletBalance || 0) < 50
                  ? 'Click "Recharge Gas Wallet" above to add TRX funds.'
                  : 'System is ready to process USDT TRC20 payments.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Merchant Management */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Merchants</h2>
          <button
            onClick={fetchMerchants}
            disabled={isMerchantsLoading}
            className="p-2 hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
          >
            <RefreshCw size={20} className={`text-slate-400 ${isMerchantsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-slate-400 mb-6">
          Manage merchants. Each merchant gets a derived TRON wallet. Invoice funds are split between 
          commission (master wallet) and merchant (derived wallet).
        </p>

        {/* Create Merchant */}
        <div className="mb-6 p-4 bg-slate-900/50 rounded-lg">
          <p className="text-sm font-medium text-slate-300 mb-3">Add New Merchant</p>
          <div className="space-y-3">
            <input
              type="text"
              value={newMerchantName}
              onChange={(e) => setNewMerchantName(e.target.value)}
              placeholder="Merchant name"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 outline-none transition text-sm"
            />
            <input
              type="text"
              value={newMerchantWallet}
              onChange={(e) => setNewMerchantWallet(e.target.value)}
              placeholder="External sweep address (optional, TRON address)"
              className="w-full px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-blue-500 outline-none transition text-sm font-mono"
            />
            <button
              onClick={handleCreateMerchant}
              disabled={isCreatingMerchant || !newMerchantName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-sm"
            >
              {isCreatingMerchant ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {isCreatingMerchant ? 'Creating...' : 'Add Merchant'}
            </button>
          </div>
        </div>

        {merchantError && (
          <div className="mb-4 bg-red-500/10 border border-red-500/50 rounded-lg p-3">
            <p className="text-red-400 text-sm">{merchantError}</p>
          </div>
        )}

        {merchantSuccess && (
          <div className="mb-4 bg-green-500/10 border border-green-500/50 rounded-lg p-3">
            <p className="text-green-400 text-sm">{merchantSuccess}</p>
          </div>
        )}

        {/* Merchant List */}
        {merchants.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            No merchants yet. Create one above.
          </div>
        ) : (
          <div className="space-y-4">
            {merchants.map((merchant) => (
              <div key={merchant.id} className={`p-4 border rounded-lg ${merchant.is_active ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-900/30 border-slate-700/50 opacity-60'}`}>
                {editingMerchantId === merchant.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editMerchantName}
                      onChange={(e) => setEditMerchantName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                    />
                    <input
                      type="text"
                      value={editMerchantWallet}
                      onChange={(e) => setEditMerchantWallet(e.target.value)}
                      placeholder="External sweep address (TRON)"
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-white text-sm font-mono"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdateMerchant(merchant.id)}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm flex items-center gap-1"
                      >
                        <Save size={14} /> Save
                      </button>
                      <button
                        onClick={() => setEditingMerchantId(null)}
                        className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm flex items-center gap-1"
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-white">{merchant.name}</p>
                        <p className="text-xs text-slate-400">Index: {merchant.derivation_index} • {merchant.is_active ? 'Active' : 'Inactive'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingMerchantId(merchant.id)
                            setEditMerchantName(merchant.name)
                            setEditMerchantWallet(merchant.external_wallet_address || '')
                          }}
                          className="p-1.5 hover:bg-slate-700 rounded transition-colors"
                        >
                          <Edit2 size={14} className="text-slate-400" />
                        </button>
                        <button
                          onClick={() => handleToggleMerchant(merchant.id, merchant.is_active)}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            merchant.is_active
                              ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                              : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                          }`}
                        >
                          {merchant.is_active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3 text-xs">
                      <div>
                        <p className="text-slate-400 mb-1">Derived Wallet</p>
                        <div className="flex items-center gap-1">
                          <code className="text-blue-300 font-mono truncate">{merchant.derived_wallet_address}</code>
                          <button onClick={() => copyToClipboard(merchant.derived_wallet_address, `m-derived-${merchant.id}`)} className="flex-shrink-0">
                            {copied === `m-derived-${merchant.id}` ? <Check size={12} className="text-green-400" /> : <Copy size={12} className="text-slate-400" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-400 mb-1">External Sweep Address</p>
                        <code className="text-slate-300 font-mono truncate block">
                          {merchant.external_wallet_address || '(not set)'}
                        </code>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-4 text-xs">
                        <span className="text-slate-400">
                          USDT: <span className="text-green-400 font-medium">{(merchant.usdtBalance ?? 0).toFixed(2)}</span>
                        </span>
                        <span className="text-slate-400">
                          TRX: <span className="text-blue-400 font-medium">{(merchant.trxBalance ?? 0).toFixed(2)}</span>
                        </span>
                      </div>
                      {(merchant.usdtBalance ?? 0) > 0 && merchant.external_wallet_address && (
                        <button
                          onClick={() => handleSweepMerchant(merchant.id)}
                          disabled={sweepingMerchantId === merchant.id}
                          className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-600 disabled:opacity-50 text-white rounded text-xs font-medium flex items-center gap-1"
                        >
                          {sweepingMerchantId === merchant.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <ArrowUpRight size={12} />
                          )}
                          Sweep USDT
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Configuration Summary */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8">
        <h2 className="text-2xl font-bold text-white mb-6">Configuration Status</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-slate-700">
            <span className="text-slate-300">1. Master Wallet (TRON)</span>
            <span className={`font-medium ${hasMasterWallet ? 'text-green-400' : 'text-slate-400'}`}>
              {hasMasterWallet ? '✓ Complete' : '⏳ Pending'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-slate-700">
            <span className="text-slate-300">2. Gas Wallet Funded (TRX)</span>
            <span className={`font-medium ${gasWalletFunded ? 'text-green-400' : 'text-slate-400'}`}>
              {gasWalletFunded ? '✓ Complete' : '⏳ Pending'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-slate-700">
            <span className="text-slate-300">3. Merchants Configured</span>
            <span className={`font-medium ${merchants.length > 0 ? 'text-green-400' : 'text-slate-400'}`}>
              {merchants.length > 0 ? `✓ ${merchants.filter(m => m.is_active).length} active` : '⏳ None yet'}
            </span>
          </div>

          <div className="flex items-center justify-between py-3 border-b border-slate-700">
            <span className="text-slate-300">TRON Mnemonic</span>
            <span className="text-green-400 font-medium">✓ Environment Variable</span>
          </div>

          <div className="flex items-center justify-between py-3">
            <span className="text-slate-300">System Ready</span>
            <span className={`font-bold text-lg ${isFullyConfigured && merchants.length > 0 ? 'text-green-400' : 'text-yellow-400'}`}>
              {isFullyConfigured && merchants.length > 0 ? '✓ Ready' : '⏳ Not Ready'}
            </span>
          </div>
        </div>

        {isFullyConfigured && merchants.length > 0 && (
          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm font-medium">
              System is fully configured and ready to accept USDT (TRC20) payments on TRON!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
