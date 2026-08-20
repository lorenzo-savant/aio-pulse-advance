'use client'

// PATH: src/app/dashboard/brands/[id]/report/page.tsx
//
// Brand Report — one auto-generated, top-to-bottom presentation of everything
// the platform holds on a brand: facts & provenance, visibility, share of
// voice, citations & their sources, AI-crawler access (bots), sentiment,
// homonym confusion, searches, audits, errors and recommendations.
//
// It writes nothing by hand: it composes the SAME section panels the dashboard
// already renders (each self-fetches for this brand via its `brandId` prop), so
// what you see here is identical to the live pages. Every section starts on a
// new sheet (`break-before-page`), and the floating "Scarica PDF" (dashboard
// layout) prints the whole thing into one faithful multi-page report — charts,
// cards and comparisons included.
//
// NOTE: strings are intentionally inline (not i18n) so the report is
// self-contained — it does not depend on translation keys landing elsewhere.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { BrandFactsPanel } from '@/components/BrandFactsPanel'
import { ShareOfVoiceByEnginePanel } from '@/components/ShareOfVoiceByEnginePanel'
import { EngineFormatAffinityPanel } from '@/components/EngineFormatAffinityPanel'
import { SentimentDriversPanel } from '@/components/SentimentDriversPanel'
import { CitationSourceCategoriesPanel } from '@/components/CitationSourceCategoriesPanel'
import { FirstPartyCitationsPanel } from '@/components/FirstPartyCitationsPanel'
import { CitationFreshnessPanel } from '@/components/CitationFreshnessPanel'
import { CrawlerAccessPanel } from '@/components/CrawlerAccessPanel'
import { HomonymAuditPanel } from '@/components/HomonymAuditPanel'
import { PromptPortfolioPanel } from '@/components/PromptPortfolioPanel'
import { SiteAuditFoundationsCard } from '@/components/SiteAuditFoundationsCard'
import { AISeoReadinessPanel } from '@/components/AISeoReadinessPanel'
import { BusinessDriversPanel } from '@/components/BusinessDriversPanel'
import { AudienceDeclarationPanel } from '@/components/AudienceDeclarationPanel'
import { BrandedSearchPanel } from '@/components/BrandedSearchPanel'
import { CitedVsRankingPanel } from '@/components/CitedVsRankingPanel'
import { ClaimDivergencePanel } from '@/components/ClaimDivergencePanel'
import { CompetitorSentimentPanel } from '@/components/CompetitorSentimentPanel'
import { EditorialOutletsPanel } from '@/components/EditorialOutletsPanel'
import { SourceOpportunitiesPanel } from '@/components/SourceOpportunitiesPanel'
import { StrikingDistancePanel } from '@/components/StrikingDistancePanel'
import { CannibalizationPanel } from '@/components/CannibalizationPanel'
import { VisualProofPanel } from '@/components/VisualProofPanel'
import type { Brand } from '@/types'

/** A titled report block that always starts on a fresh printed sheet. */
function ReportSection({
  n,
  title,
  provenance,
  children,
}: {
  n: number
  title: string
  /** Where this section's data comes from — shown so the report is auditable. */
  provenance: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-10 break-before-page first:mt-0 first:break-before-avoid">
      <div className="mb-4 border-b border-border pb-3">
        <h2 className="text-2xl font-black tracking-tight text-foreground">
          <span className="text-brand">{String(n).padStart(2, '0')}</span> · {title}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">Fonte dati: {provenance}</p>
      </div>
      {children}
    </section>
  )
}

export default function BrandReportPage() {
  const params = useParams<{ id: string }>()
  const brandId = params?.id ?? ''
  const [brand, setBrand] = useState<Brand | null>(null)

  useEffect(() => {
    if (!brandId) return
    let cancelled = false
    fetch(`/api/brands/${brandId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j?.success) setBrand((j.data ?? j.brand) as Brand)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [brandId])

  const today = new Intl.DateTimeFormat('it-IT', { dateStyle: 'long' }).format(new Date())

  return (
    <div id="brand-report" className="animate-in space-y-6 pb-16">
      {/* ── Cover ─────────────────────────────────────────────────────────── */}
      <Card className="border-l-4 border-l-brand p-8">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Report di visibilità AI
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-foreground">
          {brand?.name ?? 'Brand'}
        </h1>
        {brand?.domain && <p className="mt-1 text-muted-foreground">{brand.domain}</p>}
        <p className="mt-4 text-sm text-muted-foreground">
          Generato il {today}. Ogni sezione riproduce, identico, un dato già misurato dalla
          piattaforma — con la fonte da cui proviene. Usa <strong>Scarica PDF</strong> per esportare
          l&apos;intero report.
        </p>
      </Card>

      <ReportSection
        n={1}
        title="Identità & fatti del brand"
        provenance="tabella brands + arricchimento LLMO"
      >
        <BrandFactsPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={2}
        title="Share of Voice per motore"
        provenance="monitoring_results (menzioni brand vs competitor)"
      >
        <ShareOfVoiceByEnginePanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={3}
        title="Affinità di formato per motore"
        provenance="citazioni del dominio + risposte dei motori"
      >
        <EngineFormatAffinityPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={4}
        title="Driver del sentiment"
        provenance="analisi sentiment delle risposte dei motori"
      >
        <SentimentDriversPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={5}
        title="Fonti delle citazioni"
        provenance="cited_urls delle risposte, categorizzate"
      >
        <CitationSourceCategoriesPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={6}
        title="Citazioni del tuo dominio"
        provenance="cited_urls sul dominio proprietario"
      >
        <FirstPartyCitationsPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={7}
        title="Freschezza delle citazioni"
        provenance="last-modified delle pagine citate"
      >
        <CitationFreshnessPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={8}
        title="Accesso dei crawler AI (bot)"
        provenance="robots.txt del dominio (GPTBot, ClaudeBot, PerplexityBot…)"
      >
        <CrawlerAccessPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={9}
        title="Audit omonimi (anti-confusione)"
        provenance="classificazione LLM delle menzioni per entità"
      >
        <HomonymAuditPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={10}
        title="Portfolio dei prompt (ricerche)"
        provenance="prompts monitorati del brand"
      >
        <PromptPortfolioPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={11}
        title="Ricerca brandizzata"
        provenance="menzioni su query che contengono il nome"
      >
        <BrandedSearchPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={12}
        title="Citato vs ranking"
        provenance="cited_urls vs posizione nelle risposte"
      >
        <CitedVsRankingPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={13}
        title="Divergenza delle affermazioni (errori)"
        provenance="claim delle risposte vs fatti noti"
      >
        <ClaimDivergencePanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={14}
        title="Sentiment dei competitor"
        provenance="sentiment dei competitor nelle risposte"
      >
        <CompetitorSentimentPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={15}
        title="Testate editoriali"
        provenance="domini editoriali che citano il brand"
      >
        <EditorialOutletsPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={16}
        title="Opportunità di fonti (raccomandazioni)"
        provenance="gap tra fonti citate e potenziali"
      >
        <SourceOpportunitiesPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={17}
        title="Striking distance (opportunità)"
        provenance="prompt vicini alla soglia di menzione"
      >
        <StrikingDistancePanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={18}
        title="Prontezza AI-SEO"
        provenance="audit di prontezza per i motori AI"
      >
        <AISeoReadinessPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={19}
        title="Audit fondamenta del sito"
        provenance="audit tecnico on-page del dominio"
      >
        <SiteAuditFoundationsCard brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={20}
        title="Cannibalizzazione"
        provenance="prompt che si sovrappongono tra loro"
      >
        <CannibalizationPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={21}
        title="Driver di business"
        provenance="driver di business dichiarati del brand"
      >
        <BusinessDriversPanel brandId={brandId} />
      </ReportSection>

      <ReportSection
        n={22}
        title="Dichiarazione audience"
        provenance="audience target dichiarata del brand"
      >
        <AudienceDeclarationPanel brandId={brandId} />
      </ReportSection>

      <ReportSection n={23} title="Prova visiva" provenance="screenshot/evidenze delle citazioni">
        <VisualProofPanel brandId={brandId} />
      </ReportSection>
    </div>
  )
}
