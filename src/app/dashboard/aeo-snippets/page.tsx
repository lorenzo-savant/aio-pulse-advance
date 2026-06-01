// PATH: src/app/dashboard/aeo-snippets/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Target,
  CheckCircle2,
  HelpCircle,
  Download,
  Search,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { cn } from '@/lib/utils'

interface Brand {
  id: string
  name: string
  language?: string | null
}

interface Snippet {
  id: string
  brand_id: string
  keyword: string
  question: string
  answer: string
  answer_model: string | null
  language: string
  paa_snippet: string | null
  paa_source_url: string | null
  schema_jsonld: unknown
  gap_status: 'covered' | 'gap' | 'unknown'
  covered_url: string | null
  position: number | null
  created_at: string
}

interface Run {
  id: string
  keyword: string
  language: string
  questions_count: number
  gap_count: number
  cost_credits: number
  status: string
  created_at: string
}

interface BraveQuota {
  limit: number
  used: number
  remaining: number
}

interface DataforseoQuota {
  count: number
  costCents: number
  capCents: number
  remainingCents: number
  utilization: number
}

type GapFilter = 'all' | 'covered' | 'gap' | 'unknown'

// Soft heuristic for the seed-quality hint (#3). Google only shows a
// People-Also-Ask box for informational/question queries — not for brand
// names or single words. We don't block Generate; we just nudge.
function weakSeedHint(keyword: string, brandName?: string | null): string | null {
  const k = keyword.trim()
  if (k.length < 2) return null
  const words = k.split(/\s+/)
  if (words.length === 1) {
    return 'Single words rarely trigger a Google "People Also Ask" box. Try a question or topic, e.g. "vad är …", "how does … work".'
  }
  if (brandName && k.toLowerCase() === brandName.trim().toLowerCase()) {
    return 'Brand names rarely have a "People Also Ask" box. Try an informational topic your audience searches for instead.'
  }
  return null
}

export default function AEOSnippetsPage() {
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [snippets, setSnippets] = useState<Snippet[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [counts, setCounts] = useState({ total: 0, gap: 0, covered: 0, unknown: 0 })
  const [braveQuota, setBraveQuota] = useState<BraveQuota | null>(null)
  const [dataforseoQuota, setDataforseoQuota] = useState<DataforseoQuota | null>(null)
  const [filter, setFilter] = useState<GapFilter>('all')
  const [keywordFilter, setKeywordFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [bundleCopied, setBundleCopied] = useState(false)
  // Seed reformulations returned by the API when Google had no PAA box for
  // the keyword. Rendered as click-to-retry chips next to the error.
  const [suggestions, setSuggestions] = useState<string[]>([])

  // Run form
  const [keywordInput, setKeywordInput] = useState('')
  const [languageInput, setLanguageInput] = useState<'en' | 'it' | 'sv' | ''>('')
  const [detectGaps, setDetectGaps] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/brands')
        const json = await res.json()
        const list: Brand[] = json.data || []
        setBrands(list)
        if (list.length > 0) setSelectedBrand(list[0]!)
      } catch {
        setError('Failed to load brands')
      }
    })()
  }, [])

  const load = useCallback(async () => {
    if (!selectedBrand) return
    setError(null)
    try {
      const url = new URL('/api/aeo-snippets', window.location.origin)
      url.searchParams.set('brand_id', selectedBrand.id)
      if (filter !== 'all') url.searchParams.set('gap', filter)
      if (keywordFilter) url.searchParams.set('keyword', keywordFilter)
      const res = await fetch(url.toString())
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed')
      setSnippets(json.data.snippets || [])
      setRuns(json.data.runs || [])
      setCounts(json.data.counts || { total: 0, gap: 0, covered: 0, unknown: 0 })
      setBraveQuota(json.data.braveQuota || null)
      setDataforseoQuota(json.data.dataforseoQuota || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [selectedBrand, filter, keywordFilter])

  useEffect(() => {
    void load()
  }, [load])

  const runGeneration = useCallback(async () => {
    if (!selectedBrand || !keywordInput.trim()) return
    setRunning(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        brand_id: selectedBrand.id,
        keyword: keywordInput.trim(),
        detect_gaps: detectGaps,
        max_questions: 10,
      }
      if (languageInput) body.language = languageInput
      const res = await fetch('/api/aeo-snippets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Run failed')

      // Soft-error surfacing: the API can return success:true with items=[]
      // when DataForSEO's PAA box for this keyword is empty (common for
      // narrow Swedish/Italian niches). Without surfacing this, the user
      // sees their input clear and nothing new in the list — looking like
      // a silent failure. Show the server's `errors` array so the cause is
      // visible.
      const runResult = json.data as
        | { items?: unknown[]; errors?: string[]; suggestions?: string[] }
        | undefined
      const items = runResult?.items ?? []
      const apiErrors = runResult?.errors ?? []
      // Capture seed reformulations the server proposes when the PAA box was
      // empty, so we can offer click-to-retry chips below the error.
      setSuggestions(items.length === 0 ? (runResult?.suggestions ?? []) : [])
      let pendingError: string | null = null
      if (items.length === 0 && apiErrors.length > 0) {
        pendingError = apiErrors.join(' • ')
      } else if (items.length === 0) {
        // No items AND no errors — happens when the run completes but
        // produced nothing actionable (e.g. PAA box empty for a niche
        // Swedish/Italian keyword and the server didn't flag it).
        pendingError =
          'No snippets generated — DataForSEO returned no People-Also-Ask questions for this keyword. Try a broader seed term.'
      } else if (apiErrors.length > 0) {
        // Partial success — some questions failed (LLM call or gap check);
        // we still got snippets. Surface the partial errors as a hint.
        pendingError = `Generated with warnings: ${apiErrors.slice(0, 3).join(' • ')}`
      }
      setKeywordInput('')
      await load()
      // load() resets `error` to null, so re-apply the post-run message
      // AFTER load completes — otherwise the user sees a silent failure.
      if (pendingError) setError(pendingError)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Run failed')
    } finally {
      setRunning(false)
    }
  }, [selectedBrand, keywordInput, languageInput, detectGaps, load])

  const copySchema = useCallback(async (s: Snippet) => {
    const json = JSON.stringify(s.schema_jsonld, null, 2)
    const html = `<script type="application/ld+json">\n${json}\n</script>`
    try {
      await navigator.clipboard.writeText(html)
      setCopiedId(s.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      /* noop */
    }
  }, [])

  const exportCsv = useCallback(() => {
    if (!selectedBrand) return
    const url = new URL('/api/aeo-snippets/export', window.location.origin)
    url.searchParams.set('brand_id', selectedBrand.id)
    if (filter !== 'all') url.searchParams.set('gap', filter)
    if (keywordFilter) url.searchParams.set('keyword', keywordFilter)
    window.location.href = url.toString()
  }, [selectedBrand, filter, keywordFilter])

  // Build one FAQPage JSON-LD bundle covering every snippet under the
  // current filters (keyword + gap_status) and copy the <script> tag to
  // the clipboard. Per-snippet copy is for landing pages targeting one
  // question; the bundle is for hub/cluster pages targeting a keyword.
  const copyBundleSchema = useCallback(async () => {
    if (!selectedBrand) return
    try {
      const url = new URL('/api/aeo-snippets/export-schema', window.location.origin)
      url.searchParams.set('brand_id', selectedBrand.id)
      if (filter !== 'all') url.searchParams.set('gap', filter)
      if (keywordFilter) url.searchParams.set('keyword', keywordFilter)
      const res = await fetch(url.toString())
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || 'Failed to load bundle')
      const schema = json.data?.schema as Record<string, unknown> | undefined
      if (!schema) throw new Error('Empty schema bundle')
      const html = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`
      await navigator.clipboard.writeText(html)
      setBundleCopied(true)
      setTimeout(() => setBundleCopied(false), 1800)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to copy bundle schema')
    }
  }, [selectedBrand, filter, keywordFilter])

  const downloadBundleSchema = useCallback(() => {
    if (!selectedBrand) return
    const url = new URL('/api/aeo-snippets/export-schema', window.location.origin)
    url.searchParams.set('brand_id', selectedBrand.id)
    url.searchParams.set('format', 'html')
    url.searchParams.set('download', '1')
    if (filter !== 'all') url.searchParams.set('gap', filter)
    if (keywordFilter) url.searchParams.set('keyword', keywordFilter)
    window.location.href = url.toString()
  }, [selectedBrand, filter, keywordFilter])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="animate-in space-y-8 bg-background">
      <SectionHelp section="aeo-snippets" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight text-foreground">
            <Sparkles className="h-7 w-7 text-brand" />
            AEO Snippets
          </h1>
          <p className="mt-1 text-muted-foreground">
            Generate answer-engine-ready Q&A snippets from Google&rsquo;s &ldquo;People Also
            Ask&rdquo;, with FAQPage JSON-LD and gap detection against your own domain.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {brands.length > 1 && (
            <select
              className="rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              value={selectedBrand?.id || ''}
              onChange={(e) => {
                const b = brands.find((x) => x.id === e.target.value)
                if (b) setSelectedBrand(b)
              }}
            >
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="ghost"
            onClick={copyBundleSchema}
            disabled={counts.total === 0}
            title={
              keywordFilter
                ? `Copy one FAQPage JSON-LD bundle for "${keywordFilter}"`
                : 'Copy one FAQPage JSON-LD bundle for every snippet on this brand'
            }
          >
            {bundleCopied ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                Bundle copied
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy FAQ bundle
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={downloadBundleSchema}
            disabled={counts.total === 0}
            title="Download the FAQ bundle as an HTML <script> snippet"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download .html
          </Button>
          <Button variant="ghost" onClick={exportCsv} disabled={counts.total === 0}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/5 p-4">
          <p className="text-red-400">{error}</p>
          {suggestions.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Try instead:
              </span>
              {suggestions.map((s) => (
                <button
                  key={s}
                  className="bg-brand/10 border-brand/40 hover:bg-brand/20 rounded-full border px-3 py-1 text-xs text-brand transition-colors"
                  onClick={() => {
                    setKeywordInput(s)
                    setError(null)
                    setSuggestions([])
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Run form */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">New generation</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
          <input
            type="text"
            placeholder="Seed keyword (e.g. 'best running shoes for flat feet')"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void runGeneration()
            }}
            className="rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
          <select
            value={languageInput}
            onChange={(e) => setLanguageInput(e.target.value as 'en' | 'it' | 'sv' | '')}
            className="rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          >
            <option value="">Auto (brand)</option>
            <option value="en">English</option>
            <option value="it">Italiano</option>
            <option value="sv">Svenska</option>
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-input bg-input px-3 py-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={detectGaps}
              onChange={(e) => setDetectGaps(e.target.checked)}
            />
            Gap detection
          </label>
          <Button
            variant="primary"
            onClick={runGeneration}
            disabled={running || !selectedBrand || !keywordInput.trim()}
            title={
              running
                ? 'Generation in progress…'
                : !selectedBrand
                  ? 'Select a brand first'
                  : !keywordInput.trim()
                    ? 'Type a seed keyword to enable Generate'
                    : 'Generate AEO snippets'
            }
          >
            {running ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Generate
              </>
            )}
          </Button>
        </div>
        {!keywordInput.trim() && !running && (
          <p className="mt-2 text-xs text-muted-foreground">
            Type a seed keyword above to enable <b>Generate</b> — e.g.{' '}
            <code className="rounded bg-secondary px-1">castingplattform Sverige</code>,{' '}
            <code className="rounded bg-secondary px-1">marknadsföringsbyrå Stockholm</code>, or{' '}
            <code className="rounded bg-secondary px-1">best running shoes for flat feet</code>.
          </p>
        )}
        {keywordInput.trim() && !running && weakSeedHint(keywordInput, selectedBrand?.name) && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-400">
            <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {weakSeedHint(keywordInput, selectedBrand?.name)}
          </p>
        )}
        {(braveQuota || dataforseoQuota) && (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            {dataforseoQuota && dataforseoQuota.capCents > 0 && (
              <p>
                DataForSEO spend:{' '}
                <span className="font-bold text-foreground">
                  ${(dataforseoQuota.costCents / 100).toFixed(2)}/$
                  {(dataforseoQuota.capCents / 100).toFixed(2)}
                </span>{' '}
                ({dataforseoQuota.count} PAA queries this month)
              </p>
            )}
            {braveQuota && braveQuota.limit > 0 && (
              <p>
                Brave quota:{' '}
                <span className="font-bold text-foreground">
                  {braveQuota.used}/{braveQuota.limit}
                </span>{' '}
                ({braveQuota.remaining} remaining this month)
              </p>
            )}
          </div>
        )}
      </Card>

      {/* Counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            k: 'all' as const,
            label: 'Total',
            icon: Sparkles,
            v: counts.total,
            color: 'text-brand',
          },
          {
            k: 'gap' as const,
            label: 'Gaps',
            icon: Target,
            v: counts.gap,
            color: 'text-amber-400',
          },
          {
            k: 'covered' as const,
            label: 'Covered',
            icon: CheckCircle2,
            v: counts.covered,
            color: 'text-emerald-400',
          },
          {
            k: 'unknown' as const,
            label: 'Unknown',
            icon: HelpCircle,
            v: counts.unknown,
            color: 'text-muted-foreground',
          },
        ].map((c) => {
          const Ico = c.icon
          const active = filter === c.k
          return (
            <Card
              key={c.k}
              className={cn(
                'cursor-pointer p-5 transition-all',
                active ? 'ring-brand/40 border-brand ring-2' : 'hover:border-input',
              )}
              onClick={() => setFilter(c.k)}
            >
              <div className="flex items-center gap-2">
                <Ico className={cn('h-4 w-4', c.color)} />
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {c.label}
                </p>
              </div>
              <p className="mt-2 text-3xl font-black text-foreground">{c.v}</p>
            </Card>
          )
        })}
      </div>

      {/* Keyword filter chips from runs */}
      {runs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Recent keywords:
          </span>
          <button
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              !keywordFilter
                ? 'bg-brand/10 border-brand text-brand'
                : 'border-input text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setKeywordFilter('')}
          >
            All
          </button>
          {Array.from(new Set(runs.map((r) => r.keyword)))
            .slice(0, 10)
            .map((k) => (
              <button
                key={k}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  keywordFilter === k
                    ? 'bg-brand/10 border-brand text-brand'
                    : 'border-input text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setKeywordFilter(k)}
              >
                {k}
              </button>
            ))}
        </div>
      )}

      {/* Snippets list */}
      {snippets.length === 0 ? (
        <Card className="p-12 text-center">
          <Sparkles className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-bold text-foreground">No snippets yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter a seed keyword above and click <b>Generate</b> to fetch PAA questions and create
            AEO-ready answers with schema.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {snippets.map((s) => (
            <Card key={s.id} className="p-5 transition-all hover:border-input">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="default" size="sm" className="font-bold">
                  {s.keyword}
                </Badge>
                {s.gap_status === 'gap' && (
                  <Badge variant="warning" size="sm" className="font-bold">
                    <Target className="mr-1 h-3 w-3" />
                    Gap
                  </Badge>
                )}
                {s.gap_status === 'covered' && (
                  <Badge variant="success" size="sm" className="font-bold">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Covered
                  </Badge>
                )}
                {s.answer_model && (
                  <span className="text-xs text-muted-foreground">{s.answer_model}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-lg font-bold text-foreground">{s.question}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.answer}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => copySchema(s)}>
                  {copiedId === s.id ? (
                    <>
                      <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Copy JSON-LD
                    </>
                  )}
                </Button>
                {s.covered_url && (
                  <a
                    href={s.covered_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Covered at: {new URL(s.covered_url).hostname}
                  </a>
                )}
                {s.paa_source_url && !s.covered_url && (
                  <a
                    href={s.paa_source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-brand"
                  >
                    <ExternalLink className="h-3 w-3" />
                    PAA source
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
