// PATH: src/lib/utils/citation-worthiness-score.ts
//
// Single 0-100 Citation Worthiness Score that aggregates the per-page
// signals we already compute separately (Schema.org validity, AI
// crawlability, freshness, AI citation count, brand mention, content
// depth) into one actionable number.
//
// Complement to citation-worthiness.ts (which classifies a page into an
// archetype like research/case-study/news). This file produces the
// OPERATIONAL score — "your page is at 47/100, fix these three things to
// get to 80" — without re-classifying anything.
//
// Closes the gap from the Semrush "AI search visibility" piece:
// operators don't want six different scorecards, they want one number
// per page plus the next-best-action ranked by impact.
//
// Pure + deterministic. Callers pass already-aggregated signal counts.

export interface CitationWorthinessSignals {
  /** Has a complete Schema.org payload (Organization / Article / FAQPage). */
  schemaValid: boolean
  /** Number of distinct Schema.org @type values present on the page. */
  schemaTypeCount: number
  /** robots/x-robots/meta tags allow AI crawlers (GPTBot, ClaudeBot, …). */
  aiCrawlersAllowed: boolean
  /** Days since the page was last modified (999 when unknown). */
  daysSinceUpdate: number
  /** Times the page has been cited by AI engines in the monitoring window. */
  aiCitationCount: number
  /** Distinct AI engines that have cited the page (1-5 in practice). */
  aiEnginesCiting: number
  /** Does the page mention the brand by name at least once? */
  brandMentioned: boolean
  /** Has the page been flagged for hallucination-prone claims in any run? */
  hallucinationFlagged: boolean
  /** Word count of the page's main content (skip nav/footer). */
  wordCount: number
  /** Inbound internal links pointing INTO the page from other site pages. */
  inboundInternalLinks: number
}

export type WorthinessBand = 'excellent' | 'strong' | 'moderate' | 'weak' | 'poor'

export interface CitationWorthinessScoreResult {
  /** 0-100, integer. */
  score: number
  band: WorthinessBand
  /** Per-pillar breakdown so the UI can show "you lost 12pts on schema". */
  components: {
    schema: number // /20
    crawlability: number // /15
    freshness: number // /15
    citations: number // /25
    brand: number // /10
    quality: number // /15
  }
  /** Top 3 actionable next steps to improve the score, sorted by impact. */
  recommendations: Array<{ action: string; impact: number; pillar: string }>
}

function bandFor(score: number): WorthinessBand {
  if (score >= 80) return 'excellent'
  if (score >= 65) return 'strong'
  if (score >= 45) return 'moderate'
  if (score >= 25) return 'weak'
  return 'poor'
}

function scoreSchema(s: CitationWorthinessSignals) {
  // 20pts max: 8 for any valid schema + 4 per extra type up to 3 extras.
  let pts = 0
  if (s.schemaValid) pts += 8
  pts += Math.min(12, Math.max(0, s.schemaTypeCount - 1) * 4)
  return { points: pts, max: 20, gap: 20 - pts }
}

function scoreCrawlability(s: CitationWorthinessSignals) {
  // 15pts: binary. AI crawlers blocked = entire pillar lost.
  const pts = s.aiCrawlersAllowed ? 15 : 0
  return { points: pts, max: 15, gap: 15 - pts }
}

function scoreFreshness(s: CitationWorthinessSignals) {
  // 15pts: stair function. ≤30d full, ≤90d 12, ≤180d 8, ≤365d 4, else 0.
  const d = s.daysSinceUpdate
  let pts = 15
  if (d > 30) pts = 12
  if (d > 90) pts = 8
  if (d > 180) pts = 4
  if (d > 365) pts = 0
  return { points: pts, max: 15, gap: 15 - pts }
}

function scoreCitations(s: CitationWorthinessSignals) {
  // 25pts: count signal (15) + engine breadth (10), diminishing returns.
  const countPts = Math.min(15, s.aiCitationCount * 1.5)
  const enginePts = Math.min(10, s.aiEnginesCiting * 3.3)
  const pts = Math.round(countPts + enginePts)
  return { points: pts, max: 25, gap: 25 - pts }
}

function scoreBrand(s: CitationWorthinessSignals) {
  // 10pts: brand mentioned (+10) - hallucination flagged (-5).
  let pts = 0
  if (s.brandMentioned) pts += 10
  if (s.hallucinationFlagged) pts -= 5
  pts = Math.max(0, pts)
  return { points: pts, max: 10, gap: 10 - pts }
}

function scoreQuality(s: CitationWorthinessSignals) {
  // 15pts: depth (10, stair) + inbound internal links (5, capped).
  const depthPts =
    s.wordCount < 300
      ? 0
      : s.wordCount < 600
        ? 4
        : s.wordCount < 1000
          ? 7
          : s.wordCount < 1500
            ? 9
            : 10
  const linkPts = Math.min(5, s.inboundInternalLinks)
  const pts = depthPts + linkPts
  return { points: pts, max: 15, gap: 15 - pts }
}

function breakdownAll(s: CitationWorthinessSignals) {
  return {
    schema: scoreSchema(s),
    crawlability: scoreCrawlability(s),
    freshness: scoreFreshness(s),
    citations: scoreCitations(s),
    brand: scoreBrand(s),
    quality: scoreQuality(s),
  }
}

function generateRecommendations(
  s: CitationWorthinessSignals,
  b: ReturnType<typeof breakdownAll>,
): CitationWorthinessScoreResult['recommendations'] {
  const out: CitationWorthinessScoreResult['recommendations'] = []

  if (b.crawlability.gap > 0) {
    out.push({
      action:
        'Allow GPTBot / ClaudeBot / Google-Extended in robots.txt — without this AI engines simply cannot index the page.',
      impact: b.crawlability.gap,
      pillar: 'crawlability',
    })
  }
  if (b.schema.gap >= 10) {
    out.push({
      action: `Add Schema.org structured data — at minimum Organization on every page, plus FAQPage / Article / HowTo where the content fits. Current ${s.schemaTypeCount} type(s); aim for 3+.`,
      impact: b.schema.gap,
      pillar: 'schema',
    })
  } else if (b.schema.gap > 0) {
    out.push({
      action: `Add ${Math.ceil(b.schema.gap / 4)} more Schema.org type(s) (e.g. BreadcrumbList, WebSite SearchAction).`,
      impact: b.schema.gap,
      pillar: 'schema',
    })
  }
  if (b.freshness.gap >= 8) {
    out.push({
      action: `Refresh the page — last update was ${s.daysSinceUpdate} days ago. Even minor edits (date stamp, new example, updated screenshot) bump the freshness signal.`,
      impact: b.freshness.gap,
      pillar: 'freshness',
    })
  }
  if (b.citations.gap >= 15) {
    out.push({
      action:
        'Pursue inbound mentions from review sites (G2, Capterra, Trustpilot) and industry publications — AI engines weight off-domain citation context heavily.',
      impact: b.citations.gap,
      pillar: 'authority',
    })
  } else if (b.citations.gap >= 8 && s.aiEnginesCiting < 3) {
    out.push({
      action: `Cited by only ${s.aiEnginesCiting} AI engine(s). Broaden to engine-specific surfaces (Perplexity profile, ChatGPT plugin metadata).`,
      impact: b.citations.gap,
      pillar: 'authority',
    })
  }
  if (s.hallucinationFlagged) {
    out.push({
      action:
        'AI engines have hallucinated claims about this page — strengthen factual specificity, add citations to primary sources, surface dates and numbers explicitly.',
      impact: 5,
      pillar: 'trust',
    })
  }
  if (!s.brandMentioned && b.brand.gap > 0) {
    out.push({
      action:
        'Page does not mention the brand by name. Add canonical brand-mention copy (footer, About CTA, byline) so AI engines anchor entity resolution to the page.',
      impact: b.brand.gap,
      pillar: 'brand',
    })
  }
  if (s.wordCount < 600 && b.quality.gap > 0) {
    out.push({
      action: `Page has only ${s.wordCount} words. Aim for 1000+ for "depth" signal — add FAQ, examples, comparison tables.`,
      impact: b.quality.gap,
      pillar: 'depth',
    })
  }

  return out.sort((a, b2) => b2.impact - a.impact).slice(0, 3)
}

/**
 * Compute the Citation Worthiness Score for a single page given pre-
 * aggregated signal counts. Returns the score (0-100), per-pillar
 * breakdown, a band label, and the top 3 highest-impact recommendations.
 *
 * The pillar weights total exactly 100:
 *   schema (20) + crawlability (15) + freshness (15) +
 *   citations (25) + brand (10) + quality (15) = 100
 *
 * Citations weighs heaviest because off-domain AI signal is the hardest
 * to fake — schema can be added in an afternoon, citations take months.
 */
export function computeCitationWorthinessScore(
  signals: CitationWorthinessSignals,
): CitationWorthinessScoreResult {
  const b = breakdownAll(signals)
  const score = Math.max(
    0,
    Math.min(
      100,
      b.schema.points +
        b.crawlability.points +
        b.freshness.points +
        b.citations.points +
        b.brand.points +
        b.quality.points,
    ),
  )
  return {
    score: Math.round(score),
    band: bandFor(score),
    components: {
      schema: b.schema.points,
      crawlability: b.crawlability.points,
      freshness: b.freshness.points,
      citations: b.citations.points,
      brand: b.brand.points,
      quality: b.quality.points,
    },
    recommendations: generateRecommendations(signals, b),
  }
}
