// PATH: src/app/dashboard/ai-funnel/page.tsx
'use client'

// AI Funnel unified report.
//
// Closes the gap from the Earned Media Australia agency case study:
//   "Tracking the AI funnel with industry research, the team breaks it down into
//    three levels:
//      Top of the Funnel: high-level metrics like AI Visibility,
//        Mentions, and Citations.
//      Visual Proof: screenshots of LLM responses where the brand is
//        recommended right in the response.
//      Bottom of the Funnel: AI Referral Traffic data — clicks and
//        conversions from platforms like ChatGPT and Perplexity."
//
// We already have all the pieces — they were just scattered across
// /dashboard/{overview,citation-sources,competitor,sentiment,…}. This
// page brings them into one stacked report ready to share with a
// client or stakeholder. All panels are self-contained, so this page
// is mostly composition.

import { useEffect, useState } from 'react'
import { Filter, ChevronDown, Download } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { ShareOfVoiceByEnginePanel } from '@/components/ShareOfVoiceByEnginePanel'
import { VisualProofPanel } from '@/components/VisualProofPanel'
import { SourceOpportunitiesPanel } from '@/components/SourceOpportunitiesPanel'
import { BrandedSearchPanel } from '@/components/BrandedSearchPanel'
import { CitationFreshnessPanel } from '@/components/CitationFreshnessPanel'
import { BrandAnnotationsPanel } from '@/components/BrandAnnotationsPanel'
import { AISeoReadinessPanel } from '@/components/AISeoReadinessPanel'
import { ClaimDivergencePanel } from '@/components/ClaimDivergencePanel'
import { BrandFactsPanel } from '@/components/BrandFactsPanel'
import { AIReferralFiltersPanel } from '@/components/AIReferralFiltersPanel'
import { AIBotLogsPanel } from '@/components/AIBotLogsPanel'
import { CitationSourceCategoriesPanel } from '@/components/CitationSourceCategoriesPanel'
import { EditorialOutletsPanel } from '@/components/EditorialOutletsPanel'
import { FirstPartyCitationsPanel } from '@/components/FirstPartyCitationsPanel'
import { AudienceDeclarationPanel } from '@/components/AudienceDeclarationPanel'

interface BrandLite {
  id: string
  name: string
}

interface SectionHeadingProps {
  step: number
  title: string
  subtitle: string
}

function SectionHeading({ step, title, subtitle }: SectionHeadingProps) {
  return (
    <div className="mb-4 flex items-start gap-4">
      <div className="bg-brand/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-black text-brand">
        {step}
      </div>
      <div>
        <h2 className="text-xl font-black tracking-tight text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  )
}

export default function AiFunnelPage() {
  const [brands, setBrands] = useState<BrandLite[]>([])
  const [activeBrandId, setActiveBrandId] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/brands')
      .then((r) => r.json() as Promise<{ data?: BrandLite[] }>)
      .then((j) => {
        if (cancelled) return
        const list = j.data ?? []
        setBrands(list)
        if (list[0]) setActiveBrandId(list[0].id)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="animate-in space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight text-foreground">
            <Filter className="h-7 w-7 text-brand" />
            AI Funnel
          </h1>
          <p className="mt-1 max-w-3xl text-muted-foreground">
            One stacked report for the full AI-visibility journey: high-level visibility at the top,
            the responses naming your brand in the middle, and the branded-search +
            citation-freshness signals at the bottom. Built for client reporting — every section is
            a screenshot away from a deck.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {brands.length > 1 && (
            <>
              <label
                htmlFor="brand-select"
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Brand
              </label>
              <div className="relative">
                <select
                  id="brand-select"
                  value={activeBrandId}
                  onChange={(e) => setActiveBrandId(e.target.value)}
                  className="appearance-none rounded-md border border-border bg-background px-3 py-2 pr-8 text-sm text-foreground focus:border-primary focus:outline-none"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </>
          )}
          {activeBrandId && (
            <>
              <a
                href={`/api/reports/exec-summary?brand_id=${activeBrandId}&days=30&format=md`}
                className="hover:bg-secondary/70 inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground transition-colors"
                title="Download the executive 4-question summary as Markdown"
              >
                <Download className="h-3.5 w-3.5" />
                Exec summary
              </a>
              <a
                href={`/api/reports/exec-summary?brand_id=${activeBrandId}&days=30&format=tiered`}
                className="hover:bg-secondary/70 inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground transition-colors"
                title="Tier 1 / Tier 2 / Tier 3 client deck (industry template framing)"
              >
                <Download className="h-3.5 w-3.5" />
                Tiered KPI deck
              </a>
              <a
                href={`/api/reports/exec-summary?brand_id=${activeBrandId}&format=trend&months=6`}
                className="hover:bg-secondary/70 inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground transition-colors"
                title="6-month trend of mention rate, sentiment, and branded search"
              >
                <Download className="h-3.5 w-3.5" />
                6-mo trend
              </a>
            </>
          )}
        </div>
      </div>

      {/* AI SEO 2026 readiness hero — aggregates every other signal below
          into a single A-F grade so the operator can lead the deck with
          "where do we stand?" before walking through the funnel. */}
      <AISeoReadinessPanel brandId={activeBrandId || undefined} />

      {/* ── 1. Top of funnel — visibility ──────────────────────────────── */}
      <section>
        <SectionHeading
          step={1}
          title="Top of funnel — Visibility"
          subtitle="Where you show up across AI engines and how your share of voice compares to competitors. The headline metric that gets the conversation started."
        />
        <div className="space-y-6">
          <ShareOfVoiceByEnginePanel brandId={activeBrandId || undefined} />
          <SourceOpportunitiesPanel brandId={activeBrandId || undefined} />
          <CitationSourceCategoriesPanel brandId={activeBrandId || undefined} />
          <EditorialOutletsPanel brandId={activeBrandId || undefined} />
          <FirstPartyCitationsPanel brandId={activeBrandId || undefined} />
          <AudienceDeclarationPanel brandId={activeBrandId || undefined} />
        </div>
      </section>

      {/* ── 2. Visual proof — the actual responses ─────────────────────── */}
      <section>
        <SectionHeading
          step={2}
          title="Visual proof — Real AI responses"
          subtitle="The latest answers where your brand is named, with the response text highlighted. Drop these into the deck — they make abstract metrics concrete."
        />
        <div className="space-y-6">
          <VisualProofPanel brandId={activeBrandId || undefined} />
          <BrandFactsPanel brandId={activeBrandId || undefined} />
          <ClaimDivergencePanel brandId={activeBrandId || undefined} />
        </div>
      </section>

      {/* ── 3. Bottom of funnel — downstream behaviour ─────────────────── */}
      <section>
        <SectionHeading
          step={3}
          title="Bottom of funnel — Downstream signal"
          subtitle="Branded search growth + the AI-assist verdict (is AI exposure driving direct searches for you, or just cannibalising your top-of-funnel?) and citation freshness for the pages AI is actually pulling."
        />
        <div className="space-y-6">
          <BrandedSearchPanel brandId={activeBrandId || undefined} />
          <CitationFreshnessPanel brandId={activeBrandId || undefined} />
          <AIReferralFiltersPanel />
          <AIBotLogsPanel />
        </div>
      </section>

      {/* Annotations live below the funnel so they apply to every section
          above. The exec summary export already includes the data the
          annotations help contextualise. */}
      <BrandAnnotationsPanel brandId={activeBrandId || undefined} />

      <Card className="p-4 text-xs text-muted-foreground">
        Want a different section order or extra widgets in the report? This page is composed of
        self-contained panels from the rest of the dashboard — adding or moving a section is just a
        JSX line change.
      </Card>
    </div>
  )
}
