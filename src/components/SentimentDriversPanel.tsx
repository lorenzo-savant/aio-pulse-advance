'use client'

// "Key Sentiment Drivers" panel — closes the Semrush AI-SoV-article gap:
// the Perception report flags WHICH aspects of a brand drive positive vs
// negative AI portrayal. We mine our own monitoring_results.response_text
// per brand mention to produce the same view — no new API key, no new
// dependency. See src/lib/services/sentiment-drivers.ts for the logic.
//
// Self-contained: fetches brands, drives its own brand-id state when not
// given one.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Loader2, ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DriverRow {
  id: string
  label: string
  mentions: number
  pos: number
  neg: number
  neu: number
  avgScore: number
  sampleResponseIds: string[]
}

interface DriversData {
  positive: DriverRow[]
  negative: DriverRow[]
  neutral: DriverRow[]
  totalResponses: number
  responsesWithDriver: number
  filters: { days: number; minMentions: number; windowTokens: number }
  brand: { id: string; name: string }
}

interface BrandLite {
  id: string
  name: string
}

function scoreClass(score: number): string {
  if (score >= 0.15) return 'bg-emerald-500/10 text-emerald-400'
  if (score <= -0.15) return 'bg-rose-500/10 text-rose-400'
  return 'bg-secondary text-muted-foreground'
}

function fmt(score: number): string {
  return `${score > 0 ? '+' : ''}${score.toFixed(2)}`
}

function DriverItem({ d, tone }: { d: DriverRow; tone: 'pos' | 'neg' | 'neu' }) {
  const dominant = tone === 'pos' ? d.pos : tone === 'neg' ? d.neg : d.neu
  const total = Math.max(1, d.mentions)
  const dominantPct = Math.round((dominant / total) * 100)
  return (
    <div className="bg-input/40 flex flex-col gap-1.5 rounded-lg border border-input px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{d.label}</span>
          <span
            className={cn('rounded-full px-2 py-0.5 text-xs font-bold', scoreClass(d.avgScore))}
          >
            {fmt(d.avgScore)}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">{d.mentions} windows</span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="text-emerald-400/80">+{d.pos}</span>
        <span className="text-rose-400/80">−{d.neg}</span>
        <span>={d.neu}</span>
        <span>·</span>
        <span>{dominantPct}% dominant</span>
      </div>
    </div>
  )
}

export function SentimentDriversPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<DriversData | null>(null)
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
      .catch(() => {
        /* silent — panel just stays empty */
      })
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
    fetch(`/api/sentiment-drivers?brand_id=${activeBrandId}&days=30`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.success) setData(j.data as DriversData)
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
        Loading sentiment drivers…
      </Card>
    )
  }
  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (!data) return null

  const hasAny = data.positive.length + data.negative.length + data.neutral.length > 0

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Key Sentiment Drivers</h2>
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
        Which aspects drive how AI engines describe <b>{data.brand.name}</b>, over the last{' '}
        {data.filters.days} days. {data.responsesWithDriver} of {data.totalResponses} responses
        contributed a driver signal (±{data.filters.windowTokens}-word window around each mention).
      </p>

      {!hasAny ? (
        <div className="bg-input/30 rounded-lg border border-input px-4 py-6 text-center text-sm text-muted-foreground">
          No driver signals yet — the brand was mentioned but no business-driver keywords matched
          near the mention. Add more monitoring or lower min_mentions.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ThumbsUp className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                What lifts perception ({data.positive.length})
              </p>
            </div>
            <div className="space-y-2">
              {data.positive.length === 0 ? (
                <p className="text-xs text-muted-foreground">No clearly positive drivers yet.</p>
              ) : (
                data.positive.slice(0, 5).map((d) => <DriverItem key={d.id} d={d} tone="pos" />)
              )}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ThumbsDown className="h-3.5 w-3.5 text-rose-400" />
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                What drags perception ({data.negative.length})
              </p>
            </div>
            <div className="space-y-2">
              {data.negative.length === 0 ? (
                <p className="text-xs text-muted-foreground">No clearly negative drivers yet.</p>
              ) : (
                data.negative.slice(0, 5).map((d) => <DriverItem key={d.id} d={d} tone="neg" />)
              )}
            </div>
          </div>
        </div>
      )}

      {data.neutral.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Mixed / neutral ({data.neutral.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.neutral.map((d) => (
              <span
                key={d.id}
                className="bg-input/30 rounded-full border border-input px-2 py-0.5 text-[11px] text-muted-foreground"
                title={`${d.mentions} windows · avg ${fmt(d.avgScore)}`}
              >
                {d.label} · {d.mentions}
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
