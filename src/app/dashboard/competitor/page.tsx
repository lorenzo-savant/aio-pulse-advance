'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  GitCompare,
  Plus,
  X,
  Trophy,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  RefreshCw,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'
import { CompetitorPositioningPanel } from '@/components/CompetitorPositioningPanel'
import { CompetitorSentimentPanel } from '@/components/CompetitorSentimentPanel'
import { SourceOpportunitiesPanel } from '@/components/SourceOpportunitiesPanel'
import { ShareOfVoiceByEnginePanel } from '@/components/ShareOfVoiceByEnginePanel'
import { BusinessDriversPanel } from '@/components/BusinessDriversPanel'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { exportToJson } from '@/lib/export'
import { cn } from '@/lib/utils'
import type { CompetitorResult } from '@/lib/services/gemini'
import type { ShareOfVoice } from '@/lib/services/share-of-voice'
import type { MarketPosition } from '@/lib/services/market-position'
import { useChartTheme } from '@/hooks/useChartTheme'

type SovData = ShareOfVoice & { marketPosition?: MarketPosition }

interface Snapshot {
  id: string
  brand_id: string
  scan_date: string
  engine: string
  category: string
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

interface CompetitorStats {
  name: string
  currentRate: number
  avgRate: number
  trend: 'up' | 'down' | 'stable'
  trendPercent: number
  bestEngine: string
  color: string
}

const COMPETITOR_COLORS = ['#6366f1', '#10b981', '#f97316', '#a855f7', '#ec4899', '#14b8a6']
const RANK_BADGES = ['🥇', '🥈', '🥉', '4️⃣']

const DATE_RANGES = [
  { label: '7 days', days: 7 },
  { label: '15 days', days: 15 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

function HistoricalSection() {
  const { tooltipStyle } = useChartTheme()
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [sov, setSov] = useState<SovData | null>(null)

  useEffect(() => {
    async function loadBrands() {
      try {
        const res = await fetch('/api/brands')
        const data = await res.json()
        const list = data.data || data || []
        setBrands(list)
        if (list.length > 0) setSelectedBrand(list[0])
      } catch {
        console.error('Failed to load brands')
      }
    }
    loadBrands()
  }, [])

  const fetchSnapshots = useCallback(async () => {
    if (!selectedBrand) return
    setLoading(true)
    try {
      const from = new Date()
      from.setDate(from.getDate() - days)
      const fromStr = from.toISOString().split('T')[0]
      const res = await fetch(
        `/api/snapshots?brand_id=${selectedBrand.id}&engine=all&category=all&from=${fromStr}`,
      )
      const data = await res.json()
      setSnapshots(data.data?.snapshots || [])
    } catch {
      console.error('Failed to load snapshots')
    } finally {
      setLoading(false)
    }
  }, [selectedBrand, days])

  useEffect(() => {
    fetchSnapshots()
  }, [fetchSnapshots])

  // Share of Voice comes straight from monitoring_results (mention share),
  // independent of citation snapshots — so it shows even before snapshots exist.
  useEffect(() => {
    if (!selectedBrand) return
    let cancelled = false
    fetch(`/api/share-of-voice?brand_id=${selectedBrand.id}&days=${days}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setSov(j.success ? (j.data as SovData) : null)
      })
      .catch(() => {
        if (!cancelled) setSov(null)
      })
    return () => {
      cancelled = true
    }
  }, [selectedBrand, days])

  const allCompetitors = Array.from(
    new Set(snapshots.flatMap((s) => Object.keys(s.competitor_rates))),
  )

  const chartData = snapshots.map((s) => ({
    date: new Date(s.scan_date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
    brand: s.citation_rate,
    ...s.competitor_rates,
  }))

  const competitorStats: CompetitorStats[] = allCompetitors.map((compName, idx) => {
    const rates = snapshots.map((s) => s.competitor_rates[compName] ?? 0).filter((r) => r > 0)
    const currentRate =
      snapshots.length > 0 ? (snapshots[snapshots.length - 1]?.competitor_rates[compName] ?? 0) : 0
    const avgRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0

    let trend: 'up' | 'down' | 'stable' = 'stable'
    let trendPercent = 0
    if (snapshots.length >= 2) {
      const first = snapshots[0]?.competitor_rates[compName] ?? 0
      const last = snapshots[snapshots.length - 1]?.competitor_rates[compName] ?? 0
      if (first > 0) {
        trendPercent = ((last - first) / first) * 100
        if (trendPercent > 5) trend = 'up'
        else if (trendPercent < -5) trend = 'down'
      }
    }

    return {
      name: compName,
      currentRate,
      avgRate,
      trend,
      trendPercent,
      bestEngine: 'all',
      color: COMPETITOR_COLORS[idx % COMPETITOR_COLORS.length] ?? '#6b7280',
    }
  })

  const brandStats: CompetitorStats = {
    name: selectedBrand?.name ?? 'Your Brand',
    currentRate: snapshots.length > 0 ? (snapshots[snapshots.length - 1]?.citation_rate ?? 0) : 0,
    avgRate:
      snapshots.length > 0
        ? snapshots.reduce((a, s) => a + s.citation_rate, 0) / snapshots.length
        : 0,
    trend: (() => {
      if (snapshots.length < 2) return 'stable'
      const first = snapshots[0]?.citation_rate ?? 0
      const last = snapshots[snapshots.length - 1]?.citation_rate ?? 0
      if (first > 0) {
        const pct = ((last - first) / first) * 100
        if (pct > 5) return 'up'
        if (pct < -5) return 'down'
      }
      return 'stable'
    })(),
    trendPercent: (() => {
      if (snapshots.length < 2) return 0
      const first = snapshots[0]?.citation_rate ?? 0
      const last = snapshots[snapshots.length - 1]?.citation_rate ?? 0
      return first > 0 ? ((last - first) / first) * 100 : 0
    })(),
    bestEngine: 'all',
    color: '#6366f1',
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Historical Tracking</h2>
          <p className="text-sm text-muted-foreground">
            Track competitor citation rates over time from monitoring data
          </p>
        </div>
        <div className="flex items-center gap-3">
          {brands.length > 1 && (
            <select
              className="rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
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
          <div className="flex rounded-lg border border-input bg-input p-1">
            {DATE_RANGES.map((range) => (
              <button
                key={range.days}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  days === range.days
                    ? 'bg-primary text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setDays(range.days)}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Market Position: qualitative role + perception (from SOV+sentiment) ── */}
      {sov?.marketPosition && sov.totalResponses > 0 && (
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Market Position</h3>
            <span
              className={cn(
                'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                sov.marketPosition.confidence === 'high'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : sov.marketPosition.confidence === 'medium'
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-input text-muted-foreground',
              )}
            >
              {sov.marketPosition.confidence} confidence
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {(
              [
                { label: 'Category role', value: sov.marketPosition.categoryRole },
                { label: 'Perception', value: sov.marketPosition.innovationPerception },
              ] as const
            ).map((b) => (
              <div key={b.label} className="bg-input/50 rounded-xl border border-input px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {b.label}
                </p>
                <p className="mt-0.5 text-lg font-black capitalize text-primary">{b.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            {sov.marketPosition.reasoning}
          </p>
        </Card>
      )}

      {/* ── Share of Voice: mention share, brand vs competitors ──────────── */}
      {sov && sov.entities.length > 0 && sov.totalResponses > 0 && (
        <Card className="p-6">
          <div className="mb-1 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Share of Voice</h3>
          </div>
          <p className="mb-5 text-sm text-muted-foreground">
            Of every brand &amp; competitor mention across AI answers ({sov.totalResponses}{' '}
            responses, last {days} days), who owns the conversation.
          </p>

          <div className="space-y-2.5">
            {sov.entities.slice(0, 8).map((e, idx) => {
              const color = e.isBrand
                ? '#6366f1'
                : (COMPETITOR_COLORS[idx % COMPETITOR_COLORS.length] ?? '#6b7280')
              return (
                <div key={e.name} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-sm font-semibold text-foreground">
                    {e.name}
                    {e.isBrand && <span className="ml-1 text-[10px] text-primary">(you)</span>}
                  </span>
                  <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-input">
                    <div
                      className="h-full rounded-md transition-all"
                      style={{ width: `${e.share}%`, background: color }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-sm font-black text-foreground">
                    {e.share}%
                  </span>
                  <span className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground sm:inline">
                    {e.mentionRate}% of answers
                    {e.avgPosition != null && ` · pos ${e.avgPosition}`}
                  </span>
                </div>
              )
            })}
          </div>

          {sov.timeline.length >= 2 && (
            <div className="mt-6">
              <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
                Share of Voice over time
              </h4>
              <ResponsiveContainer height={260} width="100%">
                <LineChart
                  data={sov.timeline.map((t) => ({
                    date: new Date(t.date).toLocaleDateString('sv-SE', {
                      day: 'numeric',
                      month: 'short',
                    }),
                    ...t.shares,
                  }))}
                >
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} domain={[0, 100]} unit="%" />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
                  <Legend />
                  {sov.series.map((name, idx) => (
                    <Line
                      key={name}
                      dataKey={name}
                      name={name}
                      type="monotone"
                      stroke={
                        idx === 0
                          ? '#6366f1'
                          : (COMPETITOR_COLORS[idx % COMPETITOR_COLORS.length] ?? '#6b7280')
                      }
                      strokeWidth={idx === 0 ? 3 : 1.5}
                      strokeDasharray={idx === 0 ? undefined : '4 4'}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      )}

      {!loading && snapshots.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-bold text-foreground">No tracking data yet</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Run monitoring and recalculate snapshots to start tracking competitor rates.
          </p>
        </Card>
      )}

      {!loading && chartData.length > 0 && (
        <>
          <Card className="p-6">
            <h3 className="mb-6 text-lg font-bold text-foreground">Citation Rate Trend</h3>
            <ResponsiveContainer height={320} width="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} domain={[0, 100]} unit="%" />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`]} />
                <Legend />
                <Line
                  dataKey="brand"
                  name={selectedBrand?.name || 'Your Brand'}
                  stroke="#6366f1"
                  strokeWidth={3}
                  dot={{ fill: '#6366f1', strokeWidth: 2 }}
                  type="monotone"
                />
                {allCompetitors.map((comp) => (
                  <Line
                    key={comp}
                    dataKey={comp}
                    name={comp}
                    stroke={
                      COMPETITOR_COLORS[allCompetitors.indexOf(comp) % COMPETITOR_COLORS.length]
                    }
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    type="monotone"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="mb-5 text-lg font-bold text-foreground">Competitor Statistics</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input">
                    <th className="pb-3 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Name
                    </th>
                    <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Current Rate
                    </th>
                    <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Avg Rate
                    </th>
                    <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Trend
                    </th>
                    <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-input/50 border-b">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-primary" />
                        <span className="font-bold text-foreground">{brandStats.name}</span>
                        <Badge variant="brand">Your Brand</Badge>
                      </div>
                    </td>
                    <td className="py-3 text-center font-black text-primary">
                      {brandStats.currentRate.toFixed(1)}%
                    </td>
                    <td className="py-3 text-center text-muted-foreground">
                      {brandStats.avgRate.toFixed(1)}%
                    </td>
                    <td className="py-3 text-center">
                      {brandStats.trend === 'up' && (
                        <span className="flex items-center justify-center gap-1 text-emerald-400">
                          <TrendingUp className="h-4 w-4" />+{brandStats.trendPercent.toFixed(1)}%
                        </span>
                      )}
                      {brandStats.trend === 'down' && (
                        <span className="flex items-center justify-center gap-1 text-red-400">
                          <TrendingDown className="h-4 w-4" />
                          {brandStats.trendPercent.toFixed(1)}%
                        </span>
                      )}
                      {brandStats.trend === 'stable' && (
                        <span className="flex items-center justify-center gap-1 text-muted-foreground">
                          <Minus className="h-4 w-4" />
                          Stable
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      <Badge
                        variant={
                          brandStats.trend === 'up'
                            ? 'success'
                            : brandStats.trend === 'down'
                              ? 'danger'
                              : 'default'
                        }
                      >
                        {brandStats.trend === 'up'
                          ? 'Improving'
                          : brandStats.trend === 'down'
                            ? 'Declining'
                            : 'Stable'}
                      </Badge>
                    </td>
                  </tr>
                  {competitorStats.map((comp) => (
                    <tr key={comp.name} className="border-input/50 border-b">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: comp.color }}
                          />
                          <span className="font-medium text-muted-foreground">{comp.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-center font-black text-foreground">
                        {comp.currentRate.toFixed(1)}%
                      </td>
                      <td className="py-3 text-center text-muted-foreground">
                        {comp.avgRate.toFixed(1)}%
                      </td>
                      <td className="py-3 text-center">
                        {comp.trend === 'up' && (
                          <span className="flex items-center justify-center gap-1 text-red-400">
                            <TrendingUp className="h-4 w-4" />+{comp.trendPercent.toFixed(1)}%
                          </span>
                        )}
                        {comp.trend === 'down' && (
                          <span className="flex items-center justify-center gap-1 text-emerald-400">
                            <TrendingDown className="h-4 w-4" />
                            {comp.trendPercent.toFixed(1)}%
                          </span>
                        )}
                        {comp.trend === 'stable' && (
                          <span className="flex items-center justify-center gap-1 text-muted-foreground">
                            <Minus className="h-4 w-4" />
                            Stable
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {comp.currentRate > brandStats.currentRate ? (
                          <Badge variant="warning">Ahead</Badge>
                        ) : (
                          <Badge variant="success">Behind</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  )
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 26
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: 68, height: 68 }}
    >
      <svg className="-rotate-90" height={68} width={68}>
        <circle
          cx={34}
          cy={34}
          fill="none"
          r={r}
          stroke="rgb(var(--color-ring-track))"
          strokeWidth="6"
        />
        <circle
          cx={34}
          cy={34}
          fill="none"
          r={r}
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="6"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <span className="absolute text-sm font-black text-foreground">{score}</span>
    </div>
  )
}

function ResultCard({
  result,
  rank,
  color,
  isPrimary,
}: {
  result: CompetitorResult
  rank: number
  color: string
  isPrimary: boolean
}) {
  const isWinner = rank === 0

  return (
    <Card className={cn('p-5 transition-all', isWinner && 'ring-brand-500/40 ring-1')}>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-base">{RANK_BADGES[rank]}</span>
            {isPrimary && <Badge variant="brand">Your Site</Badge>}
            {isWinner && <Badge variant="success">Winner</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">{result.url}</p>
        </div>
        <ScoreRing color={color} score={result.score} />
      </div>

      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">{result.summary}</p>

      <div className="space-y-2">
        {result.engineBreakdown.slice(0, 4).map((e) => (
          <div key={e.engine} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-muted-foreground">{e.engine}</span>
            <div className="bg-input-border h-1 flex-1 rounded-full">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${e.score}%`, background: color }}
              />
            </div>
            <span className="w-7 text-right font-bold text-muted-foreground">{e.score}</span>
          </div>
        ))}
      </div>

      {result.keywords.length > 0 && (
        <div className="mt-4 border-t border-input pt-3">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Top Keywords
          </p>
          <div className="flex flex-wrap gap-1">
            {result.keywords.slice(0, 3).map((k) => (
              <span
                key={k.word}
                className="rounded border px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ borderColor: `${color}30`, color }}
              >
                {k.word}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

export default function CompetitorPage() {
  const [primaryUrl, setPrimaryUrl] = useState('')
  const [competitorUrls, setCompetitorUrls] = useState([''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<{
    primary: CompetitorResult
    competitors: CompetitorResult[]
  } | null>(null)
  const [savedAnalyses, setSavedAnalyses] = useState<
    Array<{
      id: string
      primary_url: string
      summary: string
      competitors: any
      created_at: string
    }>
  >([])

  useEffect(() => {
    async function loadSaved() {
      try {
        const res = await fetch('/api/competitor?limit=5')
        const d = await res.json()
        if (d.success && d.data?.length > 0) {
          setSavedAnalyses(d.data)
        }
      } catch {
        // Silently fail
      }
    }
    loadSaved()
  }, [])

  const addCompetitor = () => {
    if (competitorUrls.length < 3) setCompetitorUrls((prev) => [...prev, ''])
  }
  const removeCompetitor = (i: number) =>
    setCompetitorUrls((prev) => prev.filter((_, idx) => idx !== i))
  const updateCompetitor = (i: number, val: string) => {
    setCompetitorUrls((prev) => prev.map((u, idx) => (idx === i ? val : u)))
  }

  const handleCompare = useCallback(async () => {
    const validCompetitors = competitorUrls.filter((u) => u.trim())
    if (!primaryUrl.trim() || validCompetitors.length === 0) return

    setLoading(true)
    setError(null)
    setResults(null)

    try {
      const res = await fetch('/api/competitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryUrl: primaryUrl.trim(),
          competitorUrls: validCompetitors,
        }),
      })

      const json = (await res.json()) as {
        success: boolean
        data?: { primary: CompetitorResult; competitors: CompetitorResult[] }
        message?: string
      }

      if (!json.success || !json.data) throw new Error(json.message ?? 'Comparison failed')
      setResults(json.data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }, [primaryUrl, competitorUrls])

  const radarData = results
    ? ['ChatGPT', 'Gemini', 'Perplexity', 'Claude'].map((engine) => {
        const point: Record<string, number | string> = { engine }
        const allResults = [results.primary, ...results.competitors]
        allResults.forEach((r, i) => {
          const match = r.engineBreakdown.find((e) => e.engine === engine)
          point[`site${i}`] = match?.score ?? 0
        })
        return point
      })
    : []

  const rankedResults = results
    ? [
        ...[
          { ...results.primary, isPrimary: true },
          ...results.competitors.map((c) => ({ ...c, isPrimary: false })),
        ],
      ].sort((a, b) => b.score - a.score)
    : []

  const winner = rankedResults[0]

  return (
    <div className="animate-in space-y-8">
      <SectionHelp section="competitor" />
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">
          Competitor Comparison
        </h1>
        <p className="mt-1 text-muted-foreground">
          Benchmark your AI visibility against up to 3 competitors.
        </p>
      </div>

      <CompetitorPositioningPanel />

      <CompetitorSentimentPanel />

      <ShareOfVoiceByEnginePanel />

      <BusinessDriversPanel />

      <SourceOpportunitiesPanel />

      <HistoricalSection />

      {savedAnalyses.length > 0 && !results && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-bold text-muted-foreground">Previous Comparisons</h3>
          <div className="space-y-2">
            {savedAnalyses.map((sa) => (
              <button
                key={sa.id}
                className="flex w-full items-center gap-3 rounded-lg border border-input bg-secondary px-3 py-2 text-left transition-all hover:border-input"
                onClick={() => {
                  if (sa.competitors?.primary && sa.competitors?.competitors) {
                    setResults(sa.competitors)
                    setPrimaryUrl(sa.primary_url)
                  }
                }}
              >
                <GitCompare className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {sa.primary_url}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(sa.created_at).toLocaleString('sv-SE')} · {sa.summary}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Your URL (Primary)
            </label>
            <input
              className="border-brand-500/30 placeholder-text-muted-surface w-full rounded-xl border bg-input px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="https://yoursite.com/page-to-analyze"
              type="url"
              value={primaryUrl}
              onChange={(e) => setPrimaryUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Competitor URLs
            </label>
            <div className="space-y-2">
              {competitorUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="placeholder-text-muted-surface flex-1 rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-primary"
                    placeholder={`https://competitor${i + 1}.com/their-page`}
                    type="url"
                    value={url}
                    onChange={(e) => updateCompetitor(i, e.target.value)}
                  />
                  {competitorUrls.length > 1 && (
                    <button
                      className="rounded-xl border border-input p-3 text-muted-foreground transition-colors hover:border-red-500/30 hover:text-red-400"
                      onClick={() => removeCompetitor(i)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {competitorUrls.length < 3 && (
              <button
                className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-input px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-input hover:text-muted-foreground"
                onClick={addCompetitor}
              >
                <Plus className="h-4 w-4" /> Add competitor
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Each URL will be fetched and analyzed individually using Gemini AI.
          </p>
          <Button
            disabled={!primaryUrl.trim() || !competitorUrls.some((u) => u.trim())}
            loading={loading}
            size="lg"
            onClick={handleCompare}
          >
            <GitCompare className="h-5 w-5" />
            {loading ? 'Analyzing...' : 'Compare'}
          </Button>
        </div>
      </Card>

      {results && (
        <div className="animate-in space-y-6">
          {winner && (
            <div className="flex items-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-4">
              <Trophy className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="font-bold text-emerald-300">
                  {winner.isPrimary ? '🎉 Your site leads!' : 'Competitor leads'} — Score:{' '}
                  {winner.score}/100
                </p>
                <p className="max-w-md truncate text-xs text-muted-foreground">{winner.url}</p>
              </div>
              <Button
                className="ml-auto"
                size="sm"
                variant="outline"
                onClick={() => exportToJson(results, 'competitor-analysis')}
              >
                Export JSON
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {rankedResults.map((r, i) => (
              <ResultCard
                key={r.url}
                color={COMPETITOR_COLORS[i] ?? '#6b7280'}
                isPrimary={r.isPrimary}
                rank={i}
                result={r}
              />
            ))}
          </div>

          {radarData.length > 0 && (
            <Card className="p-6">
              <h2 className="mb-6 text-lg font-bold text-foreground">Engine-by-Engine Radar</h2>
              <ResponsiveContainer height={320} width="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1f2937" />
                  <PolarAngleAxis dataKey="engine" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 100]}
                    tick={{ fontSize: 9, fill: '#4b5563' }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#0f172a',
                      border: '1px solid #1f2937',
                      borderRadius: 8,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {rankedResults.map((r, i) => (
                    <Radar
                      key={r.url}
                      dataKey={`site${i}`}
                      fill={COMPETITOR_COLORS[i] ?? '#6b7280'}
                      fillOpacity={0.15}
                      name={r.isPrimary ? 'Your Site' : `Competitor ${i}`}
                      stroke={COMPETITOR_COLORS[i] ?? '#6b7280'}
                      strokeWidth={2}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="mb-5 text-lg font-bold text-foreground">Score Delta vs Your Site</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-input">
                    <th className="pb-3 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      URL
                    </th>
                    <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Score
                    </th>
                    <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Delta
                    </th>
                    <th className="pb-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Rank
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rankedResults.map((r, i) => {
                    const delta = r.score - results.primary.score
                    return (
                      <tr key={r.url} className="border-input/50 border-b">
                        <td className="max-w-[200px] truncate py-3 text-xs text-muted-foreground">
                          {r.url}
                        </td>
                        <td className="py-3 text-center font-black text-foreground">{r.score}</td>
                        <td className="py-3 text-center">
                          {r.isPrimary ? (
                            <span className="text-xs text-muted-foreground">baseline</span>
                          ) : (
                            <span
                              className={cn(
                                'flex items-center justify-center gap-1 text-xs font-bold',
                                delta > 0 ? 'text-red-400' : 'text-emerald-400',
                              )}
                            >
                              {delta > 0 ? (
                                <TrendingUp className="h-3 w-3" />
                              ) : (
                                <TrendingDown className="h-3 w-3" />
                              )}
                              {delta > 0 ? '+' : ''}
                              {delta}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-center text-lg">{RANK_BADGES[i]}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
