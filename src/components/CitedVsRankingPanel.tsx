'use client'

// "Cited × Ranking" panel — pages AI cites vs Google ranks, with
// actionable opportunity tags (SEO gap / AEO gap / aligned).
//
// Closes the gap from the Semrush AI Mode study:
//   "Most of ChatGPT's citations in the study sample were pulled from
//    URLs ranking beyond position 21+ on Google."
//
// Self-contained: fetches own brand list, hides when no data.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Crosshair, Loader2, ExternalLink, TrendingUp, TrendingDown, Equal } from 'lucide-react'

type Opportunity = 'seo_gap' | 'aeo_gap' | 'aligned' | 'no_gsc'

interface CrossRefRow {
  url: string
  citationCount: number
  position: number | null
  clicks: number
  impressions: number
  engines: string[]
  opportunity: Opportunity
}

interface Totals {
  citedPages: number
  seoGapPages: number
  aeoGapPages: number
  alignedPages: number
}

interface CrossRefReport {
  rows: CrossRefRow[]
  seoGaps: CrossRefRow[]
  aeoGaps: CrossRefRow[]
  aligned: CrossRefRow[]
  totals: Totals
  citationVsPositionCorrelation: number | null
}

interface ResponseData {
  ownedDomain?: string
  filters: { days: number }
  gscAvailable?: boolean
  report: CrossRefReport | null
  reason?: string
}

interface BrandLite {
  id: string
  name: string
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

const OPPORTUNITY_META: Record<
  Opportunity,
  { label: string; tone: string; icon: typeof TrendingUp; hint: string }
> = {
  seo_gap: {
    label: 'SEO gap',
    tone: 'text-rose-300 bg-rose-500/15',
    icon: TrendingUp,
    hint: 'AI trusts this page; Google ranks it deep — closest payoff.',
  },
  aeo_gap: {
    label: 'AEO gap',
    tone: 'text-amber-300 bg-amber-500/15',
    icon: TrendingDown,
    hint: 'Google ranks this top 10; AI rarely cites — close the citation hook.',
  },
  aligned: {
    label: 'Aligned',
    tone: 'text-emerald-300 bg-emerald-500/15',
    icon: Equal,
    hint: 'Both layers working — protect and reinforce.',
  },
  no_gsc: {
    label: 'No GSC data',
    tone: 'text-muted-foreground bg-muted/30',
    icon: Equal,
    hint: 'AI cites but GSC has no record — check indexing.',
  },
}

export function CitedVsRankingPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<ResponseData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<Opportunity>('seo_gap')

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
    fetch(`/api/citations/cited-vs-ranking?brand_id=${activeBrandId}&days=30`)
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
        Loading cross-reference report…
      </Card>
    )
  }
  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (!data) return null
  if (!data.report) {
    if (data.reason) {
      return (
        <Card className="p-4 text-xs text-muted-foreground">
          <Crosshair className="mr-1.5 inline h-3.5 w-3.5" />
          {data.reason}
        </Card>
      )
    }
    return null
  }
  const { report } = data
  if (report.totals.citedPages === 0 && report.aeoGaps.length === 0) return null

  const rowsForView =
    view === 'seo_gap'
      ? report.seoGaps
      : view === 'aeo_gap'
        ? report.aeoGaps
        : view === 'aligned'
          ? report.aligned
          : report.rows.filter((r) => r.opportunity === 'no_gsc')

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Cited × Ranking</h2>
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
        Cross-reference: pages AI cites vs Google rankings on{' '}
        <strong>{data.ownedDomain ?? 'your domain'}</strong>. ChatGPT cites pages ranking beyond
        position 21+ ~90% of the time (Semrush AI Mode study) — these are real opportunities you can
        act on.
      </p>

      {data.gscAvailable === false && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          GSC data unavailable — showing citation-only view. Connect Google Search Console to unlock
          SEO/AEO gap classification.
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Cited pages</p>
          <p className="text-xl font-black text-foreground">{report.totals.citedPages}</p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">SEO gaps</p>
          <p className="text-xl font-black text-rose-400">{report.totals.seoGapPages}</p>
          <p className="text-[10px] text-muted-foreground">cited ≥2×, Google &gt;10</p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">AEO gaps</p>
          <p className="text-xl font-black text-amber-400">{report.totals.aeoGapPages}</p>
          <p className="text-[10px] text-muted-foreground">Google top 10, AI ≤1×</p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Cite-rank correlation
          </p>
          <p className="text-xl font-black text-foreground">
            {report.citationVsPositionCorrelation != null
              ? report.citationVsPositionCorrelation.toFixed(2)
              : 'n/a'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            Pearson r — negative = AI cites your better-ranking pages
          </p>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-1 text-[11px]">
        {(['seo_gap', 'aeo_gap', 'aligned', 'no_gsc'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={
              view === v
                ? 'bg-brand/10 rounded-md px-2 py-1 font-bold text-brand'
                : 'rounded-md px-2 py-1 text-muted-foreground transition-colors hover:text-foreground'
            }
          >
            {OPPORTUNITY_META[v].label} (
            {v === 'seo_gap'
              ? report.totals.seoGapPages
              : v === 'aeo_gap'
                ? report.totals.aeoGapPages
                : v === 'aligned'
                  ? report.totals.alignedPages
                  : report.rows.filter((r) => r.opportunity === 'no_gsc').length}
            )
          </button>
        ))}
      </div>

      <p className="mb-2 text-[11px] text-muted-foreground">{OPPORTUNITY_META[view].hint}</p>

      {rowsForView.length === 0 ? (
        <p className="text-sm text-muted-foreground">No pages in this bucket — nice.</p>
      ) : (
        <div className="space-y-1">
          {rowsForView.slice(0, 12).map((r) => {
            const meta = OPPORTUNITY_META[r.opportunity]
            return (
              <div
                key={r.url}
                className="bg-input/40 flex items-center justify-between gap-2 rounded-md border border-input px-3 py-1.5"
              >
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex min-w-0 items-center gap-1 truncate text-sm font-medium text-foreground hover:text-brand"
                  title={r.url}
                >
                  <span className="truncate">{shortPath(r.url)}</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
                </a>
                <div className="flex shrink-0 items-center gap-2 text-[11px]">
                  {r.position != null && (
                    <span className="text-muted-foreground">
                      Google pos{' '}
                      <span className="font-bold text-foreground">{r.position.toFixed(1)}</span>
                    </span>
                  )}
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    AI <span className="font-bold text-foreground">{r.citationCount}×</span>
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.tone}`}
                  >
                    {meta.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
