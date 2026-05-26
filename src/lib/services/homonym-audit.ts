// PATH: src/lib/services/homonym-audit.ts
//
// Homonym-audit service. For each "brand_mentioned = true" row in
// monitoring_results, ask an LLM whether the response is REALLY about
// this brand or whether the AI engine confused it with a homonym
// (Acasting ↔ Acast podcast; Savant ↔ "savant" adjective; …). Sets
// `confusion_flag = true` + `confusion_reason` on confused rows.
//
// Read consumers (share-of-voice, sentiment-drivers, etc.) filter
// `confusion_flag = false` so the metrics they surface only count
// mentions the audit confirmed are about THIS brand.
//
// Pure-ish: the classifier (`classifyMention`) is unit-testable with an
// injected `callLLM` mock. `auditBrandMentions` orchestrates the DB
// read + classifier loop + write-back.

import { callLLM } from '@/lib/services/prompt-generator-ai'
import { logger } from '@/lib/logger'
import type { createServerClient } from '@/lib/supabase'

type ServerClient = NonNullable<ReturnType<typeof createServerClient>>

/** Brand context the classifier needs to disambiguate. */
export interface BrandContext {
  name: string
  domain?: string | null
  industry?: string | null
  description?: string | null
  aliases?: string[] | null
  disambiguation?: string | null
}

/** One row to audit. Trimmed to what the classifier actually uses. */
export interface AuditRow {
  id: string
  response_text: string | null
  engine: string | null
}

/** Classifier verdict for a single mention. */
export interface MentionVerdict {
  actuallyAboutBrand: boolean
  confidence: 'high' | 'medium' | 'low'
  reason: string
}

/** Aggregate result of one audit run. */
export interface AuditSummary {
  scanned: number
  audited: number
  flagged: number
  ambiguous: number
  errors: number
  /** Cost-saver counter — rows we already audited in a prior run. */
  skipped: number
}

const CLASSIFIER_SYSTEM_PROMPT = `You are an entity-resolution auditor. Given a brand profile and an AI assistant's response that mentioned the brand by name, decide whether the response is GENUINELY about that brand or whether the AI confused it with a homonym (a different entity with the same or similar name).

You MUST output strict JSON, no prose, no markdown fences. Schema:

{
  "actually_about_brand": boolean,
  "confidence": "high" | "medium" | "low",
  "reason": "<one short English sentence — what tells you it's the brand or a homonym>"
}

Rules:
- "actually_about_brand": true ONLY when the response's context (industry, domain, products, geography) matches the brand profile. If the response talks about a different company/concept that happens to share the name, set false.
- "confidence": "high" when industry/domain match is unambiguous; "medium" when context is generic but plausible; "low" when the response is too short or generic to tell.
- "reason": one sentence. Cite the disambiguating signal ("mentions podcast hosting, not casting" / "matches the Swedish marketing agency context" / "too generic to tell").`

function buildClassifierUserPrompt(brand: BrandContext, excerpt: string): string {
  const lines: string[] = []
  lines.push('Brand profile:')
  lines.push(`- Name: ${brand.name}`)
  if (brand.domain) lines.push(`- Domain: ${brand.domain}`)
  if (brand.industry) lines.push(`- Industry: ${brand.industry}`)
  if (brand.description) lines.push(`- Description: ${brand.description.slice(0, 400)}`)
  if (brand.aliases && brand.aliases.length > 0) {
    lines.push(`- Aliases: ${brand.aliases.join(', ')}`)
  }
  if (brand.disambiguation) {
    lines.push(`- Known homonym warning: ${brand.disambiguation.slice(0, 400)}`)
  }
  lines.push('')
  lines.push('AI response excerpt:')
  lines.push('"""')
  // Cap excerpt to keep token cost predictable — 1200 chars is enough
  // context for the classifier without exploding cost on long answers.
  lines.push(excerpt.slice(0, 1200))
  lines.push('"""')
  return lines.join('\n')
}

/**
 * Ask the LLM whether `excerpt` is actually about `brand`. Pure function
 * over the LLM-call boundary so tests can inject a mock `llmCaller`.
 * The default `llmCaller` is the shared `callLLM` resilient chain.
 */
export async function classifyMention(
  brand: BrandContext,
  excerpt: string,
  llmCaller: (system: string, user: string) => Promise<{ text: string }> = callLLM,
): Promise<MentionVerdict> {
  const user = buildClassifierUserPrompt(brand, excerpt)
  const { text } = await llmCaller(CLASSIFIER_SYSTEM_PROMPT, user)
  return parseVerdict(text)
}

/** Defensive parser — accepts either bare JSON or a fenced block. */
export function parseVerdict(text: string): MentionVerdict {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim()
  const obj = JSON.parse(cleaned) as Record<string, unknown>

  const actuallyAboutBrand = Boolean(obj['actually_about_brand'])

  const rawConf = String(obj['confidence'] ?? 'medium').toLowerCase()
  const confidence: MentionVerdict['confidence'] =
    rawConf === 'high' || rawConf === 'low' ? rawConf : 'medium'

  const reason =
    typeof obj['reason'] === 'string' && (obj['reason'] as string).trim().length > 0
      ? (obj['reason'] as string).trim().slice(0, 300)
      : 'No reason provided'

  return { actuallyAboutBrand, confidence, reason }
}

/**
 * Run the audit for one brand. Walks pending rows (brand_mentioned=true,
 * confusion_audited_at IS NULL), classifies each, writes back the flag +
 * reason + audited_at timestamp.
 *
 * Caps total work per call (`limit`, default 50) so a single trigger
 * can't blow up cost or latency for an active brand with thousands of
 * historical rows — the caller (or a cron) can re-trigger to drain.
 */
export async function auditBrandMentions(
  db: ServerClient,
  brandId: string,
  brand: BrandContext,
  opts: { limit?: number; confidenceFloor?: MentionVerdict['confidence'] } = {},
): Promise<AuditSummary> {
  const limit = opts.limit ?? 50
  // Only "high" or higher gets flagged by default — "medium"/"low" stay
  // unflagged so an over-eager classifier doesn't quietly suppress real
  // mentions. Tightening this turns into an audit policy knob later.
  const confidenceFloor = opts.confidenceFloor ?? 'high'

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const dbAny = db as any
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const { data: rows, error } = await dbAny
    .from('monitoring_results')
    .select('id, response_text, engine')
    .eq('brand_id', brandId)
    .eq('brand_mentioned', true)
    .is('confusion_audited_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to load pending audit rows: ${error.message}`)
  }

  const pending = (rows ?? []) as AuditRow[]
  const summary: AuditSummary = {
    scanned: pending.length,
    audited: 0,
    flagged: 0,
    ambiguous: 0,
    errors: 0,
    skipped: 0,
  }

  if (pending.length === 0) return summary

  // Process sequentially: the LLM fallback chain already handles 429s
  // with backoff, parallel calls would just amplify rate-limit pressure.
  for (const row of pending) {
    if (!row.response_text || row.response_text.trim().length < 20) {
      // Too short to classify — mark as audited with a sentinel so we
      // don't keep retrying these forever.
      await dbAny
        .from('monitoring_results')
        .update({
          confusion_flag: false,
          confusion_reason: 'skipped (response too short to classify)',
          confusion_audited_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      summary.skipped++
      continue
    }

    try {
      const verdict = await classifyMention(brand, row.response_text)

      // Confidence floor: only flag at-or-above the configured level.
      const confidenceRank = { low: 0, medium: 1, high: 2 } as const
      const passesFloor = confidenceRank[verdict.confidence] >= confidenceRank[confidenceFloor]
      const flag = !verdict.actuallyAboutBrand && passesFloor

      if (flag) summary.flagged++
      else if (!verdict.actuallyAboutBrand) summary.ambiguous++

      await dbAny
        .from('monitoring_results')
        .update({
          confusion_flag: flag,
          confusion_reason: verdict.reason,
          confusion_audited_at: new Date().toISOString(),
        })
        .eq('id', row.id)

      summary.audited++
    } catch (e) {
      summary.errors++
      logger.warn('homonym-audit: classifier failed for row', {
        rowId: row.id,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return summary
}

/**
 * Aggregate stats for the audit panel: total audited, flagged count,
 * confusion rate, plus the N most-recent flagged mentions for display.
 */
export interface AuditStats {
  totalMentions: number
  auditedMentions: number
  flaggedMentions: number
  pendingMentions: number
  confusionRate: number
  recentFlagged: Array<{
    id: string
    engine: string | null
    response_excerpt: string
    reason: string | null
    audited_at: string | null
  }>
}

export async function getAuditStats(
  db: ServerClient,
  brandId: string,
  recentLimit = 10,
): Promise<AuditStats> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const dbAny = db as any
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const [totalRes, auditedRes, flaggedRes, recentRes] = await Promise.all([
    dbAny
      .from('monitoring_results')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('brand_mentioned', true),
    dbAny
      .from('monitoring_results')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('brand_mentioned', true)
      .not('confusion_audited_at', 'is', null),
    dbAny
      .from('monitoring_results')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .eq('confusion_flag', true),
    dbAny
      .from('monitoring_results')
      .select('id, engine, response_text, confusion_reason, confusion_audited_at')
      .eq('brand_id', brandId)
      .eq('confusion_flag', true)
      .order('confusion_audited_at', { ascending: false })
      .limit(recentLimit),
  ])

  const totalMentions = totalRes.count ?? 0
  const auditedMentions = auditedRes.count ?? 0
  const flaggedMentions = flaggedRes.count ?? 0
  const pendingMentions = Math.max(0, totalMentions - auditedMentions)
  const confusionRate =
    auditedMentions > 0 ? Math.round((flaggedMentions / auditedMentions) * 1000) / 10 : 0

  const recentFlagged = (
    (recentRes.data ?? []) as Array<{
      id: string
      engine: string | null
      response_text: string | null
      confusion_reason: string | null
      confusion_audited_at: string | null
    }>
  ).map((r) => ({
    id: r.id,
    engine: r.engine,
    response_excerpt: (r.response_text ?? '').slice(0, 240),
    reason: r.confusion_reason,
    audited_at: r.confusion_audited_at,
  }))

  return {
    totalMentions,
    auditedMentions,
    flaggedMentions,
    pendingMentions,
    confusionRate,
    recentFlagged,
  }
}
