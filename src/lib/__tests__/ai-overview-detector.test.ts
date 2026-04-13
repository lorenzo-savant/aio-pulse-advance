import { describe, it, expect } from 'vitest'
import {
  detectBrandInAiOverview,
  detectBrandInPaa,
  detectBrandInOrganic,
  detectBrandInTop3,
  calculateOpportunityScore,
  analyzeBrandPresence,
  type OpportunityResult,
} from '../services/ai-overview-detector'

describe('detectBrandInAiOverview', () => {
  it('returns false when no aiOverviews', () => {
    const result = detectBrandInAiOverview([], 'example.com')
    expect(result).toBe(false)
  })

  it('returns false when brandDomain is empty', () => {
    const aiOverviews = [
      { text: 'Test', links: [{ title: 'Test', url: 'https://example.com/page' }] },
    ]
    const result = detectBrandInAiOverview(aiOverviews, '')
    expect(result).toBe(false)
  })

  it('returns true when brand domain found in AI Overview links', () => {
    const aiOverviews = [
      {
        text: 'Test overview',
        links: [
          { title: 'Brand Page', url: 'https://example.com/product' },
          { title: 'Other', url: 'https://other.com' },
        ],
      },
    ]
    const result = detectBrandInAiOverview(aiOverviews, 'example.com')
    expect(result).toBe(true)
  })

  it('returns false when brand domain not in AI Overview', () => {
    const aiOverviews = [
      {
        text: 'Test overview',
        links: [{ title: 'Competitor', url: 'https://competitor.com' }],
      },
    ]
    const result = detectBrandInAiOverview(aiOverviews, 'example.com')
    expect(result).toBe(false)
  })

  it('handles undefined links', () => {
    const aiOverviews = [{ text: 'Test', links: undefined as never }]
    const result = detectBrandInAiOverview(aiOverviews, 'example.com')
    expect(result).toBe(false)
  })

  it('handles subdomains correctly', () => {
    const aiOverviews = [
      { text: 'Test', links: [{ title: 'Blog', url: 'https://blog.example.com/post' }] },
    ]
    const result = detectBrandInAiOverview(aiOverviews, 'example.com')
    expect(result).toBe(true)
  })
})

describe('detectBrandInPaa', () => {
  it('returns false when no paaBoxes', () => {
    const result = detectBrandInPaa([], 'example.com')
    expect(result).toBe(false)
  })

  it('returns false when brandDomain is empty', () => {
    const paaBoxes = [
      {
        question: 'What is X?',
        answer: 'X is...',
        links: [{ title: 'Link', url: 'https://example.com' }],
      },
    ]
    const result = detectBrandInPaa(paaBoxes, '')
    expect(result).toBe(false)
  })

  it('returns true when brand domain found in PAA links', () => {
    const paaBoxes = [
      {
        question: 'What is X?',
        answer: 'X is...',
        links: [
          { title: 'Brand Page', url: 'https://example.com/about' },
          { title: 'Other', url: 'https://other.com' },
        ],
      },
    ]
    const result = detectBrandInPaa(paaBoxes, 'example.com')
    expect(result).toBe(true)
  })

  it('returns false when brand domain not in PAA', () => {
    const paaBoxes = [
      {
        question: 'What is X?',
        answer: 'X is...',
        links: [{ title: 'Competitor', url: 'https://competitor.com' }],
      },
    ]
    const result = detectBrandInPaa(paaBoxes, 'example.com')
    expect(result).toBe(false)
  })
})

describe('detectBrandInOrganic', () => {
  it('returns false when no organicResults', () => {
    const result = detectBrandInOrganic([], 'example.com')
    expect(result).toBe(false)
  })

  it('returns false when brandDomain is empty', () => {
    const organicResults = [{ title: 'Page', url: 'https://example.com', snippet: '...', rank: 1 }]
    const result = detectBrandInOrganic(organicResults, '')
    expect(result).toBe(false)
  })

  it('returns true when brand domain found in organic', () => {
    const organicResults = [
      { title: 'Brand', url: 'https://example.com', snippet: '...', rank: 1 },
      { title: 'Other', url: 'https://other.com', snippet: '...', rank: 2 },
    ]
    const result = detectBrandInOrganic(organicResults, 'example.com')
    expect(result).toBe(true)
  })

  it('returns false when brand not in organic', () => {
    const organicResults = [
      { title: 'Competitor', url: 'https://competitor.com', snippet: '...', rank: 1 },
    ]
    const result = detectBrandInOrganic(organicResults, 'example.com')
    expect(result).toBe(false)
  })
})

describe('detectBrandInTop3', () => {
  it('returns false when position > 3', () => {
    const organicResults = [
      { title: 'Other1', url: 'https://other1.com', snippet: '...', rank: 1 },
      { title: 'Other2', url: 'https://other2.com', snippet: '...', rank: 2 },
      { title: 'Other3', url: 'https://other3.com', snippet: '...', rank: 3 },
      { title: 'Brand', url: 'https://example.com', snippet: '...', rank: 4 },
    ]
    const result = detectBrandInTop3(organicResults, 'example.com')
    expect(result).toBe(false)
  })

  it('returns true when brand in top 3', () => {
    const organicResults = [
      { title: 'Brand', url: 'https://example.com', snippet: '...', rank: 2 },
      { title: 'Other', url: 'https://other.com', snippet: '...', rank: 1 },
    ]
    const result = detectBrandInTop3(organicResults, 'example.com')
    expect(result).toBe(true)
  })
})

describe('calculateOpportunityScore', () => {
  it('returns 0 when none present', () => {
    const score = calculateOpportunityScore(false, false, false)
    expect(score).toBe(0)
  })

  it('returns 40 when only AI Overview', () => {
    const score = calculateOpportunityScore(true, false, false)
    expect(score).toBe(40)
  })

  it('returns 30 when only PAA', () => {
    const score = calculateOpportunityScore(false, true, false)
    expect(score).toBe(30)
  })

  it('returns 30 when only top 3', () => {
    const score = calculateOpportunityScore(false, false, true)
    expect(score).toBe(30)
  })

  it('returns 70 when AI Overview + PAA', () => {
    const score = calculateOpportunityScore(true, true, false)
    expect(score).toBe(70)
  })

  it('returns 70 when AI Overview + top 3', () => {
    const score = calculateOpportunityScore(true, false, true)
    expect(score).toBe(70)
  })

  it('returns 60 when PAA + top 3', () => {
    const score = calculateOpportunityScore(false, true, true)
    expect(score).toBe(60)
  })

  it('returns 100 when all present', () => {
    const score = calculateOpportunityScore(true, true, true)
    expect(score).toBe(100)
  })
})

describe('analyzeBrandPresence', () => {
  it('returns correct result for brand in all three', () => {
    const serpData = {
      success: true,
      provider: 'dataforseo' as const,
      aiOverviews: [{ text: 'Test', links: [{ title: 'Brand', url: 'https://example.com' }] }],
      peopleAlsoAsk: [
        { question: 'Q?', answer: 'A', links: [{ title: 'Brand', url: 'https://example.com' }] },
      ],
      organicResults: [
        { title: 'Brand', url: 'https://example.com', snippet: '...', rank: 1 },
        { title: 'Other', url: 'https://other.com', snippet: '...', rank: 2 },
      ],
    }

    const result = analyzeBrandPresence(serpData, 'example.com')

    expect(result.aiOverviewPresent).toBe(true)
    expect(result.paaPresent).toBe(true)
    expect(result.organicTop3).toBe(true)
    expect(result.opportunityScore).toBe(100)
  })

  it('returns score 40 when only in AI Overview', () => {
    const serpData = {
      success: true,
      provider: 'dataforseo' as const,
      aiOverviews: [{ text: 'Test', links: [{ title: 'Brand', url: 'https://example.com' }] }],
      peopleAlsoAsk: [
        { question: 'Q?', answer: 'A', links: [{ title: 'Other', url: 'https://other.com' }] },
      ],
      organicResults: [{ title: 'Other', url: 'https://other.com', snippet: '...', rank: 1 }],
    }

    const result = analyzeBrandPresence(serpData, 'example.com')

    expect(result.aiOverviewPresent).toBe(true)
    expect(result.paaPresent).toBe(false)
    expect(result.organicTop3).toBe(false)
    expect(result.opportunityScore).toBe(40)
  })

  it('returns score 0 when brand not found anywhere', () => {
    const serpData = {
      success: true,
      provider: 'dataforseo' as const,
      aiOverviews: [{ text: 'Test', links: [{ title: 'Other', url: 'https://other.com' }] }],
      peopleAlsoAsk: [
        { question: 'Q?', answer: 'A', links: [{ title: 'Other', url: 'https://other.com' }] },
      ],
      organicResults: [{ title: 'Other', url: 'https://other.com', snippet: '...', rank: 1 }],
    }

    const result = analyzeBrandPresence(serpData, 'example.com')

    expect(result.aiOverviewPresent).toBe(false)
    expect(result.paaPresent).toBe(false)
    expect(result.organicTop3).toBe(false)
    expect(result.opportunityScore).toBe(0)
  })
})
