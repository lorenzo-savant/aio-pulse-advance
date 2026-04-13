import { describe, it, expect } from 'vitest'
import { calculateDomainSOAIV } from '../services/monitoring'

describe('calculateDomainSOAIV', () => {
  it('returns empty array for empty cited_urls', () => {
    const result = calculateDomainSOAIV([], 'example.com', ['competitor.com'])
    expect(result).toEqual([])
  })

  it('categorizes brand domain correctly', () => {
    const urls = ['https://example.com/page1', 'https://example.com/blog/post']
    const result = calculateDomainSOAIV(urls, 'example.com', ['competitor.com'])
    expect(result).toHaveLength(1)
    expect(result[0]!.domain).toBe('example.com')
    expect(result[0]!.brandShare).toBe(100)
    expect(result[0]!.competitorShare).toBe(0)
    expect(result[0]!.otherShare).toBe(0)
  })

  it('categorizes competitor domain correctly', () => {
    const urls = ['https://competitor.com/about', 'https://competitor.com/pricing']
    const result = calculateDomainSOAIV(urls, 'example.com', ['competitor.com'])
    expect(result).toHaveLength(1)
    expect(result[0]!.domain).toBe('competitor.com')
    expect(result[0]!.brandShare).toBe(0)
    expect(result[0]!.competitorShare).toBe(100)
    expect(result[0]!.otherShare).toBe(0)
  })

  it('categorizes other domains correctly', () => {
    const urls = ['https://news.com/article', 'https://blog.org/post']
    const result = calculateDomainSOAIV(urls, 'example.com', ['competitor.com'])
    expect(result).toHaveLength(2)
    expect(result[0]!.otherShare).toBe(100)
    expect(result[1]!.otherShare).toBe(100)
  })

  it('calculates correct shares for mixed domains', () => {
    const urls = [
      'https://example.com/page1',
      'https://example.com/page2',
      'https://competitor.com/about',
      'https://news.com/article',
    ]
    const result = calculateDomainSOAIV(urls, 'example.com', ['competitor.com'])
    expect(result).toHaveLength(3)
  })

  it('handles www prefix normalization', () => {
    const urls = ['https://www.example.com/page', 'https://example.com/blog']
    const result = calculateDomainSOAIV(urls, 'example.com', ['competitor.com'])
    expect(result).toHaveLength(1)
    expect(result[0]!.brandShare).toBe(100)
  })

  it('handles subdomain matching for competitors', () => {
    const urls = ['https://blog.competitor.com/post', 'https://www.competitor.com/about']
    const result = calculateDomainSOAIV(urls, 'example.com', ['competitor.com'])
    expect(result).toHaveLength(1)
    expect(result[0]!.competitorShare).toBe(100)
  })

  it('returns sorted results by brand share descending', () => {
    const urls = [
      'https://news.com/a',
      'https://example.com/b',
      'https://competitor.com/c',
      'https://example.com/d',
    ]
    const result = calculateDomainSOAIV(urls, 'example.com', ['competitor.com'])
    expect(result[0]!.domain).toBe('example.com')
    expect(result[0]!.brandShare).toBeGreaterThanOrEqual(result[1]!.brandShare)
  })

  it('handles invalid URLs gracefully', () => {
    const urls = ['https://valid.com', 'not-a-url', 'https://another.com']
    const result = calculateDomainSOAIV(urls, 'example.com', ['competitor.com'])
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('handles case insensitivity', () => {
    const urls = ['https://EXAMPLE.COM/page', 'https://Example.com/blog']
    const result = calculateDomainSOAIV(urls, 'example.com', ['Competitor.com'])
    expect(result).toHaveLength(1)
    expect(result[0]!.brandShare).toBe(100)
  })
})
