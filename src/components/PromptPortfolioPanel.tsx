'use client'

// "Prompt Portfolio" panel — classifies tracked prompts into the 4-bucket
// business-impact taxonomy (revenue / reputation / competitor / gap)
// from the industry research "Prompt Tracking" piece, with average brand visibility
// per bucket.
//
// Self-contained: fetches own brand list, hides when the brand has no
// prompts.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Briefcase, Loader2 } from 'lucide-react'

type PortfolioType = 'revenue' | 'reputation' | 'competitor' | 'gap' | 'other'

interface PortfolioRow {
  promptId: string
  prompt: string
  type: PortfolioType
  reasons: string[]
}

interface PortfolioBucket {
  type: PortfolioType
  count: number
  averageBrandVisibility: number | null
}

type BrandedMixVerdict = 'over_indexed' | 'balanced' | 'category_led'

interface BrandedMix {
  brandedCount: number
  categoryCount: number
  brandedRatio: number
  verdict: BrandedMixVerdict
  message: string
}

interface PortfolioReport {
  rows: PortfolioRow[]
  buckets: PortfolioBucket[]
  brandedMix?: BrandedMix
}

interface ResponseData {
  report: PortfolioReport
  filters: { days: number }
}

interface BrandLite {
  id: string
  name: string
}

const META: Record<
  PortfolioType,
  { label: string; tone: string; blurb: string; priority: number }
> = {
  revenue: {
    label: 'Revenue',
    tone: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
    blurb: 'Buying-intent — track daily, every drop costs deals.',
    priority: 1,
  },
  competitor: {
    label: 'Competitor',
    tone: 'text-amber-300 bg-amber-500/15 border-amber-500/30',
    blurb: 'You vs rival comparisons — track weekly.',
    priority: 2,
  },
  gap: {
    label: 'Gap',
    tone: 'text-rose-300 bg-rose-500/15 border-rose-500/30',
    blurb: 'Competitor named, you missing — opportunities to close.',
    priority: 3,
  },
  reputation: {
    label: 'Reputation',
    tone: 'text-sky-300 bg-sky-500/15 border-sky-500/30',
    blurb: 'Brand narrative — review monthly for misperceptions.',
    priority: 4,
  },
  other: {
    label: 'Other',
    tone: 'text-muted-foreground bg-muted/30 border-muted/40',
    blurb: 'No clear business signal — consider retiring.',
    priority: 5,
  },
}

const ORDER: PortfolioType[] = ['revenue', 'competitor', 'gap', 'reputation', 'other']

export function PromptPortfolioPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<ResponseData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<PortfolioType | 'all'>('all')

  // Sync internal state when parent changes the brand prop.
  useEffect(() => {
    if (brandIdProp) setActiveBrandId(brandIdProp)
  }, [brandIdProp])

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
    fetch(`/api/prompts/portfolio?brand_id=${activeBrandId}&days=30`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.success) setData(j.data as ResponseData)
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
        Loading prompt portfolio…
      </Card>
    )
  }
  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (!data || data.report.rows.length === 0) return null

  const { report } = data
  const visibleRows = filter === 'all' ? report.rows : report.rows.filter((r) => r.type === filter)

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Prompt Portfolio</h2>
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

      <p className="mb-3 text-sm text-muted-foreground">
        Your {report.rows.length} tracked prompts classified by business impact (per industry Prompt
        Tracking framework). The visibility % shows how often your brand was named in the engine
        responses for the prompts in each bucket.
      </p>

      {report.brandedMix && (
        <div
          className={`mb-4 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs ${
            report.brandedMix.verdict === 'over_indexed'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
              : report.brandedMix.verdict === 'category_led'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'bg-input/40 border-border text-muted-foreground'
          }`}
          title={report.brandedMix.message}
        >
          <span className="font-bold uppercase tracking-wider">
            {report.brandedMix.verdict === 'over_indexed'
              ? 'Branded-heavy'
              : report.brandedMix.verdict === 'category_led'
                ? 'Category-led'
                : 'Balanced mix'}
          </span>
          <span>
            {report.brandedMix.brandedCount} branded · {report.brandedMix.categoryCount} category (
            {report.brandedMix.brandedRatio}% branded)
          </span>
          <span className="text-[11px] opacity-80">{report.brandedMix.message}</span>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        {ORDER.map((t) => {
          const b = report.buckets.find((x) => x.type === t)
          const meta = META[t]
          return (
            <button
              key={t}
              onClick={() => setFilter(filter === t ? 'all' : t)}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${meta.tone} ${
                filter === t ? 'ring-brand/40 ring-2' : ''
              }`}
            >
              <p className="text-[10px] uppercase tracking-wider">{meta.label}</p>
              <p className="text-xl font-black text-foreground">{b?.count ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">
                {b?.averageBrandVisibility != null
                  ? `${b.averageBrandVisibility.toFixed(1)}% visibility`
                  : 'no data'}
              </p>
            </button>
          )
        })}
      </div>

      <p className="mb-2 text-[11px] text-muted-foreground">
        {filter === 'all' ? 'All buckets' : META[filter].blurb}
      </p>

      <div className="space-y-1">
        {visibleRows.slice(0, 20).map((r) => {
          const meta = META[r.type]
          return (
            <div
              key={r.promptId}
              className="bg-input/40 flex items-center justify-between gap-2 rounded-md border border-input px-3 py-1.5"
            >
              <span
                className="truncate text-sm font-medium text-foreground"
                title={r.reasons.join(' · ')}
              >
                {r.prompt}
              </span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.tone}`}
              >
                {meta.label}
              </span>
            </div>
          )
        })}
        {visibleRows.length > 20 && (
          <p className="text-center text-[11px] text-muted-foreground">
            +{visibleRows.length - 20} more in this bucket
          </p>
        )}
      </div>
    </Card>
  )
}
