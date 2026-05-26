'use client'

// "Engine × Content-Format Affinity" panel.
//
// Closes the gap from the Semrush "LLM Prompt Tracking" piece:
//   "The fix was to rewrite their existing high-converting pages in
//    forms each of the other LLMs would prefer: a Reddit Q&A thread
//    for Perplexity, a page with a listicle for ChatGPT, a blog post
//    for Gemini talking about alternatives to the client's product."
//
// Shows a heatmap engine × format (blog / docs / product / support /
// other) using the cited URLs the brand has accumulated in
// monitoring_results. Highlights:
//   - the dominant format each engine cites (the format you should
//     publish more of for that engine)
//   - the leading engine per format (the engine you serve best with
//     that format).
//
// Self-contained: fetches own brand list, hides when there's no
// owned-domain citation data.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { LayoutGrid, Loader2 } from 'lucide-react'

type Kind = 'blog' | 'docs' | 'product' | 'support' | 'other'

interface FormatBreakdown {
  blog: number
  docs: number
  product: number
  support: number
  other: number
}

interface EngineFormatRow {
  engine: string
  totalCitations: number
  counts: FormatBreakdown
  shares: FormatBreakdown
  dominantFormat: Kind | null
  dominantShare: number
}

interface FormatLeaderRow {
  format: Kind
  leadingEngine: string | null
  leadingShare: number
  total: number
}

interface AffinityReport {
  engines: EngineFormatRow[]
  formatLeaders: FormatLeaderRow[]
  totalCitations: number
}

interface ResponseData {
  scope: 'owned' | 'all'
  ownedDomain?: string | null
  filters: { days: number }
  report: AffinityReport
  reason?: string
}

interface BrandLite {
  id: string
  name: string
}

const ENGINE_LABEL: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
  claude: 'Claude',
  unknown: 'Unknown',
}

const KINDS: Kind[] = ['blog', 'docs', 'product', 'support', 'other']
const KIND_LABEL: Record<Kind, string> = {
  blog: 'Blog',
  docs: 'Docs',
  product: 'Product',
  support: 'Support',
  other: 'Other',
}

/** Heatmap cell colour by share %. Brand-tone gradient: pale → bold. */
function heatColour(share: number): string {
  if (share === 0) return 'bg-secondary/30 text-muted-foreground'
  if (share < 15) return 'bg-brand/10 text-foreground'
  if (share < 30) return 'bg-brand/25 text-foreground'
  if (share < 50) return 'bg-brand/45 text-white'
  if (share < 70) return 'bg-brand/65 text-white'
  return 'bg-brand text-white'
}

export function EngineFormatAffinityPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
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
    fetch(`/api/citations/engine-format?brand_id=${activeBrandId}&days=30&owned=1`)
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
        Loading engine × format affinity…
      </Card>
    )
  }
  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (!data) return null
  if (data.report.totalCitations === 0) {
    if (data.reason) {
      return (
        <Card className="p-4 text-xs text-muted-foreground">
          <LayoutGrid className="mr-1.5 inline h-3.5 w-3.5" />
          {data.reason}
        </Card>
      )
    }
    return null
  }

  const { report } = data

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Engine × Format Affinity</h2>
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
        Of <strong>{data.ownedDomain ?? 'your'}</strong> pages cited by each AI engine (last{' '}
        {data.filters.days} days), which content format does each one prefer? Different engines
        reward different formats — rewriting a page as docs vs blog can change which engine cites
        it.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Engine
              </th>
              {KINDS.map((k) => (
                <th
                  key={k}
                  className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground"
                >
                  {KIND_LABEL[k]}
                </th>
              ))}
              <th className="px-2 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Total
              </th>
              <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Prefers
              </th>
            </tr>
          </thead>
          <tbody>
            {report.engines.map((row) => (
              <tr key={row.engine} className="border-t border-border">
                <td className="py-2 pr-3 font-semibold text-foreground">
                  {ENGINE_LABEL[row.engine] ?? row.engine}
                </td>
                {KINDS.map((k) => (
                  <td
                    key={k}
                    className={`px-2 py-2 text-center text-xs font-bold ${heatColour(row.shares[k])}`}
                    title={`${row.counts[k]} citation${row.counts[k] === 1 ? '' : 's'} — ${row.shares[k]}%`}
                  >
                    {row.shares[k] > 0 ? `${row.shares[k]}%` : '·'}
                  </td>
                ))}
                <td className="px-2 py-2 text-right text-muted-foreground">{row.totalCitations}</td>
                <td className="px-2 py-2 text-left text-xs text-foreground">
                  {row.dominantFormat ? (
                    <span>
                      <span className="font-bold">{KIND_LABEL[row.dominantFormat]}</span>{' '}
                      <span className="text-muted-foreground">({row.dominantShare}%)</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Format-level leaders — useful when N engines is small. */}
      {report.formatLeaders.some((f) => f.leadingEngine) && (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            Leading engine per format
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {report.formatLeaders
              .filter((f) => f.leadingEngine)
              .map((f) => (
                <div
                  key={f.format}
                  className="bg-input/40 rounded-md border border-input px-3 py-1.5"
                >
                  <span className="text-muted-foreground">{KIND_LABEL[f.format]}:</span>{' '}
                  <span className="font-bold text-foreground">
                    {ENGINE_LABEL[f.leadingEngine!] ?? f.leadingEngine}
                  </span>{' '}
                  <span className="text-muted-foreground">
                    ({f.leadingShare}% · {f.total} total)
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </Card>
  )
}
