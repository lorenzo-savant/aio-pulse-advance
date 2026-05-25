'use client'

// Cross-engine claim divergence panel — surfaces prompts where AI
// engines disagree on simple factual claims about the brand (founding
// year, HQ city, founder, team size, pricing tier, funding amount).
// Each row is an opportunity to push a correction — schema markup,
// Wikipedia edit, on-site fact box, or PR pitch.
//
// Self-contained: fetches brands, drives its own brand-id state when
// not given one.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { AlertTriangle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

type ClaimType = 'founding_year' | 'headquarters' | 'founder' | 'team_size' | 'pricing' | 'funding'

interface Bucket {
  value: string
  engines: string[]
  contexts: string[]
}
interface Divergence {
  type: ClaimType
  buckets: Bucket[]
}
interface PromptDivergence {
  promptId: string
  promptText: string | null
  divergences: Divergence[]
}
interface ApiData {
  prompts: PromptDivergence[]
  totals: Record<ClaimType, number>
  promptsCount: number
}

interface BrandLite {
  id: string
  name: string
}

const TYPE_LABEL: Record<ClaimType, string> = {
  founding_year: 'Founding year',
  headquarters: 'Headquarters',
  founder: 'Founder',
  team_size: 'Team size',
  pricing: 'Pricing',
  funding: 'Funding',
}

const TYPE_TONE: Record<ClaimType, string> = {
  founding_year: 'text-amber-300 bg-amber-500/15',
  headquarters: 'text-sky-300 bg-sky-500/15',
  founder: 'text-violet-300 bg-violet-500/15',
  team_size: 'text-emerald-300 bg-emerald-500/15',
  pricing: 'text-rose-300 bg-rose-500/15',
  funding: 'text-fuchsia-300 bg-fuchsia-500/15',
}

export function ClaimDivergencePanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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
    fetch(`/api/claim-divergence?brand_id=${activeBrandId}&days=180`)
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

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading && !data) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading cross-engine contradictions…
      </Card>
    )
  }

  const hasAny = !!data && data.prompts.length > 0

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <h2 className="text-lg font-bold text-foreground">Cross-engine claim divergence</h2>
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
        Where the AI engines disagree about your brand. Each row is an opportunity to push a
        correction — schema markup, an updated About page, a PR pitch, or a Wikipedia edit. Detected
        with regex over the responses we already store (zero extra API cost).
      </p>

      {data && data.promptsCount > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {(Object.keys(TYPE_LABEL) as ClaimType[]).map((t) => {
            const n = data.totals[t]
            if (!n) return null
            return (
              <span
                key={t}
                className={`rounded-full px-2.5 py-0.5 font-bold uppercase tracking-wider ${TYPE_TONE[t]}`}
              >
                {TYPE_LABEL[t]} · {n}
              </span>
            )
          })}
        </div>
      )}

      {!hasAny ? (
        <p className="text-sm text-muted-foreground">
          No contradictions found in the last 180 days. Either your AI footprint is small (run more
          prompts) or the engines agree on the basics — good news either way.
        </p>
      ) : (
        <div className="space-y-2">
          {data!.prompts.slice(0, 25).map((p) => {
            const open = expanded.has(p.promptId)
            return (
              <div key={p.promptId} className="rounded-lg border border-input">
                <button
                  onClick={() => toggle(p.promptId)}
                  className="hover:bg-input/30 flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {p.promptText || '(prompt text unavailable)'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {p.divergences.length} divergence{p.divergences.length === 1 ? '' : 's'} —{' '}
                      {p.divergences.map((d) => TYPE_LABEL[d.type]).join(', ')}
                    </p>
                  </div>
                  {open ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {open && (
                  <div className="space-y-3 border-t border-input px-3 py-3">
                    {p.divergences.map((d) => (
                      <div key={d.type}>
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {TYPE_LABEL[d.type]}
                        </p>
                        <div className="space-y-1.5">
                          {d.buckets.map((b) => (
                            <div
                              key={b.value}
                              className="bg-input/30 rounded-md border border-input px-2.5 py-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-sm font-bold text-foreground">
                                  {b.value}
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {b.engines.map((e) => (
                                    <span
                                      key={e}
                                      className="rounded bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
                                    >
                                      {e}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              {b.contexts[0] && (
                                <p className="mt-1 text-[11px] italic text-muted-foreground">
                                  “…{b.contexts[0]}…”
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
