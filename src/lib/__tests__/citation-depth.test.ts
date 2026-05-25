import { describe, it, expect } from 'vitest'
import {
  classifyCitationDepth,
  classifyCitationKind,
  classifyCitationDepthAndKind,
  deepPageRate,
  emptyDepthBreakdown,
} from '@/lib/utils/citation-depth'

describe('classifyCitationDepth', () => {
  describe('root', () => {
    it('detects the bare domain root', () => {
      expect(classifyCitationDepth('https://example.com')).toBe('root')
      expect(classifyCitationDepth('https://example.com/')).toBe('root')
      expect(classifyCitationDepth('https://www.example.com')).toBe('root')
    })

    it('treats index.* files as root', () => {
      expect(classifyCitationDepth('https://example.com/index.html')).toBe('root')
      expect(classifyCitationDepth('https://example.com/index.php')).toBe('root')
    })

    it('strips a leading locale segment', () => {
      expect(classifyCitationDepth('https://example.com/en/')).toBe('root')
      expect(classifyCitationDepth('https://example.com/it')).toBe('root')
      expect(classifyCitationDepth('https://example.com/sv/index.html')).toBe('root')
    })
  })

  describe('hub', () => {
    it('detects recognised top-level section landings', () => {
      expect(classifyCitationDepth('https://example.com/blog')).toBe('hub')
      expect(classifyCitationDepth('https://example.com/docs/')).toBe('hub')
      expect(classifyCitationDepth('https://example.com/pricing')).toBe('hub')
      expect(classifyCitationDepth('https://example.com/products')).toBe('hub')
      expect(classifyCitationDepth('https://example.com/about')).toBe('hub')
    })

    it('detects hubs after a locale prefix', () => {
      expect(classifyCitationDepth('https://example.com/en/blog')).toBe('hub')
      expect(classifyCitationDepth('https://example.com/it/pricing')).toBe('hub')
    })
  })

  describe('leaf', () => {
    it('classifies any 2+ segment path as leaf', () => {
      expect(classifyCitationDepth('https://example.com/blog/post-title')).toBe('leaf')
      expect(classifyCitationDepth('https://example.com/docs/getting-started/install')).toBe('leaf')
      expect(classifyCitationDepth('https://example.com/products/widget-42')).toBe('leaf')
    })

    it('treats a single unrecognised slug as leaf, not hub', () => {
      // /about-the-founder is a one-off content slug, not a section root.
      expect(classifyCitationDepth('https://example.com/about-the-founder')).toBe('leaf')
      expect(classifyCitationDepth('https://example.com/our-story-2026')).toBe('leaf')
    })

    it('falls back to leaf for empty / un-parseable input', () => {
      expect(classifyCitationDepth('')).toBe('leaf')
      expect(classifyCitationDepth('   ')).toBe('leaf')
      expect(classifyCitationDepth('not a url at all')).toBe('leaf')
    })
  })
})

describe('classifyCitationKind', () => {
  it('detects blog kind', () => {
    expect(classifyCitationKind('https://example.com/blog/why-ai')).toBe('blog')
    expect(classifyCitationKind('https://example.com/news/launch')).toBe('blog')
    expect(classifyCitationKind('https://example.com/posts/123')).toBe('blog')
  })

  it('detects docs kind', () => {
    expect(classifyCitationKind('https://example.com/docs/api')).toBe('docs')
    expect(classifyCitationKind('https://example.com/guides/setup')).toBe('docs')
    expect(classifyCitationKind('https://example.com/academy/course-1')).toBe('docs')
  })

  it('detects product kind across common paths', () => {
    expect(classifyCitationKind('https://example.com/product/x')).toBe('product')
    expect(classifyCitationKind('https://example.com/products/y')).toBe('product')
    expect(classifyCitationKind('https://amazon.com/dp/B0XYZ')).toBe('product')
    expect(classifyCitationKind('https://ebay.com/itm/12345')).toBe('product')
  })

  it('detects support kind', () => {
    expect(classifyCitationKind('https://example.com/help/account')).toBe('support')
    expect(classifyCitationKind('https://example.com/support/login-issue')).toBe('support')
    expect(classifyCitationKind('https://example.com/faq/billing')).toBe('support')
  })

  it('defaults to other for the bare root', () => {
    expect(classifyCitationKind('https://example.com/')).toBe('other')
    expect(classifyCitationKind('https://example.com')).toBe('other')
  })

  it('respects locale prefix when picking the kind', () => {
    expect(classifyCitationKind('https://example.com/it/blog/post')).toBe('blog')
    expect(classifyCitationKind('https://example.com/sv/docs/api')).toBe('docs')
  })
})

describe('classifyCitationDepthAndKind', () => {
  it('returns both classifications in one call', () => {
    expect(classifyCitationDepthAndKind('https://example.com/blog/post')).toEqual({
      depth: 'leaf',
      kind: 'blog',
    })
    expect(classifyCitationDepthAndKind('https://example.com/blog')).toEqual({
      depth: 'hub',
      kind: 'blog',
    })
    expect(classifyCitationDepthAndKind('https://example.com/')).toEqual({
      depth: 'root',
      kind: 'other',
    })
  })
})

describe('deepPageRate', () => {
  it('returns the percent of leaf citations, 1 decimal', () => {
    expect(deepPageRate({ root: 1, hub: 1, leaf: 8 })).toBe(80)
    expect(deepPageRate({ root: 2, hub: 2, leaf: 6 })).toBe(60)
    expect(deepPageRate({ root: 1, hub: 1, leaf: 1 })).toBe(33.3)
  })

  it('returns 0 for an empty breakdown (no division by zero)', () => {
    expect(deepPageRate(emptyDepthBreakdown())).toBe(0)
  })

  it('returns 100 when every citation is deep', () => {
    expect(deepPageRate({ root: 0, hub: 0, leaf: 5 })).toBe(100)
  })

  it('returns 0 when nothing is deep', () => {
    expect(deepPageRate({ root: 3, hub: 2, leaf: 0 })).toBe(0)
  })
})
