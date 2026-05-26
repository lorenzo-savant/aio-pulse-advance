// PATH: src/app/dashboard/onboarding/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Building2,
  MessageSquare,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/index'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Types ───────────────────────────────────────────────────────────────────

type BrandLanguage = 'en' | 'it' | 'sv'

interface BrandForm {
  name: string
  domain: string
  description: string
  industry: string
  aliases: string
  competitors: string
  color: string
  language: BrandLanguage
}

type PromptDimension = 'presence' | 'citation' | 'comparison' | 'sentiment'

interface PromptForm {
  text: string
  language: string
  engines: string[]
  /** Which monitoring dimension this starter prompt probes (for the UI). */
  dimension?: PromptDimension
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Industries are loaded at runtime from /api/industries (the prompt-generator
// presets) so the list is LOCALIZED and the selected value is a preset id —
// no English label leaking into Swedish/Italian prompts.
interface IndustryOption {
  id: string
  name: { en: string; it: string; sv: string }
}

const LANGUAGES = [
  { value: 'en', label: '🇬🇧 English' },
  { value: 'it', label: '🇮🇹 Italiano' },
  { value: 'sv', label: '🇸🇪 Svenska' },
]

const ENGINES = [
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  },
  { id: 'gemini', label: 'Gemini', color: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
  {
    id: 'perplexity',
    label: 'Perplexity',
    color: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  },
  { id: 'claude', label: 'Claude', color: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
]

const BRAND_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6b7280',
]

const STEPS = [
  { id: 'welcome', icon: Sparkles, labelKey: 'onboarding.steps.welcome' },
  { id: 'brand', icon: Building2, labelKey: 'onboarding.steps.brand' },
  { id: 'prompts', icon: MessageSquare, labelKey: 'onboarding.steps.prompts' },
  { id: 'launch', icon: Rocket, labelKey: 'onboarding.steps.launch' },
]

// ─── Prompt Templates ────────────────────────────────────────────────────────

// A deliberately SMALL, purpose-built starter set — not a flood of generic
// prompts. Six prompts that, together, give the first read on the three
// monitoring dimensions for THIS brand, using its real competitor + market:
//   • PRESENCE  — does the AI know the brand at all?
//   • CITATION  — is the brand named when the category/market is asked?
//   • SENTIMENT — how is the brand spoken about (reviews, recommendation, vs)?
const ALL_ENGINES: PromptForm['engines'] = ['chatgpt', 'gemini', 'perplexity', 'claude']

function generatePromptTemplates(
  brandName: string,
  industry: string,
  language: BrandLanguage,
  competitors: string[] = [],
): PromptForm[] {
  const ind = (industry || 'business').toLowerCase()
  // Light market hint from the language so category/citation prompts are local.
  const place = language === 'sv' ? 'Sverige' : language === 'it' ? 'Italia' : ''
  const inPlace = { sv: ` i ${place}`, it: ` in ${place}`, en: '' }[language]

  const mk = (text: string, dimension: PromptDimension): PromptForm => ({
    text,
    language,
    engines: ALL_ENGINES,
    dimension,
  })
  // Head-to-head comparison prompts against the real competitors — capped at
  // the top 2 so the starter set stays focused. Falls back to a generic
  // "vs competitors" prompt only when none were provided.
  const topCompetitors = competitors
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 2)

  if (language === 'sv') {
    const vs =
      topCompetitors.length > 0
        ? topCompetitors.map((c) => mk(`${brandName} eller ${c} – vilket är bäst?`, 'comparison'))
        : [mk(`Jämför ${brandName} med konkurrenter`, 'comparison')]
    return [
      mk(`Vad är ${brandName}?`, 'presence'),
      mk(`Bästa företagen inom ${ind}${inPlace}?`, 'citation'),
      ...vs,
      mk(`${brandName} omdömen och rykte`, 'sentiment'),
      mk(`Bästa alternativen till ${brandName}`, 'citation'),
      mk(`Kan du rekommendera ${brandName}${inPlace}?`, 'sentiment'),
    ]
  }
  if (language === 'it') {
    const vs =
      topCompetitors.length > 0
        ? topCompetitors.map((c) => mk(`${brandName} o ${c}: qual è meglio?`, 'comparison'))
        : [mk(`Confronta ${brandName} con i concorrenti`, 'comparison')]
    return [
      mk(`Cos'è ${brandName}?`, 'presence'),
      mk(`Migliori aziende di ${ind}${inPlace}?`, 'citation'),
      ...vs,
      mk(`${brandName} recensioni e reputazione`, 'sentiment'),
      mk(`Migliori alternative a ${brandName}`, 'citation'),
      mk(`Puoi consigliare ${brandName}${inPlace}?`, 'sentiment'),
    ]
  }
  const vs =
    topCompetitors.length > 0
      ? topCompetitors.map((c) => mk(`${brandName} vs ${c} — which is better?`, 'comparison'))
      : [mk(`Compare ${brandName} with competitors`, 'comparison')]
  return [
    mk(`What is ${brandName}?`, 'presence'),
    mk(`Best ${ind} companies${inPlace}?`, 'citation'),
    ...vs,
    mk(`${brandName} reviews and reputation`, 'sentiment'),
    mk(`Best alternatives to ${brandName}`, 'citation'),
    mk(`Can you recommend ${brandName}${inPlace}?`, 'sentiment'),
  ]
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const t = useTranslations()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)

  // Brand form
  const [brand, setBrand] = useState<BrandForm>({
    name: '',
    domain: '',
    description: '',
    industry: '',
    aliases: '',
    competitors: '',
    color: '#6366f1',
    language: 'en',
  })

  // Prompts
  const [prompts, setPrompts] = useState<PromptForm[]>([])
  const [customPrompt, setCustomPrompt] = useState('')

  // Created IDs
  const [brandId, setBrandId] = useState<string | null>(null)

  // Localized industry presets for the dropdown.
  const [industries, setIndustries] = useState<IndustryOption[]>([])
  useEffect(() => {
    fetch('/api/industries')
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.data)) setIndustries(j.data as IndustryOption[])
      })
      .catch(() => {})
  }, [])

  // The selected preset, and a short localized noun for the category prompt
  // (primary term before any "&"/"och", e.g. "Marknadsföring & Reklam" →
  // "marknadsföring"). Falls back to a generic word so prompts never show a
  // raw preset id.
  const selectedPreset = industries.find((i) => i.id === brand.industry)
  const industryNoun = (() => {
    const generic = { en: 'business', it: 'attività', sv: 'verksamhet' }[brand.language]
    if (!selectedPreset) return generic
    const name = selectedPreset.name[brand.language] ?? selectedPreset.name.en
    return name.split(/\s+(?:&|och|e)\s+/i)[0]!.toLowerCase()
  })()

  // ─── Step navigation ─────────────────────────────────────────────────────

  const canProceed = () => {
    if (step === 1)
      // Name + language + domain + industry + competitors are the fundamentals:
      // domain drives site scraping/grounding, industry selects the prompt
      // preset, competitors power comparison ("vs") prompts + positioning.
      return (
        brand.name.trim().length > 0 &&
        brand.language.trim().length > 0 &&
        brand.domain.trim().length > 0 &&
        brand.industry.trim().length > 0 &&
        brand.competitors.trim().length > 0
      )
    if (step === 2) return prompts.length > 0
    return true
  }

  const goNext = () => {
    if (step === 1 && prompts.length === 0) {
      // Auto-generate the focused starter set, using the real competitors so
      // the comparison prompts are head-to-head against actual rivals.
      const competitorList = brand.competitors
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      setPrompts(
        generatePromptTemplates(brand.name, industryNoun, brand.language || 'en', competitorList),
      )
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const goBack = () => setStep((s) => Math.max(s - 1, 0))

  // ─── Create brand + prompts + first monitoring run ────────────────────────

  const [launchStage, setLaunchStage] = useState<
    'idle' | 'brand' | 'prompts' | 'monitoring' | 'done'
  >('idle')

  const handleLaunch = async () => {
    setLoading(true)
    try {
      // ── 1. Create brand ──────────────────────────────────────────────────
      setLaunchStage('brand')
      const brandRes = await fetch('/api/brands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: brand.name,
          domain: brand.domain || undefined,
          description: brand.description || undefined,
          industry: selectedPreset?.name.en || undefined,
          aliases: brand.aliases
            ? brand.aliases
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          competitors: brand.competitors
            ? brand.competitors
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
          color: brand.color,
          language: brand.language,
        }),
      })

      const brandData = await brandRes.json()
      const newBrandId = brandData.data?.id || brandData.id
      if (!brandRes.ok || !newBrandId) {
        throw new Error(brandData.message || 'Failed to create brand')
      }
      setBrandId(newBrandId)

      // ── 2. Create prompts (fail-fast on first error) ─────────────────────
      setLaunchStage('prompts')
      const createdPromptIds: string[] = []
      for (const [idx, p] of prompts.entries()) {
        const pRes = await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brand_id: newBrandId,
            text: p.text,
            language: p.language,
            engines: p.engines,
            run_frequency: 'daily',
          }),
        })
        const pData = await pRes.json()
        const newPromptId = pData.data?.id || pData.id
        if (!pRes.ok || !newPromptId) {
          throw new Error(
            `Failed to create prompt ${idx + 1}/${prompts.length}: ${pData.message || 'unknown error'}`,
          )
        }
        createdPromptIds.push(newPromptId)
      }

      // ── 3. Launch first monitoring run (best-effort — don't block) ───────
      setLaunchStage('monitoring')
      const firstPromptId = createdPromptIds[0]
      if (firstPromptId) {
        try {
          const mRes = await fetch('/api/monitoring', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt_id: firstPromptId }),
          })
          const mData = await mRes.json().catch(() => ({}))
          if (!mRes.ok) {
            toast.error(
              t('onboarding.toast.monitoring_setup_complete', {
                error: mData.message || mRes.statusText,
              }),
            )
          } else {
            toast.success(t('onboarding.toast.launch_success', { count: createdPromptIds.length }))
          }
        } catch (mErr) {
          toast.error(
            t('onboarding.toast.monitoring_setup_complete', {
              error: mErr instanceof Error ? mErr.message : 'network error',
            }),
          )
        }
      }

      setLaunchStage('done')
      setTimeout(() => router.push(`/dashboard/brands/${newBrandId}`), 1200)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('onboarding.toast.setup_failed'))
      setLaunchStage('idle')
    } finally {
      setLoading(false)
    }
  }

  const launchStageLabel = () => {
    switch (launchStage) {
      case 'brand':
        return t('onboarding.launch_stages.creating_brand')
      case 'prompts':
        return t('onboarding.launch_stages.creating_prompts', { count: prompts.length })
      case 'monitoring':
        return t('onboarding.launch_stages.launching_monitoring')
      case 'done':
        return t('onboarding.launch_stages.done_redirecting')
      default:
        return t('onboarding.launch_stages.launch_button')
    }
  }

  // ─── Remove prompt ───────────────────────────────────────────────────────

  const removePrompt = (idx: number) => {
    setPrompts((p) => p.filter((_, i) => i !== idx))
  }

  const addCustomPrompt = () => {
    if (!customPrompt.trim()) return
    setPrompts((p) => [
      ...p,
      {
        text: customPrompt.trim(),
        language: brand.language || 'en',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
    ])
    setCustomPrompt('')
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8">
      {/* Progress */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl transition-all',
                i < step
                  ? 'bg-brand-hover text-brand-foreground'
                  : i === step
                    ? 'bg-primary/20 ring-brand-500 text-primary ring-2'
                    : 'bg-secondary text-muted-foreground',
              )}
              onClick={() => i < step && setStep(i)}
              title={t(s.labelKey)}
            >
              {i < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
            </button>
            {i < STEPS.length - 1 && (
              <div className={cn('h-0.5 w-8 rounded', i < step ? 'bg-primary' : 'bg-secondary')} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Welcome */}
      {step === 0 && (
        <Card className="p-8 text-center">
          <div className="bg-primary/20 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-3xl font-black text-foreground">
            {t('onboarding.welcome_screen.title')}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            {t('onboarding.welcome_screen.subtitle')}
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                icon: Building2,
                titleKey: 'onboarding.welcome_screen.add_brand',
                descKey: 'onboarding.welcome_screen.add_brand_desc',
              },
              {
                icon: MessageSquare,
                titleKey: 'onboarding.welcome_screen.set_up_prompts',
                descKey: 'onboarding.welcome_screen.set_up_prompts_desc',
              },
              {
                icon: Zap,
                titleKey: 'onboarding.welcome_screen.start_monitoring',
                descKey: 'onboarding.welcome_screen.start_monitoring_desc',
              },
            ].map((item) => (
              <div key={item.titleKey} className="rounded-xl border border-border p-4 text-left">
                <item.icon className="mb-2 h-5 w-5 text-primary" />
                <p className="text-sm font-bold text-foreground">{t(item.titleKey)}</p>
                <p className="text-xs text-muted-foreground">{t(item.descKey)}</p>
              </div>
            ))}
          </div>
          <Button className="mt-8" size="lg" onClick={goNext}>
            {t('onboarding.welcome_screen.get_started')} <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>
      )}

      {/* Step 1: Brand Setup */}
      {step === 1 && (
        <Card className="p-8">
          <h2 className="text-2xl font-black text-foreground">
            {t('onboarding.brand_form.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('onboarding.brand_form.subtitle')}
          </p>

          <div className="mt-6 space-y-5">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t('onboarding.brand_form.name_label')} <span className="text-red-400">*</span>
              </label>
              <input
                className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder={t('onboarding.brand_form.name_placeholder')}
                value={brand.name}
                onChange={(e) => setBrand({ ...brand, name: e.target.value })}
              />
            </div>

            {/* Domain */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t('onboarding.brand_form.domain_label')} <span className="text-red-400">*</span>
              </label>
              <input
                className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder={t('onboarding.brand_form.domain_placeholder')}
                value={brand.domain}
                onChange={(e) => setBrand({ ...brand, domain: e.target.value })}
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                {t('onboarding.brand_form.domain_helper')}
              </p>
            </div>

            {/* Industry */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t('onboarding.brand_form.industry_label')} <span className="text-red-400">*</span>
              </label>
              <select
                className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                value={brand.industry}
                onChange={(e) => setBrand({ ...brand, industry: e.target.value })}
              >
                <option value="">{t('onboarding.brand_form.industry_placeholder')}</option>
                {industries.map((ind) => (
                  <option key={ind.id} value={ind.id}>
                    {ind.name[brand.language] ?? ind.name.en}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {t('onboarding.brand_form.industry_helper')}
              </p>
            </div>

            {/* Language */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t('onboarding.brand_form.language_label')} <span className="text-red-400">*</span>
              </label>
              <select
                className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                value={brand.language}
                onChange={(e) => setBrand({ ...brand, language: e.target.value as BrandLanguage })}
              >
                <option value="">{t('onboarding.brand_form.language_placeholder')}</option>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <p className="bg-primary/10 mt-1.5 rounded-lg px-3 py-2 text-[11px] text-primary">
                {t('onboarding.brand_form.language_helper')}
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t('onboarding.brand_form.description_label')}
              </label>
              <textarea
                className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder={t('onboarding.brand_form.description_placeholder')}
                rows={2}
                value={brand.description}
                onChange={(e) => setBrand({ ...brand, description: e.target.value })}
              />
            </div>

            {/* Aliases & Competitors */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {t('onboarding.brand_form.aliases_label')}
                </label>
                <input
                  className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder={t('onboarding.brand_form.aliases_placeholder')}
                  value={brand.aliases}
                  onChange={(e) => setBrand({ ...brand, aliases: e.target.value })}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {t('onboarding.brand_form.aliases_helper')}
                </p>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {t('onboarding.brand_form.competitors_label')}{' '}
                  <span className="text-red-400">*</span>
                </label>
                <input
                  className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder={t('onboarding.brand_form.competitors_placeholder')}
                  value={brand.competitors}
                  onChange={(e) => setBrand({ ...brand, competitors: e.target.value })}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {t('onboarding.brand_form.competitors_helper')}
                </p>
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t('onboarding.brand_form.color_label')}
              </label>
              <div className="flex flex-wrap gap-2">
                {BRAND_COLORS.map((c) => (
                  <button
                    key={c}
                    className={cn(
                      'h-8 w-8 rounded-lg transition-all',
                      brand.color === c
                        ? 'ring-offset-background900 ring-2 ring-white ring-offset-2'
                        : 'opacity-60 hover:opacity-100',
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setBrand({ ...brand, color: c })}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Prompts */}
      {step === 2 && (
        <Card className="p-8">
          <h2 className="text-2xl font-black text-foreground">
            {t('onboarding.prompts_form.title')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('onboarding.prompts_form.subtitle')}
          </p>

          <div className="mt-6 space-y-3">
            {prompts.map((p, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-border p-3">
                <MessageSquare className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-foreground">{p.text}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.dimension && (
                      <Badge variant="brand" size="sm">
                        {t(`onboarding.dimensions.${p.dimension}`)}
                      </Badge>
                    )}
                    {p.engines.map((e) => (
                      <Badge key={e} variant="default" size="sm">
                        {e}
                      </Badge>
                    ))}
                    <Badge variant="info" size="sm">
                      {p.language}
                    </Badge>
                  </div>
                </div>
                <button
                  className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-red-400"
                  onClick={() => removePrompt(i)}
                >
                  ×
                </button>
              </div>
            ))}

            {/* Add custom prompt */}
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                placeholder={t('onboarding.prompts_form.add_custom_placeholder')}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomPrompt()}
              />
              <Button variant="secondary" onClick={addCustomPrompt} disabled={!customPrompt.trim()}>
                {t('onboarding.prompts_form.add_button')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: Launch */}
      {step === 3 && (
        <Card className="p-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-600/20">
            <Rocket className="h-10 w-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-black text-foreground">
            {t('onboarding.launch_screen.title')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            {t('onboarding.launch_screen.subtitle', { count: prompts.length })}
          </p>

          {/* Summary */}
          <div className="mx-auto mt-6 max-w-sm space-y-3 text-left">
            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: brand.color }} />
              <div>
                <p className="text-sm font-bold text-foreground">{brand.name}</p>
                <p className="text-xs text-muted-foreground">
                  {brand.domain || t('onboarding.launch_screen.no_domain')} ·{' '}
                  {brand.industry || t('onboarding.launch_screen.no_industry')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              <MessageSquare className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">
                {prompts.length} {t('onboarding.launch_screen.monitoring_prompts')}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              <Zap className="h-5 w-5 text-amber-400" />
              <p className="text-sm text-muted-foreground">
                {t('onboarding.launch_screen.ai_engines')}
              </p>
            </div>
          </div>

          <Button className="mt-8" size="lg" loading={loading} onClick={handleLaunch}>
            <Rocket className="h-5 w-5" />
            {launchStageLabel()}
          </Button>
          {loading && launchStage !== 'idle' && (
            <p className="mt-3 text-xs text-muted-foreground">
              {launchStage === 'brand' && t('onboarding.launch_progress.step1_brand')}
              {launchStage === 'prompts' && t('onboarding.launch_progress.step2_prompts')}
              {launchStage === 'monitoring' && t('onboarding.launch_progress.step3_check')}
              {launchStage === 'done' && t('onboarding.launch_progress.all_set')}
            </p>
          )}
        </Card>
      )}

      {/* Navigation */}
      {step > 0 && step < 3 && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" /> {t('onboarding.buttons.back')}
          </Button>
          <Button onClick={goNext} disabled={!canProceed()}>
            {t('onboarding.buttons.continue')} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      {step === 3 && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" /> {t('onboarding.launch_screen.go_back_edit')}
          </Button>
        </div>
      )}
    </div>
  )
}
