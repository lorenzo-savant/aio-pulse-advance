// PATH: src/app/dashboard/credits/page.tsx
// Credits Dashboard — manage credit balance and purchases

'use client'

import { useState, useEffect } from 'react'
import {
  Coins,
  CreditCard,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Zap,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { cn } from '@/lib/utils'

interface CreditPackage {
  id: string
  name: string
  credits: number
  bonus: number
  total: number
  price: number
}

interface Transaction {
  id: string
  amount: number
  source: string
  description: string | null
  created_at: string
}

interface UsageRecord {
  id: string
  credits_used: number
  provider: string | null
  engine: string | null
  description: string | null
  created_at: string
}

export default function CreditsPage() {
  const [balance, setBalance] = useState(0)
  const [totalPurchased, setTotalPurchased] = useState(0)
  const [totalUsed, setTotalUsed] = useState(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [usageHistory, setUsageHistory] = useState<UsageRecord[]>([])
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCredits()
  }, [])

  const fetchCredits = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/credits?include_history=true')
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Failed to load credits')
        return
      }

      setBalance(data.data.balance)
      setTotalPurchased(data.data.totalPurchased)
      setTotalUsed(data.data.totalUsed)
      setTransactions(data.data.transactions || [])
      setUsageHistory(data.data.usageHistory || [])
      setPackages(data.data.packages || [])
    } catch (e) {
      setError('Failed to load credits')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handlePurchase = async (packageId: string) => {
    setPurchasing(packageId)
    try {
      const res = await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: packageId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.message || 'Purchase failed')
        return
      }

      // Redirect to Stripe checkout
      if (data.data.checkoutUrl) {
        window.location.href = data.data.checkoutUrl
      } else {
        setError('Checkout URL not available')
      }
    } catch (e) {
      setError('Purchase failed')
    } finally {
      setPurchasing(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getSourceLabel = (source: string) => {
    const labels: Record<string, { label: string; color: string }> = {
      stripe_purchase: { label: 'Purchase', color: 'bg-green-500' },
      promo: { label: 'Promo', color: 'bg-purple-500' },
      bonus: { label: 'Bonus', color: 'bg-blue-500' },
      refund: { label: 'Refund', color: 'bg-yellow-500' },
      subscription: { label: 'Subscription', color: 'bg-indigo-500' },
      query_usage: { label: 'Used', color: 'bg-red-500' },
    }
    return labels[source] || { label: source, color: 'bg-secondary-' }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="border-brand-500 h-8 w-8 animate-spin rounded-full border-b-2" />
      </div>
    )
  }

  return (
    <div className="space-y-6 bg-background">
      <SectionHelp section="credits" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Credits</h1>
          <p className="">Manage your AI query credits</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCredits}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 border-red-800 bg-red-50 bg-red-900/20 p-4">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-400 text-red-700">{error}</span>
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border border-input bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="mt-1 text-3xl font-bold text-foreground">{balance.toLocaleString()}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <Coins className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
            </div>
          </div>
        </Card>

        <Card className="border border-input bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Purchased</p>
              <p className="mt-1 text-3xl font-bold text-foreground">
                {totalPurchased.toLocaleString()}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </Card>

        <Card className="border border-input bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Used</p>
              <p className="mt-1 text-3xl font-bold text-foreground">
                {totalUsed.toLocaleString()}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Purchase Packages */}
      <Card className="border border-input bg-card p-6">
        <h2 className="text-text-secondary-ui mb-4 text-lg font-semibold">Purchase Credits</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="hover:border-primary-500 rounded-lg border border-input bg-card p-4 transition-colors"
            >
              <div className="text-sm font-medium text-foreground">{pkg.name}</div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-foreground">
                  {pkg.total.toLocaleString()}
                </span>
                <span className="text-text-secondary-ui ml-1 text-sm">credits</span>
              </div>
              {pkg.bonus > 0 && (
                <div className="mt-1 text-sm text-green-600 dark:text-green-400">
                  +{pkg.bonus} bonus!
                </div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-semibold text-foreground">${pkg.price}</span>
                <Button
                  size="sm"
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchasing === pkg.id}
                >
                  {purchasing === pkg.id ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="mr-1 h-4 w-4" />
                      Buy
                    </>
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Usage & Transactions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Usage */}
        <Card className="border border-input bg-card p-6">
          <h2 className="text-text-secondary-ui mb-4 text-lg font-semibold">Recent Usage</h2>
          {usageHistory.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No usage history yet</p>
          ) : (
            <div className="space-y-3">
              {usageHistory.slice(0, 10).map((usage) => (
                <div
                  key={usage.id}
                  className="flex items-center justify-between border-b border-border py-2 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                      <Zap className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {usage.engine || usage.provider || 'Query'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(usage.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                      -{usage.credits_used}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Transaction History */}
        <Card className="border border-input bg-card p-6">
          <h2 className="text-text-secondary-ui mb-4 text-lg font-semibold">Transaction History</h2>
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No transactions yet</p>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 10).map((tx) => {
                const sourceInfo = getSourceLabel(tx.source)
                const isPositive = tx.amount > 0
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between border-b border-border py-2 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full',
                          isPositive
                            ? 'bg-green-100 dark:bg-green-900/30'
                            : 'bg-red-100 dark:bg-red-900/30',
                        )}
                      >
                        {isPositive ? (
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{sourceInfo.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.description || formatDate(tx.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          isPositive
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400',
                        )}
                      >
                        {isPositive ? '+' : ''}
                        {tx.amount}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Credit Costs Info */}
      <Card className="border border-border bg-secondary p-6">
        <h2 className="text-text-secondary-ui mb-4 text-lg font-semibold">Credit Costs</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { engine: 'ChatGPT', cost: 2, desc: 'GPT-4o Mini' },
            { engine: 'Gemini', cost: 1, desc: 'Most efficient' },
            { engine: 'Perplexity', cost: 3, desc: 'Search-focused' },
            { engine: 'Claude', cost: 3, desc: 'Analysis' },
          ].map((item) => (
            <div
              key={item.engine}
              className="rounded-lg border border-input bg-card p-4 text-center"
            >
              <p className="text-lg font-semibold text-foreground">{item.cost} credits</p>
              <p className="text-text-secondary-ui text-sm font-medium">{item.engine}</p>
              <p className="text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Free tier: 10 queries per day • Paid plans: Unlimited with credit balance
        </p>
      </Card>
    </div>
  )
}
