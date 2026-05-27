// PATH: src/lib/services/ai-seo-readiness.ts
//
// "AI SEO 2026 readiness" scorecard — turns the industry research 2026 checklist
// (multi-engine coverage, schema markup, fresh citations, branded
// search uplift, llms.txt, competitor awareness) into a single 0-100
// score with an itemised list of what's missing.
//
// Pure composer. Reads tables we already populate; runs no new API
// calls, no LLM calls. Returns one check per dimension so the panel
// can render "5 of 8 passed" + a punch list.

import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import {
  computeCitationWorthinessScore,
  type CitationWorthinessScoreResult,
  type CitationWorthinessSignals,
} from '@/lib/utils/citation-worthiness-score'

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'unknown'

export interface ReadinessCheck {
  id: string
  label: string
  status: CheckStatus
  detail: string
  // What the operator should do to flip this from fail/warn → pass.
  remedy: string
}

export interface ReadinessReport {
  brandId: string
  score: number // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  passed: number
  total: number
  checks: ReadinessCheck[]
  computedAt: string
  /** Brand-level Citation Worthiness Score — aggregates the monitoring
   *  signals into a single 0-100 number with top-3 next-best-actions.
   *  Complements the per-check readiness above. */
  citationWorthiness: CitationWorthinessScoreResult
}

const ENGINES = ['chatgpt', 'gemini', 'perplexity', 'claude'] as const

function grade(score: number): ReadinessReport['grade'] {
  if (score >= 85) return 'A'
  if (score >= 70) return 'B'
  if (score >= 55) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

function statusFromBool(ok: boolean, partialCondition = false): CheckStatus {
  if (ok) return 'pass'
  if (partialCondition) return 'warn'
  return 'fail'
}

export async function computeReadinessReport(brandId: string): Promise<ReadinessReport> {
  const db = createServerClient()
  const computedAt = new Date().toISOString()
  if (!db) {
    return {
      brandId,
      score: 0,
      grade: 'F',
      passed: 0,
      total: 0,
      checks: [],
      computedAt,
      citationWorthiness: computeCitationWorthinessScore({
        schemaValid: false,
        schemaTypeCount: 0,
        aiCrawlersAllowed: false,
        daysSinceUpdate: 999,
        aiCitationCount: 0,
        aiEnginesCiting: 0,
        brandMentioned: false,
        hallucinationFlagged: false,
        wordCount: 0,
        inboundInternalLinks: 0,
      }),
    }
  }

  const since30 = new Date()
  since30.setDate(since30.getDate() - 30)
  const since30Iso = since30.toISOString()
  const since180 = new Date()
  since180.setDate(since180.getDate() - 180)
  const since180Iso = since180.toISOString()

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [monitoringRes, aeoSnippetsRes, llmsRes, gscRes, brandRes] = await Promise.all([
    (db as any)
      .from('monitoring_results')
      .select('engine, brand_mentioned, cited_urls, created_at')
      .eq('brand_id', brandId)
      .gte('created_at', since30Iso)
      .limit(5000),
    (db as any).from('aeo_snippets').select('id, created_at').eq('brand_id', brandId).limit(1000),
    (db as any)
      .from('llms_txt_versions')
      .select('id, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(1),
    (db as any)
      .from('gsc_performance')
      .select('clicks, impressions, date')
      .eq('brand_id', brandId)
      .eq('dimension_type', 'query')
      .gte('date', since180Iso.slice(0, 10))
      .limit(10_000),
    (db as any)
      .from('brands')
      .select('competitors, aliases, domain, domains')
      .eq('id', brandId)
      .single(),
  ])
  /* eslint-enable @typescript-eslint/no-explicit-any */

  for (const r of [monitoringRes, aeoSnippetsRes, llmsRes, gscRes]) {
    if (r.error) {
      logger.warn('readiness: subquery failed (non-fatal)', { err: String(r.error) })
    }
  }

  const monitoring = (monitoringRes.data ?? []) as Array<{
    engine: string
    brand_mentioned: boolean
    cited_urls: string[] | null
  }>
  const aeoSnippets = (aeoSnippetsRes.data ?? []) as Array<{ id: string; created_at: string }>
  const llmsTxt = (llmsRes.data ?? []) as Array<{ id: string; created_at: string }>
  const gsc = (gscRes.data ?? []) as Array<{
    clicks: number | null
    impressions: number | null
    date: string
  }>
  const brand = (brandRes.data ?? null) as {
    competitors: string[] | null
    aliases: string[] | null
    domain: string | null
    domains: string[] | null
  } | null

  // ── Check 1: brand monitored in ≥30 days ───────────────────────────────
  const totalResponses = monitoring.length
  const c1Status = statusFromBool(totalResponses >= 50, totalResponses >= 10)
  const c1: ReadinessCheck = {
    id: 'monitoring_volume',
    label: 'Recent monitoring volume',
    status: c1Status,
    detail: `${totalResponses} response${totalResponses === 1 ? '' : 's'} in the last 30 days.`,
    remedy:
      totalResponses === 0
        ? 'Add prompts on /dashboard/prompts and run a scan — without recent data the rest of the score is unreliable.'
        : 'Run more prompts so the rest of the score reflects current AI engine behaviour.',
  }

  // ── Check 2: multi-engine presence ─────────────────────────────────────
  const enginesWithMention = new Set(
    monitoring.filter((m) => m.brand_mentioned).map((m) => m.engine),
  )
  const c2Status = statusFromBool(
    enginesWithMention.size >= 3,
    enginesWithMention.size >= 1 && enginesWithMention.size <= 2,
  )
  const c2: ReadinessCheck = {
    id: 'multi_engine_coverage',
    label: 'Multi-engine coverage',
    status: c2Status,
    detail:
      enginesWithMention.size === 0
        ? 'Brand not mentioned on any engine yet.'
        : `Brand mentioned on ${enginesWithMention.size}/${ENGINES.length} engines: ${Array.from(enginesWithMention).sort().join(', ')}.`,
    remedy:
      'Identify which engines miss you (see /dashboard/ai-funnel section 1) and push the matching content/citations — different engines weight different sources.',
  }

  // ── Check 3: brand mention rate ≥ 50% ──────────────────────────────────
  const mentioned = monitoring.filter((m) => m.brand_mentioned).length
  const mentionRate = totalResponses > 0 ? mentioned / totalResponses : 0
  const c3Status = statusFromBool(mentionRate >= 0.5, mentionRate >= 0.2)
  const c3: ReadinessCheck = {
    id: 'mention_rate',
    label: 'Mention rate ≥ 50%',
    status: c3Status,
    detail:
      totalResponses === 0
        ? 'No data.'
        : `${Math.round(mentionRate * 100)}% of responses (${mentioned}/${totalResponses}) named the brand.`,
    remedy:
      'Low mention rate means engines pick competitor sources first. Use the Strategy Advisor to pick the prompts with the highest gap and ship answers for those topics.',
  }

  // ── Check 4: cited under brand domain ──────────────────────────────────
  const brandDomains = new Set<string>(
    [brand?.domain, ...(brand?.domains ?? [])]
      .filter((d): d is string => typeof d === 'string' && d.length > 0)
      .map((d) =>
        d
          .replace(/^https?:\/\//i, '')
          .replace(/\/.+$/, '')
          .toLowerCase(),
      ),
  )
  let citedFromBrand = 0
  let totalCitedUrls = 0
  for (const m of monitoring) {
    const urls = m.cited_urls ?? []
    for (const u of urls) {
      totalCitedUrls++
      try {
        const host = new URL(u.startsWith('http') ? u : `https://${u}`).hostname.toLowerCase()
        if (Array.from(brandDomains).some((d) => host.includes(d))) citedFromBrand++
      } catch {
        /* malformed url — skip */
      }
    }
  }
  const ownCitationShare = totalCitedUrls > 0 ? citedFromBrand / totalCitedUrls : 0
  const c4Status =
    brandDomains.size === 0
      ? 'unknown'
      : statusFromBool(ownCitationShare >= 0.15, ownCitationShare > 0)
  const c4: ReadinessCheck = {
    id: 'own_domain_cited',
    label: 'Own domain cited',
    status: c4Status,
    detail:
      brandDomains.size === 0
        ? 'No brand domain configured — cannot tell.'
        : totalCitedUrls === 0
          ? 'No citations captured yet.'
          : `${citedFromBrand}/${totalCitedUrls} citations point to your domain (${Math.round(ownCitationShare * 100)}%).`,
    remedy:
      brandDomains.size === 0
        ? 'Set a domain on the brand record so AI citations can be matched against your owned pages.'
        : 'Engines prefer trusted citations. Use /dashboard/citation-sources to see which competitor domains are taking your share, then publish parallel content on those topics.',
  }

  // ── Check 5: FAQPage schema generated ──────────────────────────────────
  const aeoCount = aeoSnippets.length
  const c5Status = statusFromBool(aeoCount >= 5, aeoCount > 0)
  const c5: ReadinessCheck = {
    id: 'faq_schema',
    label: 'FAQPage schema coverage',
    status: c5Status,
    detail:
      aeoCount === 0
        ? 'No AEO snippets generated yet.'
        : `${aeoCount} FAQPage Q&A pair${aeoCount === 1 ? '' : 's'} generated and ready to paste.`,
    remedy:
      'Run /dashboard/aeo-snippets for your top keywords. Each run gives you copy-paste JSON-LD that improves featured-snippet and AI-citation odds.',
  }

  // ── Check 6: llms.txt published ────────────────────────────────────────
  const llmsTxtExists = llmsTxt.length > 0
  const c6: ReadinessCheck = {
    id: 'llms_txt',
    label: 'llms.txt published',
    status: llmsTxtExists ? 'pass' : 'fail',
    detail: llmsTxtExists
      ? `Latest version generated ${new Date(llmsTxt[0]!.created_at).toLocaleDateString()}.`
      : 'No llms.txt generated for this brand yet.',
    remedy:
      'Generate one from /dashboard/optimizer → llms.txt and deploy at /llms.txt of your domain.',
  }

  // ── Check 7: branded search uplift ─────────────────────────────────────
  const gscDailyClicks = gsc.map((g) => g.clicks ?? 0)
  const recent30 = gscDailyClicks.slice(-30)
  const prior30 = gscDailyClicks.slice(-60, -30)
  const recentSum = recent30.reduce((s, v) => s + v, 0)
  const priorSum = prior30.reduce((s, v) => s + v, 0)
  const hasGsc = gsc.length > 0
  const upliftStatus: CheckStatus = !hasGsc
    ? 'unknown'
    : priorSum === 0 && recentSum === 0
      ? 'fail'
      : recentSum >= priorSum * 1.05
        ? 'pass'
        : recentSum >= priorSum * 0.95
          ? 'warn'
          : 'fail'
  const c7: ReadinessCheck = {
    id: 'branded_search_uplift',
    label: 'Branded search uplift',
    status: upliftStatus,
    detail: !hasGsc
      ? 'Connect Google Search Console to measure whether AI exposure drives branded search.'
      : `Last 30d: ${recentSum} clicks vs prior 30d: ${priorSum}.`,
    remedy:
      'If AI exposure isn’t lifting branded search, the citations aren’t naming you clearly enough — push for full-name citations on owned pages and PR.',
  }

  // ── Check 8: competitor tracking configured ────────────────────────────
  const competitorCount = brand?.competitors?.length ?? 0
  const c8Status = statusFromBool(competitorCount >= 3, competitorCount >= 1)
  const c8: ReadinessCheck = {
    id: 'competitors_configured',
    label: 'Competitor tracking configured',
    status: c8Status,
    detail:
      competitorCount === 0
        ? 'No competitors set on the brand.'
        : `${competitorCount} competitor${competitorCount === 1 ? '' : 's'} configured.`,
    remedy:
      'Add 3-5 direct competitors on the brand settings page. Without them, share-of-voice and competitive gap reports under-perform.',
  }

  const checks = [c1, c2, c3, c4, c5, c6, c7, c8]
  const scored = checks.filter((c) => c.status !== 'unknown')
  const passed = scored.filter((c) => c.status === 'pass').length
  const partial = scored.filter((c) => c.status === 'warn').length
  const total = scored.length
  // pass = 1, warn = 0.5, fail = 0; unknown drops out of denominator.
  const score = total > 0 ? Math.round(((passed + partial * 0.5) / total) * 100) : 0

  // ── Citation Worthiness Score ──────────────────────────────────────────
  // Brand-level aggregation of the operational LLMO signals we just
  // queried. Some inputs are weaker than they would be for a per-page
  // score (no homepage HTML fetch for word count / inbound links /
  // Last-Modified header) — sensible defaults keep the signal useful,
  // gaps are documented inline. `totalCitedUrls` is already computed
  // above for the cited_urls breakdown — reuse it instead of recounting.
  // Days since most-recent monitoring run as a freshness proxy. If we
  // can't tell, assume 999 (worst case) — better than over-rating stale
  // brands.
  const lastRunAt = monitoringRes.data?.[0]?.created_at ?? null
  const daysSinceUpdate = lastRunAt
    ? Math.max(0, Math.floor((Date.now() - new Date(lastRunAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 999
  const signals: CitationWorthinessSignals = {
    // Schema validity proxied by aeo_snippets presence (each snippet ships
    // a FAQPage JSON-LD fragment). Better than nothing; the dedicated
    // technical-seo-audit service can override this when wired in.
    schemaValid: aeoSnippets.length > 0,
    schemaTypeCount: aeoSnippets.length > 0 ? 1 : 0,
    // Crawlability proxied by llms.txt presence — without the file the
    // brand has implicitly opted out of LLM grounding. The dedicated
    // crawlability service can override this for a tighter signal.
    aiCrawlersAllowed: llmsTxt.length > 0,
    daysSinceUpdate,
    aiCitationCount: totalCitedUrls,
    aiEnginesCiting: enginesWithMention.size,
    brandMentioned: mentioned > 0,
    hallucinationFlagged: false, // No per-row hallucination flag aggregated here yet.
    wordCount: 1000, // Brand-level default; per-page audit replaces this.
    inboundInternalLinks: 0, // Same — per-page audit replaces.
  }
  const citationWorthiness = computeCitationWorthinessScore(signals)

  return {
    brandId,
    score,
    grade: grade(score),
    passed,
    total,
    checks,
    computedAt,
    citationWorthiness,
  }
}
