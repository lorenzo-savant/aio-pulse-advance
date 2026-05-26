'use client'

// Lists pages on the brand's OWN domain that AI engines actually cite,
// ranked by hit count with per-engine breakdown. Pairs with the source-
// category panel: that one shows the macro split, this one shows the
// individual URLs to keep maintained / promote.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Home, Loader2, ExternalLink } from 'lucide-react'

interface PageStat {
  url: string
  hits: number
  engines: Record<string, number>
}

interface ApiData {
  pages: PageStat[]
  totalFirstParty: number
  totalCitations: number
  ownDomains: string[]
  message?: string
}

interface BrandLite {
  id: string
  name: string
}

export function FirstPartyCitationsPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<ApiData | null>(null)
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
    fetch(`/api/first-party-citations?brand_id=${activeBrandId}&days=180`)
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
        Loading first-party citations…
      </Card>
    )
  }

  const ownShare =
    data && data.totalCitations > 0
      ? Math.round((data.totalFirstParty / data.totalCitations) * 100)
      : 0

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Your pages cited by AI</h2>
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
        The pages on YOUR domain that AI engines actually cite — ranked by hits with per-engine
        breakdown. Direct answer to &ldquo;which pages on my site does AI cite most?&rdquo;.
      </p>

      {data?.message && (
        <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          {data.message}
        </p>
      )}

      {data && data.totalCitations > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2 text-xs">
          <div className="bg-input/30 rounded-md border border-input p-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Total AI citations
            </p>
            <p className="mt-0.5 text-xl font-black text-foreground">{data.totalCitations}</p>
          </div>
          <div className="bg-input/30 rounded-md border border-input p-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              First-party hits
            </p>
            <p className="mt-0.5 text-xl font-black text-brand">{data.totalFirstParty}</p>
          </div>
          <div className="bg-input/30 rounded-md border border-input p-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              First-party share
            </p>
            <p className="mt-0.5 text-xl font-black text-emerald-300">{ownShare}%</p>
          </div>
        </div>
      )}

      {!data || data.pages.length === 0 ? (
        !data?.message && (
          <p className="text-sm text-muted-foreground">
            No first-party citations captured yet. Use the source-category panel above to see which
            third-party sources AI is citing instead — then publish parallel content on your own
            domain to win some of that back.
          </p>
        )
      ) : (
        <div className="space-y-1.5">
          {data.pages.map((p) => {
            const engineList = Object.entries(p.engines).sort((a, b) => b[1] - a[1])
            const fullUrl = p.url.startsWith('http') ? p.url : `https://${p.url}`
            return (
              <div
                key={p.url}
                className="bg-input/30 flex items-center justify-between gap-2 rounded-md border border-input px-3 py-1.5"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-xs font-bold tabular-nums text-foreground">
                    {p.hits}
                  </span>
                  <span className="truncate font-mono text-xs text-foreground" title={p.url}>
                    {p.url}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {engineList.map(([engine, count]) => (
                    <span
                      key={engine}
                      className="rounded bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
                      title={`${count} citation${count === 1 ? '' : 's'} from ${engine}`}
                    >
                      {engine}·{count}
                    </span>
                  ))}
                  <a
                    href={fullUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-brand"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
