// PATH: src/app/dashboard/citations/page.tsx
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
  Cell,
} from 'recharts'
import { SectionHelp } from '@/components/help/SectionHelp'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  BarChart3,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
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

// ─── Competitor Colors ───────────────────────────────────────────────────────

const COMPETITOR_COLORS: Record<string, string> = {
  Wint: '#f59e0b',
  'Björn Lundén': '#ec4899',
  Fortnox: '#14b8a6',
}

const ENGINE_COLORS: Record<string, string> = {
  chatgpt: '#10b981',
  gemini: '#3b82f6',
  perplexity: '#a855f7',
  claude: '#f97316',
  all: '#6366f1',
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  suffix,
  subtitle,
  trend,
  accent = 'brand',
}: {
  title: string
  value: string | number
  suffix?: string
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
  accent?: 'brand' | 'emerald' | 'red' | 'amber'
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const accentMap = {
    brand: 'text-primary',
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
  }

  return (
    <Card className="p-5">
      <p className="mb-2 text-sm font-medium text-muted-foreground">{title}</p>
      <div className="flex items-baseline gap-1">
        <p className={cn('text-3xl font-black', accentMap[accent])}>{value}</p>
        {suffix && <span className="text-lg font-bold text-muted-foreground">{suffix}</span>}
      </div>
      {subtitle && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          {trend && <TrendIcon className="h-3.5 w-3.5" />}
          {subtitle}
        </div>
      )}
    </Card>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CitationsPage() {
  const { tooltipStyle } = useChartTheme()
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [engineSnapshots, setEngineSnapshots] = useState<Snapshot[]>([])
  const [languageSnapshots, setLanguageSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedEngine, setSelectedEngine] = useState('all')
  const [selectedLanguage, setSelectedLanguage] = useState('all')

  // ── Fetch brands ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
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
    load()
  }, [])

  // ── Fetch snapshots when brand changes ────────────────────────────────────
  const fetchSnapshots = useCallback(async () => {
    if (!selectedBrand) return
    setLoading(true)
    setError(null)

    try {
      // Fetch "all" engine + language aggregate
      const res = await fetch(
        `/api/snapshots?brand_id=${selectedBrand.id}&engine=all&category=all&language=${selectedLanguage}`,
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || `API error: ${res.status}`)
        setSnapshots([])
        return
      }
      setSnapshots(data.data?.snapshots || [])

      // Fetch per-engine breakdown for latest date
      const engines = ['chatgpt', 'gemini', 'perplexity']
      const engineData: Snapshot[] = []

      for (const engine of engines) {
        const r = await fetch(
          `/api/snapshots?brand_id=${selectedBrand.id}&engine=${engine}&category=all&language=${selectedLanguage}`,
        )
        const d = await r.json()
        const snaps = d.data?.snapshots || []
        if (snaps.length > 0) engineData.push(snaps[snaps.length - 1])
      }

      setEngineSnapshots(engineData)
    } catch {
      setError('Failed to load citation data')
    } finally {
      setLoading(false)
    }
  }, [selectedBrand, selectedLanguage])

  useEffect(() => {
    fetchSnapshots()
  }, [fetchSnapshots])

  // ── Calculate snapshots ───────────────────────────────────────────────────
  const handleCalculate = async () => {
    if (!selectedBrand) return
    setCalculating(true)
    try {
      await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: selectedBrand.id }),
      })
      await fetchSnapshots()
    } catch {
      setError('Failed to calculate snapshots')
    } finally {
      setCalculating(false)
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null

  const citationRate = latest?.citation_rate ?? 0
  const avgPosition = latest?.avg_position
  const totalPrompts = latest?.total_prompts ?? 0
  const brandCitations = latest?.brand_citations ?? 0
  const competitorRates = latest?.competitor_rates ?? {}

  // Chart data for competitor comparison bar chart
  const competitorChartData = [
    { name: selectedBrand?.name || 'Brand', rate: citationRate, color: '#6366f1' },
    ...Object.entries(competitorRates).map(([name, rate]) => ({
      name,
      rate,
      color: COMPETITOR_COLORS[name] || '#6b7280',
    })),
  ].sort((a, b) => b.rate - a.rate)

  // Engine breakdown data
  const engineChartData = engineSnapshots.map((s) => ({
    engine: s.engine.charAt(0).toUpperCase() + s.engine.slice(1),
    citation_rate: s.citation_rate,
    avg_visibility: s.avg_visibility,
    color: ENGINE_COLORS[s.engine] || '#6b7280',
  }))

  // Trend data (if multiple snapshots)
  const trendData = snapshots.map((s) => ({
    date: new Date(s.scan_date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
    citation_rate: s.citation_rate,
    avg_visibility: s.avg_visibility,
    ...Object.fromEntries(Object.entries(s.competitor_rates).map(([k, v]) => [k, v])),
  }))

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="animate-in space-y-8">
      <SectionHelp section="citations" />
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Citation Trends</h1>
          <p className="mt-1 text-muted-foreground">
            Track brand visibility across AI search engines over time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {brands.length > 1 && (
            <select
              className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              value={selectedBrand?.id || ''}
              onChange={(e) => {
                const b = brands.find((x) => x.id === e.target.value)
                if (b) setSelectedBrand(b)
              }}
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <select
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
          >
            <option value="all">All Languages</option>
            <option value="en">English</option>
            <option value="sv">Swedish</option>
            <option value="de">German</option>
            <option value="fr">French</option>
            <option value="es">Spanish</option>
            <option value="no">Norwegian</option>
            <option value="da">Danish</option>
          </select>
          <Button
            size="sm"
            variant="primary"
            onClick={handleCalculate}
            disabled={calculating || !selectedBrand}
          >
            <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', calculating && 'animate-spin')} />
            {calculating ? 'Calculating...' : 'Recalculate'}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-900/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}

      {/* No data */}
      {!loading && snapshots.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-bold text-foreground">No citation data yet</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Run the monitoring cron first, then click &quot;Recalculate&quot; to generate citation
            snapshots.
          </p>
        </Card>
      )}

      {/* Dashboard content */}
      {!loading && snapshots.length > 0 && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatCard
              title="Citation Rate"
              value={citationRate.toFixed(1)}
              suffix="%"
              subtitle={`${brandCitations} of ${totalPrompts} responses`}
              accent={citationRate > 20 ? 'emerald' : citationRate > 5 ? 'amber' : 'red'}
            />
            <StatCard
              title="Avg Position"
              value={avgPosition ? `#${avgPosition.toFixed(1)}` : '—'}
              subtitle="Position when mentioned"
              accent={avgPosition && avgPosition <= 3 ? 'emerald' : 'amber'}
            />
            <StatCard
              title="Top Competitor"
              value={Object.entries(competitorRates).sort(([, a], [, b]) => b - a)[0]?.[0] || '—'}
              suffix={(() => {
                const sorted = Object.entries(competitorRates).sort(([, a], [, b]) => b - a)
                const top = sorted[0]
                return top ? `${top[1]}%` : ''
              })()}
              subtitle="Highest competitor citation rate"
              accent="red"
            />
            <StatCard
              title="Prompts Analyzed"
              value={totalPrompts}
              subtitle={`Across ${engineSnapshots.length} engines`}
              accent="brand"
            />
          </div>

          {/* Competitor Comparison */}
          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Citation Rate — Brand vs Competitors
                </h2>
                <p className="text-sm text-muted-foreground">
                  How often each brand is mentioned in AI responses
                </p>
              </div>
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
            <ResponsiveContainer height={260} width="100%">
              <BarChart data={competitorChartData} layout="vertical">
                <CartesianGrid horizontal={false} stroke="#1f2937" />
                <XAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  type="number"
                  unit="%"
                />
                <YAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  type="category"
                  width={120}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, 'Citation Rate']}
                />
                <Bar dataKey="rate" name="Citation Rate" radius={[0, 6, 6, 0]} barSize={28}>
                  {competitorChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Engine Breakdown + Trend */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Engine Breakdown */}
            <Card className="p-6">
              <h2 className="mb-6 text-lg font-bold text-foreground">Citation Rate by Engine</h2>
              {engineChartData.length > 0 ? (
                <div className="space-y-5">
                  {engineChartData.map((engine) => (
                    <div key={engine.engine}>
                      <div className="mb-1.5 flex justify-between text-sm font-medium">
                        <span className="text-muted-foreground">{engine.engine}</span>
                        <span className="font-bold text-foreground">
                          {engine.citation_rate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(engine.citation_rate, 100)}%`,
                            backgroundColor: engine.color,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Visibility: {engine.avg_visibility.toFixed(0)}%
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No per-engine data available yet.</p>
              )}
            </Card>

            {/* Competitor Rates Detail */}
            <Card className="p-6">
              <h2 className="mb-6 text-lg font-bold text-foreground">Competitor Breakdown</h2>
              <div className="space-y-4">
                {/* Brand row */}
                <div className="border-brand-500/20 bg-primary/5 flex items-center justify-between rounded-xl border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-primary" />
                    <span className="font-bold text-foreground">{selectedBrand?.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-primary">
                      {citationRate.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Competitor rows */}
                {Object.entries(competitorRates)
                  .sort(([, a], [, b]) => b - a)
                  .map(([name, rate]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between rounded-xl border border-border px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: COMPETITOR_COLORS[name] || '#6b7280' }}
                        />
                        <span className="font-medium text-muted-foreground">{name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(rate, 100)}%`,
                              backgroundColor: COMPETITOR_COLORS[name] || '#6b7280',
                            }}
                          />
                        </div>
                        <span className="w-12 text-right text-sm font-bold text-foreground">
                          {rate}%
                        </span>
                      </div>
                    </div>
                  ))}

                {Object.keys(competitorRates).length === 0 && (
                  <p className="text-sm text-muted-foreground">No competitor data detected.</p>
                )}
              </div>
            </Card>
          </div>

          {/* Trend Over Time */}
          {trendData.length > 1 && (
            <Card className="p-6">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-foreground">Citation Rate Over Time</h2>
                <p className="text-sm text-muted-foreground">Daily trend — brand vs competitors</p>
              </div>
              <ResponsiveContainer height={300} width="100%">
                <LineChart data={trendData}>
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} domain={[0, 100]} unit="%" />
                  <Tooltip {...tooltipStyle} />
                  <Line
                    dataKey="citation_rate"
                    name={selectedBrand?.name || 'Brand'}
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={{ fill: '#6366f1', strokeWidth: 2 }}
                    type="monotone"
                  />
                  {Object.keys(competitorRates).map((comp) => (
                    <Line
                      key={comp}
                      dataKey={comp}
                      name={comp}
                      stroke={COMPETITOR_COLORS[comp] || '#6b7280'}
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      dot={false}
                      type="monotone"
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
