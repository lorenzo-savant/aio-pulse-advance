'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Building2,
  Sparkles,
  Settings,
  CheckCircle2,
  Plus,
  X,
  Loader2,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const STEPS = [
  { id: 1, name: 'Brand Info', icon: Building2 },
  { id: 2, name: 'Prompts', icon: Sparkles },
  { id: 3, name: 'Configure', icon: Settings },
  { id: 4, name: 'Review', icon: CheckCircle2 },
]

const BRAND_COLORS = [
  '#6366f1',
  '#10b981',
  '#f97316',
  '#a855f7',
  '#3b82f6',
  '#ec4899',
  '#14b8a6',
  '#f59e0b',
  '#ef4444',
  '#84cc16',
]

const INDUSTRIES = [
  'Technology',
  'SaaS / Software',
  'E-commerce',
  'Healthcare',
  'Finance',
  'Marketing / Agency',
  'Education',
  'Media / Publishing',
  'Consulting',
  'Other',
]

const ENGINES = [
  { id: 'chatgpt', label: 'ChatGPT', color: '#10b981' },
  { id: 'gemini', label: 'Gemini', color: '#3b82f6' },
  { id: 'perplexity', label: 'Perplexity', color: '#a855f7' },
  { id: 'claude', label: 'Claude', color: '#f97316' },
]

const LANGUAGES = [
  { id: 'en', label: '🇬🇧 English', flag: '🇬🇧' },
  { id: 'it', label: '🇮🇹 Italiano', flag: '🇮🇹' },
  { id: 'sv', label: '🇸🇪 Svenska', flag: '🇸🇪' },
]

const MARKETS = [
  { id: 'SE-Stockholm', label: 'Stockholm, Sweden' },
  { id: 'SE-Göteborg', label: 'Gothenburg, Sweden' },
  { id: 'SE-Malmö', label: 'Malmö, Sweden' },
  { id: 'SE', label: 'Sweden (National)' },
  { id: 'NO', label: 'Norway' },
  { id: 'DK', label: 'Denmark' },
  { id: 'International', label: 'International' },
]

const PROMPT_TEMPLATES = {
  local: [
    'Bästa {industry} i {city}',
    '{brand} {city} rekommendation',
    'Rekommenderad {industry} {city}',
    'Billig {industry} {city}',
    'Bästa {industry} nära {city}',
  ],
  national: [
    'Bästa {industry} i Sverige',
    'Hur väljer jag {industry}?',
    'Vad kostar {industry}?',
    '{industry} jämförelse',
    'Bästa {industry} företag',
  ],
  industry: [
    'Best {industry} for small businesses',
    '{brand} vs competitors',
    '{industry} pricing comparison',
    '{industry} review',
    'Top {industry} companies',
  ],
}

interface Prompt {
  text: string
  category: string
  language: string
  market: string
}

export default function NewBrandWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [generatingPrompts, setGeneratingPrompts] = useState(false)

  const [form, setForm] = useState({
    name: '',
    description: '',
    domain: '',
    industry: '',
    color: '#6366f1',
    aliasInput: '',
    aliases: [] as string[],
    competitorInput: '',
    competitors: [] as string[],
    engines: ['chatgpt', 'gemini', 'perplexity', 'claude'] as string[],
    frequency: 'weekly',
    alertEmail: '',
    primaryLanguage: 'en' as string,
    languages: ['en', 'sv'] as string[],
    markets: ['SE-Stockholm', 'SE', 'International'] as string[],
  })

  const [prompts, setPrompts] = useState<Prompt[]>([])

  const set = (key: string, val: unknown) => setForm((f) => ({ ...f, [key]: val }))

  const addAlias = () => {
    const v = form.aliasInput.trim()
    if (v && !form.aliases.includes(v)) {
      setForm((f) => ({ ...f, aliases: [...f.aliases, v], aliasInput: '' }))
    }
  }

  const addCompetitor = () => {
    const v = form.competitorInput.trim()
    if (v && !form.competitors.includes(v)) {
      setForm((f) => ({ ...f, competitors: [...f.competitors, v], competitorInput: '' }))
    }
  }

  const generatePrompts = async () => {
    console.log('[generatePrompts] Starting with form:', {
      languages: form.languages,
      markets: form.markets,
      industry: form.industry,
      name: form.name,
    })

    if (form.languages.length === 0) {
      toast.error('Please select at least one language')
      return
    }
    if (form.markets.length === 0) {
      toast.error('Please select at least one market')
      return
    }

    setGeneratingPrompts(true)
    try {
      const industry = form.industry || 'business'
      const brand = form.name || 'Brand'
      const competitors = form.competitors.join(', ') || 'competitors'
      const selectedLanguages = form.languages
      const selectedMarkets = form.markets

      const generated: Prompt[] = []

      const categories = ['awareness', 'comparison', 'features', 'alternative']
      const englishTemplates = [
        `Best ${industry} companies`,
        `${industry} review`,
        `${industry} pricing`,
        `${brand} vs competitors`,
        `Top ${industry} recommendations`,
      ]
      const swedishTemplates = [
        `Bästa ${industry} i Sverige`,
        `${industry} recension`,
        `Rekommenderad ${industry}`,
        `${brand} vs konkurrenter`,
        `Bästa ${industry} företag`,
      ]

      const templatesByLang: Record<string, string[]> = {
        en: englishTemplates,
        sv: swedishTemplates,
        de: englishTemplates.map((t) => t.replace(/Best /, 'Beste ').replace(/Top /, 'Top-')),
        fr: englishTemplates.map((t) => t.replace(/Best /, 'Meilleur ').replace(/Top /, 'Top ')),
        es: englishTemplates.map((t) => t.replace(/Best /, 'Mejor ').replace(/Top /, 'Top ')),
        no: swedishTemplates,
        da: swedishTemplates,
      }

      for (const language of selectedLanguages) {
        const templates = templatesByLang[language] || englishTemplates

        for (const market of selectedMarkets) {
          for (let i = 0; i < 5; i++) {
            const template = templates[i % templates.length] ?? englishTemplates[0] ?? ''
            generated.push({
              text: template
                .replace('{industry}', industry)
                .replace('{brand}', brand)
                .replace('{competitors}', competitors),
              category: categories[i % categories.length] || 'awareness',
              language: language,
              market: market,
            })
          }
        }
      }

      console.log('[generatePrompts] Generated prompts:', generated.length)

      if (generated.length === 0) {
        toast.error('No prompts generated. Please check your language and market selections.')
        setGeneratingPrompts(false)
        return
      }

      setPrompts(generated)
      setStep(3)
    } catch (err) {
      console.error('[generatePrompts] Error:', err)
      toast.error('Failed to generate prompts')
    } finally {
      setGeneratingPrompts(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Brand name is required')
      return
    }

    setLoading(true)

    try {
      // Create brand
      const brandRes = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          domain: form.domain.trim().replace(/^https?:\/\//, '') || undefined,
          industry: form.industry || undefined,
          color: form.color,
          aliases: form.aliases,
          competitors: form.competitors,
          language: form.primaryLanguage,
        }),
      })

      const brandJson = await brandRes.json()
      if (!brandJson.success) throw new Error(brandJson.message)

      const brandId = brandJson.data.id

      console.log('[handleSubmit] Creating brand:', brandId, 'with', prompts.length, 'prompts')

      // Create prompts
      const promptErrors: string[] = []
      const validEngines = ['chatgpt', 'gemini', 'perplexity', 'claude']
      for (const prompt of prompts) {
        console.log('[handleSubmit] Creating prompt:', prompt.text)

        const promptRes = await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand_id: brandId,
            text: prompt.text,
            category: prompt.category,
            language: prompt.language,
            market: prompt.market,
            engines: form.engines.filter((e: string) => validEngines.includes(e)),
            run_frequency: form.frequency,
          }),
        })

        const promptJson = await promptRes.json()
        console.log('[handleSubmit] Prompt result:', promptRes.status, promptJson)

        if (!promptJson.success) {
          promptErrors.push(`Prompt "${prompt.text.slice(0, 30)}...": ${promptJson.message}`)
        }
      }

      if (promptErrors.length > 0) {
        console.error('[handleSubmit] Prompt creation errors:', promptErrors)
        toast.error(`Created brand but ${promptErrors.length} prompts failed to create`)
      } else if (prompts.length > 0) {
        toast.success(`Created brand with ${prompts.length} prompts!`)
      }

      // Create alert if email provided
      if (form.alertEmail) {
        await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand_id: brandId,
            email: form.alertEmail,
            triggers: ['visibility_drop', 'new_mention', 'sentiment_change'],
          }),
        })
      }

      toast.success('Brand setup complete!')
      router.push(`/dashboard/brands/${brandId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create brand')
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    if (step === 1) return form.name.trim().length > 0 && form.primaryLanguage.trim().length > 0
    if (step === 2) return prompts.length > 0
    if (step === 3) return form.engines.length > 0
    return true
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Progress */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all',
                step === s.id
                  ? 'bg-primary text-foreground'
                  : step > s.id
                    ? 'bg-emerald-600 text-foreground'
                    : 'bg-secondary text-muted-foreground',
              )}
            >
              {step > s.id ? <Check className="h-5 w-5" /> : s.id}
            </div>
            <span
              className={cn(
                'ml-2 hidden text-sm font-medium sm:inline-block',
                step >= s.id ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {s.name}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-4 h-0.5 w-8 sm:w-16',
                  step > s.id ? 'bg-emerald-600' : 'bg-secondary',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Brand Info */}
      {step === 1 && (
        <Card className="space-y-6 p-6">
          <div>
            <h2 className="text-xl font-black text-foreground">Brand Information</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tell us about your brand.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Brand Name *
              </label>
              <input
                className="w-full rounded-xl border border-border px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="e.g. AIO Pulse"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Description
              </label>
              <textarea
                className="w-full resize-none rounded-xl border border-border px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Brief description of your brand..."
                rows={3}
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Primary Domain
                </label>
                <input
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="yourdomain.com"
                  value={form.domain}
                  onChange={(e) => set('domain', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Industry
                </label>
                <select
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                  value={form.industry}
                  onChange={(e) => set('industry', e.target.value)}
                >
                  <option value="">Select...</option>
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Primary Market Language *
                </label>
                <select
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                  value={form.primaryLanguage}
                  onChange={(e) => set('primaryLanguage', e.target.value)}
                >
                  <option value="">Select...</option>
                  {LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Prompts and AI simulations will run in this language.
                </p>
              </div>
            </div>
          </div>

          {/* Color */}
          <div>
            <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-muted-foreground">
              Brand Color
            </h3>
            <div className="flex flex-wrap gap-2">
              {BRAND_COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    'h-9 w-9 rounded-xl transition-all',
                    form.color === color &&
                      'ring-offset-background900 scale-110 ring-2 ring-white ring-offset-2',
                  )}
                  style={{ background: color }}
                  onClick={() => set('color', color)}
                />
              ))}
            </div>
          </div>

          {/* Aliases */}
          <div>
            <h3 className="mb-2 text-sm font-black uppercase tracking-widest text-muted-foreground">
              Aliases
            </h3>
            <div className="mb-3 flex gap-2">
              <input
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                placeholder="Alternative names..."
                value={form.aliasInput}
                onChange={(e) => set('aliasInput', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAlias()}
              />
              <Button size="sm" variant="outline" onClick={addAlias}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.aliases.map((a) => (
                <span
                  key={a}
                  className="bg-secondary/50 flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {a}
                  <button
                    onClick={() =>
                      setForm((f) => ({ ...f, aliases: f.aliases.filter((x) => x !== a) }))
                    }
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-red-400" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Competitors */}
          <div>
            <h3 className="mb-2 text-sm font-black uppercase tracking-widest text-muted-foreground">
              Competitors
            </h3>
            <div className="mb-3 flex gap-2">
              <input
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                placeholder="Competitor names..."
                value={form.competitorInput}
                onChange={(e) => set('competitorInput', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCompetitor()}
              />
              <Button size="sm" variant="outline" onClick={addCompetitor}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.competitors.map((c) => (
                <span
                  key={c}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-400"
                >
                  {c}
                  <button
                    onClick={() =>
                      setForm((f) => ({ ...f, competitors: f.competitors.filter((x) => x !== c) }))
                    }
                  >
                    <X className="h-3 w-3 opacity-60 hover:opacity-100" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Prompts */}
      {step === 2 && (
        <Card className="space-y-6 p-6">
          <div>
            <h2 className="text-xl font-black text-foreground">Target Languages & Markets</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select which languages and markets you want to monitor.
            </p>
          </div>

          {/* Languages */}
          <div>
            <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-muted-foreground">
              Languages
            </h3>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.id}
                  onClick={() => {
                    if (form.languages.includes(lang.id)) {
                      set(
                        'languages',
                        form.languages.filter((l) => l !== lang.id),
                      )
                    } else {
                      set('languages', [...form.languages, lang.id])
                    }
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all',
                    form.languages.includes(lang.id)
                      ? 'border-brand-500 bg-primary/10 text-foreground'
                      : 'bg-secondary/50 border-border text-muted-foreground hover:border-border',
                  )}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                  {form.languages.includes(lang.id) && <Check className="text-brand-400 h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>

          {/* Markets */}
          <div>
            <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-muted-foreground">
              Markets
            </h3>
            <div className="flex flex-wrap gap-2">
              {MARKETS.map((market) => (
                <button
                  key={market.id}
                  onClick={() => {
                    if (form.markets.includes(market.id)) {
                      set(
                        'markets',
                        form.markets.filter((m) => m !== market.id),
                      )
                    } else {
                      set('markets', [...form.markets, market.id])
                    }
                  }}
                  className={cn(
                    'rounded-xl border px-4 py-2.5 text-sm font-medium transition-all',
                    form.markets.includes(market.id)
                      ? 'border-brand-500 bg-primary/10 text-foreground'
                      : 'bg-secondary/50 border-border text-muted-foreground hover:border-border',
                  )}
                >
                  {market.label}
                  {form.markets.includes(market.id) && (
                    <Check className="text-brand-400 ml-2 inline h-4 w-4" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-secondary/50 rounded-xl p-4">
            <p className="text-sm text-muted-foreground">
              Based on:{' '}
              <span className="font-bold text-foreground">{form.name || 'Your brand'}</span>
              {form.industry && (
                <>
                  {' '}
                  in <span className="text-brand-400">{form.industry}</span>
                </>
              )}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              We&apos;ll generate monitoring prompts for:{' '}
              <span className="font-medium text-foreground">
                {form.languages.length} language{form.languages.length !== 1 ? 's' : ''} ×{' '}
                {form.markets.length} market{form.markets.length !== 1 ? 's' : ''}
              </span>
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              size="lg"
              loading={generatingPrompts}
              onClick={generatePrompts}
              disabled={form.languages.length === 0 || form.markets.length === 0}
              className="flex-1"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Generate Prompts
            </Button>
          </div>

          {prompts.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-bold text-muted-foreground">
                {prompts.length} prompts
              </h3>
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {prompts.slice(0, 10).map((p, i) => (
                  <div
                    key={i}
                    className="bg-secondary/50 flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground"
                  >
                    <Badge variant="default" size="sm">
                      {p.language}
                    </Badge>
                    <Badge variant="info" size="sm">
                      {p.market}
                    </Badge>
                    <span className="flex-1 truncate">{p.text}</span>
                  </div>
                ))}
                {prompts.length > 10 && (
                  <p className="text-xs text-muted-foreground">...and {prompts.length - 10} more</p>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Step 3: Configure */}
      {step === 3 && (
        <Card className="space-y-6 p-6">
          <div>
            <h2 className="text-xl font-black text-foreground">Configure Monitoring</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose which AI engines to monitor and how often.
            </p>
          </div>

          {/* Engines */}
          <div>
            <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-muted-foreground">
              AI Engines
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {ENGINES.map((engine) => (
                <label
                  key={engine.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition-all',
                    form.engines.includes(engine.id)
                      ? 'border-brand-500 bg-primary/10'
                      : 'bg-secondary/50 border-border hover:border-border',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={form.engines.includes(engine.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        set('engines', [...form.engines, engine.id])
                      } else {
                        set(
                          'engines',
                          form.engines.filter((x) => x !== engine.id),
                        )
                      }
                    }}
                    className="hidden"
                  />
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black"
                    style={{ background: `${engine.color}20`, color: engine.color }}
                  >
                    {engine.label.slice(0, 3).toUpperCase()}
                  </div>
                  <span className="font-medium text-foreground">{engine.label}</span>
                  {form.engines.includes(engine.id) && (
                    <Check className="text-brand-400 ml-auto h-4 w-4" />
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-muted-foreground">
              Scan Frequency
            </h3>
            <div className="flex gap-3">
              {['daily', 'weekly'].map((freq) => (
                <button
                  key={freq}
                  onClick={() => set('frequency', freq)}
                  className={cn(
                    'flex-1 rounded-xl border py-3 text-sm font-medium transition-all',
                    form.frequency === freq
                      ? 'border-brand-500 bg-primary/10 text-foreground'
                      : 'bg-secondary/50 border-border text-muted-foreground hover:border-border',
                  )}
                >
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Alert Email */}
          <div>
            <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-muted-foreground">
              Alert Email (optional)
            </h3>
            <input
              className="w-full rounded-xl border border-border px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              placeholder="your@email.com"
              value={form.alertEmail}
              onChange={(e) => set('alertEmail', e.target.value)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Get notified when your brand visibility changes significantly.
            </p>
          </div>
        </Card>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <Card className="space-y-6 p-6">
          <div>
            <h2 className="text-xl font-black text-foreground">Review & Launch</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ready to start monitoring?</p>
          </div>

          {/* Summary */}
          <div className="space-y-4">
            {/* Brand */}
            <div className="bg-secondary/50 flex items-center gap-4 rounded-xl border border-border p-4">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-xl font-black text-foreground"
                style={{ background: form.color }}
              >
                {form.name.charAt(0).toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-bold text-foreground">{form.name}</p>
                <p className="text-sm text-muted-foreground">
                  {form.industry || 'No industry'} {form.domain && `• ${form.domain}`}
                </p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-secondary/50 rounded-xl border border-border p-4 text-center">
                <p className="text-brand-400 text-2xl font-black">{prompts.length}</p>
                <p className="text-xs text-muted-foreground">Prompts</p>
              </div>
              <div className="bg-secondary/50 rounded-xl border border-border p-4 text-center">
                <p className="text-brand-400 text-2xl font-black">{form.engines.length}</p>
                <p className="text-xs text-muted-foreground">Engines</p>
              </div>
              <div className="bg-secondary/50 rounded-xl border border-border p-4 text-center">
                <p className="text-brand-400 text-2xl font-black capitalize">{form.frequency}</p>
                <p className="text-xs text-muted-foreground">Frequency</p>
              </div>
            </div>

            {/* Engines */}
            <div className="flex flex-wrap gap-2">
              {form.engines.map((e) => {
                const engine = ENGINES.find((x) => x.id === e)
                return (
                  <Badge key={e} variant="default">
                    <span
                      className="mr-1.5 h-2 w-2 rounded-full"
                      style={{ background: engine?.color }}
                    />
                    {engine?.label || e}
                  </Badge>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard/brands">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Cancel
          </Button>
        </Link>

        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          )}

          {step < 4 ? (
            <Button
              disabled={!canProceed()}
              onClick={() => {
                if (step === 2 && prompts.length === 0) {
                  generatePrompts()
                } else {
                  setStep(step + 1)
                }
              }}
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button loading={loading} onClick={handleSubmit}>
              <Building2 className="mr-2 h-4 w-4" />
              Start Monitoring
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
