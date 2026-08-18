import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  calculateAVIFromResults,
  calculateDomainSOAIV,
  calculateCompetitorAVI,
  buildCompetitorReport,
  buildSentimentHeatmap,
} from '../services/monitoring'

describe('HTML Report Functions', () => {
  describe('calculateAVIFromResults', () => {
    it('calculates AVI from empty results', () => {
      const { avi, components } = calculateAVIFromResults([])
      expect(avi).toBe(0)
      expect(components.citationRate).toBe(0)
    })

    it('calculates AVI from sample results', () => {
      const results = [
        {
          brand_mentioned: true,
          visibility_score: 80,
          sentiment_score: 0.8,
          cited_urls: ['https://example.com'],
          has_hallucination: false,
          mention_position: 1,
        },
        {
          brand_mentioned: true,
          visibility_score: 70,
          sentiment_score: 0.6,
          cited_urls: ['https://test.com'],
          has_hallucination: false,
          mention_position: 2,
        },
      ]
      const { avi, components } = calculateAVIFromResults(results)
      expect(avi).toBeGreaterThan(0)
      expect(components.mentionFrequency).toBe(100)
    })
  })

  describe('calculateDomainSOAIV', () => {
    it('calculates domain share from URLs', () => {
      const urls = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://competitor.com/page1',
        'https://other.com/page1',
      ]
      const result = calculateDomainSOAIV(urls, 'example.com', ['competitor.com'])
      expect(result.length).toBeGreaterThan(0)
      const brandResult = result.find((r) => r.domain === 'example.com')
      expect(brandResult?.brandShare).toBeGreaterThan(0)
    })

    it('handles empty URLs', () => {
      const result = calculateDomainSOAIV([], 'example.com', ['competitor.com'])
      expect(result).toEqual([])
    })
  })

  describe('calculateCompetitorAVI', () => {
    it('calculates competitor rank and gap', () => {
      const mentions = [
        { name: 'CompetitorA', position: 1, count: 10 },
        { name: 'CompetitorB', position: 3, count: 5 },
      ]
      const result = calculateCompetitorAVI(mentions, 50)
      expect(result.rank).toBeGreaterThanOrEqual(0)
      expect(result.competitorAvi).toBeGreaterThanOrEqual(0)
    })

    it('handles empty mentions', () => {
      const result = calculateCompetitorAVI([], 50)
      expect(result.rank).toBe(0)
      expect(result.competitorAvi).toBe(0)
    })
  })

  describe('buildSentimentHeatmap', () => {
    it('builds heatmap from results', () => {
      const results = [
        {
          engine: 'chatgpt',
          category: 'awareness',
          brand_mentioned: true,
          sentiment_score: 0.8,
          visibility_score: 80,
          cited_urls: [],
          has_hallucination: false,
        },
        {
          engine: 'chatgpt',
          category: 'interest',
          brand_mentioned: true,
          sentiment_score: 0.6,
          visibility_score: 70,
          cited_urls: [],
          has_hallucination: false,
        },
        {
          engine: 'gemini',
          category: 'awareness',
          brand_mentioned: true,
          sentiment_score: 0.7,
          visibility_score: 75,
          cited_urls: [],
          has_hallucination: false,
        },
      ]
      const heatmap = buildSentimentHeatmap(results)
      expect(Object.keys(heatmap).length).toBeGreaterThan(0)
      expect(heatmap['chatgpt']?.['awareness']?.sentiment).toBeDefined()
    })

    it('handles empty results', () => {
      const heatmap = buildSentimentHeatmap([])
      expect(heatmap).toEqual({})
    })
  })
})

// ─── HTML report: the wiring that made every report state a false number ─────
//
// The competitor table is built inside the route handler, which App Router does
// not let us export for a render test. So these assert the SOURCE, in the same
// way brand-scoped-reads.test.ts does — enough to pin the exact regression:
//
//   `mappedResults` was built without `competitor_mentions`, though the row is
//   selected with `*`. The lookup therefore searched an array that could never
//   contain anything, the synthetic {position: 0, count: 0} stand-in fired for
//   every competitor in every report, calculateCompetitorAVI returned 0, and
//   the printed gap was the brand's OWN score. Every report generated said the
//   client beat every rival by exactly their own AVI.
//
// The previous i18n test that lived here was removed rather than repaired: it
// declared its own `labels` literal inline and asserted against that, so it
// passed unchanged after `rank` and `gap` were deleted from the real
// dictionary. A test that cannot fail is worse than none — it reads as cover.
describe('HTML report — competitor table wiring', () => {
  const rawSrc = readFileSync(join(process.cwd(), 'src/app/api/reports/html/route.ts'), 'utf8')

  // Assert against CODE, not prose. The comments in that file deliberately
  // quote the old broken shapes to explain them, so a naive source match
  // fires on the explanation of the bug rather than on the bug.
  const routeSrc = rawSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('carries competitor_mentions into the mapped results', () => {
    expect(routeSrc).toMatch(/competitor_mentions:\s*r\.competitor_mentions/)
  })

  it('never substitutes a synthetic zero row for an unmentioned competitor', () => {
    // Not mentioned is not scored zero.
    expect(routeSrc).not.toMatch(/position:\s*0,\s*count:\s*0/)
  })

  it('builds the competitor table from measured standings, not deprecated AVI', () => {
    // The full-report rewrite replaced the dedicated competitor table with the
    // Share of AI Voice section, fed by the same measured standings through
    // computeShareOfVoice. The invariant is unchanged: standings, never the
    // deprecated calculateCompetitorAVI.
    expect(routeSrc).toMatch(/computeShareOfVoice\(/)
    expect(routeSrc).not.toMatch(/calculateCompetitorAVI\(/)
  })

  it('does not present the model-reported position to a client', () => {
    // `competitor_mentions[].position` was requested from the model as a bare
    // `<integer>` with no unit and no origin until 2026-08-05, so historical
    // values are not comparable with each other. It stays out of the rendered
    // table until there is data written under the defined meaning.
    expect(routeSrc).not.toMatch(/<th>\$\{t\.avgPosition\}<\/th>/)
  })

  it('every locale carries the same label set', () => {
    // The real invariant: a missing translation silently renders `undefined`
    // in a client-facing report. Scope the scan to the i18n dictionary only —
    // the rewrite added two more locale-keyed dictionaries (PILLAR_I18N and
    // SOURCE_CATEGORY_I18N) that carry deliberately different key sets.
    const i18nStart = routeSrc.indexOf('const i18n = {')
    const i18nEnd = routeSrc.indexOf('} as const', i18nStart)
    const i18nBlock = routeSrc.slice(i18nStart, i18nEnd)

    const dicts = [...i18nBlock.matchAll(/^ {2}(en|it|sv): \{$/gm)].map((m) => m.index!)
    expect(dicts).toHaveLength(3)

    const keysOf = (from: number) => {
      const block = i18nBlock.slice(from, i18nBlock.indexOf('\n  },', from))
      return [...block.matchAll(/^ {4}(\w+):/gm)].map((m) => m[1]).sort()
    }
    const [en, it, sv] = dicts.map(keysOf)
    expect(it).toEqual(en)
    expect(sv).toEqual(en)
  })
})

// ─── buildCompetitorReport: the honest competitor table ──────────────────────
//
// This is the pure function the route handler calls to build the competitor
// rows. Pinning its arithmetic here keeps the rendered report honest without
// exporting the App Router handler.
describe('buildCompetitorReport', () => {
  const acast = 'Acast AB'
  const bjorn = 'Björn Lundén'
  const wint = 'Wint'

  it('renders mentions, quota and avg position for declared competitors', () => {
    const rows = buildCompetitorReport(
      [acast, bjorn, wint],
      [
        { name: 'Acast', position: 1, count: 10 },
        { name: 'Acast AB', position: 2, count: 5 },
        { name: 'Björn Lundén AB', position: 3, count: 5 },
        { name: 'Some invented rival', position: 1, count: 5 },
      ],
    )

    const acastRow = rows.find((r) => r.name === acast)!
    expect(acastRow).toMatchObject({
      mentions: 15,
      share: 60, // 15 of 25 — invented rival keeps its weight in the denominator
      avgPosition: 1.5,
      hasData: true,
    })
    const bjornRow = rows.find((r) => r.name === bjorn)!
    expect(bjornRow.mentions).toBe(5)
    expect(bjornRow.avgPosition).toBe(3)
    const wintRow = rows.find((r) => r.name === wint)!
    expect(wintRow).toMatchObject({ mentions: 0, share: null, avgPosition: null, hasData: false })
  })

  it('returns a row per declared competitor, including unmentioned ones', () => {
    const rows = buildCompetitorReport([acast], [])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ name: acast, mentions: 0, share: null, hasData: false })
  })

  it('returns [] for an empty declared list', () => {
    expect(buildCompetitorReport([], [])).toEqual([])
  })
})

describe('HTML report — ultrareview regressions (2026-08-17)', () => {
  const rawSrc = readFileSync(join(process.cwd(), 'src/app/api/reports/html/route.ts'), 'utf8')
  const routeSrc = rawSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('counts sentiment only over mentioned rows', () => {
    // The analyzer stores every unmentioned response as neutral, so a loop
    // over all scoped rows drowns real tone in unmentioned neutrals — a
    // low-visibility brand in crisis charts as "mostly neutral".
    expect(routeSrc).toMatch(/r\.brand_mentioned && r\.sentiment && r\.sentiment in sent/)
  })

  it('divides the sentiment chart by mentioned, never by N', () => {
    const chart = routeSrc.slice(routeSrc.indexOf('const sentimentSection'))
    const section = chart.slice(0, chart.indexOf(": ''"))
    expect(section).toContain('pct(sent.positive, mentioned)')
    expect(section).not.toMatch(/pct\(sent\.\w+, N\)/)
  })

  it('decides "not configured" with the same normalisation as the SoV matcher', () => {
    // toLowerCase() disagrees with normalizeEntityName whenever the engine
    // drops a legal suffix (AB, GmbH, Inc…) and would flag a declared rival.
    expect(routeSrc).toMatch(/configuredKeys\.has\(normalizeEntityName\(e\.name\)\)/)
    expect(routeSrc).not.toMatch(/configuredLower/)
  })

  it('clamps the days parameter instead of trusting parseInt', () => {
    // parseInt('abc') → NaN → new Date(NaN).toISOString() threw a bare 500;
    // a negative value rendered a silently empty report.
    expect(routeSrc).not.toMatch(/parseInt\(searchParams\.get\('days'\)/)
    expect(routeSrc).toMatch(/Math\.min\(365, Math\.max\(1, Math\.trunc\(daysRaw\)\)\)/)
  })
})
