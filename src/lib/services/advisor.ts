// PATH: src/lib/services/advisor.ts
//
// Minimal "advisor team" for AIO Pulse colleagues.
//
// Architecture (deliberately small):
//
//   buildAdvisorContext(brandId)  ── deterministic Supabase query.
//       Pulls the facts a strategist needs to reason about ONE brand.
//       This is *not* an LLM call — using a model to fetch your own data
//       is wasteful and unreliable. Calling it an "agent" would be generous;
//       it's a context builder.
//
//   runStrategist(context, question) ── single LLM call with strict JSON
//       output validated by zod. Groq first (free, fast) if GROQ_API_KEY
//       is set, otherwise Gemini, otherwise OpenAI. No frameworks.
//
//   getAdvisorRecommendation(brandId, question?) ── composes the two and
//       returns a structured StrategyOutput + the raw context the model saw.
//
// If colleague usage proves the workflow, add a Critic agent (second LLM
// pass that scores the Strategist's output against a checklist) — but not
// before that, or you build the wrong thing.

import { z } from 'zod'
import { createServerClient } from '@/lib/supabase'
import { loadLatestSiteAuditSummary, type SiteAuditSummary } from './site-audit-summary'
import {
  INDUSTRY_PRESETS,
  expandKeywords,
  getIndustryPreset,
  type Locale,
} from './prompt-generator'
import { checkBrandPresence, type BrandPresence } from './brand-presence'
import { formatGeoKnowledgeForPrompt } from '@/lib/geo/geo-knowledge'
import { logger } from '@/lib/logger'

// ─── Public types ────────────────────────────────────────────────────────────

const StrategyRecommendationSchema = z.object({
  title: z.string().min(3).max(140),
  rationale: z.string().min(10).max(600),
  impact: z.enum(['high', 'medium', 'low']),
  effort: z.enum(['high', 'medium', 'low']),
  actions: z.array(z.string().min(3)).min(1).max(6),
  sources: z.array(z.string().min(3)).min(1).max(6),
})

const NewPromptSchema = z.object({
  text: z.string().min(3).max(500),
  intentBucket: z.string().min(1).max(10),
  priority: z.enum(['high', 'medium', 'low']),
})

export const StrategyOutputSchema = z.object({
  summary: z.string().min(10).max(600),
  recommendations: z.array(StrategyRecommendationSchema).min(1).max(3),
  newPrompts: z.array(NewPromptSchema).min(0).max(8).optional(),
  confidence: z.number().min(0).max(1),
})

export type StrategyOutput = z.infer<typeof StrategyOutputSchema>

export interface AdvisorContext {
  brand: {
    id: string
    name: string
    domain: string | null
    language: string | null
    industry: string | null
    competitors: string[]
    aliases: string[]
  }
  health: {
    date: string | null
    aviScore: number
    citationRate: number
    mentionRate: number
    recommendationRate: number
    sentimentScore: number
    positionAvg: number
    hallucinationRate: number
    engineBreakdown: Record<string, number>
  } | null
  weekDelta: {
    aviDelta: number
    citationRateDelta: number
    mentionRateDelta: number
    sentimentDelta: number
  } | null
  monitoring: {
    last7Days: number
    perEngineLast7Days: Record<string, number>
    failedWorkflowsLast7Days: number
  }
  prompts: {
    active: number
    byLanguage: Record<string, number>
  }
  aeo: {
    total: number
    gap: number
    covered: number
    lastRunAt: string | null
  } | null
  /**
   * Latest cached static site audit (from /api/audit/technical) for the
   * brand's domain. null when no audit has been run yet or the cache
   * expired. Lets the Strategist reason over static readiness alongside
   * live monitoring signals.
   */
  siteAudit: SiteAuditSummary | null
  /**
   * Per-prompt performance over the last 30 days. The Strategist uses these
   * to recommend WHICH prompts to rewrite (the worst-performers are obvious
   * candidates) vs scale (top-performers point to topics worth expanding).
   */
  promptInsights: {
    topPerforming: Array<{ text: string; mentionRate: number; runs: number }>
    worstPerforming: Array<{ text: string; mentionRate: number; runs: number }>
    sampleActive: string[]
  }
  /**
   * Competitors the AI engines actually mentioned in monitoring responses
   * over the last 30 days, regardless of what's configured on brand.competitors.
   * The strongest signal for "who should I add to my benchmark set?" — the
   * LLMs are already talking about them.
   */
  topMentionedCompetitors: Array<{ name: string; count: number }>
  /**
   * If the brand name matches a known-ambiguous pattern (e.g. Acasting can
   * be confused with Acast the podcast platform), this string warns the
   * Strategist so it can call out the disambiguation as a strategic action.
   * Null for non-ambiguous brand names.
   */
  brandDisambiguation: string | null
  /**
   * Prompt Generator integration: when the brand's industry matches an
   * industry preset, this field contains suggested new prompts (queries
   * the brand is NOT already monitoring) generated from the preset's
   * localized templates and intent patterns. The Strategist can recommend
   * creating these as new active prompts.
   * Null when no industry preset matches the brand's industry.
   */
  promptGenerator: {
    industryMatch: string
    industryLabel: string
    suggestedNewPrompts: Array<{
      query: string
      intentBucket: string
      priority: 'high' | 'medium' | 'low'
      score: number
      scoreReasons: string[]
    }>
  } | null
  /**
   * Whether the brand has a presence on the two platforms that
   * disproportionately drive AI citations:
   *   - Wikipedia: ~47.9% of ChatGPT top citations
   *   - Reddit:    ~46.7% of Perplexity citations
   * Absence on either is a high-ROI gap the Strategist can recommend
   * filling. Both checks are best-effort (Wikipedia REST API + Brave
   * site-search) and soft-fail.
   */
  externalPresence: BrandPresence | null
}

export interface AdvisorResult {
  context: AdvisorContext
  strategy: StrategyOutput
  provider: string
  model: string
}

// ─── Prompt Generator integration ─────────────────────────────────────────────

function matchIndustryToPreset(
  industry: string | null,
): (typeof INDUSTRY_PRESETS)[number] | undefined {
  if (!industry) return undefined
  const norm = industry.toLowerCase().replace(/[\s-]+/g, '')

  for (const preset of INDUSTRY_PRESETS) {
    if (preset.id.replace(/[\s-]+/g, '') === norm) return preset
    for (const name of Object.values(preset.name)) {
      if (name.toLowerCase().replace(/[\s-]+/g, '') === norm) return preset
    }
  }

  for (const preset of INDUSTRY_PRESETS) {
    if (norm.includes(preset.id.replace(/[\s-]+/g, ''))) return preset
    for (const name of Object.values(preset.name)) {
      if (
        name
          .toLowerCase()
          .replace(/[\s-]+/g, '')
          .includes(norm)
      )
        return preset
    }
  }

  return undefined
}

/**
 * Fallback keyword-based industry classification when exact matching fails.
 * Scans seedKeywords (all locales) and preset names for partial matches.
 */
function keywordClassifyIndustry(industry: string): (typeof INDUSTRY_PRESETS)[number] | undefined {
  const norm = industry.toLowerCase()
  const candidates: Array<{ preset: (typeof INDUSTRY_PRESETS)[number]; score: number }> = []

  for (const preset of INDUSTRY_PRESETS) {
    let score = 0
    for (const lang of ['en', 'it', 'sv'] as Locale[]) {
      const seeds = preset.seedKeywords[lang]
      for (const seed of seeds) {
        if (norm.includes(seed.toLowerCase())) score += 2
        if (seed.toLowerCase().includes(norm)) score += 3
      }
      const categories = preset.categories[lang]
      for (const cat of categories) {
        if (norm.includes(cat.toLowerCase())) score += 1
      }
    }
    if (score > 0) candidates.push({ preset, score })
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]?.preset
}

/**
 * LLM-based industry classification — called only when fuzzy and keyword
 * matching both fail. Uses the same provider chain (Groq → Gemini → OpenAI)
 * but with a minimal prompt and low max_tokens.
 */
async function llmClassifyIndustry(
  industry: string,
  brandName: string,
): Promise<(typeof INDUSTRY_PRESETS)[number] | undefined> {
  const presetList = INDUSTRY_PRESETS.map(
    (p) => `${p.id}: ${p.name.en} / ${p.name.it} / ${p.name.sv} — ${p.description.en}`,
  ).join('\n')

  const systemPrompt = [
    'You classify a brand into one of the following industry presets.',
    'Respond with a single JSON object: { "presetId": string | null }.',
    'Return null if no preset matches.',
    '',
    'Available presets:',
    presetList,
  ].join('\n')

  const userPrompt = [
    `Brand name: "${brandName}"`,
    `Industry description: "${industry}"`,
    '',
    'Which preset fits best? Return JSON only.',
  ].join('\n')

  try {
    const { text } = await callLLM(
      systemPrompt,
      userPrompt,
      { provider: undefined, model: undefined },
      5_000,
    )
    const parsed = JSON.parse(extractJson(text)) as { presetId?: string | null }
    if (parsed.presetId) {
      return getIndustryPreset(parsed.presetId)
    }
  } catch {
    logger.warn('advisor: LLM industry classification failed, falling back to null')
  }
  return undefined
}

/**
 * Score a suggested prompt using three signals:
 * 1. AEO gap ratio for its intent bucket
 * 2. Competitor coverage (does it mention competitors the brand isn't tracking?)
 * 3. Priority weight (high → more valuable)
 */
function scoreSuggestion(
  suggestion: { query: string; intentBucket: string; priority: 'high' | 'medium' | 'low' },
  aeoGapRatio: number | null,
  unconfiguredCompetitors: Set<string>,
): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  const priorityWeight =
    suggestion.priority === 'high' ? 1.0 : suggestion.priority === 'medium' ? 0.6 : 0.3
  score += priorityWeight * 3
  if (suggestion.priority === 'high') reasons.push('high priority')

  if (aeoGapRatio !== null) {
    const aeoBoost = Math.min(aeoGapRatio * 4, 3)
    score += aeoBoost
    if (aeoGapRatio > 0.5) {
      reasons.push(`AEO gap ${Math.round(aeoGapRatio * 100)}% — covering this bucket reduces gap`)
    }
  }

  const lowerQuery = suggestion.query.toLowerCase()
  let competitorMatch = false
  for (const comp of unconfiguredCompetitors) {
    if (lowerQuery.includes(comp.toLowerCase())) {
      competitorMatch = true
      score += 2
      break
    }
  }
  if (competitorMatch) {
    reasons.push('mentions emerging competitor not yet tracked')
  }

  return {
    score: Math.round(score * 10) / 10,
    reasons: reasons.slice(0, 3),
  }
}

async function buildPromptGeneratorContext(
  db: NonNullable<ReturnType<typeof createServerClient>>,
  brandId: string,
  industry: string | null,
  language: string | null,
  brandName: string,
  aeo: AdvisorContext['aeo'],
  configuredCompetitors: string[],
  topMentionedCompetitors: Array<{ name: string; count: number }>,
): Promise<AdvisorContext['promptGenerator']> {
  if (!industry || !brandName) return null

  let preset = matchIndustryToPreset(industry)

  if (!preset) {
    preset = keywordClassifyIndustry(industry)
  }

  if (!preset) {
    preset = await llmClassifyIndustry(industry, brandName)
  }

  if (!preset) return null

  const locale: Locale = language === 'it' || language === 'sv' ? language : 'en'
  const queries = expandKeywords(brandName, preset.id, locale)

  // Build the active-prompts exclusion set from a DEDICATED query against
  // the prompts table — not from promptInsights.sampleActive which is
  // capped at 10 rows. For brands with >10 active prompts (e.g. acasting
  // has 29) the truncated sample would let already-configured queries
  // re-appear in the "new prompts" list, defeating the deduplication.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let activeSet = new Set<string>()
  try {
    const { data: rows } = (await (db as any)
      .from('prompts')
      .select('text')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .limit(1000)) as { data: Array<{ text: string | null }> | null }
    activeSet = new Set(
      (rows ?? []).map((r) => (r.text || '').toLowerCase().trim()).filter((t) => t.length > 0),
    )
  } catch (e) {
    logger.warn('advisor: failed to load active prompts for dedup', { err: String(e) })
    // Fall through with empty set — degraded behavior is "may suggest
    // already-monitored queries", strictly worse than ideal but not broken.
  }

  const configuredSet = new Set(configuredCompetitors.map((c) => c.toLowerCase()))
  const unconfiguredCompetitors = new Set(
    topMentionedCompetitors
      .filter((m) => !configuredSet.has(m.name.toLowerCase()))
      .map((m) => m.name),
  )

  const aeoGapRatio = aeo && aeo.total > 0 ? aeo.gap / aeo.total : null

  const suggested = queries
    .filter((q) => !activeSet.has(q.query.toLowerCase().trim()))
    .map((q) => {
      const { score, reasons } = scoreSuggestion(q, aeoGapRatio, unconfiguredCompetitors)
      return {
        query: q.query,
        intentBucket: q.intentBucket,
        priority: q.priority,
        score,
        scoreReasons: reasons,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  if (suggested.length === 0) return null

  return {
    industryMatch: preset.id,
    industryLabel: preset.name[locale],
    suggestedNewPrompts: suggested,
  }
}

// ─── Context builder ─────────────────────────────────────────────────────────

const DEFAULT_QUESTION =
  'What are the most important things to do this week for this brand? Rank by impact × effort.'

export async function buildAdvisorContext(brandId: string): Promise<AdvisorContext> {
  const db = createServerClient()
  if (!db) throw new Error('Database not configured')

  // Brand basics
  const { data: brandRow } = await db
    .from('brands')
    .select('id, name, domain, language, industry, competitors, aliases')
    .eq('id', brandId)
    .single()
  if (!brandRow) throw new Error('Brand not found')
  const brand: AdvisorContext['brand'] = {
    id: brandRow.id,
    name: brandRow.name,
    domain: brandRow.domain ?? null,
    language: brandRow.language ?? null,
    industry: brandRow.industry ?? null,
    competitors: Array.isArray(brandRow.competitors) ? brandRow.competitors : [],
    aliases: Array.isArray(brandRow.aliases) ? brandRow.aliases : [],
  }

  // brand_health_scores rows accessed via the service-role server client;
  // cast at the boundary (same pattern as the other brand_health_scores
  // routes) — the generated Database type isn't worth chasing here.
  type HealthLike = {
    date: string | null
    avi_score: number | null
    citation_rate: number | null
    mention_rate: number | null
    recommendation_rate: number | null
    sentiment_score: number | null
    position_avg: number | null
    hallucination_rate: number | null
    engine_breakdown: unknown
  }

  const dbAny = db as any

  const { data: latestHealth } = (await dbAny
    .from('brand_health_scores')
    .select(
      'date, avi_score, citation_rate, mention_rate, recommendation_rate, sentiment_score, position_avg, hallucination_rate, engine_breakdown',
    )
    .eq('brand_id', brandId)
    .order('date', { ascending: false })
    .limit(1)) as { data: HealthLike[] | null }

  let health: AdvisorContext['health'] = null
  let weekDelta: AdvisorContext['weekDelta'] = null

  if (latestHealth && latestHealth.length > 0) {
    const h = latestHealth[0]!
    health = {
      date: h.date,
      aviScore: h.avi_score ?? 0,
      citationRate: h.citation_rate ?? 0,
      mentionRate: h.mention_rate ?? 0,
      recommendationRate: h.recommendation_rate ?? 0,
      sentimentScore: h.sentiment_score ?? 0,
      positionAvg: h.position_avg ?? 0,
      hallucinationRate: h.hallucination_rate ?? 0,
      engineBreakdown: parseEngineBreakdown(h.engine_breakdown),
    }

    // 7-day-ago row (or earlier) for delta
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 7)
    const cutoffStr = cutoff.toISOString().split('T')[0]!
    const { data: prev } = (await dbAny
      .from('brand_health_scores')
      .select(
        'date, avi_score, citation_rate, mention_rate, recommendation_rate, sentiment_score, position_avg, hallucination_rate, engine_breakdown',
      )
      .eq('brand_id', brandId)
      .lte('date', cutoffStr)
      .order('date', { ascending: false })
      .limit(1)) as { data: HealthLike[] | null }

    if (prev && prev.length > 0) {
      const p = prev[0]!
      weekDelta = {
        aviDelta: round1((h.avi_score ?? 0) - (p.avi_score ?? 0)),
        citationRateDelta: round1((h.citation_rate ?? 0) - (p.citation_rate ?? 0)),
        mentionRateDelta: round1((h.mention_rate ?? 0) - (p.mention_rate ?? 0)),
        sentimentDelta: round1((h.sentiment_score ?? 0) - (p.sentiment_score ?? 0)),
      }
    }
  }

  // Run the remaining summaries in parallel — each is a single small read.
  const since7 = new Date()
  since7.setDate(since7.getDate() - 7)
  const sinceIso = since7.toISOString()

  // 30-day window for the "what's working / who's getting cited" signals —
  // wider than the 7-day monitoring count because we want enough samples per
  // prompt to compute a meaningful mention rate.
  const since30 = new Date()
  since30.setDate(since30.getDate() - 30)
  const since30Iso = since30.toISOString()

  const [monitoring, prompts, aeo, siteAudit, promptInsights, topMentionedCompetitors] =
    await Promise.all([
      summarizeMonitoring(db, brandId, sinceIso),
      summarizePrompts(db, brandId),
      summarizeAeo(db, brandId),
      loadLatestSiteAuditSummary(brandId),
      summarizePromptInsights(db, brandId, since30Iso),
      summarizeCompetitorMentions(db, brandId, since30Iso),
    ])

  const [promptGenerator, externalPresence] = await Promise.all([
    buildPromptGeneratorContext(
      db,
      brand.id,
      brand.industry,
      brand.language,
      brand.name,
      aeo,
      brand.competitors,
      topMentionedCompetitors,
    ),
    // Wikipedia (free REST API) + Reddit (via Brave site:reddit.com) presence
    // check. Both are network calls but they run in parallel with the prompt
    // generator's potential LLM call so we don't add to total latency.
    // Soft-fail: if either errors we still produce a context, just with
    // externalPresence: null.
    checkBrandPresence(brand.name, brand.aliases, brand.language).catch((err) => {
      logger.warn('advisor: external presence check failed', {
        err: err instanceof Error ? err.message : String(err),
      })
      return null
    }),
  ])

  return {
    brand,
    health,
    weekDelta,
    monitoring,
    prompts,
    aeo,
    siteAudit,
    promptInsights,
    topMentionedCompetitors,
    brandDisambiguation: disambiguationFor(brand.name),
    promptGenerator,
    externalPresence,
  }
}

// ─── Brand disambiguation hints ─────────────────────────────────────────────
//
// Mirrors the smaller table in brand-enrichment.ts (kept separate here so the
// advisor doesn't import LLM-prompt-shaping logic). Add an entry whenever a
// brand name collides with a well-known platform that pollutes monitoring
// results.
const ADVISOR_DISAMBIGUATION: Array<{ match: RegExp; warning: string }> = [
  {
    match: /\bacasting\b/i,
    warning:
      'Brand name "Acasting" is frequently confused with "Acast" (Swedish podcast hosting platform). ' +
      'feeds.acast.com and acast.com surface as citations even though they are a different company. ' +
      'Recommend setting brand.aliases / brand.description copy that disambiguates explicitly.',
  },
]

function disambiguationFor(brandName: string): string | null {
  for (const hint of ADVISOR_DISAMBIGUATION) {
    if (hint.match.test(brandName)) return hint.warning
  }
  return null
}

// ─── Strategist (LLM) ────────────────────────────────────────────────────────

interface StrategistOptions {
  question?: string
  /** Output language for the advice prose. Defaults to the brand's language
   *  (or English). JSON keys + enum values always stay English. */
  language?: 'en' | 'it' | 'sv'
  /** Override provider selection (mainly for tests). */
  provider?: 'groq' | 'gemini' | 'openai'
  /** Override model. */
  model?: string
}

const LANGUAGE_LABELS: Record<'en' | 'it' | 'sv', string> = {
  en: 'English',
  it: 'Italian',
  sv: 'Swedish',
}

export async function runStrategist(
  context: AdvisorContext,
  options: StrategistOptions = {},
): Promise<{ strategy: StrategyOutput; provider: string; model: string }> {
  const question = options.question?.trim() || DEFAULT_QUESTION
  // Resolve output language: explicit option wins, else the brand's own
  // language, else English.
  const resolvedLang: 'en' | 'it' | 'sv' =
    options.language ??
    (context.brand.language === 'it' || context.brand.language === 'sv'
      ? context.brand.language
      : 'en')
  const systemPrompt = buildSystemPrompt(resolvedLang)
  const userPrompt = buildUserPrompt(context, question)

  const { text, provider, model } = await callLLM(systemPrompt, userPrompt, options)

  let parsed: unknown
  try {
    parsed = JSON.parse(extractJson(text))
  } catch (e) {
    logger.error('Advisor: strategist output is not valid JSON', {
      err: e instanceof Error ? e.message : String(e),
      preview: text.slice(0, 300),
    })
    throw new Error('Strategist returned non-JSON output')
  }

  const result = StrategyOutputSchema.safeParse(parsed)
  if (!result.success) {
    logger.error('Advisor: strategist output failed schema validation', {
      issues: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    })
    throw new Error('Strategist output failed schema validation')
  }

  return { strategy: result.data, provider, model }
}

export async function getAdvisorRecommendation(
  brandId: string,
  question?: string,
  userId?: string,
  language?: 'en' | 'it' | 'sv',
): Promise<AdvisorResult> {
  const context = await buildAdvisorContext(brandId)
  const { strategy, provider, model } = await runStrategist(context, { question, language })

  // Persist to recommendation_history asynchronously (non-blocking)
  if (userId) {
    persistAdvisorResult(brandId, userId, strategy, question).catch((e) =>
      logger.warn('advisor: failed to persist result', { err: String(e) }),
    )
  }

  return { context, strategy, provider, model }
}

async function persistAdvisorResult(
  brandId: string,
  userId: string,
  strategy: StrategyOutput,
  question?: string,
): Promise<void> {
  try {
    const db = createServerClient()
    if (!db) return
    const dbAny = db as any
    await dbAny.from('recommendation_history').insert({
      brand_id: brandId,
      user_id: userId,
      recommendations: strategy.recommendations,
      summary: strategy.summary,
      based_on_count: strategy.newPrompts?.length ?? 0,
      metadata: {
        confidence: strategy.confidence,
        newPrompts: strategy.newPrompts,
        question: question ?? null,
      },
    })
  } catch (e) {
    logger.warn('advisor: persist failed (non-critical)', { err: String(e) })
  }
}

export async function getAdvisorHistory(
  brandId: string,
  limit = 5,
): Promise<
  Array<{
    id: string
    summary: string
    confidence: number
    created_at: string
    question: string | null
  }>
> {
  const db = createServerClient()
  if (!db) return []
  try {
    const dbAny = db as any
    const { data } = (await dbAny
      .from('recommendation_history')
      .select('id, summary, metadata, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(limit)) as {
      data: Array<{
        id: string
        summary: string
        metadata: { confidence?: number; question?: string | null } | null
        created_at: string
      }> | null
    }
    return (data ?? []).map((r) => ({
      id: r.id,
      summary: r.summary,
      confidence: r.metadata?.confidence ?? 0,
      created_at: r.created_at,
      question: r.metadata?.question ?? null,
    }))
  } catch {
    return []
  }
}

// ─── Internals ───────────────────────────────────────────────────────────────

function buildSystemPrompt(language: 'en' | 'it' | 'sv' = 'en'): string {
  const geoKnowledge = formatGeoKnowledgeForPrompt()
  const langLabel = LANGUAGE_LABELS[language]
  return [
    'You are an AI Visibility strategist for AIO Pulse, a SaaS that monitors how brands are surfaced by AI answer engines (ChatGPT, Gemini, Perplexity, Claude).',
    'You advise a colleague on what to do next for ONE specific brand, using ONLY the facts in the CONTEXT block.',
    '',
    `OUTPUT LANGUAGE: Write all human-readable prose (summary, each recommendation's title, rationale, actions, sources, and any newPrompts text) in ${langLabel}. Do NOT translate the JSON keys or the enum values (impact/effort/priority must stay "high"/"medium"/"low"; intentBucket stays like "B1"). Quoted prompt texts and proper names from CONTEXT keep their original language.`,
    '',
    'GEO RESEARCH REFERENCE (use to calibrate engine-specific recommendations):',
    geoKnowledge,
    '',
    'RULES — these are absolute:',
    '1. Output a single JSON object. No prose, no markdown fences, no commentary. JSON only.',
    '2. Return at most 3 recommendations. Each must pass: would a senior product manager act on this on Monday morning?',
    '3. Ground every recommendation in a specific CONTEXT fact. Quote the fact verbatim or paraphrase it in `sources`. If you cannot point to a fact, do not include the recommendation.',
    '4. `actions` must be concrete next steps with REAL names and topics from the CONTEXT — never placeholders.',
    '   - FORBIDDEN in actions: literal "X", "Topic X", "some keywords", "various", "specific topics", "etc", "[brand]", "[competitor]".',
    '   - If you cannot name a concrete topic, keyword, competitor, or prompt text from CONTEXT, drop the action.',
    "   - Good: \"Rewrite the prompt '<exact prompt text from CONTEXT.promptInsights.worstPerforming>' (0/4 engines mention brand) as '<a more specific re-formulation that includes the brand category + location>'\". Reference REAL prompts from CONTEXT, not invented ones.",
    '   - Bad: "Seed new prompts for topic X" — exactly the placeholder pattern this rule exists to stop.',
    '5. `impact` and `effort` are your honest estimates. Prefer high-impact / low-effort.',
    '6. Confidence calibration — match data richness, not just presence of every field:',
    '   - 0.0–0.2: no health row AND <5 monitoring runs AND <3 active prompts.',
    '   - 0.3–0.5: data exists but EITHER weekDelta missing OR competitors=[] (no benchmark) OR <20 monitoring runs.',
    '   - 0.6–0.8: ≥30 monitoring runs in last 7 days AND health row present AND (weekDelta OR ≥3 competitors).',
    '   - 0.8+: ≥30 runs AND weekDelta present AND ≥3 competitors AND promptInsights has data.',
    '   Do NOT downgrade to <0.3 just because aeo or siteAudit are null — those are optional surfaces.',
    '7. If the CONTEXT is genuinely insufficient to advise, say so in `summary`, return one diagnostic recommendation, and set confidence < 0.2.',
    '8. SETUP-GAP overrides: if CONTEXT.brand.competitors is EMPTY and topMentionedCompetitors has any entries, your FIRST recommendation MUST be "Add competitors to brand config" naming the top 3-5 from topMentionedCompetitors verbatim. Without competitors no benchmark is possible — this is a higher-priority gap than any monitoring signal.',
    '9. DISAMBIGUATION: if CONTEXT.brandDisambiguation is non-null, treat the warning text as a strategic finding — recommend updating brand.aliases / brand.description copy to encode the disambiguation explicitly.',
    '10. PROMPT GENERATOR: if CONTEXT.promptGenerator is non-null, you MAY recommend creating new monitoring prompts from its suggestedNewPrompts list. Name concrete query texts from the list. This is especially valuable when the brand has few active prompts (<5), active prompts cluster in only 1-2 intent buckets, or the brand language matches locale-specific patterns in the suggested list.',
    '11. LLMS.TXT: if CONTEXT.siteAudit.hasLlmsTxt is true, note it as a positive signal. If false and the brand lacks one, you MAY recommend implementing llms.txt — use the GEO RESEARCH REFERENCE for adoption context (Claude confirmed support, ~0.3% adoption, early-mover advantage).',
    '12. ENGINE-SPECIFIC CALIBRATION: use the GEO RESEARCH REFERENCE per-engine profiles to tailor recommendations. For example:',
    '    - If Perplexity is underperforming, recommend Reddit presence (46.7% of Perplexity citations).',
    '    - If ChatGPT is underperforming, recommend Wikipedia optimization (47.9% of ChatGPT citations) and content freshness (<3 months old = 3× citation probability).',
    '    - If the brand has strong Claude coverage but weak Gemini, note the different citation patterns and suggest multimodal optimization.',
    '13. NEW PROMPTS OUTPUT: in addition to recommendations, you may populate the optional `newPrompts` array with up to 8 entries. Each entry must include a concrete `text` (the full query string), the `intentBucket` (e.g. B1-B5), and the `priority`.',
    '    - Populate newPrompts ONLY from CONTEXT.promptGenerator.suggestedNewPrompts — never invent prompts the brand is not already monitoring or that are not in the suggested list.',
    '    - Prefer prompts with score >= 3 and reasons related to AEO gaps or emerging competitors.',
    '    - The frontend will render these as \"Create prompt\" buttons — the user can activate them with one click.',
    '14. EXTERNAL PRESENCE: use CONTEXT.externalPresence as ground-truth, not assumption.',
    '    - If externalPresence.wikipedia.found === false, "create a Wikipedia article" is one of the highest-ROI actions you can recommend — quote the 47.9% ChatGPT citation share from GEO RESEARCH REFERENCE as the rationale. Treat it as impact:high effort:medium.',
    '    - If externalPresence.wikipedia.found === true, do NOT suggest creating one. Use the existing article URL (externalPresence.wikipedia.url) when relevant.',
    '    - If externalPresence.reddit.found === false AND the brand is consumer-facing or in an industry with active subreddits, recommend authentic Reddit engagement (not promotion). Quote the 46.7% Perplexity citation share. impact:medium effort:medium.',
    '    - If externalPresence.reddit.found === true with matchCount, acknowledge it (e.g. "you appear in N Reddit threads") and skip the "build Reddit presence" recommendation.',
    '    - If externalPresence is null (check failed) do NOT speculate — skip both recommendations.',
    '',
    'Schema:',
    '{ "summary": string, "recommendations": [ { "title": string, "rationale": string, "impact": "high"|"medium"|"low", "effort": "high"|"medium"|"low", "actions": string[], "sources": string[] } ], "newPrompts"?: [ { "text": string, "intentBucket": string, "priority": "high"|"medium"|"low" } ], "confidence": number }',
  ].join('\n')
}

function buildUserPrompt(context: AdvisorContext, question: string): string {
  return [
    `QUESTION: ${question}`,
    '',
    'CONTEXT (live data from this brand):',
    '```json',
    JSON.stringify(context, null, 2),
    '```',
    '',
    'Return JSON only.',
  ].join('\n')
}

interface LLMCallResult {
  text: string
  provider: string
  model: string
}

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: StrategistOptions,
  timeoutMs = 30_000,
): Promise<LLMCallResult> {
  const explicit = options.provider
  const haveGroq = !!process.env['GROQ_API_KEY']
  const haveGemini = !!process.env['GEMINI_API_KEY']
  const haveOpenAI = !!process.env['OPENAI_API_KEY']

  if (explicit === 'groq' || (!explicit && haveGroq)) {
    return callGroq(systemPrompt, userPrompt, options.model ?? 'llama-3.3-70b-versatile', timeoutMs)
  }
  if (explicit === 'gemini' || (!explicit && haveGemini)) {
    return callGemini(systemPrompt, userPrompt, options.model ?? 'gemini-2.5-flash', timeoutMs)
  }
  if (explicit === 'openai' || (!explicit && haveOpenAI)) {
    return callOpenAIChat(systemPrompt, userPrompt, options.model ?? 'gpt-4o-mini', timeoutMs)
  }
  throw new Error(
    'No LLM provider configured. Set GROQ_API_KEY (recommended), GEMINI_API_KEY, or OPENAI_API_KEY.',
  )
}

async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  timeoutMs = 30_000,
): Promise<LLMCallResult> {
  const apiKey = process.env['GROQ_API_KEY']!
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Groq HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty response from Groq')
  return { text, provider: 'groq', model }
}

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  timeoutMs = 30_000,
): Promise<LLMCallResult> {
  const apiKey = process.env['GEMINI_API_KEY']!
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1500,
        responseMimeType: 'application/json',
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`)
  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty response from Gemini')
  return { text, provider: 'gemini', model }
}

async function callOpenAIChat(
  systemPrompt: string,
  userPrompt: string,
  model: string,
  timeoutMs = 30_000,
): Promise<LLMCallResult> {
  const apiKey = process.env['OPENAI_API_KEY']!
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 1500,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`)
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty response from OpenAI')
  return { text, provider: 'openai', model }
}

// Some models (especially without json_object support) wrap JSON in ``` fences.
// Strip them defensively before parsing.
export function extractJson(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced) return fenced[1]!.trim()
  return trimmed
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function parseEngineBreakdown(raw: unknown): Record<string, number> {
  let obj: unknown = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      return {}
    }
  }
  if (!obj || typeof obj !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const n = Number(v)
    if (Number.isFinite(n)) out[k] = round1(n)
  }
  return out
}

// ── Helpers: small Supabase summaries. Cast db to any at the boundary to
// avoid the generated type's filter-chain friction (same pattern as other
// routes that touch raw tables).
/* eslint-disable @typescript-eslint/no-explicit-any */
// These helpers reach into tables that aren't in the generated Database
// type (workflow_executions count head queries, aeo_snippets, etc.) — cast
// the client at the boundary, same as the other advisor queries above.

async function summarizeMonitoring(
  db: NonNullable<ReturnType<typeof createServerClient>>,
  brandId: string,
  sinceIso: string,
): Promise<AdvisorContext['monitoring']> {
  const dbAny = db as any
  const perEngineLast7Days: Record<string, number> = {}
  let last7Days = 0
  try {
    const { data } = (await dbAny
      .from('monitoring_results')
      .select('engine')
      .eq('brand_id', brandId)
      .gte('created_at', sinceIso)) as { data: Array<{ engine: string | null }> | null }
    for (const row of data || []) {
      last7Days++
      const k = row.engine || 'unknown'
      perEngineLast7Days[k] = (perEngineLast7Days[k] || 0) + 1
    }
  } catch (e) {
    logger.warn('advisor: monitoring summary failed', { err: String(e) })
  }

  let failedWorkflowsLast7Days = 0
  try {
    const failedRes = (await dbAny
      .from('workflow_executions')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('status', 'failed')
      .gte('started_at', sinceIso)) as { count: number | null }
    failedWorkflowsLast7Days = failedRes.count ?? 0
  } catch {
    /* table optional in some envs */
  }

  return { last7Days, perEngineLast7Days, failedWorkflowsLast7Days }
}

async function summarizePrompts(
  db: NonNullable<ReturnType<typeof createServerClient>>,
  brandId: string,
): Promise<AdvisorContext['prompts']> {
  const dbAny = db as any
  const byLanguage: Record<string, number> = {}
  let active = 0
  try {
    const { data } = (await dbAny
      .from('prompts')
      .select('language')
      .eq('brand_id', brandId)
      .eq('is_active', true)) as { data: Array<{ language: string | null }> | null }
    for (const row of data || []) {
      active++
      const lang = row.language || 'unknown'
      byLanguage[lang] = (byLanguage[lang] || 0) + 1
    }
  } catch (e) {
    logger.warn('advisor: prompts summary failed', { err: String(e) })
  }
  return { active, byLanguage }
}

async function summarizeAeo(
  db: NonNullable<ReturnType<typeof createServerClient>>,
  brandId: string,
): Promise<AdvisorContext['aeo']> {
  const dbAny = db as any
  try {
    const { data } = (await dbAny
      .from('aeo_snippets')
      .select('gap_status, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(500)) as {
      data: Array<{ gap_status: string | null; created_at: string | null }> | null
    }
    if (!data || data.length === 0) return null
    let gap = 0
    let covered = 0
    for (const row of data) {
      if (row.gap_status === 'gap') gap++
      else if (row.gap_status === 'covered') covered++
    }
    return { total: data.length, gap, covered, lastRunAt: data[0]?.created_at ?? null }
  } catch {
    return null
  }
}

// Per-prompt mention rate over the last N days. Lets the Strategist say
// "rewrite prompt X (0% mention)" instead of "rewrite some prompts" — the
// most common failure mode of the old context-less output.
async function summarizePromptInsights(
  db: NonNullable<ReturnType<typeof createServerClient>>,
  brandId: string,
  sinceIso: string,
): Promise<AdvisorContext['promptInsights']> {
  const dbAny = db as any
  try {
    const { data } = (await dbAny
      .from('monitoring_results')
      .select('prompt_text, brand_mentioned')
      .eq('brand_id', brandId)
      .gte('created_at', sinceIso)
      .limit(2000)) as {
      data: Array<{ prompt_text: string | null; brand_mentioned: boolean | null }> | null
    }

    type Acc = { runs: number; mentions: number }
    const byPrompt = new Map<string, Acc>()
    for (const row of data || []) {
      const text = (row.prompt_text || '').trim()
      if (!text) continue
      const acc = byPrompt.get(text) ?? { runs: 0, mentions: 0 }
      acc.runs++
      if (row.brand_mentioned) acc.mentions++
      byPrompt.set(text, acc)
    }

    // Require at least 2 runs per prompt to compute a stable rate — single
    // outlier runs would noise the ranking.
    const ranked = [...byPrompt.entries()]
      .filter(([, acc]) => acc.runs >= 2)
      .map(([text, acc]) => ({
        text: text.length > 200 ? text.slice(0, 197) + '...' : text,
        mentionRate: Math.round((acc.mentions / acc.runs) * 100) / 100,
        runs: acc.runs,
      }))

    const topPerforming = [...ranked]
      .sort((a, b) => b.mentionRate - a.mentionRate || b.runs - a.runs)
      .slice(0, 3)
    const worstPerforming = [...ranked]
      .sort((a, b) => a.mentionRate - b.mentionRate || b.runs - a.runs)
      .slice(0, 3)

    // Sample of active prompt texts so the strategist KNOWS what topics
    // are already covered — without this it can't propose "expand topic X
    // that isn't already monitored".
    const { data: activeSample } = (await dbAny
      .from('prompts')
      .select('text')
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10)) as { data: Array<{ text: string | null }> | null }

    const sampleActive = (activeSample || [])
      .map((r) => (r.text || '').trim())
      .filter((t): t is string => t.length > 0)
      .map((t) => (t.length > 200 ? t.slice(0, 197) + '...' : t))

    return { topPerforming, worstPerforming, sampleActive }
  } catch (e) {
    logger.warn('advisor: prompt insights summary failed', { err: String(e) })
    return { topPerforming: [], worstPerforming: [], sampleActive: [] }
  }
}

// Aggregates monitoring_results.competitor_mentions (stored as Json) into a
// frequency table. This is the SINGLE most useful signal for brands with
// no competitors configured: the AI engines have already volunteered the
// names — we just need to surface them.
async function summarizeCompetitorMentions(
  db: NonNullable<ReturnType<typeof createServerClient>>,
  brandId: string,
  sinceIso: string,
): Promise<AdvisorContext['topMentionedCompetitors']> {
  const dbAny = db as any
  try {
    const { data } = (await dbAny
      .from('monitoring_results')
      .select('competitor_mentions')
      .eq('brand_id', brandId)
      .gte('created_at', sinceIso)
      .limit(2000)) as {
      data: Array<{ competitor_mentions: unknown }> | null
    }

    const counts = new Map<string, number>()
    for (const row of data || []) {
      // competitor_mentions shape:
      // [{ name: string, position?: number, count?: number }]
      // We trust `count` if present, otherwise treat as a single mention.
      const arr = Array.isArray(row.competitor_mentions) ? row.competitor_mentions : []
      for (const m of arr) {
        if (typeof m !== 'object' || m === null) continue
        const obj = m as { name?: unknown; count?: unknown }
        if (typeof obj.name !== 'string') continue
        const name = obj.name.trim()
        if (!name) continue
        const inc = typeof obj.count === 'number' && obj.count > 0 ? obj.count : 1
        counts.set(name, (counts.get(name) ?? 0) + inc)
      }
    }

    return [...counts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))
  } catch (e) {
    logger.warn('advisor: competitor mentions summary failed', { err: String(e) })
    return []
  }
}
