// PATH: src/app/dashboard/analytics/page.tsx
// Enhanced Analytics Dashboard with Historical Comparison

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Calendar,
  Target,
  Activity,
  BarChart3,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface HistoricalData {
  brandId: string
  period: string
  snapshots: Array<{
    date: string
    value: number
    change?: number
    changePercent?: number
  }>
  comparison: {
    current: number
    previous: number
    change: number
    changePercent: number
    trend: 'up' | 'down' | 'stable'
  }
  summary: {
    totalSnapshots: number
    avgValue: number
    minValue: number
    maxValue: number
    trend: 'up' | 'down' | 'stable'
  }
}

interface CompetitorData {
  brand: {
    name: string
    avgCitation: number
    avgVisibility: number
  }
  competitors: Array<{
    name: string
    avgCitation: number
    avgVisibility: number
  }>
  period: string
  snapshotCount: number
}

export default function EnhancedAnalyticsPage() {
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([])
  const [selectedBrand, setSelectedBrand] = useState<string>('')
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d')
  const [metric, setMetric] = useState<'citations' | 'visibility' | 'sentiment' | 'health'>(
    'citations',
  )

  const [citations, setCitations] = useState<HistoricalData | null>(null)
  const [visibility, setVisibility] = useState<HistoricalData | null>(null)
  const [sentiment, setSentiment] = useState<HistoricalData | null>(null)
  const [competitors, setCompetitors] = useState<CompetitorData | null>(null)

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchBrands()
  }, [])

  useEffect(() => {
    if (selectedBrand) {
      fetchAllData()
    }
  }, [selectedBrand, period, metric])

  const fetchBrands = async () => {
    try {
      const res = await fetch('/api/brands')
      const data = await res.json()
      const list = data.data || data || []
      setBrands(list)
      if (list.length > 0) {
        setSelectedBrand(list[0].id)
      }
    } catch (e) {
      console.error('Failed to fetch brands', e)
    }
  }

  const fetchAllData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch all metrics in parallel
      const [citRes, visRes, sentRes, compRes] = await Promise.all([
        fetch(
          `/api/analytics/historical?brand_id=${selectedBrand}&metric=citations&period=${period}`,
        ),
        fetch(
          `/api/analytics/historical?brand_id=${selectedBrand}&metric=visibility&period=${period}`,
        ),
        fetch(
          `/api/analytics/historical?brand_id=${selectedBrand}&metric=sentiment&period=${period}`,
        ),
        fetch(
          `/api/analytics/historical?brand_id=${selectedBrand}&period=${period}&action=comparison`,
        ),
      ])

      const citData = await citRes.json()
      const visData = await visRes.json()
      const sentData = await sentRes.json()
      const compData = await compRes.json()

      if (citData.success) setCitations(citData.data)
      if (visData.success) setVisibility(visData.data)
      if (sentData.success) setSentiment(sentData.data)
      if (compData.success) setCompetitors(compData.data)

      if (!citData.success && !visData.success && !sentData.success) {
        setError('No data available. Run some scans first.')
      }
    } catch (e) {
      setError('Failed to load analytics data')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const generateSnapshots = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/analytics/historical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: selectedBrand }),
      })
      const data = await res.json()
      if (data.success) {
        alert(`Generated ${data.data.snapshotsCreated} snapshots`)
        fetchAllData()
      }
    } catch (e) {
      console.error('Failed to generate snapshots', e)
    } finally {
      setGenerating(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-text-muted-surface" />
  }

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return 'text-green-500'
    if (trend === 'down') return 'text-red-500'
    return 'text-text-muted-surface'
  }

  const MetricCard = ({
    title,
    data,
    unit = '%',
  }: {
    title: string
    data: HistoricalData | null
    unit?: string
  }) => {
    if (!data || data.summary.totalSnapshots === 0) {
      return (
        <Card className="p-6">
          <p className="text-sm text-text-muted-surface">{title}</p>
          <p className="mt-2 text-2xl font-bold text-text-on-surface">No data</p>
          <p className="mt-1 text-xs text-text-muted-surface">Run scans to generate data</p>
        </Card>
      )
    }

    return (
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-muted-surface">{title}</p>
            <p className="mt-1 text-3xl font-bold text-text-on-surface">
              {data.comparison.current.toFixed(1)}
              {unit}
            </p>
          </div>
          <div className={`flex items-center gap-1 ${getTrendColor(data.comparison.trend)}`}>
            {getTrendIcon(data.comparison.trend)}
            <span className="text-sm font-medium">
              {data.comparison.changePercent > 0 ? '+' : ''}
              {data.comparison.changePercent.toFixed(1)}%
            </span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-text-muted-surface">
          <div>
            <p>Previous</p>
            <p className="font-medium">
              {data.comparison.previous.toFixed(1)}
              {unit}
            </p>
          </div>
          <div>
            <p>Change</p>
            <p className={getTrendColor(data.comparison.trend)}>
              {data.comparison.change > 0 ? '+' : ''}
              {data.comparison.change.toFixed(1)}
            </p>
          </div>
          <div>
            <p>Trend</p>
            <p className={`capitalize ${getTrendColor(data.summary.trend)}`}>
              {data.summary.trend}
            </p>
          </div>
        </div>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-text-on-surface">Analytics</h1>
          <p className="text-text-muted-surface">Historical trends and comparisons</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={generateSnapshots} disabled={generating}>
            <RefreshCw className={`mr-2 h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            Generate Data
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className="rounded-lg border border-surface-input-border bg-surface-input px-3 py-2 text-text-on-surface"
        >
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <div className="flex overflow-hidden rounded-lg border border-surface-input-border">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm ${
                period === p
                  ? 'bg-brand-500 text-white'
                  : 'text-text-on-surface hover:bg-surface-row-hover'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
          <p className="text-yellow-800 dark:text-yellow-400">{error}</p>
          <Button size="sm" className="mt-2" onClick={generateSnapshots}>
            Generate Historical Data
          </Button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard title="Citation Rate" data={citations} unit="%" />
        <MetricCard title="Visibility Score" data={visibility} unit="" />
        <MetricCard title="Sentiment Score" data={sentiment} unit="" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Citation Trend */}
        <Card className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-text-on-surface">Citation Trend</h3>
          <div className="h-64">
            {citations?.snapshots.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={citations.snapshots}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatDate} fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 3 }}
                    name="Citation Rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-text-muted-surface">
                No data available
              </div>
            )}
          </div>
        </Card>

        {/* Visibility Trend */}
        <Card className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-text-on-surface">Visibility Trend</h3>
          <div className="h-64">
            {visibility?.snapshots.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={visibility.snapshots}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={formatDate} fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 3 }}
                    name="Visibility"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-text-muted-surface">
                No data available
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Competitor Comparison */}
      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold text-text-on-surface">Competitor Comparison</h3>
        {competitors && competitors.competitors.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  {
                    name: competitors.brand.name,
                    citations: competitors.brand.avgCitation,
                    visibility: competitors.brand.avgVisibility,
                  },
                  ...competitors.competitors.map((c) => ({
                    name: c.name,
                    citations: c.avgCitation,
                    visibility: c.avgVisibility,
                  })),
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar
                  dataKey="citations"
                  fill="#10b981"
                  name="Citation Rate"
                  radius={[4, 4, 0, 0]}
                />
                <Bar dataKey="visibility" fill="#3b82f6" name="Visibility" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center text-text-muted-surface">
            No competitor data. Add competitors to your brand settings.
          </div>
        )}
      </Card>

      {/* Data Summary */}
      <Card className="p-6">
        <h3 className="mb-4 text-lg font-semibold text-text-on-surface">Data Summary</h3>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-surface-input-border bg-surface-row p-4 text-center">
            <Target className="mx-auto mb-2 h-6 w-6 text-brand-500" />
            <p className="text-2xl font-bold text-text-on-surface">
              {citations?.summary.totalSnapshots || 0}
            </p>
            <p className="text-sm text-text-muted-surface">Total Snapshots</p>
          </div>
          <div className="rounded-lg border border-surface-input-border bg-surface-row p-4 text-center">
            <Activity className="mx-auto mb-2 h-6 w-6 text-green-500" />
            <p className="text-2xl font-bold text-text-on-surface">
              {citations?.summary.avgValue.toFixed(1) || 0}%
            </p>
            <p className="text-sm text-text-muted-surface">Avg Citation</p>
          </div>
          <div className="rounded-lg border border-surface-input-border bg-surface-row p-4 text-center">
            <BarChart3 className="mx-auto mb-2 h-6 w-6 text-blue-500" />
            <p className="text-2xl font-bold text-text-on-surface">
              {visibility?.summary.avgValue.toFixed(1) || 0}
            </p>
            <p className="text-sm text-text-muted-surface">Avg Visibility</p>
          </div>
          <div className="rounded-lg border border-surface-input-border bg-surface-row p-4 text-center">
            <Calendar className="mx-auto mb-2 h-6 w-6 text-purple-500" />
            <p className="text-2xl font-bold text-text-on-surface">{period}</p>
            <p className="text-sm text-text-muted-surface">Time Period</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
