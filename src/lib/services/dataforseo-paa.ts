// PATH: src/lib/services/dataforseo-paa.ts
//
// Google "People Also Ask" extraction via DataForSEO.
//
// Why DFS and not Brave for PAA:
//   Per the v2 API strategy (memory/project_api_strategy.md), PAA is one of
//   the 4 narrow-scope DFS use cases (alongside Google AI Overview, Google
//   Knowledge Graph, Google keyword volume). The reason: PAA is fundamentally
//   a Google feature — it's the actual questions Google's algorithm surfaces
//   for a query. Brave has a 'faq' component but it's Brave's own aggregation,
//   not Google PAA. The naming "AEO Pulse" implies Google AI surface, so the
//   PAA data should be Google-authentic.
//
// Cost estimate: ~$0.0008 per query → rounded to 1 cent (≤2 cents safety
// margin used here for cap calculations). The withDataforseoQuota wrapper
// enforces the monthly cap from dataforseo-quota.ts.

import { DataForSEOProvider, type DataForSEOResult } from '@/lib/providers/dataforseo-provider'
import { withDataforseoQuota } from './dataforseo-quota'
import { withSerpCache } from './serp-cache'
import { logger } from '@/lib/logger'

const PAA_COST_CENTS = 2

export interface PAAQuestion {
  question: string
  snippet: string | null
  sourceUrl: string | null
  sourceTitle: string | null
}

export function isDataforseoPaaAvailable(): boolean {
  return new DataForSEOProvider().isConfigured()
}

function languageToParams(lang?: string): { location: number; language: string } {
  // DataForSEO uses a numeric location_code (Google's geo target IDs) and
  // an ISO language code. Defaults match src/lib/geo-config.ts (Sweden / sv).
  if (lang === 'it') return { location: 2380, language: 'it' } // Italy
  if (lang === 'sv') return { location: 2752, language: 'sv' } // Sweden
  return { location: 2840, language: 'en' } // United States
}

/**
 * Fetch People-Also-Ask questions for a keyword from Google (via DataForSEO).
 * Drop-in shape replacement for the removed serpapi.ts:fetchPAAQuestions —
 * same PAAQuestion interface so aeo-snippets.ts doesn't need to change
 * downstream of the import line.
 *
 * Returns up to `max` questions (cap default 10). Empty array on no PAA box,
 * not an error — caller decides whether to fall back to a different strategy.
 */
export async function fetchPAAQuestions(
  keyword: string,
  language?: string,
  max = 10,
): Promise<PAAQuestion[]> {
  const provider = new DataForSEOProvider()
  if (!provider.isConfigured()) {
    throw new Error('DATAFORSEO_LOGIN / DATAFORSEO_KEY not configured')
  }

  const { location, language: lang } = languageToParams(language)

  // Cache key intentionally excludes `max` — capping at the consumer level
  // means a request for max=5 can share the cache row of an earlier max=10.
  // The slice happens after the response is returned.
  return withSerpCache(
    {
      provider: 'dataforseo',
      endpoint: 'paa',
      params: { keyword, location, language: lang },
    },
    () =>
      withDataforseoQuota(PAA_COST_CENTS, async () => {
        const response = await provider.execute({
          prompt: keyword,
          // The DataForSEOProvider class accepts free-form model config via a
          // JSON-stringified string (see provider source); we ask for SERP depth
          // 20 to ensure the PAA block is in the response. The depth value covers
          // the cost we estimate above.
          model: JSON.stringify({ depth: 20, location_code: location, language_code: lang }),
        })

        if (!response.success) {
          logger.warn('DataForSEO PAA query failed', {
            service: 'dataforseo-paa',
            keyword,
            error: response.error,
          })
          return [] as PAAQuestion[]
        }

        const data = response as unknown as DataForSEOResult
        const paaBoxes = data.peopleAlsoAsk || []

        const out: PAAQuestion[] = []
        for (const box of paaBoxes) {
          // DFS PAA returns each box with a question + an expansion
          // paragraph (answer) + source links. We surface the answer text
          // as the snippet and the first link as the citation source.
          const question = (box.question || '').trim()
          if (question.length === 0) continue

          const firstLink = box.links?.[0]
          out.push({
            question,
            snippet: box.answer?.trim() || null,
            sourceUrl: firstLink?.url ?? null,
            sourceTitle: firstLink?.title ?? null,
          })
        }
        return out
      }),
  ).then((all) => all.slice(0, max))
}
