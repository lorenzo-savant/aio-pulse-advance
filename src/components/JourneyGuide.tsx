'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Lightbulb, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

export interface JourneyStep {
  label: string
  description?: string
}

export interface JourneyGuideProps {
  step: number
  title: string
  lead: string
  steps: JourneyStep[]
  outcomes?: string[]
  cta?: { label: string; href: string }
  defaultCollapsed?: boolean
  persistKey?: string
}

export function JourneyGuide({
  step,
  title,
  lead,
  steps,
  outcomes,
  cta,
  defaultCollapsed = false,
  persistKey,
}: JourneyGuideProps) {
  const t = useTranslations('journey_guide')

  const initial = persistKey
    ? typeof window !== 'undefined' &&
      window.localStorage.getItem(`journey-guide-${persistKey}`) === 'collapsed'
    : defaultCollapsed
  const [collapsed, setCollapsed] = useState(initial)

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    if (persistKey && typeof window !== 'undefined') {
      window.localStorage.setItem(`journey-guide-${persistKey}`, next ? 'collapsed' : 'expanded')
    }
  }

  return (
    <div className="border-primary/20 from-primary/5 to-brand/5 mb-6 rounded-2xl border bg-gradient-to-br p-5">
      <button
        onClick={toggle}
        className="flex w-full items-start justify-between gap-4 text-left"
        aria-expanded={!collapsed}
      >
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-black text-white shadow-sm">
            {step}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                {t('step_prefix')} {step} · {t('guide_label')}
              </span>
            </div>
            <h2 className="mt-0.5 text-lg font-bold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{lead}</p>
          </div>
        </div>
        <span className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary">
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </span>
      </button>

      {!collapsed && (
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {t('what_to_do')}
            </p>
            <ol className="space-y-2">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span
                    className={cn(
                      'bg-primary/20 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-black text-primary',
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{s.label}</p>
                    {s.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {outcomes && outcomes.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {t('what_youll_get')}
              </p>
              <ul className="space-y-1.5">
                {outcomes.map((o, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!collapsed && cta && (
        <Link
          href={cta.href}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
        >
          {cta.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}
