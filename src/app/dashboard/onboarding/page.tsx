// PATH: src/app/dashboard/onboarding/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Globe,
  MessageSquare,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  Tag,
  Users,
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

interface PromptForm {
  text: string
  language: string
  engines: string[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const INDUSTRIES = [
  'Accounting & Finance',
  'Beauty & Wellness',
  'Construction',
  'Consulting',
  'E-commerce',
  'Education',
  'Healthcare',
  'Legal',
  'Marketing & Advertising',
  'Real Estate',
  'Restaurant & Food',
  'SaaS / Technology',
  'Travel & Hospitality',
  'Other',
]

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
  { id: 'welcome', icon: Sparkles, label: 'Welcome' },
  { id: 'brand', icon: Building2, label: 'Brand' },
  { id: 'prompts', icon: MessageSquare, label: 'Prompts' },
  { id: 'launch', icon: Rocket, label: 'Launch' },
]

// ─── Prompt Templates ────────────────────────────────────────────────────────

function generatePromptTemplates(
  brandName: string,
  industry: string,
  language: BrandLanguage,
): PromptForm[] {
  const templatesByLang: Record<BrandLanguage, PromptForm[]> = {
    sv: [
      {
        text: `Vilket är det bästa ${industry.toLowerCase()}-företaget?`,
        language: 'sv',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
      {
        text: `Kan du rekommendera ${brandName}?`,
        language: 'sv',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
      {
        text: `Vilka alternativ finns till ${brandName}?`,
        language: 'sv',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
      {
        text: `${brandName} omdömen och rykte`,
        language: 'sv',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
      {
        text: `Jämför ${brandName} med konkurrenter`,
        language: 'sv',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
    ],
    it: [
      {
        text: `Qual è la migliore azienda di ${industry.toLowerCase()}?`,
        language: 'it',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
      {
        text: `Puoi consigliare ${brandName}?`,
        language: 'it',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
      {
        text: `Quali alternative ci sono a ${brandName}?`,
        language: 'it',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
      {
        text: `${brandName} recensioni e reputazione`,
        language: 'it',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
      {
        text: `Confronta ${brandName} con i concorrenti`,
        language: 'it',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
    ],
    en: [
      {
        text: `What is the best ${industry.toLowerCase()} company?`,
        language: 'en',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
      {
        text: `Can you recommend ${brandName}?`,
        language: 'en',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
      {
        text: `What are alternatives to ${brandName}?`,
        language: 'en',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
      {
        text: `${brandName} reviews and reputation`,
        language: 'en',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
      {
        text: `Compare ${brandName} with competitors`,
        language: 'en',
        engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      },
    ],
  }
  return templatesByLang[language] || templatesByLang.en
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function OnboardingPage() {
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

  // ─── Step navigation ─────────────────────────────────────────────────────

  const canProceed = () => {
    if (step === 1) return brand.name.trim().length > 0 && brand.language.trim().length > 0
    if (step === 2) return prompts.length > 0
    return true
  }

  const goNext = () => {
    if (step === 1 && prompts.length === 0) {
      // Auto-generate prompts when leaving brand step
      setPrompts(
        generatePromptTemplates(brand.name, brand.industry || 'business', brand.language || 'en'),
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
          industry: brand.industry || undefined,
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
            // Non-fatal: brand & prompts are created, only first run failed
            toast.error(
              `Setup complete, but first monitoring run failed: ${mData.message || mRes.statusText}. You can retry from the brand page.`,
            )
          } else {
            toast.success(
              `🚀 Brand, ${createdPromptIds.length} prompts, and first monitoring run launched!`,
            )
          }
        } catch (mErr) {
          toast.error(
            `Setup complete, but first monitoring run failed: ${mErr instanceof Error ? mErr.message : 'network error'}. You can retry from the brand page.`,
          )
        }
      }

      setLaunchStage('done')
      setTimeout(() => router.push(`/dashboard/brands/${newBrandId}`), 1200)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Setup failed')
      setLaunchStage('idle')
    } finally {
      setLoading(false)
    }
  }

  const launchStageLabel = () => {
    switch (launchStage) {
      case 'brand':
        return 'Creating brand...'
      case 'prompts':
        return `Creating ${prompts.length} prompts...`
      case 'monitoring':
        return 'Launching first monitoring run...'
      case 'done':
        return 'Done! Redirecting...'
      default:
        return 'Launch Monitoring'
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
        language: 'en',
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
                  ? 'bg-primary text-foreground'
                  : i === step
                    ? 'bg-primary/20 ring-brand-500 text-primary ring-2'
                    : 'bg-secondary text-muted-foreground',
              )}
              onClick={() => i < step && setStep(i)}
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
          <h1 className="text-3xl font-black text-foreground">Welcome to AIO Pulse</h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Let&apos;s set up your first brand for AI visibility monitoring. This takes about 2
            minutes.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { icon: Building2, title: 'Add your brand', desc: 'Name, domain, competitors' },
              { icon: MessageSquare, title: 'Set up prompts', desc: 'What questions to monitor' },
              { icon: Zap, title: 'Start monitoring', desc: 'Track across AI engines' },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-border p-4 text-left">
                <item.icon className="mb-2 h-5 w-5 text-primary" />
                <p className="text-sm font-bold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
          <Button className="mt-8" size="lg" onClick={goNext}>
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>
      )}

      {/* Step 1: Brand Setup */}
      {step === 1 && (
        <Card className="p-8">
          <h2 className="text-2xl font-black text-foreground">Set up your brand</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tell us about the brand you want to monitor.
          </p>

          <div className="mt-6 space-y-5">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Brand Name <span className="text-red-400">*</span>
              </label>
              <input
                className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="e.g. Ekonomirådgivarna"
                value={brand.name}
                onChange={(e) => setBrand({ ...brand, name: e.target.value })}
              />
            </div>

            {/* Domain */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Website Domain
              </label>
              <input
                className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="e.g. ekonomiradgivarna.se"
                value={brand.domain}
                onChange={(e) => setBrand({ ...brand, domain: e.target.value })}
              />
            </div>

            {/* Industry */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Industry
              </label>
              <select
                className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                value={brand.industry}
                onChange={(e) => setBrand({ ...brand, industry: e.target.value })}
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Primary Market Language <span className="text-red-400">*</span>
              </label>
              <select
                className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                value={brand.language}
                onChange={(e) => setBrand({ ...brand, language: e.target.value as BrandLanguage })}
              >
                <option value="">Select language...</option>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <p className="bg-primary/10 mt-1.5 rounded-lg px-3 py-2 text-[11px] text-primary">
                Prompts and AI simulations will run in this language to reflect how your customers
                search.
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Description
              </label>
              <textarea
                className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="Brief description of what your brand does..."
                rows={2}
                value={brand.description}
                onChange={(e) => setBrand({ ...brand, description: e.target.value })}
              />
            </div>

            {/* Aliases & Competitors */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Aliases / Variants
                </label>
                <input
                  className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                  placeholder="e.g. ERG, Ekonomi AB"
                  value={brand.aliases}
                  onChange={(e) => setBrand({ ...brand, aliases: e.target.value })}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">Comma-separated</p>
              </div>
              <div>
                <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Competitors
                </label>
                <input
                  className="w-full rounded-xl border border-input bg-input px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-primary"
                  placeholder="e.g. Fortnox, Visma"
                  value={brand.competitors}
                  onChange={(e) => setBrand({ ...brand, competitors: e.target.value })}
                />
                <p className="mt-1 text-[10px] text-muted-foreground">Comma-separated</p>
              </div>
            </div>

            {/* Color */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Brand Color
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
          <h2 className="text-2xl font-black text-foreground">Monitoring Prompts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These are the questions we&apos;ll ask AI engines about your brand. We auto-generated
            some based on your brand — edit or add more.
          </p>

          <div className="mt-6 space-y-3">
            {prompts.map((p, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-border p-3">
                <MessageSquare className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-foreground">{p.text}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
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
                placeholder="Add a custom prompt..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomPrompt()}
              />
              <Button variant="secondary" onClick={addCustomPrompt} disabled={!customPrompt.trim()}>
                Add
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
          <h2 className="text-2xl font-black text-foreground">Ready to launch!</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            We&apos;ll create your brand and {prompts.length} monitoring prompts. You can always add
            more later.
          </p>

          {/* Summary */}
          <div className="mx-auto mt-6 max-w-sm space-y-3 text-left">
            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              <div className="h-8 w-8 rounded-lg" style={{ backgroundColor: brand.color }} />
              <div>
                <p className="text-sm font-bold text-foreground">{brand.name}</p>
                <p className="text-xs text-muted-foreground">
                  {brand.domain || 'No domain'} · {brand.industry || 'No industry'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              <MessageSquare className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">{prompts.length} monitoring prompts</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              <Zap className="h-5 w-5 text-amber-400" />
              <p className="text-sm text-muted-foreground">
                4 AI engines (ChatGPT, Gemini, Perplexity, Claude)
              </p>
            </div>
          </div>

          <Button className="mt-8" size="lg" loading={loading} onClick={handleLaunch}>
            <Rocket className="h-5 w-5" />
            {launchStageLabel()}
          </Button>
          {loading && launchStage !== 'idle' && (
            <p className="mt-3 text-xs text-muted-foreground">
              {launchStage === 'brand' && 'Step 1 of 3 · Brand'}
              {launchStage === 'prompts' && 'Step 2 of 3 · Prompts'}
              {launchStage === 'monitoring' && 'Step 3 of 3 · First AI check (may take 20-40s)'}
              {launchStage === 'done' && 'All set!'}
            </p>
          )}
        </Card>
      )}

      {/* Navigation */}
      {step > 0 && step < 3 && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={goNext} disabled={!canProceed()}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      {step === 3 && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" /> Go back and edit
          </Button>
        </div>
      )}
    </div>
  )
}
