'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Lightbulb, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface JourneyStep {
  label: string
  description?: string
}

export interface JourneyGuideProps {
  /** Step number in the overall journey (1-5), shown as a pill. */
  step: number
  /** Short title, e.g. "Set up your brand" */
  title: string
  /** One-line description of what this page is for */
  lead: string
  /** Concrete numbered actions the user should take here */
  steps: JourneyStep[]
  /** Optional "What you'll get" list — expected outcomes */
  outcomes?: string[]
  /** Optional call-to-action link shown at the bottom */
  cta?: { label: string; href: string }
  /** If true, start collapsed. Default false (open on first visit). */
  defaultCollapsed?: boolean
  /** localStorage key for persisting collapsed state per-page */
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
  const initial = persistKey
    ? typeof window !== 'undefined' &&
      window.localStorage.getItem(`journey-guide-${persistKey}`) === 'collapsed'
    : defaultCollapsed
  const [collapsed, setCollapsed] = useState(initial)

  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    if (persistKey && typeof window !== 'undefined') {
      window.localStorage.setItem(
        `journey-guide-${persistKey}`,
        next ? 'collapsed' : 'expanded',
      )
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-brand/5 p-5">
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
                Step {step} · Guide
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
              What to do
            </p>
            <ol className="space-y-2">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary/20 text-[10px] font-black text-primary',
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
                What you&apos;ll get
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
