// PATH: src/lib/services/citation-snapshots.ts
import { createServerClient } from '@/lib/supabase'

interface CompetitorRate {
  [name: string]: number
}

interface SnapshotRow {
  project_id: string
  scan_date: string
  engine: string
  category: string
  language: string
  total_prompts: number
  brand_citations: number
  citation_rate: number
  avg_position: number | null
  avg_visibility: number
  avg_sentiment: number
  competitor_rates: CompetitorRate
}

/**
 * Calculate citation snapshots for a brand on a given date.
 * Aggregates monitoring_results by engine × category × language into citation_snapshots.
 *
 * Call this after a scan completes, or via a daily cron job.
 */
export async function calculateCitationSnapshots(
  brandId: string,
  date?: string, // 'YYYY-MM-DD', defaults to today
): Promise<{ inserted: number; errors: string[] }> {
  const db = createServerClient()
  if (!db) return { inserted: 0, errors: ['Database not configured'] }

  const scanDate: string = date ?? new Date().toISOString().split('T')[0]!

  // ── Fetch all monitoring results for this brand on this date ──────────────
  const dayStart = `${scanDate}T00:00:00.000Z`
  const dayEnd = `${scanDate}T23:59:59.999Z`

  const { data: results, error: fetchError } = await (db as any)
    .from('monitoring_results')
    .select('*, prompt:prompts(category,language)')
    .eq('brand_id', brandId)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)

  if (fetchError) {
    return { inserted: 0, errors: [`Fetch error: ${fetchError.message}`] }
  }

  if (!results || results.length === 0) {
    return { inserted: 0, errors: [] }
  }

  // ── Fetch brand competitors for competitor rate calculation ────────────────
  const { data: brand } = await (db as any)
    .from('brands')
    .select('competitors')
    .eq('id', brandId)
    .single()

  const competitors: string[] = brand?.competitors || []

  // ── Group results by engine × category × language ─────────────────────────
  const engines = ['chatgpt', 'gemini', 'perplexity'] as const
  const categories = [
    ...new Set(results.map((r: any) => r.prompt?.category).filter(Boolean)),
    'all',
  ]
  const languages = [
    ...new Set(results.map((r: any) => r.prompt?.language || 'en').filter(Boolean)),
    'all',
  ]
  const engineList = [...engines, 'all'] as const

  const snapshots: SnapshotRow[] = []

  for (const engine of engineList) {
    for (const category of categories) {
      for (const language of languages) {
        const filtered = results.filter((r: any) => {
          const engineMatch = engine === 'all' || r.engine === engine
          const catMatch = category === 'all' || r.prompt?.category === category
          const langMatch = language === 'all' || r.prompt?.language === language
          return engineMatch && catMatch && langMatch
        })

        if (filtered.length === 0) continue

        const totalPrompts = filtered.length
        const brandCitations = filtered.filter((r: any) => r.brand_mentioned).length
        const citationRate = totalPrompts > 0 ? (brandCitations / totalPrompts) * 100 : 0

        const mentionedWithPosition = filtered.filter(
          (r: any) => r.brand_mentioned && r.mention_position != null,
        )
        const avgPosition =
          mentionedWithPosition.length > 0
            ? mentionedWithPosition.reduce((sum: number, r: any) => sum + r.mention_position, 0) /
              mentionedWithPosition.length
            : null

        const avgVisibility =
          filtered.reduce((sum: number, r: any) => sum + (r.visibility_score || 0), 0) /
          totalPrompts
        const avgSentiment =
          filtered.reduce((sum: number, r: any) => sum + (r.sentiment_score || 0), 0) / totalPrompts

        const competitorRates: CompetitorRate = {}
        for (const comp of competitors) {
          const compLower = comp.toLowerCase()
          const compMentioned = filtered.filter((r: any) => {
            const mentions = r.competitor_mentions as Array<{ name: string }> | undefined
            if (!mentions || !Array.isArray(mentions)) return false
            return mentions.some((m) => m.name.toLowerCase().includes(compLower))
          }).length
          competitorRates[comp] =
            totalPrompts > 0 ? Math.round((compMentioned / totalPrompts) * 100) : 0
        }

        snapshots.push({
          project_id: brandId,
          scan_date: scanDate,
          engine: engine as string,
          category: category as string,
          language: language as string,
          total_prompts: totalPrompts,
          brand_citations: brandCitations,
          citation_rate: Math.round(citationRate * 100) / 100,
          avg_position: avgPosition ? Math.round(avgPosition * 100) / 100 : null,
          avg_visibility: Math.round(avgVisibility * 100) / 100,
          avg_sentiment: Math.round(avgSentiment * 1000) / 1000,
          competitor_rates: competitorRates,
        })
      }
    }
  }

  // ── Upsert snapshots ──────────────────────────────────────────────────────
  const errors: string[] = []
  let inserted = 0

  for (const snap of snapshots) {
    const { error: upsertError } = await (db as any)
      .from('citation_snapshots')
      .upsert(snap, { onConflict: 'project_id,scan_date,engine,category,language' })

    if (upsertError) {
      errors.push(`${snap.engine}/${snap.category}/${snap.language}: ${upsertError.message}`)
    } else {
      inserted++
    }
  }

  console.log(
    `[citation-snapshots] Brand ${brandId} @ ${scanDate}: ${inserted} snapshots saved, ${errors.length} errors`,
  )

  return { inserted, errors }
}
