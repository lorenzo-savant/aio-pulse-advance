import { describe, it, expect } from 'vitest'
import { scoreCitationWorthiness } from '@/lib/utils/citation-worthiness'

describe('scoreCitationWorthiness', () => {
  it('classifies a /research/ URL with stats body as original_research', () => {
    const r = scoreCitationWorthiness({
      url: 'https://example.com/research/state-of-ai-search-2026',
      title: 'State of AI Search 2026: Findings from 1,200 Marketers',
      html: '<p>We surveyed 1,200 marketers. 47% of respondents reported using AI search daily. Methodology below.</p>',
    })
    expect(r.archetype).toBe('original_research')
    expect(r.score).toBeGreaterThanOrEqual(50)
  })

  it('classifies a /case-study/ URL with results body as case_study', () => {
    const r = scoreCitationWorthiness({
      url: 'https://example.com/case-studies/acme-inc',
      title: 'How Acme increased pipeline by 40% in 6 months',
      html: '<p>Challenge: Acme needed more pipeline. Solution: they adopted X. Results: pipeline increased 40%, conversion grew 2x.</p>',
    })
    expect(r.archetype).toBe('case_study')
    expect(r.score).toBeGreaterThanOrEqual(50)
  })

  it('classifies a /press-release/ URL with announcement body as news', () => {
    const r = scoreCitationWorthiness({
      url: 'https://example.com/press/acme-raises-50m',
      title: 'Acme Announces $50M Series B',
      html: '<p>For immediate release. Today we announced our $50M Series B led by Foo Ventures.</p>',
    })
    expect(r.archetype).toBe('news')
    expect(r.score).toBeGreaterThanOrEqual(50)
  })

  it('classifies an /opinion/ URL with first-person framing as thought_leadership', () => {
    const r = scoreCitationWorthiness({
      url: 'https://example.com/opinion/rethinking-seo',
      title: 'The future of SEO: why I think keywords are dead',
      html: '<p>I believe the keyword era is over. My take: AI engines have changed the game.</p>',
    })
    expect(r.archetype).toBe('thought_leadership')
    expect(r.score).toBeGreaterThanOrEqual(50)
  })

  it('classifies a /pricing page as brand_content', () => {
    const r = scoreCitationWorthiness({
      url: 'https://example.com/pricing',
      title: 'Pricing — Our Product',
      html: '<p>Our product has three tiers.</p>',
    })
    expect(r.archetype).toBe('brand_content')
  })

  it('biases a bare homepage toward brand_content', () => {
    const r = scoreCitationWorthiness({
      url: 'https://example.com/',
      title: 'Acme — the AI search analytics platform',
      html: '<p>Our platform helps marketers track AI visibility.</p>',
    })
    expect(r.archetype).toBe('brand_content')
    expect(r.signals.some((s) => /site root/i.test(s))).toBe(true)
  })

  it('returns generic when no archetype clears the 25-point floor', () => {
    const r = scoreCitationWorthiness({
      url: 'https://example.com/random/page-42',
      title: 'Untitled',
      html: '<p>Lorem ipsum dolor sit amet.</p>',
    })
    expect(r.archetype).toBe('generic')
  })

  it('handles bad URLs without throwing', () => {
    const r = scoreCitationWorthiness({
      url: 'not a url',
      title: 'A study of survey methodology',
      html: '<p>We surveyed 200 people. Methodology: random sampling.</p>',
    })
    expect(r.archetype).toBe('original_research')
  })

  it('returns generic at 0 when given nothing', () => {
    const r = scoreCitationWorthiness({ url: '' })
    expect(r.archetype).toBe('generic')
    expect(r.score).toBe(0)
  })

  it('extracts <title> from html when not supplied explicitly', () => {
    const r = scoreCitationWorthiness({
      url: 'https://example.com/customer-stories/acme',
      html: '<html><head><title>Success story: how Acme saved 30% on infra</title></head><body><p>Challenge / solution / results.</p></body></html>',
    })
    expect(r.archetype).toBe('case_study')
  })

  it('exposes archetypeScores for all five archetypes', () => {
    const r = scoreCitationWorthiness({
      url: 'https://example.com/research/x',
      title: 'A study',
    })
    expect(Object.keys(r.archetypeScores).sort()).toEqual(
      [
        'brand_content',
        'case_study',
        'generic',
        'news',
        'original_research',
        'thought_leadership',
      ].sort(),
    )
  })
})
