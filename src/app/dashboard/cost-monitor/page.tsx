'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { AlertCircle, DollarSign, TrendingUp, Activity, Clock, Zap } from 'lucide-react'

interface CostAnalytics {
  totalCost: number
  totalTokens: number
  totalRequests: number
  avgCostPerRequest: number
  avgTokensPerRequest: number
  avgLatencyMs: number
  providerBreakdown: Record<string, ProviderBreakdown>
  agentBreakdown: Record<string, AgentBreakdown>
  dailyTrend: DailyCost[]
  hourlyPeak: HourlyPeak[]
  successRate: number
  cacheHitRate: number
}

interface ProviderBreakdown {
  provider: string
  totalCost: number
  totalTokens: number
  requestCount: number
  avgCostPerRequest: number
  avgLatencyMs: number
  successRate: number
}

interface AgentBreakdown {
  agentType: string
  totalCost: number
  totalTokens: number
  requestCount: number
  avgCostPerRequest: number
}

interface DailyCost {
  date: string
  cost: number
  tokens: number
  requests: number
}

interface HourlyPeak {
  hour: number
  avgCost: number
  requestCount: number
}

interface BudgetAlert {
  type: 'daily' | 'monthly' | 'provider'
  threshold: number
  currentSpend: number
  limit: number
  percentage: number
  message: string
  timestamp: string
}

interface Budget {
  id: string
  userId: string
  brandId: string | null
  monthlyLimitUsd: number
  dailyLimitUsd: number | null
  alertThreshold: number
  providerLimits: Record<string, number>
  currentMonthSpend: number
  currentDaySpend: number
  lastAlertSent: string | null
  createdAt: string
  updatedAt: string
}

export default function CostMonitorPage() {
  const [analytics, setAnalytics] = useState<CostAnalytics | null>(null)
  const [alerts, setAlerts] = useState<BudgetAlert[]>([])
  const [budget, setBudget] = useState<Budget | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [activeTab, setActiveTab] = useState('providers')
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [budgetForm, setBudgetForm] = useState({
    monthlyLimitUsd: 100,
    dailyLimitUsd: null as number | null,
    alertThreshold: 0.8,
  })
  const [savingBudget, setSavingBudget] = useState(false)

  useEffect(() => {
    fetchData()
  }, [days])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [analyticsRes, alertsRes, budgetRes] = await Promise.all([
        fetch('/api/cost-monitor?days=' + days),
        fetch('/api/cost-monitor?action=alerts'),
        fetch('/api/cost-monitor?action=budget'),
      ])

      if (analyticsRes.ok) {
        const data = await analyticsRes.json()
        setAnalytics(data.analytics)
      }

      if (alertsRes.ok) {
        const data = await alertsRes.json()
        setAlerts(data.alerts || [])
      }

      if (budgetRes.ok) {
        const data = await budgetRes.json()
        if (data.budget) {
          setBudget(data.budget)
          setBudgetForm({
            monthlyLimitUsd: data.budget.monthlyLimitUsd || 100,
            dailyLimitUsd: data.budget.dailyLimitUsd || 10,
            alertThreshold: data.budget.alertThreshold || 0.8,
          })
        }
      }
    } catch (error) {
      console.error('Failed to fetch cost data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveBudget = async () => {
    setSavingBudget(true)
    try {
      const res = await fetch('/api/cost-monitor', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budgetForm),
      })
      if (res.ok) {
        const data = await res.json()
        setBudget(data.budget)
        setShowBudgetModal(false)
        fetchData()
      }
    } catch (error) {
      console.error('Failed to save budget:', error)
    } finally {
      setSavingBudget(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">Failed to load cost data</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Cost Monitor</h1>
          <p className="text-muted-foreground">Track AI provider costs, usage, and budget</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30, 90].map((d) => (
            <Button
              key={d}
              variant={days === d ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setDays(d)}
            >
              {d}D
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => setShowBudgetModal(true)}>
            ⚙️ Budget Settings
          </Button>
        </div>
      </div>

      {budget && (
        <Card className="border-primary/20 bg-primary/5">
          <CardBody>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Budget</p>
                <p className="text-lg font-semibold">${budget.monthlyLimitUsd.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">
                  ${budget.currentMonthSpend.toFixed(2)} used (
                  {((budget.currentMonthSpend / budget.monthlyLimitUsd) * 100).toFixed(0)}%)
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Daily Budget</p>
                <p className="text-lg font-semibold">
                  ${budget.dailyLimitUsd?.toFixed(2) ?? 'Not set'}
                </p>
                <p className="text-xs text-muted-foreground">
                  ${budget.currentDaySpend.toFixed(2)} used today
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Alert Threshold</p>
                <p className="text-lg font-semibold">{(budget.alertThreshold * 100).toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Alert when spend exceeds threshold</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {alerts.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Budget Alerts</h2>
            </div>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-white p-3">
                  <div>
                    <p className="font-medium">{alert.message}</p>
                    <p className="text-sm text-muted-foreground">
                      {alert.type} budget - {(alert.percentage * 100).toFixed(0)}% used
                    </p>
                  </div>
                  <Badge variant={alert.percentage >= 1 ? 'danger' : 'warning'}>
                    {alert.percentage >= 1 ? 'Over Budget' : 'Warning'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Cost</span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold">${analytics.totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              ${analytics.avgCostPerRequest.toFixed(4)} per request
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Tokens</span>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold">{(analytics.totalTokens / 1000).toFixed(1)}K</div>
            <p className="text-xs text-muted-foreground">
              {analytics.avgTokensPerRequest.toFixed(0)} avg per request
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Requests</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold">{analytics.totalRequests}</div>
            <p className="text-xs text-muted-foreground">
              {(analytics.successRate * 100).toFixed(1)}% success rate
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Avg Latency</span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardBody>
            <div className="text-2xl font-bold">{analytics.avgLatencyMs.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">
              {(analytics.cacheHitRate * 100).toFixed(1)}% cache hit rate
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="flex gap-2 border-b">
        {['providers', 'agents', 'trend'].map((tab) => (
          <button
            key={tab}
            className={
              'border-b-2 px-4 py-2 text-sm font-medium transition-colors ' +
              (activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'providers' && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Provider Breakdown</h2>
            <p className="text-sm text-muted-foreground">Cost and usage by AI provider</p>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              {Object.entries(analytics.providerBreakdown).map(([key, provider]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium capitalize">{key}</p>
                      <p className="text-sm text-muted-foreground">
                        {provider.requestCount} requests
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${provider.totalCost.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      ${(provider.totalCost / Math.max(provider.requestCount, 1)).toFixed(4)} avg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {activeTab === 'agents' && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Agent Breakdown</h2>
            <p className="text-sm text-muted-foreground">Cost by AI agent type</p>
          </CardHeader>
          <CardBody>
            <div className="space-y-4">
              {Object.entries(analytics.agentBreakdown).map(([key, agent]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium capitalize">{key.replace(/_/g, ' ')}</p>
                    <p className="text-sm text-muted-foreground">
                      {agent.requestCount} requests, {(agent.totalTokens / 1000).toFixed(1)}K tokens
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${agent.totalCost.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      ${agent.avgCostPerRequest.toFixed(4)} avg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {activeTab === 'trend' && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Daily Cost Trend</h2>
            <p className="text-sm text-muted-foreground">AI spending over time</p>
          </CardHeader>
          <CardBody>
            <div className="flex h-64 items-end gap-1">
              {analytics.dailyTrend.map((day, i) => {
                const maxCost = Math.max(...analytics.dailyTrend.map((d) => d.cost), 0.01)
                const height = (day.cost / maxCost) * 100
                return (
                  <div
                    key={i}
                    className="bg-primary/20 hover:bg-primary/40 group relative flex-1 rounded-t transition-colors"
                    style={{ height: Math.max(height, 1) + '%' }}
                  >
                    <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                      ${day.cost.toFixed(2)} · {day.requests} req
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{analytics.dailyTrend[0]?.date}</span>
              <span>{analytics.dailyTrend[analytics.dailyTrend.length - 1]?.date}</span>
            </div>
          </CardBody>
        </Card>
      )}

      {showBudgetModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowBudgetModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-xl font-bold">Budget Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Monthly Limit ($)</label>
                <input
                  type="number"
                  value={budgetForm.monthlyLimitUsd}
                  onChange={(e) =>
                    setBudgetForm({
                      ...budgetForm,
                      monthlyLimitUsd: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm"
                  min={0}
                  step={10}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Daily Limit ($)</label>
                <input
                  type="number"
                  value={budgetForm.dailyLimitUsd ?? ''}
                  onChange={(e) =>
                    setBudgetForm({
                      ...budgetForm,
                      dailyLimitUsd: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  className="w-full rounded-lg border border-input bg-input px-3 py-2 text-sm"
                  min={0}
                  step={5}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Alert Threshold ({(budgetForm.alertThreshold * 100).toFixed(0)}%)
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={1}
                  step={0.05}
                  value={budgetForm.alertThreshold}
                  onChange={(e) =>
                    setBudgetForm({ ...budgetForm, alertThreshold: parseFloat(e.target.value) })
                  }
                  className="w-full"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Alert when spend reaches {(budgetForm.alertThreshold * 100).toFixed(0)}% of limit
                </p>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowBudgetModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button onClick={handleSaveBudget} disabled={savingBudget} className="flex-1">
                {savingBudget ? 'Saving...' : 'Save Budget'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
