'use client'

// "Citation Capture Rate" panel — for every prompt where an AI engine
// mentioned the brand, did it also CITE the brand's own site? Low
// capture rate = the AI knows about you but considers other sources
// authoritative on the topic. The gap list highlights specific prompts
// to target with new / improved content. See lib/services/citation-capture.ts
// for the rationale + computation.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Link2, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CaptureByEngine {
  engine: string
  mentions: number
  capturedMentions: number
  captureRate: number
}

interface CaptureGap {
  id: string
  engine: string | null
  prompt_text: string | null
  citedInstead: string[]
  citedCount: number
  created_at: string | null
}

interface CaptureData {
  totalMentions: number
  capturedMentions: number
  captureRate: number
  byEngine: CaptureByEngine[]
  gapList: CaptureGap[]
  mentionsWithoutAnyCitation: number
  brand: { id: string; name: string }
  ownedDomains: string[]
  filters: { days: number; engine: string }
}

interface BrandLite {
  id: string
  name: string
}

function rateClass(rate: number): string {
  if (rate >= 50) return 'text-emerald-400'
  if (rate >= 25) return 'text-amber-300'
  return 'text-rose-400'
}

function rateBg(rate: number): string {
  if (rate >= 50) return 'bg-emerald-500'
  if (rate >= 25) return 'bg-amber-500'
  return 'bg-rose-500'
}

export function CitationCapturePanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [data, setData] = useState<CaptureData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    fetch(`/api/brands/${activeBrandId}/citation-capture?days=30`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.success) setData(j.data as CaptureData)
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
        Loading citation-capture data…
      </Card>
    )
  }
  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (!data) return null

  if (data.ownedDomains.length === 0) {
    return (
      <Card className="p-4 text-xs text-amber-300">
        <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
        No brand domain configured — set <b>Domain</b> on the brand to compute citation-capture
        rate.
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Citation Capture Rate</h2>
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
        When AI engines mention <b>{data.brand.name}</b>, how often do they also cite your own site?
        Low rate = the AI knows about you but considers other sources authoritative on the topic.
        The gap list below is your content-priority list. Window: last {data.filters.days} days ·
        owned domain
        {data.ownedDomains.length > 1 ? 's' : ''}:{' '}
        <code className="rounded bg-secondary px-1 py-0.5 text-[11px]">
          {data.ownedDomains.join(', ')}
        </code>
        .
      </p>

      {data.totalMentions === 0 ? (
        <div className="bg-input/30 rounded-lg border border-input px-4 py-6 text-center text-sm text-muted-foreground">
          No brand mentions in the selected window. Run more monitoring prompts to populate this
          panel.
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Capture rate</p>
              <p className={cn('text-xl font-black', rateClass(data.captureRate))}>
                {data.captureRate.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground">cited when mentioned</p>
            </div>
            <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Captured</p>
              <p className="text-xl font-black text-emerald-400">{data.capturedMentions}</p>
              <p className="text-[10px] text-muted-foreground">mentions w/ own-site citation</p>
            </div>
            <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Gaps</p>
              <p className="text-xl font-black text-rose-400">
                {data.totalMentions - data.capturedMentions}
              </p>
              <p className="text-[10px] text-muted-foreground">mentions w/o own-site citation</p>
            </div>
            <div className="bg-secondary/40 rounded-lg border border-border px-3 py-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Zero-citation
              </p>
              <p className="text-xl font-black text-amber-300">{data.mentionsWithoutAnyCitation}</p>
              <p className="text-[10px] text-muted-foreground">mentions w/o ANY citation</p>
            </div>
          </div>

          {/* Per-engine breakdown */}
          {data.byEngine.length > 1 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                By engine
              </p>
              <div className="space-y-1.5">
                {data.byEngine.map((e) => (
                  <div
                    key={e.engine}
                    className="bg-input/30 rounded-lg border border-input px-3 py-2"
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{e.engine}</span>
                      <span className={cn('text-sm font-black', rateClass(e.captureRate))}>
                        {e.captureRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-border">
                      <div
                        className={cn('h-full transition-all', rateBg(e.captureRate))}
                        style={{ width: `${e.captureRate}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {e.capturedMentions} of {e.mentions} mentions captured
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gap list */}
          {data.gapList.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Mention-without-citation gap list (top {data.gapList.length})
              </p>
              <p className="mb-2 text-[11px] text-muted-foreground">
                For each prompt below, the AI mentioned <b>{data.brand.name}</b> but cited other
                sources. These are your highest-leverage content priorities — write the kind of
                content the AI would prefer to cite over the &ldquo;cited instead&rdquo; hosts.
              </p>
              <div className="space-y-1.5">
                {data.gapList.map((g) => (
                  <div
                    key={g.id}
                    className="bg-input/30 rounded-lg border border-rose-500/20 px-3 py-2"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded bg-rose-500/15 px-1.5 py-0.5 font-bold uppercase tracking-wider text-rose-300">
                        {g.engine ?? 'unknown'}
                      </span>
                      <span>{g.created_at?.slice(0, 10)}</span>
                    </div>
                    <p className="mb-1 truncate text-sm font-medium text-foreground">
                      &ldquo;{g.prompt_text ?? '—'}&rdquo;
                    </p>
                    {g.citedInstead.length > 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        Cited instead:{' '}
                        {g.citedInstead.map((h, i) => (
                          <span key={h}>
                            <code className="rounded bg-secondary px-1 py-0.5 text-[10px] text-foreground">
                              {h}
                            </code>
                            {i < g.citedInstead.length - 1 ? ' · ' : ''}
                          </span>
                        ))}
                        {g.citedCount > g.citedInstead.length && (
                          <span> · +{g.citedCount - g.citedInstead.length} more</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-300">
                        No citations at all — AI answered from memory, not retrieval.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.captureRate >= 50 && data.gapList.length === 0 && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Strong capture rate — when AI engines mention you, they cite your site too. Keep
                content fresh to maintain this position.
              </span>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
