'use client'

// "Competitor Sentiment" panel — closes Semrush competitor-intelligence
// best-practice #3 ("AI analyzes competitor customer reviews to identify
// pain points / popular features / service gaps") by leaning on the data
// we already collect: every monitoring response carries a sentiment_score
// AND a list of competitor_mentions. Aggregating one against the other
// shows how the AI portrays each rival vs. how it portrays you.
//
// Self-contained: takes brandId as a prop, fetches its own data, renders
// the breakdown. No new API key, no new dependency.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Loader2, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CompetitorRow {
  name: string
  mentions: number
  avgSentiment: number
  skew: 'positive' | 'negative' | 'neutral'
  deltaVsBrand: number | null
  pos: number
  neg: number
  neu: number
  engines: string[]
}

interface OwnBrand {
  name: string
  mentions: number
  avgSentiment: number
  skew: 'positive' | 'negative' | 'neutral'
  pos: number
  neg: number
  neu: number
}

interface SentimentData {
  summary: {
    totalAnalyzed: number
    rankedCompetitors: number
    minMentions: number
    ownBrand: OwnBrand
  }
  competitors: CompetitorRow[]
}

function toneClass(skew: 'positive' | 'negative' | 'neutral'): string {
  if (skew === 'positive') return 'bg-emerald-500/10 text-emerald-400'
  if (skew === 'negative') return 'bg-rose-500/10 text-rose-400'
  return 'bg-secondary text-muted-foreground'
}

function deltaClass(delta: number | null): string {
  if (delta === null) return 'text-muted-foreground'
  if (delta > 0.05) return 'text-rose-400' // competitor is described BETTER than you → bad for you
  if (delta < -0.05) return 'text-emerald-400'
  return 'text-muted-foreground'
}

interface BrandLite {
  id: string
  name: string
}

/**
 * Self-contained: fetches the user's brands, lets them pick one (defaults to
 * the first), then loads competitor-sentiment for the selected brand.
 * Avoids reaching into the parent page's state (which is split across
 * sub-components and would force a refactor to lift it up).
 */
export function CompetitorSentimentPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<SentimentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sortByDelta, setSortByDelta] = useState(false)

  // Fetch the user's brands once (or skip if brandId came from a prop).
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
      .catch(() => {
        /* silent — panel just stays empty */
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandIdProp])

  // Fetch sentiment whenever the active brand changes.
  useEffect(() => {
    if (!activeBrandId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/competitor/sentiment?brand_id=${activeBrandId}&days=30`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.success) setData(j.data as SentimentData)
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
        Loading competitor sentiment…
      </Card>
    )
  }
  if (error) {
    return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  }
  if (!data || data.competitors.length === 0) return null

  const { ownBrand } = data.summary
  const rows = sortByDelta
    ? [...data.competitors].sort((a, b) => {
        // Most threatening (competitor better than you) first.
        const da = a.deltaVsBrand ?? -Infinity
        const db = b.deltaVsBrand ?? -Infinity
        return db - da
      })
    : data.competitors

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Competitor Sentiment</h2>
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
        How AI engines describe each competitor vs. how they describe you, over the last 30 days (
        {data.summary.totalAnalyzed} responses analyzed, min {data.summary.minMentions} mentions).
        Positive Δ means the AI is more favourable to that rival than to you — the ones to study or
        counter.
      </p>

      {/* Own-brand baseline */}
      <div className="bg-secondary/40 mb-4 rounded-lg border border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{ownBrand.name}</span>
            <span className="bg-primary/10 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              you
            </span>
            <span
              className={cn('rounded-full px-2 py-0.5 text-xs font-bold', toneClass(ownBrand.skew))}
            >
              {ownBrand.avgSentiment > 0 ? '+' : ''}
              {ownBrand.avgSentiment.toFixed(2)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {ownBrand.mentions} mentions ·{' '}
            <span className="text-emerald-400/80">+{ownBrand.pos}</span>{' '}
            <span className="text-rose-400/80">−{ownBrand.neg}</span> ={ownBrand.neu}
          </div>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Competitors ({data.summary.rankedCompetitors})
        </p>
        <button
          className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setSortByDelta((v) => !v)}
        >
          Sort by: {sortByDelta ? 'Δ vs. you (threat)' : 'mention volume'} ↻
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((c) => (
          <div
            key={c.name}
            className="bg-input/40 flex flex-col gap-2 rounded-lg border border-input px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{c.name}</span>
                <span
                  className={cn('rounded-full px-2 py-0.5 text-xs font-bold', toneClass(c.skew))}
                >
                  {c.avgSentiment > 0 ? '+' : ''}
                  {c.avgSentiment.toFixed(2)}
                </span>
                {c.deltaVsBrand !== null && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                      deltaClass(c.deltaVsBrand),
                    )}
                    title="Δ vs. your own sentiment"
                  >
                    Δ {c.deltaVsBrand > 0 ? '+' : ''}
                    {c.deltaVsBrand.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>{c.mentions} mentions</span>
                <span>·</span>
                <span className="text-emerald-400/80">+{c.pos}</span>
                <span className="text-rose-400/80">−{c.neg}</span>
                <span>={c.neu}</span>
                {c.engines.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="capitalize">{c.engines.join(', ')}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
