'use client'

// "Branded vs Non-branded GSC search" panel.
//
// Closes the gap from the Semrush AEO piece: "Inside Google's AI
// Overviews and AI Mode, mentions can also increase your search
// impressions. When your brand consistently appears in AI-generated
// summaries, users begin to recognize and trust it — that can lead
// to more direct searches over time."
//
// The signal: branded impressions / clicks growing while ranking-page
// CTR drops is the canonical "AI is making people search for you"
// pattern. This panel surfaces that growth + the top branded queries
// in-window so the user can see WHICH queries are responsible.
//
// Self-contained — fetches its own brand list, picks the first, accepts
// optional brandId. No parent-state coupling.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Search, Loader2, TrendingUp, TrendingDown } from 'lucide-react'

interface BrandedTotals {
  clicks: number
  impressions: number
  uniqueQueries: number
}

interface BrandedSummary {
  branded: BrandedTotals
  nonBranded: BrandedTotals
  total: BrandedTotals
  brandedShareClicks: number
  brandedShareImpressions: number
}

interface TimelinePoint {
  date: string
  brandedClicks: number
  brandedImpressions: number
  nonBrandedClicks: number
  nonBrandedImpressions: number
}

interface Growth {
  clicksDeltaPct: number | null
  impressionsDeltaPct: number | null
}

type AiAssistVerdict = 'assisted' | 'neutral' | 'cannibalised' | 'unknown'

interface AiAssistShape {
  score: number | null
  verdict: AiAssistVerdict
  brandedDeltaPct: number | null
  nonBrandedDeltaPct: number | null
  reason: string
}

interface TopBrandedQuery {
  query: string
  clicks: number
  impressions: number
}

interface BrandedSearchData {
  anchors: string[]
  summary: BrandedSummary
  timeline: TimelinePoint[]
  growth: Growth
  aiAssist?: AiAssistShape
  topBrandedQueries: TopBrandedQuery[]
  gscAvailable?: boolean
  filters: { days: number }
}

interface BrandLite {
  id: string
  name: string
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

export function BrandedSearchPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<BrandedSearchData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (brandIdProp) return
    let cancelled = false
    fetch('/api/brands')
      .then((r) => r.json() as Promise<{ data?: BrandLite[] }>)
      .then((j) => {
        if (cancelled) return
        const list = j.data ?? []
        setBrands(list)
        if (!activeBrandId && list[0]) setActiveBrandId(list[0].id)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandIdProp])

  useEffect(() => {
    if (!activeBrandId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/gsc/branded-search?brand_id=${activeBrandId}&days=90`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.success) setData(j.data as BrandedSearchData)
        else setError(j.message || 'Failed to load')
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeBrandId])

  if (loading && !data) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading branded search…
      </Card>
    )
  }
  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (!data) return null
  if (data.gscAvailable === false) {
    return (
      <Card className="p-4 text-xs text-amber-300">
        <Search className="mr-1.5 inline h-3.5 w-3.5" />
        GSC data unavailable — connect Google Search Console to unlock branded-vs-non-branded growth
        and the AI-assist verdict.
      </Card>
    )
  }
  if (data.summary.total.impressions === 0) return null

  const { summary, growth, topBrandedQueries } = data

  // Trend arrow + colour for the click-growth delta.
  const clicksDelta = growth.clicksDeltaPct
  const impressionsDelta = growth.impressionsDeltaPct
  const trendIcon = (delta: number | null) => {
    if (delta == null) return null
    return delta >= 0 ? (
      <TrendingUp className="inline h-3 w-3" />
    ) : (
      <TrendingDown className="inline h-3 w-3" />
    )
  }
  const trendColour = (delta: number | null) => {
    if (delta == null) return 'text-muted-foreground'
    if (delta >= 10) return 'text-emerald-400'
    if (delta <= -10) return 'text-rose-400'
    return 'text-muted-foreground'
  }

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Branded vs Non-Branded Search</h2>
        </div>
        {brands.length > 1 && !brandIdProp && (
          <select
            value={activeBrandId}
            onChange={(e) => setActiveBrandId(e.target.value)}
            className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground"
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        Google Search Console queries split by whether they mention your brand. Branded volume
        rising while CTR falls is the &ldquo;AI is making people search for you&rdquo; pattern — AI
        surfaces strip the click but the brand sticks. Window: last {data.filters.days} days.
      </p>

      {data.aiAssist && data.aiAssist.verdict !== 'unknown' && data.aiAssist.score != null && (
        <div
          className={
            'mb-4 rounded-lg border px-4 py-3 text-sm ' +
            (data.aiAssist.verdict === 'assisted'
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
              : data.aiAssist.verdict === 'cannibalised'
                ? 'border-rose-500/30 bg-rose-500/5 text-rose-300'
                : 'bg-secondary/40 border-border text-muted-foreground')
          }
        >
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wider">
              AI assist score:{' '}
              <span className="text-foreground">{data.aiAssist.score.toFixed(1)}</span>{' '}
              <span className="text-muted-foreground">({data.aiAssist.verdict.toUpperCase()})</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              Δ branded {data.aiAssist.brandedDeltaPct?.toFixed(1) ?? 'n/a'}% · Δ non-branded{' '}
              {data.aiAssist.nonBrandedDeltaPct?.toFixed(1) ?? 'n/a'}%
            </p>
          </div>
          <p className="text-foreground">{data.aiAssist.reason}</p>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Branded clicks</p>
          <p className="text-xl font-black text-foreground">{formatNum(summary.branded.clicks)}</p>
          {clicksDelta != null && (
            <p className={`text-[10px] font-bold ${trendColour(clicksDelta)}`}>
              {trendIcon(clicksDelta)} {clicksDelta >= 0 ? '+' : ''}
              {clicksDelta.toFixed(1)}% vs first half
            </p>
          )}
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Branded impressions
          </p>
          <p className="text-xl font-black text-foreground">
            {formatNum(summary.branded.impressions)}
          </p>
          {impressionsDelta != null && (
            <p className={`text-[10px] font-bold ${trendColour(impressionsDelta)}`}>
              {trendIcon(impressionsDelta)} {impressionsDelta >= 0 ? '+' : ''}
              {impressionsDelta.toFixed(1)}% vs first half
            </p>
          )}
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Branded share (clicks)
          </p>
          <p className="text-xl font-black text-foreground">
            {summary.brandedShareClicks.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground">
            {summary.branded.uniqueQueries} unique queries
          </p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Branded share (impressions)
          </p>
          <p className="text-xl font-black text-foreground">
            {summary.brandedShareImpressions.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground">
            vs {formatNum(summary.nonBranded.impressions)} non-branded impressions
          </p>
        </div>
      </div>

      {topBrandedQueries.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            Top branded queries (by impressions)
          </p>
          <div className="space-y-1">
            {topBrandedQueries.slice(0, 8).map((q) => (
              <div
                key={q.query}
                className="bg-input/40 flex items-center justify-between gap-2 rounded-md border border-input px-3 py-1.5"
              >
                <span className="truncate text-sm font-medium text-foreground" title={q.query}>
                  {q.query}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  <span className="font-bold text-foreground">{formatNum(q.impressions)}</span> impr
                  · {formatNum(q.clicks)} clicks
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
