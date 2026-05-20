// PATH: src/app/dashboard/geo-score/page.tsx
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
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Gauge,
  RefreshCw,
  AlertCircle,
  Lightbulb,
  Globe,
  ArrowUpRight,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { useChartTheme } from '@/hooks/useChartTheme'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Brand {
  id: string
  name: string
  color: string
  domain?: string | null
}

interface Pillar {
  key: string
  label: string
  score: number
  weight: number
  contribution: number
}

interface SiteAudit {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  url: string
  cachedAt: string
  expiresAt: string
  topIssues: string[]
}

interface GeoData {
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  delta: number
  previousScore: number
  pillars: Pillar[]
  recommendations: string[]
  history: { date: string; score: number }[]
  engineBreakdown: { engine: string; visibility: number }[]
  date: string | null
  hasData: boolean
  /** Latest cached static site audit (from /api/audit/technical). */
  siteAudit: SiteAudit | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GRADE_COLOR: Record<string, string> = {
  A: '#10b981',
  B: '#22c55e',
  C: '#f59e0b',
  D: '#f97316',
  F: '#ef4444',
}

const ENGINE_COLORS: Record<string, string> = {
  chatgpt: '#10b981',
  gemini: '#3b82f6',
  perplexity: '#a855f7',
  claude: '#f97316',
}

function scoreAccent(score: number): string {
  if (score >= 70) return '#10b981'
  if (score >= 55) return '#f59e0b'
  if (score >= 40) return '#f97316'
  return '#ef4444'
}

function periodLabel(p: string): string {
  if (p === '7d') return '7d ago'
  if (p === '60d') return '60d ago'
  if (p === '90d') return '90d ago'
  return '30d ago'
}

// Inline link that connects the live GEO Score to the static site audit at
// /dashboard/audit. Deliberately small — it lives inside the gauge card and
// reads as "by the way, here's the related static-readiness score", not as a
// competing widget.
function SiteAuditLine({
  audit,
  fallbackDomain,
}: {
  audit: GeoData['siteAudit']
  fallbackDomain: string | null
}) {
  if (audit) {
    const href = `/dashboard/audit?url=${encodeURIComponent(audit.url)}`
    return (
      <a
        href={href}
        className="mt-8 flex w-full items-center gap-2 border-t border-border pt-6 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <Globe className="h-3.5 w-3.5" />
        <span>
          Site readiness{' '}
          <span className="font-bold" style={{ color: scoreAccent(audit.score) }}>
            {audit.score}
          </span>{' '}
          ({audit.grade})
        </span>
        <ArrowUpRight className="ml-auto h-3.5 w-3.5" />
      </a>
    )
  }
  if (!fallbackDomain) return null
  const href = `/dashboard/audit?url=${encodeURIComponent(fallbackDomain)}`
  return (
    <a
      href={href}
      className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <Globe className="h-3.5 w-3.5" />
      <span>Run site audit for {fallbackDomain}</span>
      <ArrowUpRight className="ml-auto h-3.5 w-3.5" />
    </a>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function GeoScorePage() {
  const { tooltipStyle } = useChartTheme()
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState<GeoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/brands')
        const json = await res.json()
        const list = json.data || json || []
        setBrands(list)
        if (list.length > 0) setSelectedBrand(list[0])
        else setLoading(false)
      } catch {
        setError('Failed to load brands')
        setLoading(false)
      }
    }
    load()
  }, [])

  const fetchScore = useCallback(async () => {
    if (!selectedBrand) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/geo-score?brand_id=${selectedBrand.id}&period=${period}`)
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.message || `API error: ${res.status}`)
        setData(null)
        return
      }
      setData(json.data)
    } catch {
      setError('Failed to load GEO score')
    } finally {
      setLoading(false)
    }
  }, [selectedBrand, period])

  useEffect(() => {
    fetchScore()
  }, [fetchScore])

  const trend: 'up' | 'down' | 'neutral' =
    !data || data.delta === 0 ? 'neutral' : data.delta > 0 ? 'up' : 'down'
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus

  const chartData = (data?.history || []).map((h) => ({
    date: new Date(h.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
    score: h.score,
  }))

  return (
    <div className="animate-in space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">GEO Score</h1>
          <p className="mt-1 text-muted-foreground">
            Generative Engine Optimization — how well your brand is optimized to be surfaced and
            cited by AI answer engines.
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
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="60d">Last 60 days</option>
            <option value="90d">Last 90 days</option>
          </select>
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
      {!loading && (!data || !data.hasData) && !error && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Gauge className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-bold text-foreground">No GEO score yet</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Run the monitoring cron to generate brand health scores. The GEO score is derived from
            your AI visibility metrics over time.
          </p>
        </Card>
      )}

      {/* Content */}
      {!loading && data && data.hasData && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Score gauge */}
            <Card className="flex flex-col items-center justify-center p-10 text-center">
              <p className="mb-8 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                GEO Score
              </p>
              {/* Slightly bigger frame so the grade badge sits outside the
                  gauge arc with breathing room (was h-44/w-44). */}
              <div className="relative flex h-52 w-52 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                  {/* Background ring: same colour as the score arc at low opacity
                      so the gauge reads as one coherent shape, not two stripes. */}
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke={scoreAccent(data.score)}
                    strokeOpacity={0.15}
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke={scoreAccent(data.score)}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(data.score / 100) * 276.46} 276.46`}
                    className="transition-all duration-700"
                  />
                </svg>
                {/* Score number — leading-none keeps it visually centered. */}
                <span
                  className="text-6xl font-black leading-none"
                  style={{ color: scoreAccent(data.score) }}
                >
                  {data.score.toFixed(0)}
                </span>
                {/* Grade badge — pulled fully OUTSIDE the gauge arc so it
                    reads as a separate annotation, not as something sitting
                    on top of the score number. Larger ring-card halo keeps
                    visual separation from the arc stroke. */}
                <span
                  className="absolute -bottom-2 -right-2 flex h-12 w-12 items-center justify-center rounded-full text-lg font-black text-white shadow-lg ring-[6px] ring-card"
                  style={{ backgroundColor: GRADE_COLOR[data.grade] }}
                >
                  {data.grade}
                </span>
              </div>
              {/* Delta + previous-score block. mt-10 (40px) gives the gauge
                  room to breathe; the two lines are intentionally bunched
                  via gap-1 so they read as one trend statement. */}
              <div className="mt-10 flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'flex items-center gap-2 text-sm font-semibold',
                    trend === 'up'
                      ? 'text-emerald-400'
                      : trend === 'down'
                        ? 'text-red-400'
                        : 'text-muted-foreground',
                  )}
                >
                  <TrendIcon className="h-4 w-4" />
                  <span>
                    {data.delta > 0 ? '+' : ''}
                    {data.delta.toFixed(1)} vs {periodLabel(period)}
                  </span>
                </div>
                {data.previousScore > 0 && Math.abs(data.delta) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    was {data.previousScore.toFixed(1)}
                  </p>
                )}
              </div>

              {/* Inline link to the static site audit — connects this live
                  visibility score to the static readiness audit that already
                  exists at /dashboard/audit, without a parallel card. */}
              <SiteAuditLine
                audit={data.siteAudit}
                fallbackDomain={selectedBrand?.domain ?? null}
              />
            </Card>

            {/* Pillars */}
            <Card className="p-6 lg:col-span-2">
              <h2 className="mb-1 text-lg font-bold text-foreground">Score Breakdown</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Each pillar is weighted; its contribution sums to the total score.
              </p>
              <div className="space-y-5">
                {data.pillars.map((p) => (
                  <div key={p.key}>
                    <div className="mb-1.5 flex justify-between text-sm font-medium">
                      <span className="text-muted-foreground">
                        {p.label}{' '}
                        <span className="text-xs opacity-60">
                          ({Math.round(p.weight * 100)}% weight)
                        </span>
                      </span>
                      <span className="font-bold text-foreground">
                        {p.score.toFixed(0)}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          +{p.contribution.toFixed(1)} pts
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(p.score, 100)}%`,
                          backgroundColor: scoreAccent(p.score),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <Card className="p-6">
              <div className="mb-4 flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-400" />
                <h2 className="text-lg font-bold text-foreground">How to improve your GEO Score</h2>
              </div>
              <ul className="space-y-3">
                {data.recommendations.map((rec, i) => (
                  <li
                    key={i}
                    className="bg-secondary/40 flex gap-3 rounded-lg border border-border px-4 py-3 text-sm text-foreground"
                  >
                    <span className="bg-primary/15 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    {rec}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Trend */}
            <Card className="p-6">
              <h2 className="mb-6 text-lg font-bold text-foreground">GEO Score Trend</h2>
              {chartData.length > 1 ? (
                <ResponsiveContainer height={240} width="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip {...tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={false}
                      name="GEO Score"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Need at least two snapshots to show a trend.
                </p>
              )}
            </Card>

            {/* Engine breakdown */}
            <Card className="p-6">
              <h2 className="mb-6 text-lg font-bold text-foreground">Visibility by Engine</h2>
              {data.engineBreakdown.length > 0 ? (
                <div className="space-y-5">
                  {data.engineBreakdown.map((e) => (
                    <div key={e.engine}>
                      <div className="mb-1.5 flex justify-between text-sm font-medium">
                        <span className="capitalize text-muted-foreground">{e.engine}</span>
                        <span className="font-bold text-foreground">
                          {e.visibility.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.min(e.visibility, 100)}%`,
                            backgroundColor: ENGINE_COLORS[e.engine] || '#6b7280',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No per-engine data for the latest snapshot.
                </p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
