import { describe, it, expect } from 'vitest'
import {
  generateRecommendations,
  type RecommendationInput,
  type AVIInput,
  type DomainSOAIVResult,
} from '../services/monitoring'

const createAVIInput = (overrides: Partial<AVIInput> = {}): AVIInput => ({
  citationRate: 50,
  mentionFrequency: 50,
  sentimentScore: 0,
  recommendationRate: 50,
  positionAvg: 2,
  hallucinationIndex: 5,
  ...overrides,
})

const createSOAIV = (overrides: Partial<DomainSOAIVResult>[] = []): DomainSOAIVResult[] => [
  { domain: 'brand.com', brandShare: 50, competitorShare: 30, otherShare: 20 },
  ...overrides.map((o) => ({
    domain: 'test.com',
    brandShare: 30,
    competitorShare: 30,
    otherShare: 40,
    ...o,
  })),
]

const createCompetitorGap = (
  overrides: Partial<RecommendationInput['competitorGap']> = {},
): RecommendationInput['competitorGap'] => ({
  rank: 2,
  competitorAvi: 40,
  brandAvi: 60,
  weakestComponent: 'Citation Rate',
  ...overrides,
})

describe('generateRecommendations', () => {
  it('returns empty array when no conditions are met', () => {
    const input: RecommendationInput = {
      aviComponents: createAVIInput({
        citationRate: 50,
        mentionFrequency: 50,
        sentimentScore: 0.5,
        recommendationRate: 50,
        positionAvg: 1,
        hallucinationIndex: 10,
      }),
      soaiv: createSOAIV([
        { domain: 'brand.com', brandShare: 50, competitorShare: 20, otherShare: 30 },
      ]),
      competitorGap: createCompetitorGap({ brandAvi: 50, competitorAvi: 45 }),
    }
    const result = generateRecommendations(input)
    expect(result).toEqual([])
  })

  it('generates recommendation for low citationRate', () => {
    const input: RecommendationInput = {
      aviComponents: createAVIInput({ citationRate: 20 }),
      soaiv: [],
      competitorGap: createCompetitorGap(),
    }
    const result = generateRecommendations(input)
    expect(result.find((r) => r.component === 'citationRate')).toBeDefined()
    expect(result[0]!.priority).toBe(8 * 3 - 5)
  })

  it('generates recommendation for low mentionFrequency', () => {
    const input: RecommendationInput = {
      aviComponents: createAVIInput({ mentionFrequency: 30 }),
      soaiv: [],
      competitorGap: createCompetitorGap(),
    }
    const result = generateRecommendations(input)
    expect(result.find((r) => r.component === 'mentionFrequency')).toBeDefined()
  })

  it('generates recommendation for negative sentimentScore', () => {
    const input: RecommendationInput = {
      aviComponents: createAVIInput({ sentimentScore: -0.5 }),
      soaiv: [],
      competitorGap: createCompetitorGap(),
    }
    const result = generateRecommendations(input)
    expect(result.find((r) => r.component === 'sentimentScore')).toBeDefined()
  })

  it('generates recommendation for low positive sentimentScore', () => {
    const input: RecommendationInput = {
      aviComponents: createAVIInput({ sentimentScore: 0.3 }),
      soaiv: [],
      competitorGap: createCompetitorGap(),
    }
    const result = generateRecommendations(input)
    const sentimentRec = result.find((r) => r.component === 'sentimentScore')
    expect(sentimentRec).toBeDefined()
    expect(sentimentRec!.title).toBe('Incrementa sentiment positivo')
  })

  it('generates recommendation for low recommendationRate', () => {
    const input: RecommendationInput = {
      aviComponents: createAVIInput({ recommendationRate: 20 }),
      soaiv: [],
      competitorGap: createCompetitorGap(),
    }
    const result = generateRecommendations(input)
    expect(result.find((r) => r.component === 'recommendationRate')).toBeDefined()
  })

  it('generates recommendation for high positionAvg', () => {
    const input: RecommendationInput = {
      aviComponents: createAVIInput({ positionAvg: 5 }),
      soaiv: [],
      competitorGap: createCompetitorGap(),
    }
    const result = generateRecommendations(input)
    expect(result.find((r) => r.component === 'positionAvg')).toBeDefined()
  })

  it('generates recommendation for high hallucinationIndex', () => {
    const input: RecommendationInput = {
      aviComponents: createAVIInput({ hallucinationIndex: 30 }),
      soaiv: [],
      competitorGap: createCompetitorGap(),
    }
    const result = generateRecommendations(input)
    expect(result.find((r) => r.component === 'hallucinationIndex')).toBeDefined()
  })

  it('generates recommendation for large competitor gap', () => {
    const input: RecommendationInput = {
      aviComponents: createAVIInput(),
      soaiv: [],
      competitorGap: createCompetitorGap({ brandAvi: 80, competitorAvi: 30 }),
    }
    const result = generateRecommendations(input)
    expect(result.find((r) => r.component === 'competitorGap')).toBeDefined()
    expect(result[0]!.title).toBe('Recupera gap competitor')
  })

  it('generates recommendation for low brand share in SOAIV', () => {
    const input: RecommendationInput = {
      aviComponents: createAVIInput(),
      soaiv: [{ domain: 'news.com', brandShare: 20, competitorShare: 40, otherShare: 40 }],
      competitorGap: createCompetitorGap(),
    }
    const result = generateRecommendations(input)
    expect(
      result.find((r) => r.component === 'soaiv' && r.title === 'Aumenta share del brand'),
    ).toBeDefined()
  })

  it('generates recommendation when competitor dominates in SOAIV', () => {
    const input: RecommendationInput = {
      aviComponents: createAVIInput(),
      soaiv: [{ domain: 'news.com', brandShare: 30, competitorShare: 50, otherShare: 20 }],
      competitorGap: createCompetitorGap(),
    }
    const result = generateRecommendations(input)
    expect(result.find((r) => r.title === 'Combatti dominio competitor')).toBeDefined()
  })

  it('sorts recommendations by priority descending', () => {
    const input: RecommendationInput = {
      aviComponents: createAVIInput({ citationRate: 20, sentimentScore: -0.5 }),
      soaiv: [{ domain: 'news.com', brandShare: 20, competitorShare: 40, otherShare: 40 }],
      competitorGap: createCompetitorGap({ brandAvi: 80, competitorAvi: 30 }),
    }
    const result = generateRecommendations(input)
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.priority).toBeGreaterThanOrEqual(result[i]!.priority)
    }
  })

  it('calculates priority correctly: impact * 3 - effort', () => {
    const input: RecommendationInput = {
      aviComponents: createAVIInput({ citationRate: 20 }),
      soaiv: [],
      competitorGap: createCompetitorGap(),
    }
    const result = generateRecommendations(input)
    const rec = result[0]
    expect(rec?.priority).toBe(rec!.impact * 3 - rec!.effort)
  })
})
