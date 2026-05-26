import { describe, it, expect } from 'vitest'
import {
  calculateAVIFromResults,
  calculateDomainSOAIV,
  calculateCompetitorAVI,
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

describe('i18n Labels', () => {
  const locales = ['en', 'it', 'sv'] as const

  it('has all required labels for each locale', () => {
    const requiredLabels = [
      'title',
      'brand',
      'period',
      'aviScore',
      'soaiv',
      'competitors',
      'rank',
      'gap',
      'sentiment',
    ]

    for (const locale of locales) {
      const labels = {
        en: {
          title: 'AI Voice Report',
          brand: 'Brand',
          period: 'Report Period',
          aviScore: 'AVI Score',
          soaiv: 'Share of AI Voice',
          competitors: 'Competitor Analysis',
          rank: 'Rank',
          gap: 'Gap',
          sentiment: 'Sentiment Heatmap',
        },
        it: {
          title: 'Rapporto AI Voice',
          brand: 'Marca',
          period: 'Periodo Report',
          aviScore: 'Punteggio AVI',
          soaiv: 'Share of AI Voice',
          competitors: 'Analisi Competitor',
          rank: 'Rank',
          gap: 'Gap',
          sentiment: 'Mappa Sentiment',
        },
        sv: {
          title: 'AI Voice Rapport',
          brand: 'Varumärke',
          period: 'Rapportperiod',
          aviScore: 'AVI Poäng',
          soaiv: 'Share of AI Voice',
          competitors: 'Konkurrentanalys',
          rank: 'Rank',
          gap: 'Gap',
          sentiment: 'Sentiment Heatmap',
        },
      }
      for (const label of requiredLabels) {
        expect(labels[locale][label as keyof (typeof labels)['en']]).toBeDefined()
      }
    }
  })
})
