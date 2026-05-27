'use client'

// "Keyword Cannibalization" panel — queries where ≥2 of your pages
// compete in the SERP, splitting Google's attention.
//
// Closes the gap from the industry research "Keyword Tracking" piece:
//   "When multiple pages on your site rank for the same keyword, they
//    can compete against each other and hurt your overall performance.
//    Cannibalization can lead to unstable rankings, reduced visibility,
//    or Google selecting the wrong page to rank."
//
// Self-contained: fetches own brand list, hides when GSC isn't wired
// or the report comes back empty.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { GitBranch, Loader2, AlertTriangle, ExternalLink } from 'lucide-react'

type Severity = 'critical' | 'moderate' | 'minor'

interface CompetingPage {
  page: string
  position: number
  impressions: number
  clicks: number
}

interface CannibalizationRow {
  query: string
  pages: CompetingPage[]
  pageCount: number
  bestPosition: number
  positionSpread: number
  totalImpressions: number
  totalClicks: number
  severity: Severity
}

interface CannibalizationReport {
  rows: CannibalizationRow[]
  affectedPagesCount: number
  totalImpactImpressions: number
  healthScore: number
}

interface ResponseData {
  filters?: { days: number; minImpressions: number; maxPosition: number }
  report: CannibalizationReport | null
  reason?: string
}

interface BrandLite {
  id: string
  name: string
}

function severityColour(s: Severity): string {
  if (s === 'critical') return 'bg-rose-500/15 text-rose-300'
  if (s === 'moderate') return 'bg-amber-500/15 text-amber-300'
  return 'bg-sky-500/15 text-sky-300'
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function shortPath(url: string): string {
  try {
    const u = new URL(url)
    const path = u.pathname.length > 1 ? u.pathname : '/'
    return path.length > 48 ? path.slice(0, 45) + '…' : path
  } catch {
    return url.length > 48 ? url.slice(0, 45) + '…' : url
  }
}

export function CannibalizationPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<ResponseData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    fetch(`/api/gsc/cannibalization?brand_id=${activeBrandId}&days=28`)
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
        Loading cannibalization report…
      </Card>
    )
  }
  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (!data) return null
  if (!data.report) {
    if (data.reason) {
      return (
        <Card className="p-4 text-xs text-muted-foreground">
          <GitBranch className="mr-1.5 inline h-3.5 w-3.5" />
          {data.reason}
        </Card>
      )
    }
    return null
  }
  if (data.report.rows.length === 0) return null

  const { report, filters } = data

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Keyword Cannibalization</h2>
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
        Queries where ≥2 of your pages rank in the top {filters?.maxPosition ?? 50} — Google has to
        pick a winner, splitting your visibility. Last {filters?.days ?? 28} days.
      </p>

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Cannibalization health
          </p>
          <p
            className={`text-xl font-black ${
              report.healthScore >= 90
                ? 'text-emerald-400'
                : report.healthScore >= 70
                  ? 'text-amber-400'
                  : 'text-rose-400'
            }`}
          >
            {report.healthScore.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground">100% = no cannibalization</p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Cannibalised queries
          </p>
          <p className="text-xl font-black text-foreground">{report.rows.length}</p>
          <p className="text-[10px] text-muted-foreground">in last {filters?.days ?? 28}d</p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Affected pages</p>
          <p className="text-xl font-black text-foreground">{report.affectedPagesCount}</p>
          <p className="text-[10px] text-muted-foreground">at least one overlap</p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Impressions impacted
          </p>
          <p className="text-xl font-black text-foreground">
            {formatNum(report.totalImpactImpressions)}
          </p>
          <p className="text-[10px] text-muted-foreground">total monthly</p>
        </div>
      </div>

      <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5" />
        Top offenders
      </p>
      <div className="space-y-2">
        {report.rows.slice(0, 10).map((q) => (
          <div key={q.query} className="bg-input/40 rounded-lg border border-input px-3 py-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-sm font-semibold text-foreground" title={q.query}>
                {q.query}
              </span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${severityColour(q.severity)}`}
                title={`${q.pageCount} pages competing — best pos ${q.bestPosition}, spread ±${q.positionSpread}`}
              >
                {q.severity} · {q.pageCount} pages
              </span>
            </div>
            <div className="mb-1 text-[11px] text-muted-foreground">
              {formatNum(q.totalImpressions)} impr · {formatNum(q.totalClicks)} clicks · best pos{' '}
              {q.bestPosition.toFixed(1)}
            </div>
            <div className="space-y-0.5">
              {q.pages.slice(0, 4).map((p) => (
                <div key={p.page} className="flex items-center justify-between gap-2 text-[11px]">
                  <a
                    href={p.page}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex min-w-0 items-center gap-1 truncate text-foreground hover:text-brand"
                    title={p.page}
                  >
                    <span className="truncate">{shortPath(p.page)}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
                  </a>
                  <span className="shrink-0 text-muted-foreground">
                    pos {p.position.toFixed(1)} · {formatNum(p.impressions)} impr
                  </span>
                </div>
              ))}
              {q.pages.length > 4 && (
                <p className="text-[10px] text-muted-foreground">
                  +{q.pages.length - 4} more pages
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
