// PATH: src/app/dashboard/snapshots/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import {
  Camera,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  Download,
  Filter,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { cn } from '@/lib/utils'
import { useChartTheme } from '@/hooks/useChartTheme'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Snapshot {
  id: string
  brand_id: string
  scan_date: string
  engine: string
  category: string
  language: string
  total_prompts: number
  brand_citations: number
  citation_rate: number
  avg_position: number | null
  avg_visibility: number
  avg_sentiment: number
  competitor_rates: Record<string, number>
}

interface Brand {
  id: string
  name: string
  color: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DATE_RANGES = [
  { label: '7 days', days: 7 },
  { label: '15 days', days: 15 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

const ENGINES = ['all', 'chatgpt', 'gemini', 'perplexity', 'claude']

const ENGINE_COLORS: Record<string, string> = {
  all: '#6366f1',
  chatgpt: '#10b981',
  gemini: '#f97316',
  perplexity: '#3b82f6',
  claude: '#a855f7',
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SnapshotsPage() {
  const { tooltipStyle } = useChartTheme()
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [recalculating, setRecalculating] = useState(false)
  const [days, setDays] = useState(30)
  const [engine, setEngine] = useState('all')
  const [error, setError] = useState('')

  // Load brands
  useEffect(() => {
    async function loadBrands() {
      try {
        const res = await fetch('/api/brands')
        const data = await res.json()
        const list = data.data || data || []
        setBrands(list)
        if (list.length > 0) setSelectedBrand(list[0])
      } catch {
        setError('Failed to load brands')
      }
    }
    loadBrands()
  }, [])

  // Fetch snapshots
  const fetchSnapshots = useCallback(async () => {
    if (!selectedBrand) return
    setLoading(true)
    setError('')
    try {
      const from = new Date()
      from.setDate(from.getDate() - days)
      const fromStr = from.toISOString().split('T')[0]
      const res = await fetch(
        `/api/snapshots?brand_id=${selectedBrand.id}&engine=${engine}&category=all&from=${fromStr}`,
      )
      const data = await res.json()
      if (!data.success) {
        setError(data.message || 'Failed to load snapshots')
        setSnapshots([])
      } else {
        setSnapshots(data.data?.snapshots || [])
      }
    } catch {
      setError('Failed to load snapshots')
    } finally {
      setLoading(false)
    }
  }, [selectedBrand, days, engine])

  useEffect(() => {
    fetchSnapshots()
  }, [fetchSnapshots])

  // Recalculate snapshots
  const handleRecalculate = async () => {
    if (!selectedBrand) return
    setRecalculating(true)
    setError('')
    try {
      const res = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: selectedBrand.id }),
      })
      const data = await res.json()
      if (!data.success) {
        setError(data.message || 'Recalculation failed')
      } else {
        await fetchSnapshots()
      }
    } catch {
      setError('Recalculation failed')
    } finally {
      setRecalculating(false)
    }
  }

  // Chart data
  const chartData = snapshots.map((s) => ({
    date: new Date(s.scan_date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
    citationRate: Number(s.citation_rate.toFixed(1)),
    visibility: Number(s.avg_visibility.toFixed(1)),
    sentiment: Number(((s.avg_sentiment + 1) * 50).toFixed(1)),
    totalPrompts: s.total_prompts,
    brandCitations: s.brand_citations,
  }))

  // Summary stats
  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null
  const first = snapshots.length > 1 ? snapshots[0] : null

  const citationTrend = (() => {
    if (!first || !latest) return { direction: 'stable' as const, percent: 0 }
    if (first.citation_rate === 0) return { direction: 'stable' as const, percent: 0 }
    const pct = ((latest.citation_rate - first.citation_rate) / first.citation_rate) * 100
    return {
      direction: pct > 5 ? ('up' as const) : pct < -5 ? ('down' as const) : ('stable' as const),
      percent: Math.abs(pct),
    }
  })()

  const visibilityTrend = (() => {
    if (!first || !latest) return { direction: 'stable' as const, percent: 0 }
    if (first.avg_visibility === 0) return { direction: 'stable' as const, percent: 0 }
    const pct = ((latest.avg_visibility - first.avg_visibility) / first.avg_visibility) * 100
    return {
      direction: pct > 5 ? ('up' as const) : pct < -5 ? ('down' as const) : ('stable' as const),
      percent: Math.abs(pct),
    }
  })()

  // Per-engine breakdown (bar chart)
  const engineBreakdown = (() => {
    if (engine !== 'all' || snapshots.length === 0) return []
    // We only have 'all' engine data here, but we can show competitor comparison
    return []
  })()

  // Competitor rates from latest snapshot
  const competitorData = latest?.competitor_rates
    ? Object.entries(latest.competitor_rates).map(([name, rate], i) => ({
        name,
        rate: Number(rate.toFixed(1)),
        color: ['#10b981', '#f97316', '#a855f7', '#ec4899', '#14b8a6'][i % 5],
      }))
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Camera className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-black tracking-tight text-foreground">Snapshots</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            Citation rate snapshots and trend analysis from monitoring data.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            loading={recalculating}
            onClick={handleRecalculate}
            disabled={!selectedBrand}
          >
            <RefreshCw className="h-4 w-4" />
            {recalculating ? 'Recalculating...' : 'Recalculate'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Brand selector */}
          {brands.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Brand
              </label>
              <select
                className="rounded-lg border border-border bg-secondary px-3 py-1.5 text-sm text-foreground"
                value={selectedBrand?.id || ''}
                onChange={(e) => {
                  const b = brands.find((b) => b.id === e.target.value)
                  if (b) setSelectedBrand(b)
                }}
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Engine filter */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Engine
            </label>
            <div className="flex gap-1">
              {ENGINES.map((e) => (
                <button
                  key={e}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                    engine === e
                      ? 'bg-brand-600 text-foreground'
                      : 'surface-600 bg-secondary text-foreground text-muted-foreground hover:bg-secondary',
                  )}
                  onClick={() => setEngine(e)}
                >
                  {e === 'all' ? 'All' : e.charAt(0).toUpperCase() + e.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Period
            </label>
            <div className="flex gap-1">
              {DATE_RANGES.map((r) => (
                <button
                  key={r.days}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                    days === r.days
                      ? 'bg-brand-600 text-foreground'
                      : 'surface-600 bg-secondary text-foreground text-muted-foreground hover:bg-secondary',
                  )}
                  onClick={() => setDays(r.days)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {latest && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Citation Rate */}
          <Card className="p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Citation Rate
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-3xl font-black text-foreground">
                {latest.citation_rate.toFixed(1)}%
              </span>
              <TrendIcon direction={citationTrend.direction} percent={citationTrend.percent} />
            </div>
          </Card>

          {/* Avg Visibility */}
          <Card className="p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Avg Visibility
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-3xl font-black text-foreground">
                {latest.avg_visibility.toFixed(0)}
              </span>
              <TrendIcon direction={visibilityTrend.direction} percent={visibilityTrend.percent} />
            </div>
          </Card>

          {/* Total Prompts */}
          <Card className="p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Total Prompts
            </p>
            <span className="mt-2 block text-3xl font-black text-foreground">
              {latest.total_prompts}
            </span>
          </Card>

          {/* Brand Citations */}
          <Card className="p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Brand Citations
            </p>
            <span className="mt-2 block text-3xl font-black text-foreground">
              {latest.brand_citations}
            </span>
          </Card>
        </div>
      )}

      {/* Citation Rate Trend Chart */}
      <Card className="p-6">
        <h2 className="mb-1 text-lg font-bold text-foreground">Citation Rate Trend</h2>
        <p className="mb-6 text-xs text-muted-foreground">
          How often your brand is cited across AI engines over time
        </p>
        {loading ? (
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Loading snapshots...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
            <Camera className="mb-3 h-10 w-10 text-foreground" />
            <p className="text-sm">No snapshots available for this period.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Run monitoring and recalculate snapshots to start tracking.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} unit="%" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="citationRate"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Citation Rate %"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Visibility Trend Chart */}
      {chartData.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-bold text-foreground">Visibility & Sentiment</h2>
          <p className="mb-6 text-xs text-muted-foreground">
            Average visibility score and normalized sentiment over time
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} domain={[0, 100]} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="visibility"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Visibility"
              />
              <Line
                type="monotone"
                dataKey="sentiment"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 3 }}
                name="Sentiment (normalized)"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Competitor Rates (from latest snapshot) */}
      {competitorData.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-1 text-lg font-bold text-foreground">Competitor Citation Rates</h2>
          <p className="mb-6 text-xs text-muted-foreground">
            Latest snapshot: how often competitors are cited vs your brand
          </p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[
                {
                  name: selectedBrand?.name || 'Your Brand',
                  rate: Number(latest!.citation_rate.toFixed(1)),
                  color: '#6366f1',
                },
                ...competitorData,
              ]}
            >
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} unit="%" />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                {[{ color: '#6366f1' }, ...competitorData.map((c) => ({ color: c.color }))].map(
                  (entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ),
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Raw Snapshots Table */}
      {snapshots.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-bold text-foreground">Snapshot History</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-3 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Date
                  </th>
                  <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Prompts
                  </th>
                  <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Citations
                  </th>
                  <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Rate
                  </th>
                  <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Visibility
                  </th>
                  <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Sentiment
                  </th>
                </tr>
              </thead>
              <tbody>
                {snapshots
                  .slice()
                  .reverse()
                  .map((s) => (
                    <tr key={s.id} className="border-border/50 border-b">
                      <td className="py-3 text-xs text-muted-foreground">
                        {new Date(s.scan_date).toLocaleDateString('sv-SE')}
                      </td>
                      <td className="py-3 text-center text-xs text-muted-foreground">
                        {s.total_prompts}
                      </td>
                      <td className="py-3 text-center text-xs text-muted-foreground">
                        {s.brand_citations}
                      </td>
                      <td className="py-3 text-center">
                        <Badge
                          variant={
                            s.citation_rate > 50
                              ? 'success'
                              : s.citation_rate > 20
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {s.citation_rate.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="py-3 text-center text-xs font-bold text-foreground">
                        {s.avg_visibility.toFixed(0)}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={cn(
                            'text-xs font-bold',
                            s.avg_sentiment > 0.2
                              ? 'text-emerald-400'
                              : s.avg_sentiment < -0.2
                                ? 'text-red-400'
                                : 'text-muted-foreground',
                          )}
                        >
                          {s.avg_sentiment.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Trend Icon Helper ───────────────────────────────────────────────────────

function TrendIcon({
  direction,
  percent,
}: {
  direction: 'up' | 'down' | 'stable'
  percent: number
}) {
  if (direction === 'up') {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
        <TrendingUp className="h-3.5 w-3.5" />+{percent.toFixed(1)}%
      </span>
    )
  }
  if (direction === 'down') {
    return (
      <span className="flex items-center gap-1 text-xs font-bold text-red-400">
        <TrendingDown className="h-3.5 w-3.5" />-{percent.toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
      <Minus className="h-3.5 w-3.5" />
      stable
    </span>
  )
}
