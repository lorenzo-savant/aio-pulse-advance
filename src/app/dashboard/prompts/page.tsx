'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, X, Play, Loader2, MessageSquare, Clock, Library } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { Modal, ModalHeader, ModalTitle, ModalBody } from '@/components/ui/Modal'
import { formatRelativeTime, cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Brand, Prompt, MonitoringEngine } from '@/types'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PromptLibrarySelector } from '@/components/PromptLibrarySelector'

const PROMPT_TEMPLATES = [
  { category: 'awareness', text: 'What is [brand]?' },
  { category: 'awareness', text: 'Tell me about [brand]' },
  { category: 'comparison', text: 'Compare [brand] vs competitors' },
  { category: 'alternative', text: 'Best alternatives to [brand]' },
  { category: 'features', text: 'What are the main features of [brand]?' },
  { category: 'comparison', text: 'Is [brand] better than [competitor]?' },
]

const CATEGORY_COLORS: Record<string, 'brand' | 'info' | 'warning' | 'success' | 'default'> = {
  awareness: 'brand',
  comparison: 'info',
  alternative: 'warning',
  features: 'success',
  custom: 'default',
}

function PromptCard({
  prompt,
  onDelete,
  onRun,
  running,
  deleting,
}: {
  prompt: Prompt
  onDelete: (id: string) => void
  onRun: (promptId: string) => void
  running: boolean
  deleting: boolean
}) {
  const categoryColor = CATEGORY_COLORS[prompt.category ?? 'custom'] ?? 'default'

  return (
    <Card className="border-input bg-card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1.5 flex flex-wrap gap-1.5">
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
            Run
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={deleting}
            onClick={() => onDelete(prompt.id)}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin text-red-400" />
            ) : (
              <X className="h-4 w-4 text-muted-foreground hover:text-red-400" />
            )}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          {prompt.last_run_at ? `Last run ${formatRelativeTime(prompt.last_run_at)}` : 'Never run'}
        </div>
        <span className="capitalize">{prompt.run_frequency} schedule</span>
      </div>
    </Card>
  )
}

function PromptsPageContent() {
  const searchParams = useSearchParams()
  const preselectedBrandId = searchParams.get('brand_id')
  const { confirm, ConfirmDialog } = useConfirmDialog()

  const [brands, setBrands] = useState<Brand[]>([])
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [selectedBrandId, setSelectedBrandId] = useState(preselectedBrandId ?? '')
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
  const [showLibrary, setShowLibrary] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [brandsRes, promptsRes] = await Promise.all([
        fetch('/api/brands'),
        fetch(`/api/prompts${selectedBrandId ? `?brand_id=${selectedBrandId}` : ''}`),
      ])
      const bJson = await brandsRes.json()
      const pJson = await promptsRes.json()

      if (!bJson.success) {
        toast.error(`Failed to load brands: ${bJson.message}`)
      }
      if (!pJson.success) {
        toast.error(`Failed to load prompts: ${pJson.message}`)
      }

      setBrands(bJson.data ?? [])
      setPrompts(pJson.data ?? [])
    } catch (err) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [selectedBrandId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (!loading && brands.length === 0) {
      toast.error('No brands found. Please create a brand first.')
    }
  }, [loading, brands])

  const handleCreate = async () => {
    if (!form.text.trim() || !selectedBrandId) {
      toast.error('Select a brand and enter a prompt text')
      return
    }
    if (form.engines.length === 0) {
      toast.error('Select at least one AI engine')
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
        throw new Error(
          json.message || json.details?.text?.[0] || `Failed to create prompt (${res.status})`,
        )
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
      toast.success('Prompt created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create prompt')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: 'Delete prompt?',
      description: 'This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!confirmed) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/prompts?id=${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Failed to delete (${res.status})`)
      }
      setPrompts((prev) => prev.filter((p) => p.id !== id))
      toast.success('Prompt deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete prompt')
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
      console.log('[handleRun] Response:', json)

      if (!res.ok || !json.success) {
        throw new Error(json.message || `Monitoring failed (${res.status})`)
      }

      if (json.data?.errors?.length > 0) {
        console.error('[handleRun] Engine errors:', json.data.errors)
        toast.error(`Monitoring failed: ${json.data.errors.join(', ')}`)
      } else {
        toast.success(`Monitoring complete: ${json.data?.results?.length ?? 0} results saved`)
      }
      void loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Monitoring failed')
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">Prompts</h1>
          <p className="mt-1 text-muted-foreground">
            Configure the queries to monitor across AI engines.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowLibrary(true)}>
            <Library className="h-5 w-5" /> Add from Library
          </Button>
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-5 w-5" /> New Prompt
          </Button>
        </div>
      </div>

      <Card className="border-border bg-secondary p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Brand:
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
            All
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

      {showForm && (
        <Card className="border-brand-500/30 p-6">
          <h2 className="mb-5 text-base font-bold text-foreground">Create New Prompt</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Brand *
              </label>
              <select
                className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-brand"
                value={selectedBrandId}
                onChange={(e) => setSelectedBrandId(e.target.value)}
              >
                <option value="">Select brand...</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Quick Templates
              </label>
              <div className="flex flex-wrap gap-2">
                {PROMPT_TEMPLATES.map((t, i) => (
                  <button
                    key={i}
                    className="rounded-lg border border-input bg-input px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-brand"
                    onClick={() => {
                      const brandName =
                        brands.find((b) => b.id === selectedBrandId)?.name ?? 'YourBrand'
                      setForm((f) => ({
                        ...f,
                        text: t.text
                          .replace('[brand]', brandName)
                          .replace('[competitor]', 'competitor'),
                        category: t.category as Prompt['category'],
                      }))
                    }}
                  >
                    {t.text}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Prompt Text *
              </label>
              <textarea
                className="placeholder-text-muted-surface w-full resize-none rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-brand"
                placeholder="e.g. What are the best AI monitoring tools?"
                rows={3}
                value={form.text}
                onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Category
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
                  Run Frequency
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
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Engines to Monitor
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
                Language
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
                Cancel
              </Button>
              <Button loading={creating} onClick={handleCreate}>
                <Plus className="h-4 w-4" /> Create Prompt
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
          <h2 className="mb-2 text-xl font-bold text-foreground">No prompts yet</h2>
          <p className="text-muted-foreground">
            Create your first prompt to start monitoring AI responses.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {prompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              running={runningId === prompt.id}
              deleting={deletingId === prompt.id}
              onDelete={handleDelete}
              onRun={handleRun}
            />
          ))}
        </div>
      )}
      <ConfirmDialog />

      <Modal open={showLibrary} onOpenChange={setShowLibrary}>
        <ModalHeader>
          <ModalTitle>Add Prompts from Library</ModalTitle>
        </ModalHeader>
        <ModalBody>
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
              Select a brand to add prompts from the library.
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
