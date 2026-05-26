'use client'

// Citation source-category breakdown panel. Shows which CATEGORY of
// source (first-party, review site, community, encyclopedia, editorial,
// social, aggregator) AI engines cite for the brand, and which category
// each engine prefers. Closes the gap from the Semrush "Why AI is
// citing third-party sources" piece: the operator can target the
// platforms that actually move the needle for THEIR engine mix.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Layers, Loader2 } from 'lucide-react'

type SourceCategory =
  | 'first_party'
  | 'review_site'
  | 'community'
  | 'encyclopedia'
  | 'editorial'
  | 'social'
  | 'aggregator'
  | 'other'

interface CategoryStat {
  category: SourceCategory
  count: number
  share: number
  topHosts: Array<{ host: string; count: number }>
}

interface EngineStat {
  engine: string
  total: number
  dominant: SourceCategory
  dominantShare: number
  categories: Record<SourceCategory, number>
}

interface Breakdown {
  total: number
  byCategory: CategoryStat[]
  perEngine: EngineStat[]
  brandDomains: string[]
}

interface BrandLite {
  id: string
  name: string
}

const CATEGORY_LABEL: Record<SourceCategory, string> = {
  first_party: 'First-party (your domain)',
  review_site: 'Review sites',
  community: 'Communities (Reddit / Quora)',
  encyclopedia: 'Encyclopedias (Wikipedia)',
  editorial: 'Editorial / news',
  social: 'Social platforms',
  aggregator: 'Aggregators (Yelp / TripAdvisor)',
  other: 'Other',
}

const CATEGORY_TONE: Record<SourceCategory, string> = {
  first_party: 'bg-emerald-500/15 text-emerald-300',
  review_site: 'bg-sky-500/15 text-sky-300',
  community: 'bg-amber-500/15 text-amber-300',
  encyclopedia: 'bg-violet-500/15 text-violet-300',
  editorial: 'bg-rose-500/15 text-rose-300',
  social: 'bg-fuchsia-500/15 text-fuchsia-300',
  aggregator: 'bg-orange-500/15 text-orange-300',
  other: 'bg-muted/60 text-muted-foreground',
}

export function CitationSourceCategoriesPanel({
  brandId: brandIdProp,
}: {
  brandId?: string
} = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<Breakdown | null>(null)
  const [loading, setLoading] = useState(false)

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
    fetch(`/api/citation-categories?brand_id=${activeBrandId}&days=180`)
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
        Categorising citations…
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Citation sources by category</h2>
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
        Where your AI citations come from, grouped into seven source categories. ChatGPT favours
        Wikipedia + Reddit. Perplexity favours Reddit + G2 + LinkedIn. Google AI favours Facebook +
        Yelp. Use this to pick the cross-platform investments that matter for YOUR engine mix.
      </p>

      {!data || data.total === 0 ? (
        <p className="text-sm text-muted-foreground">
          No citations captured yet — once monitoring results carry <code>cited_urls</code>, this
          panel populates.
        </p>
      ) : (
        <>
          <div className="mb-5">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              All engines — {data.total} citation{data.total === 1 ? '' : 's'}
            </p>
            <div className="space-y-1.5">
              {data.byCategory
                .filter((c) => c.count > 0)
                .map((c) => (
                  <div
                    key={c.category}
                    className="bg-input/30 rounded-md border border-input px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${CATEGORY_TONE[c.category]}`}
                      >
                        {CATEGORY_LABEL[c.category]}
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {c.count} · {Math.round(c.share * 100)}%
                      </span>
                    </div>
                    {c.topHosts.length > 0 && (
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        {c.topHosts.map((h) => `${h.host} (${h.count})`).join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {data.perEngine.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Each engine&apos;s favourite category
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {data.perEngine.map((e) => (
                  <div key={e.engine} className="bg-input/30 rounded-md border border-input p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold uppercase tracking-wider text-foreground">
                        {e.engine}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{e.total} citations</span>
                    </div>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${CATEGORY_TONE[e.dominant]}`}
                    >
                      {CATEGORY_LABEL[e.dominant]} · {Math.round(e.dominantShare * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
