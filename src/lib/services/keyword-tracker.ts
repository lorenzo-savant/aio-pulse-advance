import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { classifyKeywordsForBrand } from './keyword-clustering'

interface KeywordData {
  keyword: string
  mention_count: number
  correlation_score: number
  engines: string[]
  first_seen: string | null
  last_seen: string | null
}

interface MonitoringResult {
  id: string
  brand_id: string
  engine: string
  response_text: string | null
  brand_mentioned: boolean | null
  created_at: string | null
}

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'as',
  'is',
  'was',
  'are',
  'were',
  'been',
  'be',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'must',
  'shall',
  'can',
  'need',
  'dare',
  'ought',
  'used',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
  'what',
  'which',
  'who',
  'whom',
  'whose',
  'where',
  'when',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'nor',
  'not',
  'only',
  'own',
  'same',
  'so',
  'than',
  'too',
  'very',
  'just',
  'also',
  'now',
  'here',
  'there',
  'then',
  'if',
  'about',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'under',
  'again',
  'further',
  'once',
  'etc',
  'eg',
  'ie',
  'vs',
  'via',
  'per',
  'say',
  'says',
  'said',
  'going',
  'make',
  'get',
  'got',
  'use',
  'using',
  'based',
  'including',
  'according',
  'available',
  'see',
  'know',
  'want',
  'think',
  'take',
  'come',
  'made',
  'find',
  'give',
  'tell',
  'try',
  'call',
  'look',
  'seem',
  'help',
  'show',
  'hear',
  'play',
  'run',
  'move',
  'live',
  'believe',
  'bring',
  // ── Swedish stopwords ──────────────────────────────────────────────────
  'och', 'att', 'det', 'som', 'är', 'på', 'för', 'med', 'en', 'ett', 'den', 'de',
  'har', 'inte', 'av', 'om', 'eller', 'var', 'vi', 'ni', 'du', 'jag', 'hon', 'han',
  'mig', 'dig', 'sig', 'sin', 'sina', 'sitt', 'men', 'till', 'från', 'kan', 'kunde',
  'ska', 'skulle', 'här', 'där', 'när', 'då', 'så', 'också', 'även', 'mer', 'mest',
  'mycket', 'lite', 'några', 'alla', 'bara', 'ännu', 'redan', 'enligt', 'samma',
  'andra', 'annan', 'annat', 'varje', 'både', 'inom', 'utan', 'över', 'under',
  'genom', 'mellan', 'hos', 'ger', 'fick', 'varit', 'blivit', 'blir', 'bli',
  'väl', 'ganska', 'dock', 'således', 'eftersom', 'därför', 'medan', 'innan',
  'efter', 'före', 'mot', 'via', 'ej', 'nu', 'sedan', 'sen',
  // ── Italian stopwords ──────────────────────────────────────────────────
  'il', 'lo', 'la', 'le', 'gli', 'uno', 'una', 'del', 'della', 'dello', 'degli',
  'delle', 'dei', 'al', 'allo', 'alla', 'alle', 'agli', 'ai', 'nel', 'nello',
  'nella', 'nelle', 'negli', 'nei', 'dal', 'dallo', 'dalla', 'dalle', 'dagli',
  'dai', 'sul', 'sullo', 'sulla', 'sulle', 'sugli', 'sui', 'che', 'chi', 'cui',
  'non', 'ma', 'però', 'anche', 'ancora', 'già', 'solo', 'sempre', 'mai', 'più',
  'meno', 'molto', 'poco', 'tanto', 'tutto', 'tutti', 'tutta', 'tutte', 'essere',
  'avere', 'fare', 'dire', 'sono', 'sei', 'era', 'sarà', 'ho', 'hai', 'abbiamo',
  'hanno', 'loro', 'voi', 'noi', 'lui', 'lei', 'essi', 'esse', 'io', 'tu',
  'suo', 'sua', 'suoi', 'sue', 'nostro', 'vostro', 'mio', 'mia', 'miei', 'tuo',
  'tua', 'con', 'per', 'tra', 'fra', 'su', 'giù', 'quanto', 'quando', 'dove',
  'come', 'perché', 'cosa', 'così', 'quale', 'quali', 'senza', 'dentro', 'fuori',
  'sotto', 'sopra', 'verso', 'presso', 'dopo', 'prima',
])

const PURE_NUMBER = /^\d+$/

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zåäöüßéèêëàâáãíîìôòóúùçñ\s]/g, ' ')
    .split(/\s+/)
    .filter(
      (word) =>
        word.length >= 3 &&
        word.length <= 30 &&
        !PURE_NUMBER.test(word) &&
        !STOP_WORDS.has(word),
    )
}

function countTokens(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const w of tokenize(text)) {
    counts.set(w, (counts.get(w) || 0) + 1)
  }
  return counts
}

export async function trackKeywords(brandId: string): Promise<void> {
  const db = createServerClient()
  if (!db) {
    logger.warn('Database not configured', { service: 'keyword-tracker' })
    return
  }

  try {
    const { data: results, error: fetchError } = await db
      .from('monitoring_results')
      .select('id, brand_id, engine, response_text, brand_mentioned, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (fetchError || !results || results.length === 0) {
      return
    }

    const mentionResults = results.filter((r) => r.brand_mentioned)
    const noMentionResults = results.filter((r) => !r.brand_mentioned)
    const mentionCount = mentionResults.length
    const noMentionCount = noMentionResults.length

    // Per-response token counts (cached to avoid re-tokenising)
    const tokenizedResults = results.map((r) => ({
      result: r,
      tokens: countTokens(r.response_text || ''),
    }))

    // Global aggregates per keyword
    interface Stats {
      totalOccurrences: number
      docsInMention: number
      docsInNoMention: number
      engines: Set<string>
      dates: string[]
    }
    const stats = new Map<string, Stats>()

    for (const { result: r, tokens } of tokenizedResults) {
      const date = (r.created_at ?? '').split('T')[0] || ''
      for (const [word, count] of tokens) {
        let s = stats.get(word)
        if (!s) {
          s = {
            totalOccurrences: 0,
            docsInMention: 0,
            docsInNoMention: 0,
            engines: new Set<string>(),
            dates: [],
          }
          stats.set(word, s)
        }
        s.totalOccurrences += count
        if (r.brand_mentioned) s.docsInMention += 1
        else s.docsInNoMention += 1
        s.engines.add(r.engine)
        if (date) s.dates.push(date)
      }
    }

    // Keep only keywords that appear in ≥2 responses (signal filter)
    // and top 200 by total occurrences
    const keywordData: Record<string, KeywordData> = {}
    const ranked = [...stats.entries()]
      .filter(([, s]) => s.docsInMention + s.docsInNoMention >= 2)
      .sort((a, b) => b[1].totalOccurrences - a[1].totalOccurrences)
      .slice(0, 200)

    for (const [keyword, s] of ranked) {
      // Proper correlation: P(keyword | mentioned) - P(keyword | not mentioned)
      // Range: -1..1; positive = keyword correlates with brand mention
      const mentionRate = mentionCount > 0 ? s.docsInMention / mentionCount : 0
      const noMentionRate = noMentionCount > 0 ? s.docsInNoMention / noMentionCount : 0
      const correlation = mentionRate - noMentionRate

      const sortedDates = s.dates.sort()
      keywordData[keyword] = {
        keyword,
        mention_count: s.totalOccurrences,
        correlation_score: Math.round(correlation * 100) / 100,
        engines: [...s.engines],
        first_seen: sortedDates[0] || null,
        last_seen: sortedDates[sortedDates.length - 1] || null,
      }
    }

    // Remove stale keywords for this brand before inserting fresh set
    await db.from('keyword_tracking').delete().eq('brand_id', brandId)

    for (const [keyword, data] of Object.entries(keywordData)) {
      const { error: upsertError } = await db.from('keyword_tracking').upsert(
        {
          brand_id: brandId,
          keyword,
          mention_count: data.mention_count,
          correlation_score: data.correlation_score,
          engines: data.engines,
          first_seen: data.first_seen,
          last_seen: data.last_seen,
        },
        {
          onConflict: 'brand_id,keyword',
        },
      )

      if (upsertError) {
        logger.error('Keyword upsert error', { service: 'keyword-tracker', keyword, error: upsertError })
      }
    }

    logger.info('Keywords tracked', { service: 'keyword-tracker', brandId, keywordCount: Object.keys(keywordData).length })

    // Classify fresh keywords into clusters using brand context
    try {
      const clusterRes = await classifyKeywordsForBrand(brandId)
      logger.info('Keywords clustered', {
        service: 'keyword-tracker',
        brandId,
        classified: clusterRes.classified,
        errors: clusterRes.errors.length,
      })
    } catch (clusterErr) {
      logger.error('Keyword clustering failed', {
        service: 'keyword-tracker',
        brandId,
        error: String(clusterErr),
      })
    }
  } catch (error) {
    logger.error('Error tracking keywords', { service: 'keyword-tracker', error })
  }
}

export async function getKeywords(brandId: string, limit = 50) {
  const db = createServerClient()
  if (!db) return []

  const { data, error } = await db
    .from('keyword_tracking')
    .select('*')
    .eq('brand_id', brandId)
    .order('mention_count', { ascending: false })
    .limit(limit)

  if (error) {
    logger.error('Keyword fetch error', { service: 'keyword-tracker', error })
    return []
  }

  return data || []
}

export async function getTopCorrelatedKeywords(brandId: string, limit = 20) {
  const db = createServerClient()
  if (!db) return []

  const { data, error } = await db
    .from('keyword_tracking')
    .select('*')
    .eq('brand_id', brandId)
    .gt('correlation_score', 0)
    .order('correlation_score', { ascending: false })
    .limit(limit)

  if (error) {
    logger.error('Correlated keyword fetch error', { service: 'keyword-tracker', error })
    return []
  }

  return data || []
}
