'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Wand2,
  Loader2,
  Sparkles,
  Globe,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface IndustryOption {
  id: string
  name: { en: string; it: string; sv: string }
  description: { en: string; it: string; sv: string }
  competitors: string[]
}

interface GeneratedPrompt {
  title: string
  intentBucket: string
  intentLabel: string
  targetLLMs: string[]
  language: string
  systemPrompt: string
  userQuery: string
  expectedOutput: string
  suggestedFrequency: string
  priority: string
}

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-muted text-muted-foreground border-input',
}

const LLM_BADGES: Record<string, string> = {
  chatgpt: 'bg-green-500/10 text-green-400',
  claude: 'bg-purple-500/10 text-purple-400',
  perplexity: 'bg-blue-500/10 text-blue-400',
  gemini: 'bg-rose-500/10 text-rose-400',
}

function IntentBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-input bg-input px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      {label}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium}`}
    >
      {priority}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }, [text])

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 rounded-md p-1.5 text-xs text-muted-foreground transition-colors hover:bg-input hover:text-foreground"
      title="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function PromptRow({ prompt, defaultOpen }: { prompt: GeneratedPrompt; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="hover:border-muted-foreground/30 rounded-xl border border-input bg-card transition-all">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{prompt.title}</span>
            <CopyButton text={prompt.userQuery} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <IntentBadge label={prompt.intentLabel} />
            <PriorityBadge priority={prompt.priority} />
            <span className="text-[10px] text-muted-foreground">{prompt.suggestedFrequency}</span>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-5 py-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              System Prompt
            </label>
            <div className="relative">
              <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-input p-3 text-xs text-foreground">
                {prompt.systemPrompt}
              </pre>
              <div className="absolute right-2 top-2">
                <CopyButton text={prompt.systemPrompt} />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              User Query
            </label>
            <div className="relative">
              <pre className="rounded-lg bg-input p-3 text-xs text-foreground">
                {prompt.userQuery}
              </pre>
              <div className="absolute right-2 top-2">
                <CopyButton text={prompt.userQuery} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Target LLMs:
            </label>
            {prompt.targetLLMs.map((llm) => (
              <span
                key={llm}
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-medium ${LLM_BADGES[llm] || 'bg-input text-muted-foreground'}`}
              >
                {llm}
              </span>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Expected Output
            </label>
            <p className="text-xs text-muted-foreground">{prompt.expectedOutput}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PromptGeneratorPage() {
  const t = useTranslations()

  const [industries, setIndustries] = useState<IndustryOption[]>([])
  const [industriesLoading, setIndustriesLoading] = useState(true)

  const [selectedIndustry, setSelectedIndustry] = useState('')
  const [brand, setBrand] = useState('')
  const [location, setLocation] = useState('')
  const [locale, setLocale] = useState<'en' | 'it' | 'sv'>('en')

  const [prompts, setPrompts] = useState<GeneratedPrompt[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generated, setGenerated] = useState(false)

  const localeLabels: Record<string, string> = {
    en: 'English',
    it: 'Italiano',
    sv: 'Svenska',
  }

  const localeFlags: Record<string, string> = {
    en: '🇬🇧',
    it: '🇮🇹',
    sv: '🇸🇪',
  }

  useState(() => {
    fetch('/api/industries')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setIndustries(json.data)
      })
      .catch(() => {
        // silent
      })
      .finally(() => setIndustriesLoading(false))
  })

  const handleGenerate = useCallback(async () => {
    if (!brand.trim() || !selectedIndustry) return

    setGenerating(true)
    setError(null)
    setGenerated(false)

    try {
      const res = await fetch('/api/prompts/generate-from-industry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: brand.trim(),
          industryId: selectedIndustry,
          locale,
          location: location.trim() || undefined,
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.success) {
        setError(json.message || 'Failed to generate prompts')
        return
      }

      setPrompts(json.data)
      setGenerated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setGenerating(false)
    }
  }, [brand, selectedIndustry, locale, location])

  const handleClear = useCallback(() => {
    setPrompts([])
    setGenerated(false)
    setError(null)
  }, [])

  const selectedIndustryData = industries.find((i) => i.id === selectedIndustry)

  return (
    <div className="animate-in space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-foreground">
          {t('prompt_generator.page_title') || 'Prompt Generator'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {t('prompt_generator.page_subtitle') ||
            'Generate GEO-optimized prompts for any brand in your industry'}
        </p>
      </div>

      <Card className="border-input p-6">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('prompt_generator.industry') || 'Industry'}
            </label>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50"
              disabled={generating}
            >
              <option value="">
                {industriesLoading
                  ? 'Loading...'
                  : t('prompt_generator.select_industry') || 'Select industry'}
              </option>
              {industries.map((ind) => (
                <option key={ind.id} value={ind.id}>
                  {ind.name[locale] || ind.name.en}
                </option>
              ))}
            </select>
            {selectedIndustryData && (
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {selectedIndustryData.description[locale] || selectedIndustryData.description.en}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('prompt_generator.brand') || 'Brand Name'}
            </label>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Acasting"
              className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent"
              disabled={generating}
            />
            {selectedIndustryData && (
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {t('prompt_generator.competitors') || 'Competitors'}:{' '}
                {selectedIndustryData.competitors.join(', ')}
              </p>
            )}
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              {t('prompt_generator.location') || 'Location'}
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={
                locale === 'sv' ? 't.ex. Sverige' : locale === 'it' ? 'es. Italia' : 'e.g. Sweden'
              }
              className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent"
              disabled={generating}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Globe className="mr-1 inline h-3 w-3" />
              {t('prompt_generator.language') || 'Language'}
            </label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as 'en' | 'it' | 'sv')}
              className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50"
              disabled={generating}
            >
              {Object.entries(localeLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {localeFlags[key]} {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button
            onClick={handleGenerate}
            disabled={generating || !brand.trim() || !selectedIndustry}
            size="lg"
          >
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('prompt_generator.generating') || 'Generating...'}
              </>
            ) : (
              <>
                <Wand2 className="h-5 w-5" />
                {t('prompt_generator.generate') || 'Generate Prompts'}
              </>
            )}
          </Button>

          {generated && (
            <Button variant="outline" size="lg" onClick={handleClear}>
              <RefreshCw className="h-5 w-5" />
              {t('prompt_generator.clear') || 'Clear'}
            </Button>
          )}
        </div>
      </Card>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {generated && prompts.length > 0 && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-bold text-foreground">
                {t('prompt_generator.results_title') || 'Generated Prompts'}
              </h2>
              <span className="rounded-md border border-input bg-input px-2 py-0.5 text-xs text-muted-foreground">
                {prompts.length}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {prompts.map((prompt, i) => (
              <PromptRow key={i} prompt={prompt} defaultOpen={i < 3} />
            ))}
          </div>
        </div>
      )}

      {generated && prompts.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Wand2 className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            {t('prompt_generator.no_results') ||
              'No prompts generated. Try a different industry or brand.'}
          </p>
        </div>
      )}
    </div>
  )
}
