// PATH: src/lib/services/exec-summary.ts
//
// Builds a single 1-page executive summary for a brand structured around
// the 4 questions from the Semrush "AI search visibility reporting" piece:
//
//   Q1. Where do we appear?            (citation frequency + prompt coverage)
//   Q2. How accurately are we described? (sentiment + driver narrative)
//   Q3. Are we winning or losing vs competitors? (share of voice + drivers)
//   Q4. Are business objectives improving?       (branded search + AI assist)
//
// Composes existing utilities: computeShareOfVoiceByEngine,
// extractBusinessDrivers, classifyBrandedQueries + aiAssistScore. Returns
// a structured payload the route can serve as JSON or render to markdown
// for export.

import { createServerClient } from '@/lib/supabase'
import { computeShareOfVoiceByEngine, type SovInputRow } from '@/lib/services/share-of-voice'
import {
  extractBusinessDrivers,
  findNarrativeGaps,
  type MonitoringRowForDrivers,
} from '@/lib/utils/business-drivers'
import {
  brandAnchors,
  classifyBrandedQueries,
  aiAssistScore,
  type QueryRow,
} from '@/lib/utils/branded-search'
import { logger } from '@/lib/logger'
import type { Brand } from '@/types'

export interface ExecSummaryPeriod {
  startDate: string
  endDate: string
  days: number
}

export interface ExecSummaryQ1 {
  totalResponses: number
  brandMentions: number
  mentionRate: number // %
  uniquePromptsCovered: number
}

export interface ExecSummaryQ2 {
  avgSentiment: number | null // -1..1
  sentimentLabel: 'positive' | 'neutral' | 'negative' | 'unknown'
  topPositiveDriver: string | null
  topNegativeDriver: string | null
}

export interface ExecSummaryQ3 {
  brandShare: number // %
  brandRank: number | null
  totalCompetitors: number
  narrativeGaps: Array<{ driver: string; leader: string; gap: number }>
  perEngine: Array<{ engine: string; share: number; rank: number | null }>
}

export interface ExecSummaryQ4 {
  brandedClicks: number
  brandedClicksDeltaPct: number | null
  brandedImpressions: number
  brandedImpressionsDeltaPct: number | null
  aiAssistScore: number | null
  aiAssistVerdict: 'assisted' | 'neutral' | 'cannibalised' | 'unknown'
}

export interface ExecSummary {
  brandName: string
  period: ExecSummaryPeriod
  q1: ExecSummaryQ1
  q2: ExecSummaryQ2
  q3: ExecSummaryQ3
  q4: ExecSummaryQ4
  /** Operator-facing one-line summary derived from the 4 sections. */
  headline: string
}

interface MonitoringRow {
  brand_mentioned: boolean | null
  mention_count: number | null
  mention_position: number | null
  competitor_mentions: Array<{ name?: string | null; position?: number; count?: number }> | null
  sentiment_score: number | null
  response_text: string | null
  created_at: string | null
  engine: string | null
  prompt_id: string | null
}

interface GscQueryRow {
  date: string
  dimension_value: string | null
  clicks: number | null
  impressions: number | null
  position: number | null
}

function sentimentLabel(score: number | null): ExecSummaryQ2['sentimentLabel'] {
  if (score == null) return 'unknown'
  if (score >= 0.2) return 'positive'
  if (score <= -0.2) return 'negative'
  return 'neutral'
}

function headlineFor(s: Omit<ExecSummary, 'headline'>): string {
  const parts: string[] = []
  parts.push(
    `${s.q1.mentionRate.toFixed(0)}% mention rate across ${s.q1.totalResponses} AI responses`,
  )
  if (s.q3.brandRank != null) {
    parts.push(`rank #${s.q3.brandRank} of ${s.q3.totalCompetitors + 1} brands`)
  }
  if (s.q4.aiAssistVerdict !== 'unknown') {
    parts.push(`AI ${s.q4.aiAssistVerdict}`)
  }
  if (s.q4.brandedClicksDeltaPct != null) {
    const sign = s.q4.brandedClicksDeltaPct >= 0 ? '+' : ''
    parts.push(`branded clicks ${sign}${s.q4.brandedClicksDeltaPct.toFixed(1)}%`)
  }
  return parts.join(' · ')
}

/**
 * Build the exec summary for a brand. Throws when the DB is unavailable
 * or the brand row can't be loaded.
 */
export async function buildExecSummary(brand: Brand, days: number): Promise<ExecSummary> {
  const db = createServerClient()
  if (!db) throw new Error('Database not configured')

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(endDate.getDate() - days)
  const sinceISO = startDate.toISOString()
  const period: ExecSummaryPeriod = {
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
    days,
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const [monitoringRes, gscRes] = await Promise.all([
    (db as any)
      .from('monitoring_results')
      .select(
        'brand_mentioned, mention_count, mention_position, competitor_mentions, sentiment_score, response_text, created_at, engine, prompt_id',
      )
      .eq('brand_id', brand.id)
      .gte('created_at', sinceISO)
      .order('created_at', { ascending: true })
      .limit(5000),
    (db as any)
      .from('gsc_performance')
      .select('date, dimension_value, clicks, impressions, position')
      .eq('brand_id', brand.id)
      .eq('dimension_type', 'query')
      .gte('date', period.startDate)
      .order('date', { ascending: true })
      .limit(10_000),
  ])
  /* eslint-enable @typescript-eslint/no-explicit-any */

  if (monitoringRes.error) {
    logger.error('exec-summary: monitoring query failed', { err: monitoringRes.error })
  }
  if (gscRes.error) {
    logger.warn('exec-summary: gsc query failed (non-fatal)', { err: gscRes.error })
  }

  const monitoring: MonitoringRow[] = (monitoringRes.data ?? []) as MonitoringRow[]
  const gscRows: GscQueryRow[] = (gscRes.data ?? []) as GscQueryRow[]

  // ── Q1: Where do we appear?
  const totalResponses = monitoring.length
  const brandMentions = monitoring.filter((m) => m.brand_mentioned === true).length
  const uniquePrompts = new Set(monitoring.map((m) => m.prompt_id).filter(Boolean)).size
  const q1: ExecSummaryQ1 = {
    totalResponses,
    brandMentions,
    mentionRate: totalResponses > 0 ? Math.round((brandMentions / totalResponses) * 1000) / 10 : 0,
    uniquePromptsCovered: uniquePrompts,
  }

  // ── Q2: How accurately are we described?
  const sentimentScores = monitoring
    .filter((m) => m.brand_mentioned === true && typeof m.sentiment_score === 'number')
    .map((m) => m.sentiment_score as number)
  const avgSentiment =
    sentimentScores.length > 0
      ? Math.round((sentimentScores.reduce((s, v) => s + v, 0) / sentimentScores.length) * 100) /
        100
      : null

  const driversReport = extractBusinessDrivers(
    monitoring.map<MonitoringRowForDrivers>((m) => ({
      brand_mentioned: m.brand_mentioned,
      response_text: m.response_text,
      competitor_mentions: m.competitor_mentions,
    })),
    brand.name,
    brand.competitors ?? [],
  )
  // Top driver where the brand leads → positive driver. Top driver where
  // it falls behind → negative driver.
  const brandDriverWins = driversReport.drivers.filter((d) => d.leader && d.leader.isBrand)
  const brandDriverLosses = findNarrativeGaps(driversReport)
  const q2: ExecSummaryQ2 = {
    avgSentiment,
    sentimentLabel: sentimentLabel(avgSentiment),
    topPositiveDriver: brandDriverWins[0] ? brandDriverWins[0].driver.label : null,
    topNegativeDriver: brandDriverLosses[0] ? brandDriverLosses[0].driver.label : null,
  }

  // ── Q3: Are we winning or losing vs competitors?
  const sovByEngine = computeShareOfVoiceByEngine(
    monitoring.map<SovInputRow>((m) => ({
      brand_mentioned: m.brand_mentioned,
      mention_count: m.mention_count,
      mention_position: m.mention_position,
      competitor_mentions: (m.competitor_mentions ?? []) as SovInputRow['competitor_mentions'],
      created_at: m.created_at,
      engine: m.engine,
    })),
    brand.name,
  )
  const overall = sovByEngine.overall
  const brandEntity = overall.entities.find((e) => e.isBrand)
  const brandShare = brandEntity?.share ?? 0
  const rank = brandEntity ? 1 + overall.entities.filter((e) => e.share > brandShare).length : null
  const q3: ExecSummaryQ3 = {
    brandShare,
    brandRank: rank,
    totalCompetitors: Math.max(0, overall.entities.length - 1),
    narrativeGaps: brandDriverLosses.slice(0, 3).map((g) => ({
      driver: g.driver.label,
      leader: g.leader.brand,
      gap: g.gap,
    })),
    perEngine: sovByEngine.byEngine.map((e) => {
      const eb = e.entities.find((x) => x.isBrand)
      const sh = eb?.share ?? 0
      return {
        engine: e.engine,
        share: sh,
        rank: eb ? 1 + e.entities.filter((x) => x.share > sh).length : null,
      }
    }),
  }

  // ── Q4: Are business objectives improving?
  const ownedDomain = (brand.domain ?? brand.domains?.[0] ?? '').trim()
  const anchors = brandAnchors({
    name: brand.name,
    aliases: brand.aliases ?? [],
    domain: ownedDomain || null,
  })
  const gscInputs: QueryRow[] = gscRows
    .filter((r) => typeof r.dimension_value === 'string' && r.dimension_value.length > 0)
    .map((r) => ({
      query: r.dimension_value as string,
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      position: r.position ?? undefined,
      date: r.date,
    }))
  const { summary: brandedSummary, timeline: brandedTimeline } = classifyBrandedQueries(
    gscInputs,
    anchors,
  )
  const growth = (() => {
    if (brandedTimeline.length < 4) return { clicksDelta: null, impressionsDelta: null }
    const mid = Math.floor(brandedTimeline.length / 2)
    const a = brandedTimeline.slice(0, mid)
    const b = brandedTimeline.slice(mid)
    const sum = (arr: typeof brandedTimeline, key: 'brandedClicks' | 'brandedImpressions') =>
      arr.reduce((s, p) => s + p[key], 0)
    const cA = sum(a, 'brandedClicks')
    const cB = sum(b, 'brandedClicks')
    const iA = sum(a, 'brandedImpressions')
    const iB = sum(b, 'brandedImpressions')
    const delta = (x: number, y: number) => (x > 0 ? Math.round(((y - x) / x) * 1000) / 10 : null)
    return { clicksDelta: delta(cA, cB), impressionsDelta: delta(iA, iB) }
  })()
  const assist = aiAssistScore(brandedTimeline)
  const q4: ExecSummaryQ4 = {
    brandedClicks: brandedSummary.branded.clicks,
    brandedClicksDeltaPct: growth.clicksDelta,
    brandedImpressions: brandedSummary.branded.impressions,
    brandedImpressionsDeltaPct: growth.impressionsDelta,
    aiAssistScore: assist.score,
    aiAssistVerdict: assist.verdict,
  }

  const partial: Omit<ExecSummary, 'headline'> = {
    brandName: brand.name,
    period,
    q1,
    q2,
    q3,
    q4,
  }
  return { ...partial, headline: headlineFor(partial) }
}

/**
 * Render the exec summary as a Markdown document suitable for paste-into-
 * Notion / Slack / PR review. Stable formatting — works for diffs.
 */
export function execSummaryToMarkdown(summary: ExecSummary): string {
  const lines: string[] = []
  const sentimentEmoji =
    summary.q2.sentimentLabel === 'positive'
      ? '✅'
      : summary.q2.sentimentLabel === 'negative'
        ? '⚠️'
        : '·'
  const assistEmoji =
    summary.q4.aiAssistVerdict === 'assisted'
      ? '↑'
      : summary.q4.aiAssistVerdict === 'cannibalised'
        ? '↓'
        : '→'

  lines.push(`# AI Visibility — Executive Summary`)
  lines.push('')
  lines.push(`**Brand:** ${summary.brandName}`)
  lines.push(
    `**Period:** ${summary.period.startDate} → ${summary.period.endDate} (${summary.period.days} days)`,
  )
  lines.push('')
  lines.push(`**TL;DR:** ${summary.headline}`)
  lines.push('')

  lines.push(`## Q1 — Where do we appear?`)
  lines.push(`- Mention rate: **${summary.q1.mentionRate.toFixed(1)}%**`)
  lines.push(
    `- ${summary.q1.brandMentions} brand mentions across ${summary.q1.totalResponses} AI responses`,
  )
  lines.push(`- Covered ${summary.q1.uniquePromptsCovered} unique prompts`)
  lines.push('')

  lines.push(`## Q2 — How accurately are we described?`)
  lines.push(
    `- Avg. sentiment: **${summary.q2.avgSentiment != null ? summary.q2.avgSentiment.toFixed(2) : 'n/a'}** (${summary.q2.sentimentLabel}) ${sentimentEmoji}`,
  )
  if (summary.q2.topPositiveDriver)
    lines.push(`- Owning narrative: **${summary.q2.topPositiveDriver}**`)
  if (summary.q2.topNegativeDriver)
    lines.push(`- Losing narrative: **${summary.q2.topNegativeDriver}**`)
  lines.push('')

  lines.push(`## Q3 — Are we winning or losing vs competitors?`)
  lines.push(
    `- Brand share of voice: **${summary.q3.brandShare.toFixed(1)}%** (rank ${
      summary.q3.brandRank ?? 'n/a'
    } of ${summary.q3.totalCompetitors + 1})`,
  )
  if (summary.q3.perEngine.length > 0) {
    lines.push(`- By engine:`)
    for (const e of summary.q3.perEngine) {
      lines.push(`  - ${e.engine}: ${e.share.toFixed(1)}% (rank ${e.rank ?? 'n/a'})`)
    }
  }
  if (summary.q3.narrativeGaps.length > 0) {
    lines.push(`- Narrative gaps:`)
    for (const g of summary.q3.narrativeGaps) {
      lines.push(`  - ${g.driver}: ${g.leader} leads (gap −${g.gap})`)
    }
  }
  lines.push('')

  lines.push(`## Q4 — Are business objectives improving?`)
  lines.push(
    `- Branded clicks: **${summary.q4.brandedClicks}** (${
      summary.q4.brandedClicksDeltaPct != null
        ? `${summary.q4.brandedClicksDeltaPct >= 0 ? '+' : ''}${summary.q4.brandedClicksDeltaPct.toFixed(1)}% vs first half`
        : 'no trend data'
    })`,
  )
  lines.push(
    `- Branded impressions: **${summary.q4.brandedImpressions}** (${
      summary.q4.brandedImpressionsDeltaPct != null
        ? `${summary.q4.brandedImpressionsDeltaPct >= 0 ? '+' : ''}${summary.q4.brandedImpressionsDeltaPct.toFixed(1)}%`
        : 'no trend data'
    })`,
  )
  lines.push(
    `- AI assist verdict: **${summary.q4.aiAssistVerdict}** ${assistEmoji} (score ${
      summary.q4.aiAssistScore != null ? summary.q4.aiAssistScore.toFixed(1) : 'n/a'
    })`,
  )
  lines.push('')

  return lines.join('\n')
}
