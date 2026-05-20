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

export const StrategyOutputSchema = z.object({
  summary: z.string().min(10).max(600),
  recommendations: z.array(StrategyRecommendationSchema).min(1).max(3),
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
}

export interface AdvisorResult {
  context: AdvisorContext
  strategy: StrategyOutput
  provider: string
  model: string
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  /** Override provider selection (mainly for tests). */
  provider?: 'groq' | 'gemini' | 'openai'
  /** Override model. */
  model?: string
}

export async function runStrategist(
  context: AdvisorContext,
  options: StrategistOptions = {},
): Promise<{ strategy: StrategyOutput; provider: string; model: string }> {
  const question = options.question?.trim() || DEFAULT_QUESTION
  const systemPrompt = buildSystemPrompt()
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
): Promise<AdvisorResult> {
  const context = await buildAdvisorContext(brandId)
  const { strategy, provider, model } = await runStrategist(context, { question })
  return { context, strategy, provider, model }
}

// ─── Internals ───────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return [
    'You are an AI Visibility strategist for AIO Pulse, a SaaS that monitors how brands are surfaced by AI answer engines (ChatGPT, Gemini, Perplexity, Claude).',
    'You advise a colleague on what to do next for ONE specific brand, using ONLY the facts in the CONTEXT block.',
    '',
    'RULES — these are absolute:',
    '1. Output a single JSON object. No prose, no markdown fences, no commentary. JSON only.',
    '2. Return at most 3 recommendations. Each must pass: would a senior product manager act on this on Monday morning?',
    '3. Ground every recommendation in a specific CONTEXT fact. Quote the fact verbatim or paraphrase it in `sources`. If you cannot point to a fact, do not include the recommendation.',
    '4. `actions` must be concrete next steps with REAL names and topics from the CONTEXT — never placeholders.',
    '   - FORBIDDEN in actions: literal "X", "Topic X", "some keywords", "various", "specific topics", "etc", "[brand]", "[competitor]".',
    '   - If you cannot name a concrete topic, keyword, competitor, or prompt text from CONTEXT, drop the action.',
    "   - Good: \"Rewrite the prompt 'Vad är acasting.se?' (0/4 engines mention brand) as 'Bästa castingplattformen i Sverige för skådespelare'\".",
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
    '',
    'Schema:',
    '{ "summary": string, "recommendations": [ { "title": string, "rationale": string, "impact": "high"|"medium"|"low", "effort": "high"|"medium"|"low", "actions": string[], "sources": string[] } ], "confidence": number }',
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
): Promise<LLMCallResult> {
  const explicit = options.provider
  const haveGroq = !!process.env['GROQ_API_KEY']
  const haveGemini = !!process.env['GEMINI_API_KEY']
  const haveOpenAI = !!process.env['OPENAI_API_KEY']

  if (explicit === 'groq' || (!explicit && haveGroq)) {
    return callGroq(systemPrompt, userPrompt, options.model ?? 'llama-3.3-70b-versatile')
  }
  if (explicit === 'gemini' || (!explicit && haveGemini)) {
    return callGemini(systemPrompt, userPrompt, options.model ?? 'gemini-2.5-flash')
  }
  if (explicit === 'openai' || (!explicit && haveOpenAI)) {
    return callOpenAIChat(systemPrompt, userPrompt, options.model ?? 'gpt-4o-mini')
  }
  throw new Error(
    'No LLM provider configured. Set GROQ_API_KEY (recommended), GEMINI_API_KEY, or OPENAI_API_KEY.',
  )
}

async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  model: string,
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
    signal: AbortSignal.timeout(30_000),
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
    signal: AbortSignal.timeout(30_000),
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
    signal: AbortSignal.timeout(30_000),
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
