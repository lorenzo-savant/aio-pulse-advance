'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Plus,
  X,
  Play,
  Loader2,
  MessageSquare,
  Clock,
  Library,
  Wand2,
  AlertTriangle,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { SectionHelp } from '@/components/help/SectionHelp'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { Modal, ModalHeader, ModalTitle, ModalBody } from '@/components/ui/Modal'
import { formatRelativeTime, cn } from '@/lib/utils'
import { PromptPortfolioPanel } from '@/components/PromptPortfolioPanel'
import toast from 'react-hot-toast'
import type { Brand, Prompt, MonitoringEngine } from '@/types'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PromptLibrarySelector } from '@/components/PromptLibrarySelector'
import { PromptGeneratorPanel } from '@/components/PromptGeneratorPanel'
import { JourneyGuide } from '@/components/JourneyGuide'
import { findPerformativePatterns } from '@/lib/prompt-quality'

const PROMPT_TEMPLATES = {
  en: [
    { category: 'awareness', text: 'What is [brand]?' },
    { category: 'awareness', text: 'Tell me about [brand]' },
    { category: 'comparison', text: 'Compare [brand] vs competitors' },
    { category: 'alternative', text: 'Best alternatives to [brand]' },
    { category: 'features', text: 'What are the main features of [brand]?' },
    { category: 'comparison', text: 'Is [brand] better than [competitor]?' },
  ],
  it: [
    { category: 'awareness', text: "Cos'è [brand]?" },
    { category: 'awareness', text: 'Parlami di [brand]' },
    { category: 'comparison', text: 'Confronta [brand] con i concorrenti' },
    { category: 'alternative', text: 'Migliori alternative a [brand]' },
    { category: 'features', text: 'Quali sono le principali funzionalità di [brand]?' },
    { category: 'comparison', text: '[brand] è migliore di [competitor]?' },
  ],
  sv: [
    { category: 'awareness', text: 'Vad är [brand]?' },
    { category: 'awareness', text: 'Berätta om [brand]' },
    { category: 'comparison', text: 'Jämför [brand] med konkurrenter' },
    { category: 'alternative', text: 'Bästa alternativ till [brand]' },
    { category: 'features', text: 'Vilka är de viktigaste funktionerna i [brand]?' },
    { category: 'comparison', text: 'Är [brand] bättre än [competitor]?' },
  ],
}

const CATEGORY_COLORS: Record<string, 'brand' | 'info' | 'warning' | 'success' | 'default'> = {
  awareness: 'brand',
  comparison: 'info',
  alternative: 'warning',
  features: 'success',
  custom: 'default',
}

/**
 * What one engine returned for one prompt, on its most recent run.
 *
 * Answers, in order: did the engine name the brand, where in the answer, how
 * did it talk about it, and did it cite anything. That is the whole point of
 * running a prompt, and until now none of it was visible here.
 */
function RunResultRow({ result }: { result: PromptRunResult }) {
  const cited = result.cited_urls?.length ?? 0
  const rivals = result.competitor_mentions ?? []

  return (
    <div className="space-y-1 py-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default">{result.engine}</Badge>

        {result.brand_mentioned ? (
          <span className="font-semibold text-emerald-400">Mentioned</span>
        ) : (
          <span className="text-muted-foreground">Not mentioned</span>
        )}

        {/* Named outright, or only alluded to. A brand described without being
            named cannot be clicked, searched for, or remembered. */}
        {result.brand_mentioned && result.mention_type === 'indirect' && (
          <span className="text-amber-400">indirect</span>
        )}

        {/* Sentence index, not a rank — 1 is the opening sentence. */}
        {result.brand_mentioned && result.mention_position != null && (
          <span className="text-muted-foreground">sentence {result.mention_position}</span>
        )}

        {result.brand_mentioned && (result.mention_count ?? 0) > 1 && (
          <span className="text-muted-foreground">{result.mention_count}×</span>
        )}

        {result.sentiment && (
          <span className="text-muted-foreground">
            {result.sentiment}
            {result.sentiment_score != null && ` ${result.sentiment_score.toFixed(2)}`}
          </span>
        )}

        {result.visibility_score != null && (
          <span className="text-muted-foreground">vis {Math.round(result.visibility_score)}</span>
        )}

        {cited > 0 && (
          <span className="text-muted-foreground">
            {cited} {cited === 1 ? 'citation' : 'citations'}
            {/* Grounded after the fact rather than supplied by the engine —
                weaker evidence, and worth distinguishing. */}
            {result.citation_source === 'brave_fallback' && ' (grounded)'}
          </span>
        )}

        <span className="text-muted-foreground/70 ml-auto">
          {new Date(result.created_at).toLocaleDateString()}
          {result.response_provider && ` · ${result.response_provider}`}
        </span>
      </div>

      {/* The two answers that change what you do next. Both are rare, so they
          get their own line and a colour rather than hiding in the row. */}
      {result.confusion_flag && (
        <p className="text-amber-400">
          ⚠ Brand confusion{result.confusion_reason ? ` — ${result.confusion_reason}` : ''}
        </p>
      )}
      {result.has_hallucination && (
        <p className="text-red-400">⚠ The engine stated something inaccurate</p>
      )}

      {rivals.length > 0 && (
        <p className="text-muted-foreground">
          Also named:{' '}
          <span className="text-foreground">{rivals.map((c) => c.name).join(', ')}</span>
        </p>
      )}
    </div>
  )
}

function PromptCard({
  prompt,
  results,
  onDelete,
  onRun,
  running,
  deleting,
  t,
}: {
  prompt: Prompt
  results: PromptRunResult[]
  onDelete: (id: string) => void
  onRun: (promptId: string) => void
  running: boolean
  deleting: boolean
  t: ReturnType<typeof useTranslations>
}) {
  const categoryColor = CATEGORY_COLORS[prompt.category ?? 'custom'] ?? 'default'
  const [showAnswers, setShowAnswers] = useState(false)

  return (
    <Card className="border-input bg-card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {/* Which brand this prompt belongs to. The list mixes every brand
                the user can reach — 205 prompts across 5 brands here — and
                without this there was no way to tell them apart. The API has
                returned `brand` all along; the card ignored it. */}
            {prompt.brand?.name && (
              <span
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  backgroundColor: `${prompt.brand.color || '#6366f1'}22`,
                  color: prompt.brand.color || '#6366f1',
                }}
              >
                {prompt.brand.name}
              </span>
            )}
            <Badge variant={categoryColor}>{prompt.category ?? 'custom'}</Badge>
            <Badge variant="default">{prompt.language}</Badge>
            {prompt.engines.map((e) => (
              <Badge key={e} variant="default">
                {e}
              </Badge>
            ))}
          </div>
          <p className="text-sm font-medium text-muted-foreground">"{prompt.text}"</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            disabled={running}
            loading={running}
            size="sm"
            variant="outline"
            onClick={() => onRun(prompt.id)}
          >
            {!running && <Play className="h-3.5 w-3.5 text-emerald-500" />}
            {t('prompts.card.run')}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={deleting}
            onClick={() => onDelete(prompt.id)}
          >
            {deleting ? (
              <Loader2 className="text-red-400 h-4 w-4 animate-spin" />
            ) : (
              <X className="hover:text-red-400 h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </div>

      {/* What the engines actually answered. Previously this page ran a prompt,
          reported a count in a toast, and showed none of it. */}
      {results.length > 0 && (
        <div className="bg-secondary/40 mb-3 rounded-lg border border-input px-3 py-1.5">
          {results.map((r) => (
            <RunResultRow key={r.id} result={r} />
          ))}

          {results.some((r) => r.response_text) && (
            <button
              type="button"
              onClick={() => setShowAnswers((v) => !v)}
              className="mt-1 text-xs font-semibold text-brand hover:underline"
            >
              {showAnswers ? 'Hide answers' : 'Show answers'}
            </button>
          )}

          {showAnswers && (
            <div className="mt-2 space-y-2 border-t border-input pt-2">
              {results
                .filter((r) => r.response_text)
                .map((r) => (
                  <div key={`${r.id}-text`}>
                    <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {r.engine}
                    </p>
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {r.response_text}
                    </p>
                    {(r.cited_urls?.length ?? 0) > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {r.cited_urls!.map((u) => (
                          <li key={u} className="truncate text-[11px]">
                            <a
                              href={u}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand hover:underline"
                            >
                              {u}
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          {prompt.last_run_at
            ? `${t('prompts.card.last_run')} ${formatRelativeTime(prompt.last_run_at)}`
            : t('prompts.card.never_run')}
        </div>
        <span className="capitalize">
          {t(`common.${prompt.run_frequency}`)} {t('prompts.card.schedule')}
        </span>
      </div>
    </Card>
  )
}

/**
 * The slice of a monitoring result a prompt card needs to EXPLAIN what came
 * back, not merely report that something did.
 *
 * "Was I mentioned" is the shallow question. The ones that change what you do
 * next are: who else did the engine name, did it mistake me for someone else,
 * did it state something false, and did it recommend me or just list me.
 */
interface PromptRunResult {
  id: string
  prompt_id: string
  engine: string
  brand_mentioned: boolean
  mention_position: number | null
  mention_count: number | null
  /** direct | indirect | none — being named outright is not the same as being alluded to. */
  mention_type: string | null
  visibility_score: number | null
  sentiment: string | null
  sentiment_score: number | null
  /** Rivals the engine named in the same answer. The competitive picture. */
  competitor_mentions: Array<{ name: string; position?: number | null }> | null
  /** The engine confused this brand with a look-alike. */
  confusion_flag: boolean | null
  confusion_reason: string | null
  /** The engine asserted something untrue about the brand. */
  has_hallucination: boolean | null
  response_text: string | null
  cited_urls: string[] | null
  /** Where the citations came from — `brave_fallback` means the engine did not
   *  supply them and they were grounded afterwards, which is weaker evidence. */
  citation_source: string | null
  /** Which model actually answered, after any provider fallback. */
  response_provider: string | null
  created_at: string
}

/**
 * Fetch EVERY prompt, not the first page.
 *
 * /api/prompts is paginated with `defaultLimit: 20` and `maxLimit: 100`, and
 * this page used to call it with no parameters at all — so a brand with 76
 * prompts showed 20 of them, with nothing on screen saying so. The response
 * carried the real total the whole time and the page discarded it.
 *
 * Raising the limit is not enough: unfiltered, the account has more prompts
 * than `maxLimit` allows in one request, so the pages have to be walked.
 */
export async function fetchAllPrompts(
  brandId?: string,
): Promise<{ prompts: Prompt[]; total: number; truncated: boolean }> {
  const PER_PAGE = 100 // maxLimit on the endpoint
  const HARD_STOP = 50 // 5000 prompts; a runaway loop is worse than a short list

  const all: Prompt[] = []
  let total = 0

  for (let page = 1; page <= HARD_STOP; page++) {
    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) })
    if (brandId) params.set('brand_id', brandId)

    const res = await fetch(`/api/prompts?${params}`)
    const json = await res.json()
    if (!json?.success) return { prompts: all, total: total || all.length, truncated: true }

    all.push(...((json.data ?? []) as Prompt[]))
    total = json.pagination?.total ?? all.length
    if (!json.pagination?.hasMore) return { prompts: all, total, truncated: false }
  }

  // Hit the stop with pages still to go. Say so rather than pretend.
  return { prompts: all, total, truncated: true }
}

function PromptsPageContent() {
  const t = useTranslations()
  const searchParams = useSearchParams()
  const preselectedBrandId = searchParams.get('brand_id')
  const { confirm, ConfirmDialog } = useConfirmDialog()

  const [brands, setBrands] = useState<Brand[]>([])
  const [prompts, setPrompts] = useState<Prompt[]>([])
  /** What the server says the total is. Compared against `prompts.length` so a
   *  short list is visibly short rather than quietly short. */
  const [promptTotal, setPromptTotal] = useState(0)
  /** Latest monitoring result per prompt per engine, keyed by prompt id. */
  const [resultsByPrompt, setResultsByPrompt] = useState<Record<string, PromptRunResult[]>>({})
  const [loading, setLoading] = useState(true)
  const [runningId, setRunningId] = useState<string | null>(null)
  /**
   * The brand a NEW prompt will be created for. Form state only.
   *
   * This used to double as the list filter, which made the two silently
   * interfere: pressing "Generate (AI)" with nothing selected set this to the
   * first brand, and because the list read the same value, the whole prompt
   * list collapsed to that one brand with no control on screen explaining why
   * or offering a way back.
   */
  const [selectedBrandId, setSelectedBrandId] = useState(preselectedBrandId ?? '')
  /**
   * Which brand the LIST shows. Empty means every brand the user can reach.
   *
   * Seeded from `?brand_id=` so arriving from the Brands page still lands on
   * that brand, but now it is a visible filter the user can clear.
   */
  const [filterBrandId, setFilterBrandId] = useState(preselectedBrandId ?? '')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    text: '',
    category: 'awareness' as Prompt['category'],
    engines: ['chatgpt', 'gemini', 'perplexity'] as MonitoringEngine[],
    language: 'en',
    run_frequency: 'daily' as Prompt['run_frequency'],
  })
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [templateLang, setTemplateLang] = useState<'en' | 'it' | 'sv'>('en')
  // Performative-phrasing matches block submission until the user
  // rewrites the prompt. Computed every render — cheap, no memo needed.
  // See src/lib/prompt-quality.ts for the rules + reasoning.
  const performativeMatches = findPerformativePatterns(form.text)
  const isBlockedByPerformative = performativeMatches.length > 0
  const [showLibrary, setShowLibrary] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  // Borrow #1 — prompt suggestions from Perplexity's related_questions.
  const [suggestions, setSuggestions] = useState<Array<{ text: string; source: string }>>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsReason, setSuggestionsReason] = useState<string | null>(null)
  const [addingSuggestion, setAddingSuggestion] = useState<string | null>(null)

  const fetchSuggestions = async () => {
    if (!selectedBrandId) {
      toast.error(t('prompts.toast.select_brand_error'))
      return
    }
    setSuggestionsLoading(true)
    setSuggestionsReason(null)
    try {
      const res = await fetch('/api/prompts/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: selectedBrandId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || t('errors.bad_request'))
      setSuggestions(json.suggestions ?? [])
      setSuggestionsReason(json.reason ?? null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('prompts.toast.load_failed'))
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const addSuggestion = async (text: string) => {
    if (!selectedBrandId) return
    setAddingSuggestion(text)
    try {
      const b = brands.find((x) => x.id === selectedBrandId)
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: selectedBrandId,
          text,
          language: (b?.language as string) ?? 'en',
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.message || t('errors.bad_request'))
      setPrompts((prev) => [json.data, ...prev])
      setSuggestions((prev) => prev.filter((s) => s.text !== text))
      toast.success(t('prompts.toast.created'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errors.bad_request'))
    } finally {
      setAddingSuggestion(null)
    }
  }

  /**
   * Pull the most recent monitoring results for the prompts on screen.
   *
   * Running a prompt used to end at a toast saying how many results came back,
   * and nothing else — the user paid for engine calls and then had to go to a
   * different page to find out what the engines actually said.
   *
   * One request for the whole page of prompts, not one per card.
   */
  const loadResults = useCallback(async (forPrompts: Prompt[]) => {
    if (forPrompts.length === 0) {
      setResultsByPrompt({})
      return
    }
    try {
      const ids = forPrompts.map((p) => p.id)
      const byPrompt: Record<string, PromptRunResult[]> = {}

      // The endpoint caps at 100 rows a page, and a prompt can have one row per
      // engine, so ask in id-chunks and page through each.
      for (let i = 0; i < ids.length; i += 25) {
        const chunk = ids.slice(i, i + 25)
        for (let page = 1; page <= 20; page++) {
          const params = new URLSearchParams({
            prompt_id: chunk.join(','),
            limit: '100',
            page: String(page),
          })
          const res = await fetch(`/api/monitoring?${params}`)
          const json = await res.json()
          if (!json?.success) break

          for (const r of (json.data ?? []) as PromptRunResult[]) {
            const list = byPrompt[r.prompt_id] ?? (byPrompt[r.prompt_id] = [])
            // Rows arrive newest first, so the first one seen for an engine is
            // the latest run. Keep that and drop the history.
            if (!list.some((existing) => existing.engine === r.engine)) list.push(r)
          }

          if (page >= (json.pagination?.totalPages ?? 1)) break
        }
      }

      setResultsByPrompt(byPrompt)
    } catch {
      // A failed results fetch must not blank the prompt list. Cards simply
      // show no results rather than the page showing an error.
    }
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [brandsRes, page] = await Promise.all([
        fetch('/api/brands'),
        fetchAllPrompts(filterBrandId || undefined),
      ])
      const bJson = await brandsRes.json()

      if (!bJson.success) {
        toast.error(t('prompts.toast.load_failed'))
      }

      setBrands(bJson.data ?? [])
      setPrompts(page.prompts)
      setPromptTotal(page.total)

      // The list is the whole list, or the user is told it is not. Silently
      // showing a subset is what this page used to do.
      if (page.truncated) {
        toast.error(t('prompts.toast.load_failed'))
      }

      void loadResults(page.prompts)
    } catch {
      toast.error(t('prompts.toast.load_failed'))
    } finally {
      setLoading(false)
    }
    // `loadResults` is stable (defined below with an empty dep list) and
    // including it would re-create loadData on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterBrandId, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!loading && brands.length === 0) {
      toast.error(t('prompts.toast.no_brands_error'))
    }
  }, [loading, brands, t])

  const handleCreate = async () => {
    if (!form.text.trim() || !selectedBrandId) {
      toast.error(t('prompts.toast.select_brand_error'))
      return
    }
    if (form.engines.length === 0) {
      toast.error(t('prompts.toast.select_engine_error'))
      return
    }
    // Belt-and-suspenders client-side block: the button is already
    // disabled, but if some path (keyboard, race) reaches this handler
    // with performative phrasing still in the text, fail loudly and
    // explain why. Server-side enforcement could be added later if
    // operators ever bypass the UI via direct API calls.
    const blockers = findPerformativePatterns(form.text)
    if (blockers.length > 0 && blockers[0]) {
      toast.error(
        `Cannot save — "${blockers[0].phrase}" triggers AI role-simulation. ${blockers[0].suggestion}`,
        { duration: 8000 },
      )
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, brand_id: selectedBrandId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.details?.text?.[0] || t('errors.bad_request'))
      }
      setPrompts((prev) => [json.data!, ...prev])
      setShowForm(false)
      setForm({
        text: '',
        category: 'awareness',
        engines: ['chatgpt', 'gemini', 'perplexity'],
        language: 'en',
        run_frequency: 'daily',
      })
      toast.success(t('prompts.toast.created'))
      // Non-blocking semantic dedup hint: the prompt is created, but warn that
      // a very similar one already exists so the user can avoid redundancy.
      if (json.similar && typeof json.similar.score === 'number') {
        toast(
          `⚠︎ Similar to an existing prompt (${Math.round(json.similar.score * 100)}% match): "${json.similar.text}"`,
          { duration: 6000 },
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.server_error'))
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: t('confirm_dialog.delete_title', { item: 'prompt' }),
      description: t('confirm_dialog.delete_description'),
      confirmLabel: t('common.delete'),
      destructive: true,
    })
    if (!confirmed) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/prompts?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || t('errors.server_error'))
      }
      setPrompts((prev) => prev.filter((p) => p.id !== id))
      toast.success(t('prompts.toast.deleted'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.server_error'))
    } finally {
      setDeletingId(null)
    }
  }

  const handleRun = async (promptId: string) => {
    setRunningId(promptId)
    try {
      const res = await fetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_id: promptId }),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.message || t('errors.server_error'))
      }

      if (json.data?.errors?.length > 0) {
        toast.error(`${t('errors.generic')}: ${json.data.errors.join(', ')}`)
      } else {
        toast.success(
          t('prompts.toast.monitoring_complete', { count: json.data?.results?.length ?? 0 }),
        )
      }
      void loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.server_error'))
    } finally {
      setRunningId(null)
    }
  }

  const toggleEngine = (engine: MonitoringEngine) => {
    setForm((f) => ({
      ...f,
      engines: f.engines.includes(engine)
        ? f.engines.filter((e) => e !== engine)
        : [...f.engines, engine],
    }))
  }

  return (
    <div className="animate-in space-y-8">
      <SectionHelp section="prompts" />
      <PromptPortfolioPanel />
      <JourneyGuide
        step={1}
        title={t('prompts.journey_guide.title')}
        lead={t('prompts.journey_guide.lead')}
        persistKey="prompts"
        steps={[
          {
            label: t('prompts.journey_guide.steps.open_library'),
            description: t('prompts.journey_guide.steps.open_library_desc'),
          },
          {
            label: t('prompts.journey_guide.steps.write_own'),
            description: t('prompts.journey_guide.steps.write_own_desc'),
          },
          {
            label: t('prompts.journey_guide.steps.pick_engines'),
            description: t('prompts.journey_guide.steps.pick_engines_desc'),
          },
          {
            label: t('prompts.journey_guide.steps.set_frequency'),
            description: t('prompts.journey_guide.steps.set_frequency_desc'),
          },
        ]}
        outcomes={[
          t('prompts.journey_guide.outcomes.prompts_ready'),
          t('prompts.journey_guide.outcomes.responses_captured'),
          t('prompts.journey_guide.outcomes.avi_computed'),
        ]}
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            {t('prompts.page_title')}
          </h1>
          <p className="mt-1 text-muted-foreground">{t('prompts.page_subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (!selectedBrandId && brands.length > 0) {
                setSelectedBrandId(brands[0]!.id)
              }
              setShowGenerator((v) => !v)
            }}
          >
            <Wand2 className="h-5 w-5" /> {t('prompts.generate_ai')}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!selectedBrandId && brands.length > 0) {
                setSelectedBrandId(brands[0]!.id)
              }
              setShowLibrary(true)
            }}
          >
            <Library className="h-5 w-5" /> {t('prompts.add_from_library')}
          </Button>
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-5 w-5" /> {t('prompts.new_prompt')}
          </Button>
        </div>
      </div>

      <Card className="border-border bg-secondary p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t('prompts.filter_by_brand')}:
          </span>
          <button
            className={cn(
              'rounded-xl border px-3 py-1.5 text-xs font-bold transition-all',
              !selectedBrandId
                ? 'bg-primary/10 border-brand text-brand'
                : 'border-input bg-input text-muted-foreground hover:border-input',
            )}
            onClick={() => setSelectedBrandId('')}
          >
            {t('prompts.all_brands')}
          </button>
          {brands.map((b) => (
            <button
              key={b.id}
              className={cn(
                'rounded-xl border px-3 py-1.5 text-xs font-bold transition-all',
                selectedBrandId === b.id
                  ? 'bg-primary/10 border-brand text-brand'
                  : 'border-input bg-input text-muted-foreground hover:border-input',
              )}
              onClick={() => setSelectedBrandId(b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
      </Card>

      {/* AI Prompt Generator — merged on top of the list. Suggests prompts for
          the selected brand with category/frequency/engines/language already
          mapped, and creates them straight into the list below. */}
      {showGenerator && (
        <Card className="border-brand-500/30 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-brand" />
              <h2 className="text-base font-bold text-foreground">{t('prompts.generate_ai')}</h2>
            </div>
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setShowGenerator(false)}
              aria-label="Close generator"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {selectedBrandId ? (
            (() => {
              const b = brands.find((x) => x.id === selectedBrandId)
              return (
                <PromptGeneratorPanel
                  brandId={selectedBrandId}
                  brandName={b?.name ?? 'Brand'}
                  brandDomain={b?.domain ?? undefined}
                  industry={b?.industry ?? undefined}
                  competitors={(b?.competitors as string[] | undefined) ?? []}
                  language={(b?.language as 'en' | 'it' | 'sv') ?? 'en'}
                  onCreated={() => void loadData()}
                />
              )
            })()
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t('prompts.library.select_brand_first')}
            </p>
          )}
        </Card>
      )}

      {selectedBrandId && (
        <Card className="p-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-brand" />
              <h2 className="text-base font-bold text-foreground">
                {t('prompts.suggestions.title')}
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchSuggestions()}
              disabled={suggestionsLoading}
            >
              {suggestionsLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t('prompts.suggestions.fetch')}
            </Button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">{t('prompts.suggestions.subtitle')}</p>
          {suggestions.length > 0 ? (
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li
                  key={s.text}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <span className="text-sm text-foreground">{s.text}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void addSuggestion(s.text)}
                    disabled={addingSuggestion === s.text}
                  >
                    {addingSuggestion === s.text ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="mr-1 h-3.5 w-3.5" />
                        {t('prompts.suggestions.add')}
                      </>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            suggestionsReason && (
              <p className="text-sm text-muted-foreground">{suggestionsReason}</p>
            )
          )}
        </Card>
      )}

      {showForm && (
        <Card className="border-brand-500/30 p-6">
          <h2 className="mb-5 text-base font-bold text-foreground">
            {t('prompts.form.create_title')}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t('prompts.form.brand_label')} *
              </label>
              <select
                className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-brand"
                value={selectedBrandId}
                onChange={(e) => setSelectedBrandId(e.target.value)}
              >
                <option value="">{t('prompts.form.brand_placeholder')}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t('prompts.form.quick_templates')}
              </label>
              <div className="mb-2 flex gap-2">
                {(['en', 'it', 'sv'] as const).map((lang) => (
                  <button
                    key={lang}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                      templateLang === lang
                        ? 'bg-primary/10 border-primary text-foreground'
                        : 'border-input bg-input text-muted-foreground hover:border-primary',
                    )}
                    onClick={() => setTemplateLang(lang)}
                  >
                    {lang === 'en' ? '🇬🇧 EN' : lang === 'it' ? '🇮🇹 IT' : '🇸🇪 SV'}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {PROMPT_TEMPLATES[templateLang].map((template, i) => (
                  <button
                    key={i}
                    className="rounded-lg border border-input bg-input px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-brand"
                    onClick={() => {
                      const brandName =
                        brands.find((b) => b.id === selectedBrandId)?.name ?? 'YourBrand'
                      setForm((f) => ({
                        ...f,
                        text: template.text
                          .replace('[brand]', brandName)
                          .replace('[competitor]', 'competitor'),
                        category: template.category as Prompt['category'],
                      }))
                    }}
                  >
                    {template.text}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t('prompts.form.text_label')} *
              </label>
              <textarea
                className={cn(
                  'placeholder-text-muted-surface w-full resize-none rounded-xl border bg-input px-4 py-3 text-sm text-foreground outline-none',
                  isBlockedByPerformative
                    ? 'border-rose-500/60 focus:border-rose-400'
                    : 'border-input focus:border-brand',
                )}
                placeholder={t('prompts.form.text_placeholder')}
                rows={3}
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              />
              {/* Performative-phrasing block. "Act as", "Pretend",
                  "Imagine you are", … shift AI engines into role-simulation
                  mode and inflate hallucination rate in the responses we
                  later measure as visibility. We BLOCK save (rather than
                  warn) so the noise never enters monitoring_results in the
                  first place — explanatory message includes the matched
                  phrase, WHY it's blocked, and HOW to fix it. */}
              {isBlockedByPerformative && performativeMatches[0] && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                  <div className="space-y-1.5">
                    <p className="text-sm font-bold text-rose-300">
                      Submission blocked — performative phrasing detected
                    </p>
                    <p className="text-rose-200/90">
                      Matched:{' '}
                      <code className="rounded bg-rose-500/20 px-1 py-0.5 font-mono">
                        {performativeMatches[0].phrase}
                      </code>
                    </p>
                    <p>
                      <span className="font-semibold text-rose-300">Why blocked:</span>{' '}
                      {performativeMatches[0].reason} Prompts in this form make AI engines improvise
                      rather than retrieve facts — the hallucinated answers would inflate your
                      Visibility / Share of Voice metrics with junk.
                    </p>
                    <p>
                      <span className="font-semibold text-rose-300">How to fix:</span>{' '}
                      {performativeMatches[0].suggestion} Once you rewrite the prompt without the
                      performative framing, the Create button will re-enable.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t('prompts.form.category_label')}
                </label>
                <select
                  className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-brand"
                  value={form.category ?? 'custom'}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value as Prompt['category'] }))
                  }
                >
                  {['awareness', 'comparison', 'alternative', 'features', 'custom'].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  {t('prompts.form.frequency_label')}
                </label>
                <select
                  className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-brand"
                  value={form.run_frequency}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      run_frequency: e.target.value as Prompt['run_frequency'],
                    }))
                  }
                >
                  {['hourly', 'daily', 'weekly'].map((f) => (
                    <option key={f} value={f}>
                      {t(`common.${f}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t('prompts.form.engines_label')}
              </label>
              <div className="flex gap-2">
                {(['chatgpt', 'gemini', 'perplexity'] as MonitoringEngine[]).map((engine) => (
                  <button
                    key={engine}
                    className={cn(
                      'rounded-xl border px-4 py-2 text-xs font-bold transition-all',
                      form.engines.includes(engine)
                        ? 'bg-primary/10 border-brand text-brand'
                        : 'border-input bg-input text-muted-foreground hover:border-input',
                    )}
                    onClick={() => toggleEngine(engine)}
                  >
                    {engine}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t('prompts.form.language_label')}
              </label>
              <div className="flex gap-2">
                {[
                  { code: 'en', label: '🇬🇧 English' },
                  { code: 'it', label: '🇮🇹 Italiano' },
                  { code: 'sv', label: '🇸🇪 Svenska' },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    className={cn(
                      'rounded-xl border px-4 py-2 text-xs font-bold transition-all',
                      form.language === lang.code
                        ? 'bg-primary/10 border-brand text-brand'
                        : 'border-input bg-input text-muted-foreground hover:border-input',
                    )}
                    onClick={() => setForm((f) => ({ ...f, language: lang.code }))}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setShowForm(false)}>
                {t('prompts.form.cancel')}
              </Button>
              <Button
                loading={creating}
                onClick={handleCreate}
                disabled={isBlockedByPerformative}
                title={
                  isBlockedByPerformative
                    ? 'Rewrite the prompt to remove the performative phrasing flagged above before saving.'
                    : undefined
                }
              >
                <Plus className="h-4 w-4" /> {t('prompts.form.create_button')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      ) : prompts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <MessageSquare className="mb-4 h-16 w-16 text-muted-foreground" />
          <h2 className="mb-2 text-xl font-bold text-foreground">
            {t('prompts.empty_state.title')}
          </h2>
          <p className="text-muted-foreground">{t('prompts.empty_state.description')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* The count is shown because this list used to be silently short:
              20 of 76 prompts, with nothing on screen admitting it. If these
              two numbers ever disagree, something is being hidden. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {prompts.length === promptTotal
                ? `${promptTotal} ${promptTotal === 1 ? 'prompt' : 'prompts'}`
                : `Showing ${prompts.length} of ${promptTotal} prompts`}
              {filterBrandId && ' · filtered'}
            </p>

            {/* An explicit, clearable brand filter. Arriving from the Brands
                page used to set an invisible one with no way back, and the
                "Generate (AI)" button could set it as a side effect. */}
            {brands.length > 1 && (
              <select
                className="rounded-lg border border-input bg-input px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-brand"
                value={filterBrandId}
                onChange={(e) => setFilterBrandId(e.target.value)}
              >
                <option value="">All brands</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {prompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              results={resultsByPrompt[prompt.id] ?? []}
              running={runningId === prompt.id}
              deleting={deletingId === prompt.id}
              onDelete={handleDelete}
              onRun={handleRun}
              t={t}
            />
          ))}
        </div>
      )}
      <ConfirmDialog />

      <Modal open={showLibrary} onOpenChange={setShowLibrary} className="max-w-2xl">
        <ModalHeader>
          <ModalTitle>{t('prompts.library.title')}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          {brands.length > 0 && (
            <div className="mb-4">
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t('prompts.form.brand_label')}
              </label>
              <select
                className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-brand"
                value={selectedBrandId}
                onChange={(e) => setSelectedBrandId(e.target.value)}
              >
                <option value="">{t('prompts.form.brand_placeholder')}</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selectedBrandId ? (
            <PromptLibrarySelector
              brandId={selectedBrandId}
              brandName={brands.find((b) => b.id === selectedBrandId)?.name ?? 'Unknown Brand'}
              industry={brands.find((b) => b.id === selectedBrandId)?.industry ?? undefined}
              competitors={
                (brands.find((b) => b.id === selectedBrandId)?.competitors as
                  | string[]
                  | undefined) ?? []
              }
              language={
                (brands.find((b) => b.id === selectedBrandId)?.language as 'en' | 'it' | 'sv') ??
                'en'
              }
              onComplete={() => {
                void loadData()
                setShowLibrary(false)
              }}
            />
          ) : (
            <p className="py-8 text-center text-muted-foreground">
              {t('prompts.library.select_brand_first')}
            </p>
          )}
        </ModalBody>
      </Modal>
    </div>
  )
}

export default function PromptsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      }
    >
      <PromptsPageContent />
    </Suspense>
  )
}
