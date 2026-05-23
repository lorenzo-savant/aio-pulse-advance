import { describe, it, expect } from 'vitest'
import { classifyDomainAuthority, computeAiTrustScore, trustBand } from '@/lib/utils/ai-trust-score'

describe('classifyDomainAuthority', () => {
  it('detects institutional TLDs (gov / edu / .gov.uk / .europa.eu)', () => {
    expect(classifyDomainAuthority('nasa.gov')).toBe('institutional')
    expect(classifyDomainAuthority('www.harvard.edu')).toBe('institutional')
    expect(classifyDomainAuthority('hmrc.gov.uk')).toBe('institutional')
    expect(classifyDomainAuthority('curia.europa.eu')).toBe('institutional')
  })

  it('detects wiki / Wikipedia family', () => {
    expect(classifyDomainAuthority('en.wikipedia.org')).toBe('wiki')
    expect(classifyDomainAuthority('it.wikipedia.org')).toBe('wiki')
    expect(classifyDomainAuthority('wikidata.org')).toBe('wiki')
  })

  it('detects official press', () => {
    expect(classifyDomainAuthority('www.nytimes.com')).toBe('official_press')
    expect(classifyDomainAuthority('reuters.com')).toBe('official_press')
    expect(classifyDomainAuthority('bbc.co.uk')).toBe('official_press')
    expect(classifyDomainAuthority('theverge.com')).toBe('official_press')
  })

  it('detects community sites (Reddit / SO / Quora are top AI citation sources)', () => {
    expect(classifyDomainAuthority('reddit.com')).toBe('community')
    expect(classifyDomainAuthority('stackoverflow.com')).toBe('community')
    expect(classifyDomainAuthority('quora.com')).toBe('community')
    expect(classifyDomainAuthority('github.com')).toBe('community')
  })

  it('detects social and aggregator', () => {
    expect(classifyDomainAuthority('linkedin.com')).toBe('social')
    expect(classifyDomainAuthority('x.com')).toBe('social')
    expect(classifyDomainAuthority('g2.com')).toBe('aggregator')
    expect(classifyDomainAuthority('trustpilot.com')).toBe('aggregator')
  })

  it('falls back to commercial for unknown registrable domains', () => {
    expect(classifyDomainAuthority('acme.com')).toBe('commercial')
    expect(classifyDomainAuthority('some-random-blog.io')).toBe('commercial')
  })

  it('returns unknown for empty input', () => {
    expect(classifyDomainAuthority('')).toBe('unknown')
    expect(classifyDomainAuthority('   ')).toBe('unknown')
  })
})

describe('computeAiTrustScore', () => {
  it('a Wikipedia entry cited by all 4 engines with positive sentiment gets a high score', () => {
    const out = computeAiTrustScore({
      host: 'en.wikipedia.org',
      citationsCount: 80,
      totalCitationsInWindow: 200,
      engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      avgSentiment: 0.3,
    })
    // 40 (4 engines) + 25 (wiki) + ~17 (40% share) + 10 (positive) ≈ 92
    expect(out.score).toBeGreaterThanOrEqual(85)
    expect(out.category).toBe('wiki')
    expect(trustBand(out.score)).toBe('high')
  })

  it('a one-off random commercial citation gets a low score', () => {
    const out = computeAiTrustScore({
      host: 'random-blog.example',
      citationsCount: 1,
      totalCitationsInWindow: 200,
      engines: ['chatgpt'],
      avgSentiment: null,
    })
    // 10 (1 engine) + 5 (commercial) + 0 (negligible share) + 5 (neutral) = 20
    expect(out.score).toBeLessThan(30)
    expect(out.category).toBe('commercial')
    expect(trustBand(out.score)).toBe('low')
  })

  it('negative sentiment zeros the alignment component', () => {
    const out = computeAiTrustScore({
      host: 'reddit.com',
      citationsCount: 5,
      totalCitationsInWindow: 100,
      engines: ['perplexity', 'gemini'],
      avgSentiment: -0.5,
    })
    expect(out.breakdown.sentimentAlignment).toBe(0)
  })

  it('crossEngine maxes at 40 for 4+ engines', () => {
    const out = computeAiTrustScore({
      host: 'acme.com',
      citationsCount: 10,
      totalCitationsInWindow: 100,
      engines: ['chatgpt', 'gemini', 'perplexity', 'claude', 'extra'],
      avgSentiment: 0,
    })
    expect(out.breakdown.crossEngine).toBe(40)
  })

  it('handles unknown sentiment with a neutral fallback (5 points)', () => {
    const out = computeAiTrustScore({
      host: 'nytimes.com',
      citationsCount: 10,
      totalCitationsInWindow: 100,
      engines: ['chatgpt'],
      avgSentiment: null,
    })
    expect(out.breakdown.sentimentAlignment).toBe(5)
  })

  it('provides human-readable reasoning lines', () => {
    const out = computeAiTrustScore({
      host: 'en.wikipedia.org',
      citationsCount: 50,
      totalCitationsInWindow: 100,
      engines: ['chatgpt', 'perplexity'],
      avgSentiment: 0.1,
    })
    expect(out.reasoning.length).toBeGreaterThanOrEqual(4)
    expect(out.reasoning.join(' ')).toMatch(/2\/4 engines/)
    expect(out.reasoning.join(' ')).toMatch(/wiki/)
  })

  it('clamps total to 100', () => {
    // Theoretical maximum should never exceed 100.
    const out = computeAiTrustScore({
      host: 'whitehouse.gov',
      citationsCount: 100,
      totalCitationsInWindow: 100,
      engines: ['chatgpt', 'gemini', 'perplexity', 'claude'],
      avgSentiment: 1,
    })
    expect(out.score).toBeLessThanOrEqual(100)
  })
})

describe('trustBand', () => {
  it('classifies low / medium / high', () => {
    expect(trustBand(15)).toBe('low')
    expect(trustBand(45)).toBe('medium')
    expect(trustBand(80)).toBe('high')
    expect(trustBand(60)).toBe('high') // boundary
    expect(trustBand(30)).toBe('medium') // boundary
  })
})
