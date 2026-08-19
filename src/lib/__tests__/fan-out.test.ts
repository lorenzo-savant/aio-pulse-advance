import { describe, it, expect } from 'vitest'
import {
  buildFanOutReport,
  driftBetween,
  extractGeminiGroundingFanOut,
  extractGeminiInteractionsFanOut,
  extractOpenAIFanOut,
  fanOutKey,
  normalizeFanOutQueries,
  MAX_FANOUT_QUERIES_PER_RUN,
  type FanOutRow,
} from '../services/fan-out'

// The provider payloads below are VERBATIM shapes captured from live API calls
// on 2026-08-19 (prompt: "Vilka sajter är bäst för att köpa begagnad
// elektronik i Sverige 2026?"). They are the contract: if a provider changes
// its response shape these tests fail, which is the point.

describe('extractOpenAIFanOut', () => {
  const liveOutput = [
    {
      id: 'ws_0aa905fff77f6d82006a855a3e395c81a0866bddb3d716d2bb',
      type: 'web_search_call',
      status: 'completed',
      action: {
        type: 'search',
        queries: ['bästa sajter att köpa begagnad elektronik i Sverige 2026'],
        query: 'bästa sajter att köpa begagnad elektronik i Sverige 2026',
      },
    },
    { type: 'message', content: [{ text: 'answer text' }] },
  ]

  it('reads action.queries from web_search_call items', () => {
    expect(extractOpenAIFanOut(liveOutput)).toEqual([
      'bästa sajter att köpa begagnad elektronik i Sverige 2026',
    ])
  })

  it('does not double-count the singular action.query mirror', () => {
    // The live payload carries the same string in both fields.
    expect(extractOpenAIFanOut(liveOutput)).toHaveLength(1)
  })

  it('returns [] for a response with no search call', () => {
    expect(extractOpenAIFanOut([{ type: 'message', content: [{ text: 'x' }] }])).toEqual([])
    expect(extractOpenAIFanOut(undefined)).toEqual([])
  })
})

describe('extractGeminiInteractionsFanOut', () => {
  // The trick this pins: `arguments` is a JSON STRING, not an object.
  const liveSteps = [
    {
      id: 'call_239207',
      type: 'google_search_call',
      search_type: 'web_search',
      arguments:
        '{"queries":["basta sajter begagnad elektronik sverige","kop begagnad elektronik garanti sverige"]}',
    },
    { type: 'google_search_result', call_id: 'call_239207', result: [], is_error: false },
    { type: 'thought' },
    { type: 'model_output', content: [{ text: 'answer' }] },
  ]

  it('parses the JSON-string arguments of a google_search_call step', () => {
    expect(extractGeminiInteractionsFanOut(liveSteps)).toEqual([
      'basta sajter begagnad elektronik sverige',
      'kop begagnad elektronik garanti sverige',
    ])
  })

  it('never throws on malformed arguments — a lost fan-out must not fail the run', () => {
    const broken = [{ type: 'google_search_call', arguments: '{not json' }]
    expect(extractGeminiInteractionsFanOut(broken)).toEqual([])
  })

  it('ignores steps that are not search calls', () => {
    expect(extractGeminiInteractionsFanOut([{ type: 'model_output' }])).toEqual([])
    expect(extractGeminiInteractionsFanOut(null)).toEqual([])
  })
})

describe('extractGeminiGroundingFanOut', () => {
  it('reads webSearchQueries — the field declared but never read until now', () => {
    expect(
      extractGeminiGroundingFanOut({ webSearchQueries: ['begagnad elektronik', 'tradera'] }),
    ).toEqual(['begagnad elektronik', 'tradera'])
  })

  it('returns [] when grounding produced no searches', () => {
    expect(extractGeminiGroundingFanOut({})).toEqual([])
    expect(extractGeminiGroundingFanOut(undefined)).toEqual([])
  })
})

describe('normalizeFanOutQueries', () => {
  it('deduplicates case- and whitespace-insensitively, keeping first spelling', () => {
    expect(normalizeFanOutQueries(['Begagnad  Elektronik', 'begagnad elektronik'])).toEqual([
      'Begagnad  Elektronik',
    ])
  })

  it('drops non-strings, blanks and over-long payloads', () => {
    expect(normalizeFanOutQueries([null, 42, '  ', 'ok', 'x'.repeat(301)])).toEqual(['ok'])
  })

  it('caps the stored count so a malformed payload cannot flood a row', () => {
    const many = Array.from({ length: 40 }, (_, i) => `query ${i}`)
    expect(normalizeFanOutQueries(many)).toHaveLength(MAX_FANOUT_QUERIES_PER_RUN)
  })

  it('preserves diacritics — whether the engine stripped them is itself signal', () => {
    expect(fanOutKey('Bästa Sajter')).toBe('bästa sajter')
    expect(normalizeFanOutQueries(['bästa sajter', 'basta sajter'])).toHaveLength(2)
  })
})

describe('driftBetween', () => {
  it('is 0 when the engine searched our exact wording', () => {
    expect(driftBetween('begagnad elektronik sverige', 'begagnad elektronik sverige')).toBe(0)
  })

  it('is 100 when nothing overlaps', () => {
    expect(driftBetween('helt andra ord här', 'begagnad elektronik sverige')).toBe(100)
  })

  it('scores the real Swedish case: diacritics and year dropped, concept added', () => {
    // The live pair. Every content word differs in surface form, so drift is
    // high — which is exactly the finding: the page tuned to the prompt is
    // tuned to a string the engine never searched.
    const drift = driftBetween(
      'kop begagnad elektronik garanti sverige',
      'Vilka sajter är bäst för att köpa begagnad elektronik i Sverige 2026?',
    )
    expect(drift).toBeGreaterThan(0)
    expect(drift).toBeLessThan(100)
  })

  it('returns 0 rather than NaN when a side has no scoreable words', () => {
    expect(driftBetween('', 'begagnad elektronik')).toBe(0)
  })
})

describe('buildFanOutReport', () => {
  const row = (over: Partial<FanOutRow> = {}): FanOutRow => ({
    engine: 'gemini',
    search_queries: ['begagnad elektronik sverige'],
    brand_mentioned: true,
    cited_urls: [],
    prompt_text: 'Var köper jag begagnad elektronik i Sverige?',
    ...over,
  })

  it('keeps NULL and [] apart — blindness is not the same as no search', () => {
    const report = buildFanOutReport([
      row(),
      row({ search_queries: null, engine: 'perplexity' }), // provider does not expose
      row({ search_queries: [] }), // engine answered from memory
    ])
    expect(report.captured).toBe(2)
    expect(report.notCaptured).toBe(1)
    expect(report.searchless).toBe(1)
  })

  it('never counts a not-captured row as zero searches in the ratio', () => {
    const report = buildFanOutReport([
      row({ search_queries: ['a', 'b'] }),
      row({ search_queries: null }),
      row({ search_queries: null }),
    ])
    // 2 queries over 1 searching run — the two NULL rows must not dilute it.
    expect(report.expansionRatio).toBe(2)
  })

  it('aggregates runs, engines, mention and citation rate per search', () => {
    const report = buildFanOutReport(
      [
        row({ engine: 'gemini', brand_mentioned: true, cited_urls: ['https://relovie.com/a'] }),
        row({ engine: 'chatgpt', brand_mentioned: false, cited_urls: ['https://tradera.com'] }),
      ],
      { ownDomain: 'relovie.com' },
    )
    const q = report.queries[0]!
    expect(q.runs).toBe(2)
    expect(q.engines).toEqual(['chatgpt', 'gemini'])
    expect(q.mentionRate).toBe(50)
    expect(q.citationRate).toBe(50)
  })

  it('matches the own domain on subdomains but not on look-alikes', () => {
    const hit = buildFanOutReport([row({ cited_urls: ['https://blog.relovie.com/x'] })], {
      ownDomain: 'relovie.com',
    })
    expect(hit.queries[0]!.citationRate).toBe(100)

    const miss = buildFanOutReport([row({ cited_urls: ['https://notrelovie.com/x'] })], {
      ownDomain: 'relovie.com',
    })
    expect(miss.queries[0]!.citationRate).toBe(0)
  })

  it('counts a run once even when it repeats the same search', () => {
    const report = buildFanOutReport([
      row({ search_queries: ['begagnad elektronik', 'Begagnad  Elektronik'] }),
    ])
    expect(report.queries).toHaveLength(1)
    expect(report.queries[0]!.runs).toBe(1)
  })

  it('ranks by volume, then surfaces the weakest mention rate first', () => {
    const report = buildFanOutReport([
      // 'rare' appears once; 'common' twice with a 50% mention rate.
      row({ search_queries: ['common'], brand_mentioned: true }),
      row({ search_queries: ['common'], brand_mentioned: false }),
      row({ search_queries: ['rare'], brand_mentioned: true }),
    ])
    expect(report.queries.map((q) => q.query)).toEqual(['common', 'rare'])
    expect(report.queries[0]!.mentionRate).toBe(50)
  })

  it('handles an all-NULL history without dividing by zero', () => {
    const report = buildFanOutReport([row({ search_queries: null })])
    expect(report).toMatchObject({ captured: 0, notCaptured: 1, expansionRatio: 0, queries: [] })
  })
})
