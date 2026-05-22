'use client'

// Collapsible "how to read this section" panel. Mount near a page header:
//   <SectionHelp section="geo-score" />
// Content + the explanatory metric table come from src/lib/data/section-help.ts
// and render in the active locale (en/it/sv). Renders nothing for unknown keys.

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { SECTION_HELP, type HelpLocale } from '@/lib/data/section-help'

interface UiLabels {
  toggle: string
  whatItIs: string
  why: string
  inputs: string
  outputs: string
  metric: string
  meaning: string
  how: string
  range: string
}

const UI: Record<HelpLocale, UiLabels> = {
  en: {
    toggle: 'How to read this section',
    whatItIs: 'What it is',
    why: 'Why it matters',
    inputs: 'Data in',
    outputs: 'What you get',
    metric: 'Metric',
    meaning: 'Meaning',
    how: 'How it’s measured',
    range: 'Range / how to read',
  },
  it: {
    toggle: 'Come leggere questa sezione',
    whatItIs: 'Cos’è',
    why: 'Perché conta',
    inputs: 'Dati in ingresso',
    outputs: 'Cosa ottieni',
    metric: 'Metrica',
    meaning: 'Significato',
    how: 'Come si misura',
    range: 'Intervallo / come leggere',
  },
  sv: {
    toggle: 'Så läser du den här sektionen',
    whatItIs: 'Vad det är',
    why: 'Varför det spelar roll',
    inputs: 'Indata',
    outputs: 'Vad du får',
    metric: 'Mått',
    meaning: 'Betydelse',
    how: 'Hur det mäts',
    range: 'Intervall / hur du läser',
  },
}

export function SectionHelp({ section }: { section: string }) {
  const [open, setOpen] = useState(false)
  const locale = useLocale()
  const lang: HelpLocale = locale === 'it' || locale === 'sv' ? locale : 'en'

  const entry = SECTION_HELP[section]
  if (!entry) return null

  const c = entry[lang]
  const t = UI[lang]

  return (
    <div className="bg-card/50 mb-6 rounded-2xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-bold text-foreground"
      >
        <HelpCircle className="h-4 w-4 text-primary" />
        {t.toggle}
        {open ? (
          <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4 text-sm">
          <p className="text-muted-foreground">
            <span className="font-bold text-foreground">{t.whatItIs}: </span>
            {c.whatItIs}
          </p>
          <p className="text-muted-foreground">
            <span className="font-bold text-foreground">{t.why}: </span>
            {c.why}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-muted/30 rounded-xl border border-border p-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t.inputs}
              </p>
              <p className="text-muted-foreground">{c.inputs}</p>
            </div>
            <div className="bg-muted/30 rounded-xl border border-border p-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {t.outputs}
              </p>
              <p className="text-muted-foreground">{c.outputs}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-2 pr-3 font-bold">{t.metric}</th>
                  <th className="py-2 pr-3 font-bold">{t.meaning}</th>
                  <th className="py-2 pr-3 font-bold">{t.how}</th>
                  <th className="py-2 font-bold">{t.range}</th>
                </tr>
              </thead>
              <tbody>
                {c.metrics.map((m) => (
                  <tr key={m.metric} className="border-border/50 border-b align-top">
                    <td className="py-2 pr-3 font-semibold text-foreground">{m.metric}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{m.meaning}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{m.howMeasured}</td>
                    <td className="py-2 text-muted-foreground">{m.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
