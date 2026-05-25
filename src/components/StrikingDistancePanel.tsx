'use client'

// Striking-distance keyword panel. Surfaces GSC queries the brand already
// ranks for between positions 11–30: small content / meta tweaks on those
// pages have the biggest expected ROI because Google already considers them
// relevant. Cheap SEO win that also helps AEO/GEO indirectly (pages that
// climb in SERP get crawled more often by AI engines).
//
// Self-contained: fetches own brand list, picks the first (or accepts a
// `brandId` prop), queries /api/gsc/striking-distance, renders.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Target, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type PkdBand = 'within_reach' | 'stretch' | 'tough'

interface Query {
  query: string
  impressions: number
  clicks: number
  ctr: number // percentage
  position: number
  band: 'edge' | 'mid' | 'far'
  upliftClicks: number
  kd?: number
  pkd?: number
  pkdBand?: PkdBand
}

interface AuthorityProfile {
  totalClicks: number
  avgPosition: number | null
  totalAiCitations: number
  uniquePages: number
}

interface StrikingData {
  summary: {
    totalQueries: number
    totalImpressions: number
    totalEstimatedUplift: number
    targetPosition: number
    minImpressions: number
    positionRange: { min: number; max: number }
    authority?: AuthorityProfile
  }
  queries: Query[]
}

function pkdClass(b: PkdBand | undefined): string {
  if (b === 'within_reach') return 'bg-emerald-500/15 text-emerald-300'
  if (b === 'stretch') return 'bg-amber-500/15 text-amber-300'
  if (b === 'tough') return 'bg-rose-500/15 text-rose-300'
  return 'bg-secondary text-muted-foreground'
}

function pkdLabel(b: PkdBand | undefined): string {
  if (b === 'within_reach') return 'within reach'
  if (b === 'stretch') return 'stretch'
  if (b === 'tough') return 'tough'
  return ''
}

interface BrandLite {
  id: string
  name: string
}

function bandClass(b: Query['band']): string {
  if (b === 'edge') return 'bg-emerald-500/15 text-emerald-300'
  if (b === 'mid') return 'bg-amber-500/15 text-amber-300'
  return 'bg-rose-500/15 text-rose-300'
}

export function StrikingDistancePanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<StrikingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Brand list (skip if a prop was passed).
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
        /* silent */
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandIdProp])

  // Striking-distance fetch.
  useEffect(() => {
    if (!activeBrandId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/gsc/striking-distance?brand_id=${activeBrandId}&min_impressions=100`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.success) setData(j.data as StrikingData)
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
        Loading striking-distance keywords…
      </Card>
    )
  }
  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (!data || data.queries.length === 0) return null

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Striking Distance Keywords</h2>
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
        Queries you already rank for in positions {data.summary.positionRange.min}–
        {data.summary.positionRange.max} with at least {data.summary.minImpressions} impressions —
        Google already considers these relevant, a focused on-page push has the highest expected
        ROI. Estimated uplift assumes a target position of {data.summary.targetPosition}.
      </p>

      <div className="mb-5 grid grid-cols-3 gap-3 text-sm">
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Queries</p>
          <p className="text-xl font-black text-foreground">{data.summary.totalQueries}</p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Impressions/mo</p>
          <p className="text-xl font-black text-foreground">
            {data.summary.totalImpressions.toLocaleString('en-US')}
          </p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Est. uplift (clicks/mo)
          </p>
          <p className="text-xl font-black text-emerald-400">
            +{data.summary.totalEstimatedUplift.toLocaleString('en-US')}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {data.queries.slice(0, 20).map((q) => (
          <div
            key={q.query}
            className="bg-input/40 flex flex-col gap-2 rounded-lg border border-input px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-foreground">{q.query}</span>
                <span
                  className={cn(
                    'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    bandClass(q.band),
                  )}
                  title={
                    q.band === 'edge'
                      ? 'One nudge from page 1'
                      : q.band === 'mid'
                        ? 'Mid striking-distance'
                        : 'Far — bigger lift needed'
                  }
                >
                  pos {q.position} · {q.band}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>{q.impressions.toLocaleString('en-US')} impressions</span>
                <span>·</span>
                <span>CTR {q.ctr.toFixed(2)}%</span>
                <span>·</span>
                <span>{q.clicks} clicks now</span>
                {q.pkd != null && (
                  <>
                    <span>·</span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                        pkdClass(q.pkdBand),
                      )}
                      title={`Generic KD: ${q.kd ?? '—'} · Personal KD: ${q.pkd} (${pkdLabel(q.pkdBand)})`}
                    >
                      PKD {q.pkd} · {pkdLabel(q.pkdBand)}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-emerald-400">+{q.upliftClicks}</p>
              <p className="text-[10px] text-muted-foreground">est. clicks/mo</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
