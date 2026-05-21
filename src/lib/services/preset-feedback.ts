// PATH: src/lib/services/preset-feedback.ts
//
// Analyzes real monitoring data to suggest improvements to industry presets.
// The feedback loop closes the gap between static template patterns and what
// actually happens in production.
//
// Three signals:
//   1. Zero-mention prompts   — patterns that consistently score 0% mention
//      rate. Candidates for deprecation from the preset's intentPatterns.
//   2. Emerging competitors    — names the AI engines mention but that aren't
//      in the brand's preset's competitors or localCompetitors lists.
//   3. Intent bucket imbalance — if monitoring data shows heavy skew toward
//      one bucket (e.g. 80% B1) with zero coverage in others (e.g. B4, B5),
//      the preset may need more patterns in missing buckets.

import { createServerClient } from '@/lib/supabase'
import { INDUSTRY_PRESETS, type IndustryPreset, type Locale } from './prompt-generator'
import { logger } from '@/lib/logger'

export interface PresetFeedbackSuggestion {
  presetId: string
  presetName: string
  deprecatePatterns: Array<{
    template: string
    mentionRate: number
    runs: number
    reason: string
  }>
  addCompetitors: Array<{
    name: string
    mentionCount: number
    suggestedLocale?: Locale
  }>
  addIntentPatterns: Array<{
    suggestedBucket: string
    reason: string
    exampleQuery: string
  }>
  health: {
    totalActivePrompts: number
    promptsWithData: number
    zeroMentionRate: number
    avgMentionRate: number
    bucketDistribution: Record<string, number>
  }
}

async function analyzeZeroMentionPrompts(
  db: ReturnType<typeof createServerClient>,
  brandId: string,
  sinceIso: string,
): Promise<PresetFeedbackSuggestion['deprecatePatterns']> {
  const dbAny = db as any
  try {
    const { data } = (await dbAny
      .from('monitoring_results')
      .select('prompt_text, brand_mentioned')
      .eq('brand_id', brandId)
      .gte('created_at', sinceIso)
      .limit(3000)) as {
      data: Array<{ prompt_text: string | null; brand_mentioned: boolean | null }> | null
    }

    const byPrompt = new Map<string, { runs: number; mentions: number }>()
    for (const row of data || []) {
      const text = (row.prompt_text || '').trim()
      if (!text) continue
      const acc = byPrompt.get(text) ?? { runs: 0, mentions: 0 }
      acc.runs++
      if (row.brand_mentioned) acc.mentions++
      byPrompt.set(text, acc)
    }

    return [...byPrompt.entries()]
      .filter(([, acc]) => acc.runs >= 3 && acc.mentions === 0)
      .map(([text, acc]) => ({
        template: text.length > 120 ? text.slice(0, 117) + '...' : text,
        mentionRate: 0,
        runs: acc.runs,
        reason: `${acc.runs} runs, 0 brand mentions — consistent non-performance`,
      }))
      .slice(0, 10)
  } catch {
    return []
  }
}

async function analyzeEmergingCompetitors(
  db: ReturnType<typeof createServerClient>,
  brandId: string,
  sinceIso: string,
  preset: IndustryPreset,
): Promise<PresetFeedbackSuggestion['addCompetitors']> {
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

    const knownCompetitors = new Set(
      [...preset.competitors, ...Object.values(preset.localCompetitors ?? {}).flat()].map((c) =>
        c.toLowerCase(),
      ),
    )

    const counts = new Map<string, number>()
    for (const row of data || []) {
      const arr = Array.isArray(row.competitor_mentions) ? row.competitor_mentions : []
      for (const m of arr) {
        if (typeof m !== 'object' || m === null) continue
        const obj = m as { name?: unknown; count?: unknown }
        if (typeof obj.name !== 'string') continue
        const name = obj.name.trim()
        if (!name || knownCompetitors.has(name.toLowerCase())) continue
        const inc = typeof obj.count === 'number' && obj.count > 0 ? obj.count : 1
        counts.set(name, (counts.get(name) ?? 0) + inc)
      }
    }

    return [...counts.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, count]) => ({
        name,
        mentionCount: count,
      }))
  } catch {
    return []
  }
}

function analyzeBucketDistribution(preset: IndustryPreset): {
  bucketDistribution: Record<string, number>
  addIntentPatterns: PresetFeedbackSuggestion['addIntentPatterns']
} {
  const bucketCounts: Record<string, number> = {}
  for (const pattern of preset.intentPatterns) {
    bucketCounts[pattern.bucket] = (bucketCounts[pattern.bucket] ?? 0) + 1
  }

  const total = Object.values(bucketCounts).reduce((a, b) => a + b, 0)
  const suggestions: PresetFeedbackSuggestion['addIntentPatterns'] = []

  const allBuckets = ['B1', 'B2', 'B3', 'B4', 'B5']
  for (const bucket of allBuckets) {
    const count = bucketCounts[bucket] ?? 0
    const ratio = total > 0 ? count / total : 0
    if (count === 0) {
      suggestions.push({
        suggestedBucket: bucket,
        reason: `No patterns in ${bucket} — entire intent category missing from preset "${preset.id}"`,
        exampleQuery: '',
      })
    } else if (ratio < 0.1) {
      suggestions.push({
        suggestedBucket: bucket,
        reason: `Only ${count} pattern(s) in ${bucket} (${Math.round(ratio * 100)}% of total) — underrepresented`,
        exampleQuery: '',
      })
    }
  }

  return { bucketDistribution: bucketCounts, addIntentPatterns: suggestions }
}

export async function getPresetFeedback(brandId: string): Promise<PresetFeedbackSuggestion | null> {
  const db = createServerClient()
  if (!db) throw new Error('Database not configured')

  const dbAny = db as any

  const { data: brandRow } = (await dbAny
    .from('brands')
    .select('id, name, industry')
    .eq('id', brandId)
    .single()) as { data: { id: string; name: string; industry: string | null } | null }

  if (!brandRow?.industry) return null

  const norm = brandRow.industry.toLowerCase().replace(/[\s-]+/g, '')
  let preset: IndustryPreset | undefined
  for (const p of INDUSTRY_PRESETS) {
    if (p.id.replace(/[\s-]+/g, '') === norm) {
      preset = p
      break
    }
    for (const name of Object.values(p.name)) {
      if (name.toLowerCase().replace(/[\s-]+/g, '') === norm) {
        preset = p
        break
      }
    }
    if (preset) break
  }
  if (!preset) {
    for (const p of INDUSTRY_PRESETS) {
      if (norm.includes(p.id.replace(/[\s-]+/g, ''))) {
        preset = p
        break
      }
      for (const name of Object.values(p.name)) {
        if (
          name
            .toLowerCase()
            .replace(/[\s-]+/g, '')
            .includes(norm)
        ) {
          preset = p
          break
        }
      }
      if (preset) break
    }
  }
  if (!preset) return null

  const since30 = new Date()
  since30.setDate(since30.getDate() - 30)
  const sinceIso = since30.toISOString()

  const [deprecatePatterns, addCompetitors, { bucketDistribution, addIntentPatterns }] =
    await Promise.all([
      analyzeZeroMentionPrompts(db, brandId, sinceIso),
      analyzeEmergingCompetitors(db, brandId, sinceIso, preset),
      Promise.resolve(analyzeBucketDistribution(preset)),
    ])

  const { data: activePrompts } = (await dbAny
    .from('prompts')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId)
    .eq('is_active', true)) as { data: unknown; count: number | null }
  const totalActivePrompts = activePrompts ?? 0

  const promptsWithData = deprecatePatterns.reduce((s, p) => s + p.runs, 0)

  return {
    presetId: preset.id,
    presetName: preset.name.en,
    deprecatePatterns,
    addCompetitors,
    addIntentPatterns,
    health: {
      totalActivePrompts: totalActivePrompts as number,
      promptsWithData,
      zeroMentionRate:
        deprecatePatterns.length > 0
          ? Math.round((deprecatePatterns.length / Math.max(promptsWithData, 1)) * 100)
          : 0,
      avgMentionRate: 0,
      bucketDistribution,
    },
  }
}
