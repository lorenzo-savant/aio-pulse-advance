'use client'

// "Visual proof" panel — recent AI responses where the brand was named.
//
// Closes the gap from the Earned Media Australia agency case study:
//   "Tracking a targeted set of prompts for each client, and showing
//    screenshots of LLM responses where the brand is recommended right
//    in the response. This connects the dots for the client. Instead
//    of seeing AI visibility as an abstract metric, they see their
//    brand recommended in a real AI response."
//
// We don't have screenshots, but we DO have the literal response text
// in monitoring_results.response_text — which is equally compelling
// (and copy-pastable into reports). This panel surfaces the latest
// 5 such responses + the prompt that triggered them, with the brand
// name highlighted in the answer text.
//
// Self-contained: fetches its own brand list, hides when there's no
// matching response.

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Quote, Loader2 } from 'lucide-react'

interface Brand {
  id: string
  name: string
}

interface PromptJoin {
  text?: string | null
  category?: string | null
  language?: string | null
}

interface MonitoringResult {
  id: string
  engine: string | null
  brand_mentioned: boolean | null
  response_text: string | null
  prompt_text: string | null
  created_at: string
  prompt?: PromptJoin | null
}

type BrandLite = Brand

const ENGINE_LABEL: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
  claude: 'Claude',
}
const ENGINE_DOT: Record<string, string> = {
  chatgpt: 'bg-emerald-500',
  gemini: 'bg-sky-500',
  perplexity: 'bg-violet-500',
  claude: 'bg-amber-500',
}

function snippetAroundBrand(text: string, brand: string, radius = 220): string {
  if (!text) return ''
  const idx = text.toLowerCase().indexOf(brand.toLowerCase())
  if (idx === -1) return text.slice(0, radius * 2) + (text.length > radius * 2 ? '…' : '')
  const start = Math.max(0, idx - radius)
  const end = Math.min(text.length, idx + brand.length + radius)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

function highlight(text: string, brand: string): React.ReactNode {
  if (!brand || !text) return text
  // Split on the brand name, case-insensitive, preserve original casing of
  // each match.
  const re = new RegExp(`(${brand.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi')
  const parts = text.split(re)
  return parts.map((p, i) =>
    p.toLowerCase() === brand.toLowerCase() ? (
      <mark key={i} className="bg-brand/20 rounded px-0.5 font-semibold text-brand">
        {p}
      </mark>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

export function VisualProofPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [rows, setRows] = useState<MonitoringResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/brands')
      .then((r) => r.json() as Promise<{ data?: BrandLite[] }>)
      .then((j) => {
        if (cancelled) return
        const list = j.data ?? []
        setBrands(list)
        if (!activeBrandId && list[0]) setActiveBrandId(brandIdProp ?? list[0].id)
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
    fetch(`/api/monitoring?brand_id=${activeBrandId}&limit=50`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return
        if (j.success) {
          const list = (j.data ?? []) as MonitoringResult[]
          // Keep only rows where the brand was mentioned and we have text.
          const withMention = list.filter(
            (r) =>
              r.brand_mentioned === true &&
              typeof r.response_text === 'string' &&
              r.response_text.trim().length > 20,
          )
          setRows(withMention.slice(0, 5))
        } else setError(j.message || 'Failed to load')
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

  const activeBrand = useMemo(
    () => brands.find((b) => b.id === activeBrandId),
    [brands, activeBrandId],
  )

  if (loading && rows.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading visual proof…
      </Card>
    )
  }
  if (error) return <Card className="p-6 text-sm text-rose-400">{error}</Card>
  if (rows.length === 0 || !activeBrand) return null

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Quote className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Visual Proof</h2>
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
        Recent AI responses where <strong>{activeBrand.name}</strong> was named — drop these
        directly into client reports as concrete proof of the visibility metrics above.
      </p>

      <div className="space-y-3">
        {rows.map((r) => {
          const eng = (r.engine || 'unknown').toLowerCase()
          const promptText = r.prompt?.text ?? r.prompt_text ?? '(prompt unavailable)'
          const snippet = snippetAroundBrand(r.response_text ?? '', activeBrand.name)
          return (
            <div key={r.id} className="bg-input/30 rounded-lg border border-input px-4 py-3">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${ENGINE_DOT[eng] ?? 'bg-muted-foreground/40'}`}
                  />
                  <span className="text-xs font-semibold text-foreground">
                    {ENGINE_LABEL[eng] ?? eng}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString('sv-SE')}
                  </span>
                </div>
              </div>
              <p className="mb-2 truncate text-sm font-semibold text-foreground" title={promptText}>
                Q: {promptText}
              </p>
              <p className="text-foreground/90 text-[13px] leading-relaxed">
                {highlight(snippet, activeBrand.name)}
              </p>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
