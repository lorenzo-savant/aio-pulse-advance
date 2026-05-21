'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wand2, Loader2, Plus, Check, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

// AI-driven prompt generator embedded inside the Prompts page. It turns a
// saved brand into ready-to-monitor prompts and, crucially, pre-fills EVERY
// field the "Create New Prompt" form needs — category, run frequency, engines
// and language — so the user is guided on all the choices. Each draft has a
// one-click "Create" that writes straight into the prompts list.

type Lang = 'en' | 'it' | 'sv'
type PromptCategory = 'awareness' | 'comparison' | 'alternative' | 'features' | 'custom'
type Engine = 'chatgpt' | 'gemini' | 'perplexity' | 'claude'

interface Props {
  brandId: string
  brandName: string
  brandDomain?: string
  industry?: string
  competitors?: string[]
  language?: Lang
  /** Called after a prompt is created so the parent can refresh its list. */
  onCreated?: () => void
}

interface IndustryOption {
  id: string
  name: { en: string; it: string; sv: string }
}

interface RawTemplatePrompt {
  userQuery: string
  intentBucket: string
  intentLabel: string
  suggestedFrequency: string
  targetLLMs: string[]
  language: string
  priority: string
}

interface RawAiPrompt {
  text: string
  intentBucket: string
  priority: string
  targetEngines: string[]
}

interface Draft {
  key: string
  text: string
  category: PromptCategory
  frequency: 'daily' | 'weekly'
  engines: Engine[]
  language: Lang
  bucket: string
  intentLabel: string
  priority: string
  source: 'template' | 'ai'
}

// ── Field mapping: generator output → the prompts form's enums ───────────────

const BUCKET_TO_CATEGORY: Record<string, PromptCategory> = {
  B1: 'comparison', // Brand & Competitor
  B2: 'awareness', // Category Creation
  B3: 'features', // Problem / JTBD
  B4: 'alternative', // Buyer Intent
  B5: 'custom', // Compliance & Risk
}
const BUCKET_LABEL: Record<string, string> = {
  B1: 'Brand & Competitor',
  B2: 'Category',
  B3: 'Problem / JTBD',
  B4: 'Buyer Intent',
  B5: 'Compliance & Risk',
}

function mapCategory(bucket: string): PromptCategory {
  return BUCKET_TO_CATEGORY[(bucket || '').toUpperCase()] ?? 'awareness'
}
function mapFrequency(f: string): 'daily' | 'weekly' {
  const v = (f || '').toLowerCase()
  return v === 'weekly' || v === 'monthly' ? 'weekly' : 'daily'
}
function mapEngines(arr: string[] | undefined): Engine[] {
  const valid: Engine[] = ['chatgpt', 'gemini', 'perplexity', 'claude']
  const out = (arr || []).filter((e): e is Engine => valid.includes(e as Engine))
  return out.length > 0 ? out : ['chatgpt', 'gemini', 'perplexity']
}

const CATEGORY_TONE: Record<PromptCategory, string> = {
  awareness: 'bg-blue-500/10 text-blue-400',
  comparison: 'bg-purple-500/10 text-purple-400',
  alternative: 'bg-amber-500/10 text-amber-400',
  features: 'bg-emerald-500/10 text-emerald-400',
  custom: 'bg-secondary text-muted-foreground',
}

export function PromptGeneratorPanel({
  brandId,
  brandName,
  brandDomain,
  industry,
  competitors = [],
  language = 'en',
  onCreated,
}: Props) {
  const [industries, setIndustries] = useState<IndustryOption[]>([])
  const [useAi, setUseAi] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [aiNote, setAiNote] = useState<string | null>(null)
  const [creating, setCreating] = useState<Set<string>>(new Set())
  const [created, setCreated] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/industries')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setIndustries(j.data)
      })
      .catch(() => {})
  }, [])

  // Resolve the brand's free-text industry to the closest preset id the
  // generator API understands (it's preset-locked). Falls back to saas-b2b.
  const resolvePresetId = useCallback((): string => {
    if (industries.length === 0) return 'saas-b2b'
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
    const target = norm(industry || '')
    if (target) {
      for (const ind of industries) {
        if (norm(ind.id).includes(target) || target.includes(norm(ind.id))) return ind.id
        for (const name of Object.values(ind.name)) {
          if (norm(name).includes(target) || target.includes(norm(name))) return ind.id
        }
      }
    }
    return industries.find((i) => i.id === 'saas-b2b')?.id ?? industries[0]?.id ?? 'saas-b2b'
  }, [industries, industry])

  const generate = useCallback(async () => {
    setGenerating(true)
    setDrafts([])
    setAiNote(null)
    setCreated(new Set())
    try {
      const res = await fetch('/api/prompts/generate-from-industry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: brandName,
          brandDomain: brandDomain || undefined,
          industryId: resolvePresetId(),
          locale: language,
          competitors,
          withAi: useAi,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast.error(json.message || 'Generation failed')
        return
      }

      const templateDrafts: Draft[] = (json.data as RawTemplatePrompt[]).map((p, i) => ({
        key: `t-${i}`,
        text: p.userQuery,
        category: mapCategory(p.intentBucket),
        frequency: mapFrequency(p.suggestedFrequency),
        engines: mapEngines(p.targetLLMs),
        language: (['en', 'it', 'sv'].includes(p.language) ? p.language : language) as Lang,
        bucket: p.intentBucket,
        intentLabel: p.intentLabel || BUCKET_LABEL[p.intentBucket] || p.intentBucket,
        priority: p.priority,
        source: 'template',
      }))

      const aiDrafts: Draft[] = ((json.ai?.prompts ?? []) as RawAiPrompt[]).map((p, i) => ({
        key: `ai-${i}`,
        text: p.text,
        category: mapCategory(p.intentBucket),
        frequency: 'daily',
        engines: mapEngines(p.targetEngines),
        language,
        bucket: p.intentBucket,
        intentLabel: BUCKET_LABEL[p.intentBucket] || p.intentBucket,
        priority: p.priority,
        source: 'ai',
      }))

      if (useAi && json.ai?.error) setAiNote(json.ai.error)
      setDrafts([...aiDrafts, ...templateDrafts])
      if (templateDrafts.length + aiDrafts.length === 0) {
        toast('No prompts generated for this brand', { icon: 'ℹ️' })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [brandName, brandDomain, resolvePresetId, language, competitors, useAi])

  const createOne = useCallback(
    async (d: Draft) => {
      if (created.has(d.key)) return
      setCreating((s) => new Set(s).add(d.key))
      try {
        const res = await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand_id: brandId,
            text: d.text,
            language: d.language,
            category: d.category,
            engines: d.engines,
            run_frequency: d.frequency,
          }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          toast.error(json.message || 'Could not create prompt')
          return
        }
        setCreated((s) => new Set(s).add(d.key))
        onCreated?.()
      } catch {
        toast.error('Network error creating prompt')
      } finally {
        setCreating((s) => {
          const next = new Set(s)
          next.delete(d.key)
          return next
        })
      }
    },
    [brandId, created, onCreated],
  )

  const createAll = useCallback(async () => {
    const pending = drafts.filter((d) => !created.has(d.key))
    for (const d of pending) {
      // Sequential to keep the prompts list ordering stable + avoid hammering.
      // eslint-disable-next-line no-await-in-loop
      await createOne(d)
    }
    toast.success(`Created ${pending.length} prompt${pending.length === 1 ? '' : 's'}`)
  }, [drafts, created, createOne])

  const remaining = drafts.filter((d) => !created.has(d.key)).length

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={useAi}
            onChange={(e) => setUseAi(e.target.checked)}
            disabled={generating}
            className="h-4 w-4 cursor-pointer accent-brand"
          />
          <Sparkles className="h-4 w-4 text-brand" />
          Augment with AI (Groq)
        </label>
        <Button onClick={generate} disabled={generating || !brandId} size="sm">
          {generating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          {generating ? 'Generating…' : 'Generate prompts'}
        </Button>
      </div>

      {aiNote && (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-400">
          AI augmentation unavailable: {aiNote} — showing template prompts only.
        </p>
      )}

      {drafts.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {drafts.length} suggested prompt{drafts.length === 1 ? '' : 's'} — each pre-mapped to
              category, frequency, engines & language.
            </p>
            <Button size="sm" variant="outline" onClick={createAll} disabled={remaining === 0}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create all ({remaining})
            </Button>
          </div>

          <div className="space-y-2">
            {drafts.map((d) => {
              const isCreating = creating.has(d.key)
              const isCreated = created.has(d.key)
              return (
                <div
                  key={d.key}
                  className="bg-secondary/30 flex items-start gap-3 rounded-xl border border-border px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {d.source === 'ai' && (
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand" aria-label="AI" />
                      )}
                      <p className="text-sm font-medium text-foreground">{d.text}</p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                          CATEGORY_TONE[d.category],
                        )}
                      >
                        {d.category}
                      </span>
                      <Badge variant="default" size="sm">
                        {d.frequency}
                      </Badge>
                      <Badge variant="outline" size="sm">
                        {d.language.toUpperCase()}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {d.engines.join(', ')}
                      </span>
                      <span className="text-[10px] text-muted-foreground">· {d.intentLabel}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={isCreated ? 'ghost' : 'primary'}
                    disabled={isCreating || isCreated}
                    onClick={() => createOne(d)}
                    className="shrink-0"
                  >
                    {isCreating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isCreated ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    {isCreating ? 'Creating…' : isCreated ? 'Created' : 'Create'}
                  </Button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
