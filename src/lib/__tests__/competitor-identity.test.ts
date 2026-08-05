import { describe, it, expect } from 'vitest'
import {
  normalizeEntityName,
  buildCompetitorMatcher,
  classifyMention,
} from '../services/competitor-identity'
import { computeShareOfVoice, type SovInputRow } from '../services/share-of-voice'
import { calculateCompetitorStandings } from '../services/monitoring'

/**
 * The report used to hand market share, a rank, a trend line and a sentence in
 * the executive summary to any name a model produced. `brand.competitors` was
 * passed to the prompt as context and never used to check anything.
 *
 * Identity is resolved on READ so the ~1700 historical rows are treated exactly
 * like new ones, and so editing the declared list re-reads the archive
 * consistently instead of requiring a backfill.
 */

describe('normalizeEntityName', () => {
  it('folds case, punctuation and legal suffix to one key', () => {
    const key = normalizeEntityName('Acast')
    expect(normalizeEntityName('acast')).toBe(key)
    expect(normalizeEntityName('ACAST.')).toBe(key)
    expect(normalizeEntityName('  Acast  AB ')).toBe(key)
  })

  it('keeps genuinely different companies apart', () => {
    // The near-collision the monitoring prompt warns about at length: Acast
    // (podcasts) and Acasting (casting) are different companies.
    expect(normalizeEntityName('Acast')).not.toBe(normalizeEntityName('Acasting'))
  })

  it('is empty for empty input rather than matching everything', () => {
    expect(normalizeEntityName('')).toBe('')
    expect(normalizeEntityName('   ')).toBe('')
  })
})

describe('buildCompetitorMatcher', () => {
  const matcher = buildCompetitorMatcher(['Acast', 'Spotify AB'])

  it('matches a declared name written with a legal suffix', () => {
    expect(matcher.isDeclared('Acast AB')).toBe(true)
  })

  it('matches a declared name written without its suffix', () => {
    expect(matcher.isDeclared('spotify')).toBe(true)
  })

  it('returns the spelling the user declared, not the model’s', () => {
    expect(matcher.canonical('SPOTIFY ab')).toBe('Spotify AB')
  })

  it('rejects a name nobody declared', () => {
    expect(matcher.isDeclared('Podbean')).toBe(false)
    expect(matcher.canonical('Podbean')).toBeNull()
  })

  it('reports an empty declared list, so callers can tell "unknown" from "invented"', () => {
    expect(buildCompetitorMatcher([]).hasDeclaredList).toBe(false)
    expect(buildCompetitorMatcher(null).hasDeclaredList).toBe(false)
    expect(matcher.hasDeclaredList).toBe(true)
  })
})

describe('classifyMention', () => {
  it('canonicalises a declared mention and flags it', () => {
    const m = classifyMention(buildCompetitorMatcher(['Acast']), 'acast ab')
    expect(m).toEqual({ name: 'Acast', declared: true })
  })

  it('passes a discovered name through unchanged', () => {
    const m = classifyMention(buildCompetitorMatcher(['Acast']), 'Podbean')
    expect(m).toEqual({ name: 'Podbean', declared: false })
  })
})

describe('computeShareOfVoice — declared vs discovered', () => {
  const rows: SovInputRow[] = [
    {
      brand_mentioned: true,
      mention_count: 2,
      mention_position: 1,
      competitor_mentions: [
        { name: 'Acast AB', position: 2, count: 2 },
        { name: 'Totally Made Up Inc', position: 3, count: 6 },
      ],
      created_at: '2026-08-01T00:00:00Z',
    },
  ]

  it('ranks only declared competitors', () => {
    const sov = computeShareOfVoice(rows, 'Relovie', { declaredCompetitors: ['Acast'] })
    const names = sov.entities.map((e) => e.name)
    expect(names).toContain('Relovie')
    expect(names).toContain('Acast AB')
    expect(names).not.toContain('Totally Made Up Inc')
  })

  it('reports the invented name separately instead of discarding it', () => {
    const sov = computeShareOfVoice(rows, 'Relovie', { declaredCompetitors: ['Acast'] })
    expect(sov.discovered.map((d) => d.name)).toEqual(['Totally Made Up Inc'])
    expect(sov.discoveredShare).toBeGreaterThan(0)
  })

  it('does NOT inflate the brand’s share by dropping discovered mentions', () => {
    // 2 brand + 2 declared + 6 discovered = 10 total. The brand holds 2/10.
    // Excluding the discovered mentions from the denominator would report 50%.
    const sov = computeShareOfVoice(rows, 'Relovie', { declaredCompetitors: ['Acast'] })
    const brand = sov.entities.find((e) => e.isBrand)
    expect(brand?.share).toBe(20)
  })

  it('keeps a discovered name out of the timeline series', () => {
    const sov = computeShareOfVoice(rows, 'Relovie', { declaredCompetitors: ['Acast'] })
    expect(sov.series).not.toContain('Totally Made Up Inc')
  })

  it('ranks everything when no declared list is given, as before', () => {
    // Backward compatibility: existing callers and the historical series must
    // not change until they opt in.
    const sov = computeShareOfVoice(rows, 'Relovie')
    expect(sov.entities.map((e) => e.name)).toContain('Totally Made Up Inc')
    expect(sov.discovered).toEqual([])
  })
})

describe('calculateCompetitorStandings', () => {
  it('reports only what was measured', () => {
    const s = calculateCompetitorStandings(
      [
        { name: 'Acast', position: 2, count: 3 },
        { name: 'Acast', position: 4, count: 1 },
      ],
      8,
    )
    expect(s).toEqual({
      name: 'Acast',
      mentions: 4,
      shareOfCompetitorMentions: 50,
      avgPosition: 3,
    })
  })

  it('returns null when never mentioned, rather than a zero that reads as a score', () => {
    // This is the whole point: the old code substituted {position: 0, count: 0}
    // and produced competitorAvi 0, so the printed gap was the brand's own AVI.
    expect(calculateCompetitorStandings([], 10)).toBeNull()
    expect(calculateCompetitorStandings([{ name: 'X', position: 0, count: 0 }], 10)).toBeNull()
  })

  it('leaves avgPosition null when nothing was positioned', () => {
    const s = calculateCompetitorStandings([{ name: 'X', position: 0, count: 2 }], 2)
    expect(s?.avgPosition).toBeNull()
    expect(s?.mentions).toBe(2)
  })
})
