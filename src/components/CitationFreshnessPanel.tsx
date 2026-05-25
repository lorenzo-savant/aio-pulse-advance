'use client'

// "Citation Freshness" panel.
//
// Closes the gap from the Semrush AEO piece (AirOps study):
//   "95% of ChatGPT citations come from content published or updated
//    within the last 10 months, and pages with a clear 'last updated'
//    timestamp receive 1.8x more citations than those without one."
//
// Shows the operator: of YOUR pages that the AI cites, how many are
// fresh vs stale, the correlation between page age and citation count,
// and a punch-list of "stale stars" — pages with high citation volume
// that are >365d old (prime refresh candidates).
//
// Self-contained — fetches its own brand list, hides when there's no
// owned-domain citations to analyse.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Calendar, Loader2, AlertTriangle, ExternalLink } from 'lucide-react'

type Bucket = 'fresh' | 'mid' | 'stale' | 'unknown'

interface FreshnessRow {
  url: string
  citationCount: number
  lastModifiedMs: number | null
  ageDays: number | null
  bucket: Bucket
  lastModifiedISO: string | null
  engines?: string[]
}

interface Breakdown {
  pageCounts: Record<Bucket, number>
  citationCounts: Record<Bucket, number>
  citationShare: Record<Bucket, number>
}

interface FreshnessReport {
  rows: FreshnessRow[]
  breakdown: Breakdown
  correlation: number | null
  staleStars: FreshnessRow[]
  summary: {
    totalPages: number
    totalCitations: number
    pagesWithAge: number
    ageCoverage: number
    averageAgeDays: number | null
    medianAgeDays: number | null
  }
}

interface ResponseData {
  ownedDomain: string
  filters: { days: number; top: number }
  report: FreshnessReport | null
  reason?: string
}

interface BrandLite {
  id: string
  name: string
}

const BUCKET_LABEL: Record<Bucket, string> = {
  fresh: 'Fresh (≤90d)',
  mid: 'Mid (≤365d)',
  stale: 'Stale (>365d)',
  unknown: 'Unknown age',
}
const BUCKET_COLOUR: Record<Bucket, string> = {
  fresh: 'bg-emerald-500/80',
  mid: 'bg-sky-500/80',
  stale: 'bg-rose-500/80',
  unknown: 'bg-muted-foreground/40',
}

export function CitationFreshnessPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<ResponseData | null>(null)
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
    fetch(`/api/citations/freshness?brand_id=${activeBrandId}&days=30&top=20`)
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
        Loading citation freshness…
      </Card>
    )
  }
  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (!data) return null
  if (!data.report || data.report.summary.totalPages === 0) {
    if (data.reason) {
      return (
        <Card className="p-4 text-xs text-muted-foreground">
          <Calendar className="mr-1.5 inline h-3.5 w-3.5" />
          {data.reason}
        </Card>
      )
    }
    return null
  }

  const { report } = data
  const totalCitations = report.summary.totalCitations
  const pct = (n: number) => (totalCitations > 0 ? (n / totalCitations) * 100 : 0)

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Citation Freshness</h2>
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
        Of <strong>{data.ownedDomain}</strong> pages cited by AI engines (last {data.filters.days}{' '}
        days, top {data.filters.top}), how fresh is the content? LLMs cite recently-updated content
        ~1.8× more often than undated pages.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Cited pages</p>
          <p className="text-xl font-black text-foreground">{report.summary.totalPages}</p>
          <p className="text-[10px] text-muted-foreground">
            {report.summary.totalCitations} total citations
          </p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Median age</p>
          <p className="text-xl font-black text-foreground">
            {report.summary.medianAgeDays != null ? `${report.summary.medianAgeDays}d` : 'n/a'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {report.summary.ageCoverage}% have a known age
          </p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Stale pages</p>
          <p className="text-xl font-black text-rose-400">{report.breakdown.pageCounts.stale}</p>
          <p className="text-[10px] text-muted-foreground">
            {report.breakdown.citationShare.stale}% of citations
          </p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Age × citations</p>
          <p className="text-xl font-black text-foreground">
            {report.correlation != null ? report.correlation.toFixed(2) : 'n/a'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Pearson r{' '}
            {report.correlation != null && report.correlation < -0.3
              ? '— older pages cited less ✓'
              : report.correlation != null && report.correlation > 0.3
                ? '— older pages cited MORE'
                : '— no strong trend'}
          </p>
        </div>
      </div>

      <div className="mb-1 flex h-3 w-full overflow-hidden rounded-full bg-secondary">
        {(['fresh', 'mid', 'stale', 'unknown'] as const).map((b) => {
          const c = report.breakdown.citationCounts[b]
          if (c === 0) return null
          return (
            <div
              key={b}
              className={`h-full transition-all duration-500 ${BUCKET_COLOUR[b]}`}
              style={{ width: `${pct(c)}%` }}
              title={`${BUCKET_LABEL[b]}: ${c} citations`}
            />
          )
        })}
      </div>
      <div className="mb-4 grid grid-cols-4 gap-2 text-[11px]">
        {(['fresh', 'mid', 'stale', 'unknown'] as const).map((b) => (
          <div key={b}>
            <p className="text-muted-foreground">{BUCKET_LABEL[b]}</p>
            <p className="text-foreground">
              <span className="font-bold">{report.breakdown.pageCounts[b]}</span> page
              {report.breakdown.pageCounts[b] === 1 ? '' : 's'} ·{' '}
              {report.breakdown.citationCounts[b]} cite
              {report.breakdown.citationCounts[b] === 1 ? '' : 's'}
            </p>
          </div>
        ))}
      </div>

      {report.staleStars.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-rose-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Refresh candidates (high-cited + &gt;365d old)
          </p>
          <div className="space-y-1">
            {report.staleStars.slice(0, 6).map((p) => (
              <div
                key={p.url}
                className="bg-input/40 flex items-center justify-between gap-2 rounded-md border border-input px-3 py-1.5"
              >
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex min-w-0 items-center gap-1 truncate text-sm font-medium text-foreground hover:text-brand"
                  title={p.url}
                >
                  <span className="truncate">{new URL(p.url).pathname || '/'}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
                </a>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  <span className="font-bold text-foreground">{p.citationCount}</span> cites ·{' '}
                  <span className="text-rose-300">{p.ageDays}d old</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
