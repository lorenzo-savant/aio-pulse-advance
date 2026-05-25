import { describe, it, expect } from 'vitest'
import {
  extractClaims,
  findDivergencesForPrompt,
  buildDivergenceReport,
} from '@/lib/utils/claim-divergence'

describe('extractClaims', () => {
  it('extracts founding year', () => {
    const claims = extractClaims('Acme was founded in 2018 by a small team in Berlin.')
    expect(claims.some((c) => c.type === 'founding_year' && c.value === '2018')).toBe(true)
  })

  it('extracts headquarters city', () => {
    const claims = extractClaims('The company is headquartered in Stockholm, Sweden.')
    expect(claims.some((c) => c.type === 'headquarters' && c.value === 'Stockholm')).toBe(true)
  })

  it('extracts founder name', () => {
    const claims = extractClaims('Acme was founded by Jane Doe in 2020.')
    expect(claims.some((c) => c.type === 'founder' && c.value === 'Jane Doe')).toBe(true)
  })

  it('extracts team size and normalises to digits only', () => {
    const claims = extractClaims('Today the team of 250 employees serves customers worldwide.')
    expect(claims.some((c) => c.type === 'team_size' && c.value === '250')).toBe(true)
  })

  it('extracts pricing tier with currency', () => {
    const claims = extractClaims('Pricing starts at $49 per month.')
    expect(claims.some((c) => c.type === 'pricing' && c.value.includes('$49'))).toBe(true)
  })

  it('extracts funding amount', () => {
    const claims = extractClaims('In 2023 the company raised $50 million in Series B.')
    expect(claims.some((c) => c.type === 'funding' && /50M/i.test(c.value))).toBe(true)
  })

  it('returns empty for short text', () => {
    expect(extractClaims('')).toEqual([])
    expect(extractClaims('short')).toEqual([])
  })

  it('handles Swedish + Italian phrasing', () => {
    const sv = extractClaims('Företaget grundades 2015 med säte i Göteborg.')
    expect(sv.some((c) => c.type === 'founding_year' && c.value === '2015')).toBe(true)
    expect(sv.some((c) => c.type === 'headquarters' && c.value.startsWith('Göteborg'))).toBe(true)

    const it = extractClaims("L'azienda è stata fondata nel 2010 con sede a Milano.")
    expect(it.some((c) => c.type === 'founding_year' && c.value === '2010')).toBe(true)
    expect(it.some((c) => c.type === 'headquarters' && c.value.startsWith('Milano'))).toBe(true)
  })
})

describe('findDivergencesForPrompt', () => {
  it('flags founding year divergence between two engines', () => {
    const out = findDivergencesForPrompt([
      { engine: 'chatgpt', responseText: 'Acme was founded in 2018 in Berlin.' },
      { engine: 'claude', responseText: 'Acme was founded in 2015 by the original team.' },
    ])
    const yearDiv = out.find((d) => d.type === 'founding_year')
    expect(yearDiv).toBeDefined()
    expect(yearDiv!.buckets.map((b) => b.value).sort()).toEqual(['2015', '2018'])
  })

  it('does NOT flag divergence when all engines agree', () => {
    const out = findDivergencesForPrompt([
      { engine: 'chatgpt', responseText: 'Acme was founded in 2018.' },
      { engine: 'claude', responseText: 'Founded in 2018, Acme grew quickly.' },
      { engine: 'gemini', responseText: 'Since 2018 Acme has served...' },
    ])
    expect(out.find((d) => d.type === 'founding_year')).toBeUndefined()
  })

  it('does NOT flag divergence when only one engine makes a claim', () => {
    const out = findDivergencesForPrompt([
      { engine: 'chatgpt', responseText: 'Acme is a great company headquartered in Paris.' },
      { engine: 'claude', responseText: 'Acme is a great company that serves customers.' },
    ])
    expect(out.find((d) => d.type === 'headquarters')).toBeUndefined()
  })

  it('records which engines claimed each value', () => {
    const out = findDivergencesForPrompt([
      { engine: 'chatgpt', responseText: 'Headquartered in Stockholm, Sweden.' },
      { engine: 'gemini', responseText: 'Based in Stockholm, the team...' },
      { engine: 'claude', responseText: 'The company is headquartered in Gothenburg.' },
    ])
    const hq = out.find((d) => d.type === 'headquarters')
    expect(hq).toBeDefined()
    const stockholm = hq!.buckets.find((b) => b.value.startsWith('Stockholm'))
    expect(stockholm?.engines.sort()).toEqual(['chatgpt', 'gemini'])
    const gothenburg = hq!.buckets.find((b) => b.value.startsWith('Gothenburg'))
    expect(gothenburg?.engines).toEqual(['claude'])
  })
})

describe('buildDivergenceReport', () => {
  it('groups rows by prompt_id and reports per-type totals', () => {
    const report = buildDivergenceReport([
      {
        prompt_id: 'p1',
        prompt_text: 'Tell me about Acme',
        engine: 'chatgpt',
        response_text: 'Acme was founded in 2018 by Jane Doe.',
      },
      {
        prompt_id: 'p1',
        prompt_text: 'Tell me about Acme',
        engine: 'claude',
        response_text: 'Acme was founded in 2015 by John Smith.',
      },
      {
        prompt_id: 'p2',
        prompt_text: 'How big is Acme?',
        engine: 'chatgpt',
        response_text: 'A team of 200 employees.',
      },
      {
        prompt_id: 'p2',
        prompt_text: 'How big is Acme?',
        engine: 'gemini',
        response_text: 'They have around 500 employees.',
      },
    ])
    expect(report.prompts.length).toBe(2)
    expect(report.totals.founding_year).toBe(1)
    expect(report.totals.founder).toBe(1)
    expect(report.totals.team_size).toBe(1)
  })

  it('skips prompts with only one engine response', () => {
    const report = buildDivergenceReport([
      {
        prompt_id: 'p1',
        prompt_text: null,
        engine: 'chatgpt',
        response_text: 'Founded in 2018.',
      },
    ])
    expect(report.prompts.length).toBe(0)
  })

  it('returns empty totals when no rows', () => {
    const report = buildDivergenceReport([])
    expect(report.prompts).toEqual([])
    expect(report.totals.founding_year).toBe(0)
  })
})
