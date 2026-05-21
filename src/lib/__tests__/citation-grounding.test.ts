import { describe, it, expect } from 'vitest'
import { cleanCitations, normalizeCitation } from '../services/citation-grounding'

describe('normalizeCitation', () => {
  it('canonicalizes host: lowercases, drops www and trailing slash, forces https', () => {
    expect(normalizeCitation('http://WWW.Example.com/Path/')).toBe('https://example.com/Path')
  })

  it('strips the fragment', () => {
    expect(normalizeCitation('https://example.com/article#section-2')).toBe(
      'https://example.com/article',
    )
  })

  it('strips utm_* and known tracking params but keeps real ones', () => {
    expect(normalizeCitation('https://example.com/p?utm_source=ai&id=42&fbclid=xyz&q=test')).toBe(
      'https://example.com/p?id=42&q=test',
    )
  })

  it('accepts bare domains by assuming https', () => {
    expect(normalizeCitation('example.com/page')).toBe('https://example.com/page')
  })

  it('rejects junk hosts: search engines, AI engines, vertex redirect', () => {
    expect(normalizeCitation('https://www.google.com/search?q=x')).toBeNull()
    expect(normalizeCitation('https://chatgpt.com/c/abc')).toBeNull()
    expect(normalizeCitation('https://perplexity.ai/search/foo')).toBeNull()
    expect(
      normalizeCitation('https://vertexaisearch.cloud.google.com/grounding-api-redirect/tok'),
    ).toBeNull()
  })

  it('keeps a legitimate google subproperty only if it is not the search domain', () => {
    // developers.google.com is endsWith google.com → treated as junk by design.
    expect(normalizeCitation('https://developers.google.com/docs')).toBeNull()
    // but unrelated domains pass
    expect(normalizeCitation('https://reco.se/foretag/acme')).toBe('https://reco.se/foretag/acme')
  })

  it('returns null for invalid input', () => {
    expect(normalizeCitation('')).toBeNull()
    expect(normalizeCitation('not a url')).toBeNull()
    expect(normalizeCitation('ftp://x')).toBeNull()
  })
})

describe('cleanCitations', () => {
  it('dedups by normalized URL, preserving first-seen order', () => {
    const out = cleanCitations([
      'https://example.com/a',
      'http://www.example.com/a/', // same after normalize
      'https://other.com/b',
    ])
    expect(out).toEqual(['https://example.com/a', 'https://other.com/b'])
  })

  it('drops junk and invalid entries', () => {
    const out = cleanCitations([
      'https://google.com/search?q=acme',
      'garbage',
      'https://news.site/article',
    ])
    expect(out).toEqual(['https://news.site/article'])
  })

  it('respects the max cap', () => {
    const urls = Array.from({ length: 30 }, (_, i) => `https://site${i}.com/p`)
    expect(cleanCitations(urls, { max: 5 })).toHaveLength(5)
  })

  it('returns an empty array for an all-junk list', () => {
    expect(cleanCitations(['https://bing.com/x', 'https://claude.ai/y'])).toEqual([])
  })
})
