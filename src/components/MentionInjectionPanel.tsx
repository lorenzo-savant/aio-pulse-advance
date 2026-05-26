'use client'

// "Mention Injection Opportunities" panel — closes the gap identified in
// the Semrush "How We're Driving LLM Visibility at Semrush" playbook
// (step 3: "audit existing content for injection opportunities — content
// that already discusses the problems your tools solve").
//
// Operator pastes a list of their own URLs (e.g. blog posts) + a few
// topic phrases relevant to the brand. The endpoint fetches each URL,
// runs deterministic brand-mention detection, and returns pages that
// discuss those topics but never name the brand — sorted by priority.
//
// Self-contained: fetches its own brand list, picks the first (or accepts
// a brandId prop), no parent-state coupling.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Crosshair, Loader2 } from 'lucide-react'

interface InjectionOpportunity {
  url: string
  title: string | null
  matchedTopics: string[]
  topicHitCount: number
  suggestedAnchor: string
  priority: number
}

interface InjectionResult {
  opportunities: InjectionOpportunity[]
  scanned: number
  alreadyCovered: number
  notRelevant: number
}

interface BrandLite {
  id: string
  name: string
}

function priorityClass(p: number): string {
  if (p >= 70) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  if (p >= 40) return 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  return 'bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30'
}

export function MentionInjectionPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [urlsText, setUrlsText] = useState('')
  const [topicsText, setTopicsText] = useState('')
  const [data, setData] = useState<InjectionResult | null>(null)
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

  const run = async () => {
    if (!activeBrandId) {
      setError('Pick a brand first')
      return
    }
    const urls = urlsText
      .split(/\s+/)
      .map((s) => s.trim())
      .filter((s) => /^https?:\/\//i.test(s))
    const topics = topicsText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (urls.length === 0) {
      setError('Paste at least one http(s) URL')
      return
    }
    if (topics.length === 0) {
      setError('Add at least one topic phrase (one per line)')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/audit/mention-injection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: activeBrandId, urls, topics }),
      })
      const j = (await res.json()) as { success: boolean; message?: string; data?: InjectionResult }
      if (!j.success || !j.data) {
        setError(j.message ?? 'Audit failed')
        setData(null)
      } else {
        setData(j.data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Audit failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Mention Injection Opportunities</h2>
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
        Find owned pages that discuss brand-relevant topics but never name the brand. Each row is a
        natural spot to inject a product or brand mention so LLMs can pattern-match the page back to
        you.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            URLs (one per line)
          </label>
          <textarea
            value={urlsText}
            onChange={(e) => setUrlsText(e.target.value)}
            rows={6}
            placeholder="https://example.com/blog/ai-visibility&#10;https://example.com/blog/share-of-voice"
            className="w-full rounded-md border border-border bg-background px-2.5 py-2 font-mono text-xs text-foreground"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">
            Topics (one per line)
          </label>
          <textarea
            value={topicsText}
            onChange={(e) => setTopicsText(e.target.value)}
            rows={6}
            placeholder="AI visibility&#10;share of voice&#10;LLM citations"
            className="w-full rounded-md border border-border bg-background px-2.5 py-2 font-mono text-xs text-foreground"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" />
              Scanning…
            </>
          ) : (
            'Find injection spots'
          )}
        </button>
        {error && <span className="text-xs text-rose-400">{error}</span>}
      </div>

      {data && (
        <div className="mt-5">
          <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>
              Scanned <strong className="text-foreground">{data.scanned}</strong>
            </span>
            <span>
              Already covered <strong className="text-foreground">{data.alreadyCovered}</strong>
            </span>
            <span>
              Not relevant <strong className="text-foreground">{data.notRelevant}</strong>
            </span>
            <span>
              Opportunities <strong className="text-foreground">{data.opportunities.length}</strong>
            </span>
          </div>

          {data.opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No injection opportunities found — every relevant page already mentions the brand, or
              none of the supplied pages discuss any of the topics.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.opportunities.map((op) => (
                <li
                  key={op.url}
                  className="bg-input/30 rounded-lg border border-input px-4 py-3 text-sm"
                >
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <a
                      href={op.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-foreground hover:underline"
                    >
                      {op.title || op.url}
                    </a>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${priorityClass(op.priority)}`}
                    >
                      priority {op.priority}
                    </span>
                  </div>
                  <p className="mb-1 text-[11px] text-muted-foreground">
                    {op.matchedTopics.join(' · ')} ·{' '}
                    <span className="text-muted-foreground">{op.topicHitCount} hits</span>
                  </p>
                  <p className="text-xs italic text-muted-foreground">
                    &ldquo;{op.suggestedAnchor}&rdquo;
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  )
}
