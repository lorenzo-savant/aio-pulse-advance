'use client'

// "Share of Voice — per AI Engine" panel.
//
// Closes the gap from the Semrush AEO piece:
//   "The Visibility report shows your share of voice — a metric that
//    reflects how often your brand appears relative to competitors
//    across AI-generated answers."
//
// The aggregate SoV widget hides where the brand wins vs loses. Each
// AI engine has its own retrieval + ranking behaviour, so the brand
// can be at 60% on Perplexity but 0% on Gemini — and an aggregate
// number would say 30% and obscure the gap. This panel exposes the
// split engine-by-engine so the operator can target their next move.
//
// Self-contained — fetches its own brand list, calls
// /api/share-of-voice?byEngine=1, hides itself when the data is empty.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Mic, Loader2 } from 'lucide-react'

interface SovEntity {
  name: string
  isBrand: boolean
  mentions: number
  share: number
  mentionRate: number
  avgPosition: number | null
  /** Per-bucket share stddev — surfaces day-to-day fluctuation on
   *  non-deterministic LLM engines (Semrush AEO playbook). */
  volatility?: number
  range?: { min: number; max: number; bucketsObserved: number }
}

interface SovEngineBreakdown {
  engine: string
  entities: SovEntity[]
  totalResponses: number
  series: string[]
}

interface ResponseShape {
  entities: SovEntity[]
  totalResponses: number
  series: string[]
  byEngine?: SovEngineBreakdown[]
}

interface BrandLite {
  id: string
  name: string
}

const ENGINE_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
  claude: 'Claude',
  unknown: 'Unknown',
}

const ENGINE_COLORS: Record<string, string> = {
  chatgpt: 'bg-emerald-500/80',
  gemini: 'bg-sky-500/80',
  perplexity: 'bg-violet-500/80',
  claude: 'bg-amber-500/80',
  unknown: 'bg-muted-foreground/40',
}

function shareColour(share: number, isBrand: boolean): string {
  if (!isBrand) return 'bg-muted-foreground/30'
  if (share >= 40) return 'bg-emerald-500/80'
  if (share >= 15) return 'bg-amber-500/80'
  return 'bg-rose-500/80'
}

export function ShareOfVoiceByEnginePanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<ResponseShape | null>(null)
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
    fetch(`/api/share-of-voice?brand_id=${activeBrandId}&days=30&byEngine=1`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.success) setData(j.data as ResponseShape)
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
        Loading share of voice…
      </Card>
    )
  }
  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (!data || !data.byEngine || data.byEngine.length === 0) return null

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Share of Voice by AI Engine</h2>
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
        How often <strong>your brand</strong> appears versus competitors in each engine&rsquo;s
        answers (last 30 days). Aggregate numbers hide where you win and where you lose — this view
        exposes it engine by engine.
      </p>

      <div className="space-y-4">
        {data.byEngine.map((eng) => {
          const brand = eng.entities.find((e) => e.isBrand)
          const topCompetitors = eng.entities
            .filter((e) => !e.isBrand)
            .sort((a, b) => b.share - a.share)
            .slice(0, 4)
          const rank =
            brand && brand.mentions > 0
              ? 1 + eng.entities.filter((e) => e.mentions > (brand?.mentions ?? 0)).length
              : null

          return (
            <div key={eng.engine} className="bg-input/30 rounded-lg border border-input px-4 py-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      ENGINE_COLORS[eng.engine] ?? ENGINE_COLORS['unknown']!
                    }`}
                  />
                  <span className="font-semibold text-foreground">
                    {ENGINE_LABELS[eng.engine] ?? eng.engine}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {eng.totalResponses} response{eng.totalResponses === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Your share
                  </p>
                  <p className="text-lg font-black text-foreground">
                    {(brand?.share ?? 0).toFixed(1)}%
                    {brand &&
                      (brand.volatility ?? 0) > 0 &&
                      (brand.range?.bucketsObserved ?? 0) >= 2 && (
                        <span
                          className="ml-1.5 align-baseline text-[10px] font-medium text-muted-foreground"
                          title={`Range ${brand.range!.min.toFixed(1)}%–${brand.range!.max.toFixed(1)}% across ${brand.range!.bucketsObserved} buckets`}
                        >
                          ±{brand.volatility!.toFixed(1)}%
                        </span>
                      )}
                  </p>
                  {rank != null && (
                    <p className="text-[10px] text-muted-foreground">
                      #{rank} of {eng.entities.length}
                    </p>
                  )}
                </div>
              </div>

              {/* Stacked bar: brand + top competitors */}
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                {brand && brand.share > 0 && (
                  <div
                    className={`h-full transition-all duration-500 ${shareColour(brand.share, true)}`}
                    style={{ width: `${brand.share}%` }}
                    title={`${brand.name}: ${brand.share}%`}
                  />
                )}
                {topCompetitors.map((c) => (
                  <div
                    key={c.name}
                    className="bg-muted-foreground/40 h-full transition-all duration-500"
                    style={{ width: `${c.share}%` }}
                    title={`${c.name}: ${c.share}%`}
                  />
                ))}
              </div>

              {topCompetitors.length > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Top rivals:{' '}
                  {topCompetitors.map((c, i) => (
                    <span key={c.name}>
                      {i > 0 && ' · '}
                      <span className="text-foreground">{c.name}</span> {c.share}%
                    </span>
                  ))}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
