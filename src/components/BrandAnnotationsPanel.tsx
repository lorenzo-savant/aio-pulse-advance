'use client'

// "Brand Annotations" panel — operator-recorded events on a brand's
// timeline (content publishes, product launches, earned media,
// competitor moves, campaigns, algorithm updates). Lets the operator
// explain peaks and dips on the AI visibility charts to stakeholders.
//
// Self-contained: own brand fetch, own list + create + delete.

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { CalendarClock, Loader2, Plus, Trash2, ExternalLink } from 'lucide-react'

type AnnotationType =
  | 'content_publish'
  | 'product_launch'
  | 'earned_media'
  | 'competitor_move'
  | 'campaign'
  | 'algorithm_update'
  | 'other'

interface Annotation {
  id: string
  brand_id: string
  event_date: string // YYYY-MM-DD
  type: AnnotationType
  label: string
  url: string | null
  notes: string | null
  created_at: string
}

interface BrandLite {
  id: string
  name: string
}

const TYPE_META: Record<AnnotationType, { label: string; tone: string }> = {
  content_publish: {
    label: 'Content publish',
    tone: 'bg-emerald-500/15 text-emerald-300',
  },
  product_launch: {
    label: 'Product launch',
    tone: 'bg-sky-500/15 text-sky-300',
  },
  earned_media: { label: 'Earned media', tone: 'bg-violet-500/15 text-violet-300' },
  competitor_move: {
    label: 'Competitor move',
    tone: 'bg-rose-500/15 text-rose-300',
  },
  campaign: { label: 'Campaign', tone: 'bg-amber-500/15 text-amber-300' },
  algorithm_update: {
    label: 'Algorithm update',
    tone: 'bg-muted/60 text-foreground',
  },
  other: { label: 'Other', tone: 'bg-muted/30 text-muted-foreground' },
}

const TYPE_OPTIONS: AnnotationType[] = [
  'content_publish',
  'product_launch',
  'earned_media',
  'competitor_move',
  'campaign',
  'algorithm_update',
  'other',
]

export function BrandAnnotationsPanel({ brandId: brandIdProp }: { brandId?: string } = {}) {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>(brandIdProp ?? '')
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // null = unknown (initial load), true = table exists, false = migration
  // not applied on this deployment. When false we suppress both the empty
  // state and the Add button and show a single explanatory hint.
  const [tableAvailable, setTableAvailable] = useState<boolean | null>(null)

  // Create form
  const [adding, setAdding] = useState(false)
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [formType, setFormType] = useState<AnnotationType>('content_publish')
  const [formLabel, setFormLabel] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  async function reload(brandId: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/annotations?brand_id=${brandId}&days=365`)
      const j = await res.json()
      if (!j.success) throw new Error(j.message || 'Failed to load')
      setAnnotations((j.data?.annotations ?? []) as Annotation[])
      setTableAvailable(j.data?.tableAvailable !== false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!activeBrandId) return
    void reload(activeBrandId)
  }, [activeBrandId])

  async function submit() {
    if (!activeBrandId || !formLabel.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: activeBrandId,
          event_date: formDate,
          type: formType,
          label: formLabel.trim(),
          url: formUrl.trim() || undefined,
        }),
      })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.message || 'Failed to create')
      // Reset form + reload.
      setFormLabel('')
      setFormUrl('')
      setAdding(false)
      await reload(activeBrandId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this annotation?')) return
    try {
      const res = await fetch(`/api/annotations?id=${id}`, { method: 'DELETE' })
      const j = await res.json()
      if (!res.ok || !j.success) throw new Error(j.message || 'Failed to delete')
      if (activeBrandId) await reload(activeBrandId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  if (loading && annotations.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
        Loading annotations…
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-brand" />
          <h2 className="text-lg font-bold text-foreground">Timeline Annotations</h2>
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
          {!adding && activeBrandId && tableAvailable !== false && (
            <button
              onClick={() => setAdding(true)}
              className="hover:bg-brand/90 inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-brand-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          )}
        </div>
      </div>

      <p className="mb-3 text-sm text-muted-foreground">
        Operator-recorded events on the brand timeline. Pair these with your visibility charts in
        client reports so peaks and dips have a story.
      </p>

      {error && (
        <div className="mb-3 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </div>
      )}

      {adding && (
        <div className="bg-input/30 mb-4 space-y-2 rounded-lg border border-input p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            />
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as AnnotationType)}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TYPE_META[t].label}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Label (e.g. 'Published new pricing page')"
            value={formLabel}
            onChange={(e) => setFormLabel(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            maxLength={200}
          />
          <input
            type="url"
            placeholder="URL (optional)"
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"
            maxLength={500}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setAdding(false)
                setFormLabel('')
                setFormUrl('')
              }}
              className="rounded-md border border-border bg-background px-3 py-1 text-xs text-foreground hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting || formLabel.trim().length === 0}
              className="hover:bg-brand/90 inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
            </button>
          </div>
        </div>
      )}

      {tableAvailable === false ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Timeline annotations table not yet applied on this deployment — apply migration{' '}
          <code className="rounded bg-amber-500/20 px-1">
            20260525000000_add_brand_annotations.sql
          </code>{' '}
          to enable. Until then the panel is read-only and empty.
        </div>
      ) : annotations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No annotations yet. Add one to give your visibility charts context — content publishes,
          launches, competitor moves, campaigns, algorithm updates.
        </p>
      ) : (
        <div className="space-y-1.5">
          {annotations.map((a) => {
            const meta = TYPE_META[a.type]
            return (
              <div
                key={a.id}
                className="bg-input/40 flex items-center justify-between gap-2 rounded-md border border-input px-3 py-1.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {a.event_date}
                  </span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.tone}`}
                  >
                    {meta.label}
                  </span>
                  <span className="truncate text-sm font-medium text-foreground" title={a.label}>
                    {a.label}
                  </span>
                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-brand"
                      title={a.url}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <button
                  onClick={() => remove(a.id)}
                  className="shrink-0 text-muted-foreground hover:text-rose-400"
                  title="Delete annotation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
