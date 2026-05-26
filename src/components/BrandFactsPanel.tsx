'use client'

// Brand fact-sheet + claim verifier. Operator declares the brand's
// ground-truth facts (founded year, HQ, founder, team size, pricing,
// funding) and we cross-check them against the actual AI responses
// stored in monitoring_results. Surfaces both contradictions ("AI says
// X, you say Y") and uncovered facts ("AI never mentions your HQ").
//
// Self-contained: own brand fetch, own CRUD, own verification refresh.

import { useCallback, useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import {
  BookOpen,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Edit3,
} from 'lucide-react'

type FactType = 'founding_year' | 'headquarters' | 'founder' | 'team_size' | 'pricing' | 'funding'

interface BrandFact {
  id: string
  brand_id: string
  fact_type: FactType
  value: string
  notes: string | null
  updated_at: string
}

interface Contradiction {
  factType: FactType
  expectedValue: string
  observedValue: string
  engines: string[]
  contexts: string[]
}

interface VerificationReport {
  totalFacts: number
  factsChecked: number
  contradictions: Contradiction[]
  factsCovered: Array<{ factType: FactType; covered: boolean; engines: string[] }>
}

interface BrandLite {
  id: string
  name: string
}

const FACT_TYPES: FactType[] = [
  'founding_year',
  'headquarters',
  'founder',
  'team_size',
  'pricing',
  'funding',
]

const FACT_LABEL: Record<FactType, string> = {
  founding_year: 'Founding year',
  headquarters: 'Headquarters',
  founder: 'Founder',
  team_size: 'Team size',
  pricing: 'Pricing',
  funding: 'Funding',
}

const FACT_HINT: Record<FactType, string> = {
  founding_year: '2018',
  headquarters: 'Stockholm',
  founder: 'Jane Doe',
  team_size: '50',
  pricing: '$49',
  funding: '50M',
}

export function BrandFactsPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [facts, setFacts] = useState<BrandFact[]>([])
  const [verification, setVerification] = useState<VerificationReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form
  const [adding, setAdding] = useState(false)
  const [formType, setFormType] = useState<FactType>('founding_year')
  const [formValue, setFormValue] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Keep internal state in sync when the parent flips the brand prop —
  // the useState initialiser only runs once on mount, so without this
  // sync effect the panel keeps querying the brand it had at first
  // render (visible bug on /dashboard/ai-funnel when switching brands).
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

  const reload = useCallback(async (brandId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/brand-facts?brand_id=${brandId}`)
      const j = await res.json()
      if (!j.success) throw new Error(j.message || 'Failed')
      setFacts((j.data?.facts ?? []) as BrandFact[])
      setVerification((j.data?.verification ?? null) as VerificationReport | null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!activeBrandId) return
    void reload(activeBrandId)
  }, [activeBrandId, reload])

  async function submit() {
    if (!activeBrandId || !formValue.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/brand-facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: activeBrandId,
          fact_type: formType,
          value: formValue.trim(),
          notes: formNotes.trim() || undefined,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.message || 'Failed to save')
      setFormValue('')
      setFormNotes('')
      setAdding(false)
      await reload(activeBrandId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this fact?')) return
    try {
      const res = await fetch(`/api/brand-facts?id=${id}`, { method: 'DELETE' })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.message || 'Failed to delete')
      if (activeBrandId) await reload(activeBrandId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  function startEdit(fact: BrandFact) {
    setFormType(fact.fact_type)
    setFormValue(fact.value)
    setFormNotes(fact.notes ?? '')
    setAdding(true)
  }

  const usedTypes = new Set(facts.map((f) => f.fact_type))

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Brand fact sheet</h2>
        </div>
        <div className="flex items-center gap-2">
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
          {!adding && activeBrandId && (
            <button
              onClick={() => {
                setAdding(true)
                const firstUnused = FACT_TYPES.find((t) => !usedTypes.has(t)) ?? 'founding_year'
                setFormType(firstUnused)
                setFormValue('')
                setFormNotes('')
              }}
              className="hover:bg-brand/90 inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add fact
            </button>
          )}
        </div>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        Declare the canonical facts about your brand. We cross-check them against the actual AI
        responses we&apos;ve captured — contradictions are listed below so you can push corrections.
      </p>

      {error && (
        <div className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {adding && (
        <div className="bg-input/30 mb-4 space-y-2 rounded-lg border border-input p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as FactType)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            >
              {FACT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FACT_LABEL[t]}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder={FACT_HINT[formType]}
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
              maxLength={200}
            />
          </div>
          <input
            type="text"
            placeholder="Source URL or note (optional)"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            maxLength={2000}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setAdding(false)
                setFormValue('')
                setFormNotes('')
              }}
              className="rounded-md border border-border bg-background px-3 py-1 text-xs text-foreground hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || formValue.trim().length === 0}
              className="hover:bg-brand/90 inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </button>
          </div>
        </div>
      )}

      {loading && facts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
          Loading…
        </p>
      ) : facts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No facts declared yet. Add one — even just the founding year — and we&apos;ll start
          flagging where AI engines get it wrong.
        </p>
      ) : (
        <div className="space-y-1.5">
          {facts.map((f) => {
            const cover = verification?.factsCovered.find((c) => c.factType === f.fact_type)
            const isCovered = cover?.covered ?? false
            return (
              <div
                key={f.id}
                className="bg-input/40 flex items-center justify-between gap-2 rounded-md border border-input px-3 py-1.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {isCovered ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  )}
                  <span className="shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {FACT_LABEL[f.fact_type]}
                  </span>
                  <span className="font-mono text-sm font-bold text-foreground">{f.value}</span>
                  {isCovered && cover && cover.engines.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      cited by {cover.engines.join(', ')}
                    </span>
                  )}
                  {!isCovered && (
                    <span className="text-[10px] text-amber-300">No engine names this</span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => startEdit(f)}
                    className="text-muted-foreground hover:text-foreground"
                    title="Edit"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => remove(f.id)}
                    className="text-muted-foreground hover:text-rose-400"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {verification && verification.contradictions.length > 0 && (
        <div className="mt-5">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-rose-300">
            AI is wrong about {verification.contradictions.length} of your facts
          </p>
          <div className="space-y-1.5">
            {verification.contradictions.map((c, i) => (
              <div
                key={`${c.factType}-${i}`}
                className="rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2"
              >
                <div className="mb-1 flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5 text-rose-400" />
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {FACT_LABEL[c.factType]}
                  </span>
                </div>
                <p className="text-sm">
                  <span className="text-muted-foreground">You declared:</span>{' '}
                  <span className="font-mono font-bold text-emerald-300">{c.expectedValue}</span>
                  <span className="mx-2 text-muted-foreground">vs AI says:</span>
                  <span className="font-mono font-bold text-rose-300">{c.observedValue}</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {c.engines.map((e) => (
                    <span
                      key={e}
                      className="rounded bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground"
                    >
                      {e}
                    </span>
                  ))}
                </div>
                {c.contexts[0] && (
                  <p className="mt-1 text-[11px] italic text-muted-foreground">
                    “…{c.contexts[0]}…”
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
