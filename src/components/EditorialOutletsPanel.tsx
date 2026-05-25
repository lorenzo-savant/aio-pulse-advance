'use client'

// Editorial outlets leaderboard — the publications AI engines cite
// most often for queries in this brand's space, with per-engine
// breakdown. Acts as the PR target list: pitch the outlets the
// engines already trust. Closes the gap from the Semrush 2026
// brand-first SEO piece (>75% of AI brand mentions come from earned
// editorial/social; a single Men's Journal mention drove a noticeable
// ChatGPT + Perplexity lift).

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Newspaper, Loader2 } from 'lucide-react'

interface OutletRow {
  host: string
  count: number
  share: number
  perEngine: Array<{ engine: string; count: number }>
  engineCoverage: number
}

interface Leaderboard {
  outlets: OutletRow[]
  totalEditorialCitations: number
  engines: string[]
}

interface BrandLite {
  id: string
  name: string
}

export function EditorialOutletsPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<Leaderboard | null>(null)
  const [loading, setLoading] = useState(false)

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
    fetch(`/api/editorial-outlets?brand_id=${activeBrandId}&days=180&limit=15`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.success) setData(j.data)
      })
      .catch(() => {})
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
        Ranking editorial outlets…
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Editorial outlets cited by AI</h2>
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
        The publications AI engines cite most often for queries in your space, with per-engine
        breakdown. Treat it as a PR target list — pitch outlets the engines already trust. Wider
        engine coverage = safer bet across the platform mix.
      </p>

      {!data || data.outlets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No editorial citations captured yet — once monitoring results carry{' '}
          <code>cited_urls</code>
          from mainstream publications, this leaderboard populates.
        </p>
      ) : (
        <>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Top {data.outlets.length} · {data.totalEditorialCitations} editorial citation
            {data.totalEditorialCitations === 1 ? '' : 's'} across {data.engines.length} engine
            {data.engines.length === 1 ? '' : 's'}
          </p>
          <div className="space-y-1.5">
            {data.outlets.map((o) => (
              <div key={o.host} className="bg-input/30 rounded-md border border-input px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-foreground">{o.host}</span>
                  <span className="shrink-0 text-sm font-bold text-foreground">
                    {o.count} · {Math.round(o.share * 100)}%
                  </span>
                </div>
                {o.perEngine.length > 0 && (
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {o.perEngine.map((e) => `${e.engine} (${e.count})`).join(' · ')}
                    {data.engines.length > 1 && (
                      <span className="text-muted-foreground/80 ml-1 text-[10px] uppercase tracking-wider">
                        · {o.engineCoverage}/{data.engines.length} engines
                      </span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  )
}
