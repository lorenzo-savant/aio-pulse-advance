// PATH: src/lib/services/citation-snapshots.ts
import { createServerClient } from '@/lib/supabase'
import { providerMatchesEngine } from './engine-provenance'
import { logger } from '@/lib/logger'

interface MonitoringResultRow {
  response_provider?: string | null
  id: string
  brand_id: string
  engine: string
  response_text: string
  brand_mentioned: boolean
  mention_position: number | null
  visibility_score: number | null
  sentiment_score: number | null
  competitor_mentions: Array<{ name: string }> | null
  created_at: string
  prompt?: { category?: string; language?: string } | null
}

interface CompetitorRate {
  [name: string]: number
}

interface SnapshotRow {
  brand_id: string
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
 * Rows per upsert round-trip. A single date produces engine × category ×
 * language rows — 120 for a brand with 5 categories and 3 languages — so one
 * chunk covers a typical day in a single call while keeping the request body
 * bounded and a failure locatable.
 */
const UPSERT_CHUNK_SIZE = 500

/**
 * Default and hard ceiling for how many distinct dates one backfill call will
 * rebuild. The dashboard's longest period is `1y`, so the ceiling is a leap
 * year's worth of days; the default covers the common `90d` view.
 *
 * These exist because delegating per date removed the crude `.limit(1000)`
 * that used to bound the old implementation. Unbounded work behind an HTTP
 * handler is how a brand with a long history times out a function mid-write.
 */
const DEFAULT_MAX_BACKFILL_DATES = 90
const MAX_BACKFILL_DATES_CEILING = 366

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

  const { data: results, error: fetchError } = await db
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
  const { data: brand } = await db.from('brands').select('competitors').eq('id', brandId).single()

  const competitors: string[] = brand?.competitors || []

  // Compile each competitor's matcher ONCE, not once per
  // engine × category × language combination. A brand with 5 categories and
  // 3 languages produces 120 combinations, so the inner loop used to rebuild
  // every competitor's regex 120 times per day being snapshotted.
  //
  // Word-boundary match instead of substring includes(). Substring matching
  // caused real false positives: "Acast" matched "Acasting" because the string
  // IS contained — but they are two different companies (Acasting = casting
  // platform, Acast = podcast hosting). The regex escape + \b ensures "Acast"
  // only matches the whole word "Acast", not "Acasting" / "Acasta" / etc.
  const competitorMatchers: Array<{ name: string; pattern: RegExp }> = competitors.map((name) => ({
    name,
    pattern: new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
  }))

  // ── Group results by engine × category × language ─────────────────────────
  const engines = ['chatgpt', 'gemini', 'perplexity', 'claude'] as const
  const rows = results as unknown as MonitoringResultRow[]

  const categories = [...new Set(rows.map((r) => r.prompt?.category).filter(Boolean)), 'all']
  const languages = [...new Set(rows.map((r) => r.prompt?.language || 'en').filter(Boolean)), 'all']
  const engineList = [...engines, 'all'] as const

  const snapshots: SnapshotRow[] = []

  for (const engine of engineList) {
    for (const category of categories) {
      for (const language of languages) {
        const filtered = rows.filter((r) => {
          // Per-engine buckets only accept rows the engine's own provider
          // answered (engine-provenance.ts). The 'all' bucket keeps every
          // row: a fallback-served answer is still a real AI answer — it is
          // just not a measurement of the engine it was requested for.
          const engineMatch =
            engine === 'all' ||
            (r.engine === engine && providerMatchesEngine(r.engine, r.response_provider))
          const catMatch = category === 'all' || r.prompt?.category === category
          const langMatch = language === 'all' || r.prompt?.language === language
          return engineMatch && catMatch && langMatch
        })

        if (filtered.length === 0) continue

        const totalPrompts = filtered.length
        const brandCitations = filtered.filter((r) => r.brand_mentioned).length
        const citationRate = totalPrompts > 0 ? (brandCitations / totalPrompts) * 100 : 0

        const mentionedWithPosition = filtered.filter(
          (r) => r.brand_mentioned && r.mention_position != null,
        )
        const avgPosition =
          mentionedWithPosition.length > 0
            ? mentionedWithPosition.reduce((sum, r) => sum + (r.mention_position ?? 0), 0) /
              mentionedWithPosition.length
            : null

        const avgVisibility =
          filtered.reduce((sum, r) => sum + (r.visibility_score || 0), 0) / totalPrompts
        const avgSentiment =
          filtered.reduce((sum, r) => sum + (r.sentiment_score || 0), 0) / totalPrompts

        const competitorRates: CompetitorRate = {}
        for (const { name, pattern } of competitorMatchers) {
          const compMentioned = filtered.filter((r) => {
            const mentions = r.competitor_mentions
            if (!mentions || !Array.isArray(mentions)) return false
            return mentions.some((m) => pattern.test(m.name))
          }).length
          competitorRates[name] =
            totalPrompts > 0 ? Math.round((compMentioned / totalPrompts) * 100) : 0
        }

        snapshots.push({
          brand_id: brandId,
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
  // Chunked batch, not one round-trip per row. A brand with 5 categories and
  // 3 languages produces 120 rows per date; the previous per-row loop meant
  // 120 sequential network round-trips for a single day, and a date-range
  // backfill multiplied that by the number of days.
  //
  // Chunking rather than one giant call keeps a failure from taking the whole
  // range down with it, and keeps the request body bounded.
  const errors: string[] = []
  let inserted = 0

  for (let i = 0; i < snapshots.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = snapshots.slice(i, i + UPSERT_CHUNK_SIZE)
    const { error: upsertError } = await db
      .from('citation_snapshots')
      .upsert(chunk, { onConflict: 'brand_id,scan_date,engine,category,language' })

    if (upsertError) {
      // Batching trades per-row error detail for round-trips. Name the chunk
      // by its boundaries so a failure is still locatable.
      const first = chunk[0]
      const last = chunk[chunk.length - 1]
      errors.push(
        `${chunk.length} rows (${first?.engine}/${first?.category}/${first?.language} … ` +
          `${last?.engine}/${last?.category}/${last?.language}): ${upsertError.message}`,
      )
    } else {
      inserted += chunk.length
    }
  }

  logger.info('Citation snapshots calculated', {
    service: 'citation-snapshots',
    brandId,
    scanDate,
    inserted,
    errorCount: errors.length,
  })

  return { inserted, errors }
}

/**
 * Rebuild snapshots for every date a brand has monitoring results on, within a
 * bounded window.
 *
 * WHY THIS EXISTS
 * `autoGenerateSnapshots` in analytics-service used to do this, but it wrote
 * the aggregate row with `avg_position: null` and `competitor_rates: {}`
 * hardcoded — and because a Supabase upsert replaces the full column set, it
 * destroyed whatever `calculateCitationSnapshots` had computed for the same
 * row. This function derives the same date list and delegates to the writer
 * that actually computes those fields, so there is exactly one writer for this
 * table.
 *
 * BOUNDED ON PURPOSE
 * The old implementation was capped, crudely, by `.limit(1000)` on the results
 * query. Delegating per date removes that cap, so the window is now explicit:
 * `maxDates` bounds the work and `truncated` reports when the bound bit. A
 * silent cap would read as "we rebuilt everything" when it did not.
 */
export async function backfillSnapshotsForRange(
  brandId: string,
  opts: { from?: string; to?: string; maxDates?: number } = {},
): Promise<{
  inserted: number
  datesProcessed: number
  datesAvailable: number
  truncated: boolean
  errors: string[]
}> {
  const db = createServerClient()
  if (!db) {
    return {
      inserted: 0,
      datesProcessed: 0,
      datesAvailable: 0,
      truncated: false,
      errors: ['Database not configured'],
    }
  }

  const maxDates = Math.max(
    1,
    Math.min(opts.maxDates ?? DEFAULT_MAX_BACKFILL_DATES, MAX_BACKFILL_DATES_CEILING),
  )

  // Only the timestamp is needed to derive the date list — never `select('*')`,
  // which would pull every stored engine response body across the window.
  let query = db.from('monitoring_results').select('created_at').eq('brand_id', brandId)
  if (opts.from) query = query.gte('created_at', `${opts.from}T00:00:00.000Z`)
  if (opts.to) query = query.lte('created_at', `${opts.to}T23:59:59.999Z`)

  const { data, error } = await query
  if (error) {
    return {
      inserted: 0,
      datesProcessed: 0,
      datesAvailable: 0,
      truncated: false,
      errors: [`Fetch error: ${error.message}`],
    }
  }

  const allDates = [
    ...new Set((data ?? []).map((r) => String(r.created_at).slice(0, 10)).filter(Boolean)),
  ].sort()

  // Newest first when truncating: a partial rebuild should favour the dates a
  // user is most likely to be looking at.
  const dates = allDates.length > maxDates ? allDates.slice(-maxDates) : allDates
  const truncated = dates.length < allDates.length

  let inserted = 0
  const errors: string[] = []
  for (const date of dates) {
    const result = await calculateCitationSnapshots(brandId, date)
    inserted += result.inserted
    if (result.errors.length) errors.push(...result.errors.map((e) => `${date}: ${e}`))
  }

  if (truncated) {
    logger.warn('Snapshot backfill truncated by the date bound', {
      service: 'citation-snapshots',
      brandId,
      datesAvailable: allDates.length,
      datesProcessed: dates.length,
      maxDates,
    })
  }

  return {
    inserted,
    datesProcessed: dates.length,
    datesAvailable: allDates.length,
    truncated,
    errors,
  }
}
