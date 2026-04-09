import { createServerClient } from '@/lib/supabase'

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
  response_text: string
  brand_mentioned: boolean
  created_at: string
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
])

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\såäöüßéèêëàâáã]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))

  const wordFreq: Record<string, number> = {}
  for (const word of words) {
    wordFreq[word] = (wordFreq[word] || 0) + 1
  }

  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([word]) => word)
}

export async function trackKeywords(brandId: string): Promise<void> {
  const db = createServerClient()
  if (!db) {
    console.warn('[keywords] Database not configured')
    return
  }

  try {
    const { data: results, error: fetchError } = await (db as any)
      .from('monitoring_results')
      .select('id, brand_id, engine, response_text, brand_mentioned, created_at')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (fetchError || !results || results.length === 0) {
      return
    }

    const mentionResults = results.filter((r: MonitoringResult) => r.brand_mentioned)
    const noMentionResults = results.filter((r: MonitoringResult) => !r.brand_mentioned)

    const mentionKeywords = new Set<string>()
    for (const r of mentionResults) {
      const keywords = extractKeywords(r.response_text)
      keywords.forEach((k) => mentionKeywords.add(k))
    }

    const noMentionKeywords = new Set<string>()
    for (const r of noMentionResults) {
      const keywords = extractKeywords(r.response_text)
      keywords.forEach((k) => noMentionKeywords.add(k))
    }

    const allKeywords = new Set([...mentionKeywords, ...noMentionKeywords])
    const keywordData: Record<string, KeywordData> = {}

    for (const keyword of allKeywords) {
      const inMention = mentionKeywords.has(keyword)
      const inNoMention = noMentionKeywords.has(keyword)

      const mentionCount = inMention ? mentionResults.length : 0
      const noMentionCount = inNoMention ? noMentionResults.length : 0
      const total = mentionCount + noMentionCount

      let correlation = 0
      if (total > 0) {
        const mentionRate = mentionCount / total
        correlation = inMention && !inNoMention ? 1 : inMention ? 0.5 : -0.5
      }

      const keywordEngines = results
        .filter((r: MonitoringResult) => extractKeywords(r.response_text).includes(keyword))
        .map((r: MonitoringResult) => r.engine)
      const engines: string[] = Array.from(new Set(keywordEngines))

      const dates = results
        .filter((r: MonitoringResult) => extractKeywords(r.response_text).includes(keyword))
        .map((r: MonitoringResult) => r.created_at.split('T')[0])
        .sort()

      keywordData[keyword] = {
        keyword,
        mention_count: total,
        correlation_score: correlation,
        engines,
        first_seen: dates[0] || null,
        last_seen: dates[dates.length - 1] || null,
      }
    }

    for (const [keyword, data] of Object.entries(keywordData)) {
      const { error: upsertError } = await (db as any).from('keyword_tracking').upsert(
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
        console.error('[keywords] Upsert error:', keyword, upsertError)
      }
    }

    console.log(
      `[keywords] Tracked ${Object.keys(keywordData).length} keywords for brand ${brandId}`,
    )
  } catch (error) {
    console.error('[keywords] Error tracking keywords:', error)
  }
}

export async function getKeywords(brandId: string, limit = 50) {
  const db = createServerClient()
  if (!db) return []

  const { data, error } = await (db as any)
    .from('keyword_tracking')
    .select('*')
    .eq('brand_id', brandId)
    .order('mention_count', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[keywords] Fetch error:', error)
    return []
  }

  return data || []
}

export async function getTopCorrelatedKeywords(brandId: string, limit = 20) {
  const db = createServerClient()
  if (!db) return []

  const { data, error } = await (db as any)
    .from('keyword_tracking')
    .select('*')
    .eq('brand_id', brandId)
    .gt('correlation_score', 0)
    .order('correlation_score', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[keywords] Fetch error:', error)
    return []
  }

  return data || []
}
