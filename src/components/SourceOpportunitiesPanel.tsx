'use client'

// "Source Opportunities" panel — closes the gap identified in the Semrush
// AI SEO Tips article ("source opportunities = query responses that cite
// competing domains but not you"). Surfaces specific prompt × engine pairs
// where COMPETITORS were mentioned and YOU were not. Each row is an
// actionable opportunity: which prompt the AI is answering with someone
// else, on which engine, citing which sources (so you know WHERE to act).
//
// Self-contained: fetches its own brand list, picks the first (or accepts
// a brandId prop), no parent-state coupling.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Target, Loader2 } from 'lucide-react'

interface Opportunity {
  id: string
  promptText: string
  engine: string
  competitors: string[]
  citedDomains: string[]
  sentiment: string | null
  sentimentScore: number | null
  createdAt: string
}

interface CompetitorRow {
  name: string
  count: number
}

interface LostPrompt {
  promptText: string
  count: number
  competitors: string[]
}

interface SourceOpportunitiesData {
  summary: {
    totalResponses: number
    totalOpportunities: number
    opportunityRate: number
    uniqueCompetitorsTaking: number
    uniquePromptsLost: number
    windowDays: number
  }
  opportunities: Opportunity[]
  topCompetitors: CompetitorRow[]
  topLostPrompts: LostPrompt[]
}

interface BrandLite {
  id: string
  name: string
}

type View = 'recent' | 'by_prompt' | 'by_competitor'

export function SourceOpportunitiesPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<SourceOpportunitiesData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('by_prompt')

  // Brand list (skip if prop).
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
    fetch(`/api/competitor/source-opportunities?brand_id=${activeBrandId}&days=30`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.success) setData(j.data as SourceOpportunitiesData)
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
        Loading source opportunities…
      </Card>
    )
  }
  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (!data || data.summary.totalOpportunities === 0) return null

  const { summary } = data

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Source Opportunities</h2>
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
        Responses in the last {summary.windowDays} days where the AI mentioned a competitor and{' '}
        <strong>not you</strong> — concrete prompts/engines where you can move the needle by
        improving your content or earning citations on the cited sources.
      </p>

      <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Opportunities</p>
          <p className="text-xl font-black text-rose-400">{summary.totalOpportunities}</p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Loss rate</p>
          <p className="text-xl font-black text-foreground">
            {summary.opportunityRate.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground">of {summary.totalResponses} responses</p>
        </div>
        <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Lost prompts</p>
          <p className="text-xl font-black text-foreground">{summary.uniquePromptsLost}</p>
          <p className="text-[10px] text-muted-foreground">
            {summary.uniqueCompetitorsTaking} rivals taking them
          </p>
        </div>
      </div>

      <div className="mb-3 flex items-center gap-1 text-[11px]">
        {(['by_prompt', 'by_competitor', 'recent'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={
              view === v
                ? 'bg-brand/10 rounded-md px-2 py-1 font-bold text-brand'
                : 'rounded-md px-2 py-1 text-muted-foreground transition-colors hover:text-foreground'
            }
          >
            {v === 'by_prompt'
              ? 'By prompt'
              : v === 'by_competitor'
                ? 'By competitor'
                : 'Most recent'}
          </button>
        ))}
      </div>

      {view === 'by_prompt' && (
        <div className="space-y-2">
          {data.topLostPrompts.map((p) => (
            <div
              key={p.promptText}
              className="bg-input/40 rounded-lg border border-input px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="truncate text-sm font-semibold text-foreground"
                  title={p.promptText}
                >
                  {p.promptText}
                </span>
                <span className="shrink-0 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                  ×{p.count} lost
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                AI cited instead:{' '}
                <span className="text-foreground">{p.competitors.join(', ')}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {view === 'by_competitor' && (
        <div className="space-y-2">
          {data.topCompetitors.map((c) => (
            <div
              key={c.name}
              className="bg-input/40 flex items-center justify-between gap-2 rounded-lg border border-input px-3 py-2"
            >
              <span className="truncate text-sm font-semibold text-foreground">{c.name}</span>
              <span className="shrink-0 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                {c.count} wins
              </span>
            </div>
          ))}
        </div>
      )}

      {view === 'recent' && (
        <div className="space-y-2">
          {data.opportunities.slice(0, 15).map((o) => (
            <div key={o.id} className="bg-input/40 rounded-lg border border-input px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="truncate text-sm font-semibold text-foreground"
                  title={o.promptText}
                >
                  {o.promptText}
                </span>
                <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold capitalize text-muted-foreground">
                  {o.engine}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                <span className="text-rose-300">cited:</span>{' '}
                <span className="text-foreground">{o.competitors.join(', ')}</span>
                {o.citedDomains.length > 0 && (
                  <>
                    <span className="ml-2 text-muted-foreground">· from:</span>{' '}
                    <span className="text-foreground">{o.citedDomains.join(', ')}</span>
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
