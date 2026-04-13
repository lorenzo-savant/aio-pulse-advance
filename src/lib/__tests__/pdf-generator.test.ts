import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generatePdf, type PdfReportData } from '../services/pdf-generator'
import type { Brand } from '@/types'

describe('generatePdf', () => {
  const mockBrand: Brand = {
    id: 'brand-123',
    user_id: 'user-123',
    name: 'Test Brand',
    slug: 'test-brand',
    description: 'Test description',
    domain: 'testbrand.com',
    aliases: ['TestBrand', 'TB'],
    domains: ['testbrand.com', 'www.testbrand.com'],
    competitors: ['CompetitorA', 'CompetitorB'],
    industry: 'tech',
    color: '#ff0000',
    logo_url: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    language: 'en',
    report_brand_name: 'Test Report Brand',
    report_logo_url: null,
    report_primary_color: '#ff0000',
  }

  const mockData: PdfReportData = {
    brandName: 'Test Brand',
    fromDate: '2024-01-01',
    toDate: '2024-01-31',
    results: [
      {
        created_at: '2024-01-15T10:00:00Z',
        engine: 'chatgpt',
        brand_mentioned: true,
        visibility_score: 85,
        sentiment: 'positive',
        sentiment_score: 0.8,
        url: 'https://example.com/result1',
        cited_urls: ['https://testbrand.com'],
        has_hallucination: false,
        competitor_mentions: [{ name: 'CompetitorA', position: 2, count: 1 }],
      },
      {
        created_at: '2024-01-20T10:00:00Z',
        engine: 'gemini',
        brand_mentioned: true,
        visibility_score: 70,
        sentiment: 'neutral',
        sentiment_score: 0.2,
        url: 'https://example.com/result2',
        cited_urls: ['https://testbrand.com', 'https://competitor.com'],
        has_hallucination: false,
        competitor_mentions: [{ name: 'CompetitorB', position: 1, count: 2 }],
      },
      {
        created_at: '2024-01-25T10:00:00Z',
        engine: 'perplexity',
        brand_mentioned: false,
        visibility_score: 30,
        sentiment: 'negative',
        sentiment_score: -0.3,
        url: 'https://example.com/result3',
        cited_urls: [],
        has_hallucination: true,
        competitor_mentions: [],
      },
    ],
    sentimentHistory: [
      {
        snapshot_date: '2024-01-15',
        sentiment_score: 0.6,
        positive_count: 10,
        neutral_count: 5,
        negative_count: 2,
      },
      {
        snapshot_date: '2024-01-20',
        sentiment_score: 0.4,
        positive_count: 8,
        neutral_count: 7,
        negative_count: 3,
      },
    ],
    recommendations: [
      {
        recommendation_text: 'Improve content quality to increase citations',
        priority: 'high',
        category: 'Citations',
      },
      {
        recommendation_text: 'Monitor competitor mentions more closely',
        priority: 'medium',
        category: 'Competitors',
      },
    ],
    competitors: ['CompetitorA', 'CompetitorB'],
  }

  it('generates a PDF buffer', async () => {
    const result = await generatePdf(mockBrand, mockData, { locale: 'en' })

    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
  })

  it('applies brand primary color to PDF', async () => {
    const result = await generatePdf(mockBrand, mockData, { locale: 'en' })

    expect(result.length).toBeGreaterThan(1000)
  })

  it('uses brand report_brand_name in header', async () => {
    const result = await generatePdf(mockBrand, mockData, { locale: 'en' })

    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
  })

  it('handles empty results', async () => {
    const emptyData: PdfReportData = {
      brandName: 'Empty Brand',
      fromDate: '2024-01-01',
      toDate: '2024-01-31',
      results: [],
      competitors: [],
    }

    const result = await generatePdf(mockBrand, emptyData, { locale: 'en' })

    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
  })

  it('handles brand without report settings', async () => {
    const brandNoReport: Brand = {
      ...mockBrand,
      report_brand_name: undefined,
      report_primary_color: undefined,
      report_logo_url: undefined,
    }

    const result = await generatePdf(brandNoReport, mockData, { locale: 'en' })

    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(0)
  })

  it('supports different locales', async () => {
    const resultEn = await generatePdf(mockBrand, mockData, { locale: 'en' })
    const resultIt = await generatePdf(mockBrand, mockData, { locale: 'it' })

    expect(resultEn).toBeInstanceOf(Buffer)
    expect(resultIt).toBeInstanceOf(Buffer)
    expect(resultEn.length).toBeGreaterThan(0)
    expect(resultIt.length).toBeGreaterThan(0)
  })

  it('includes AVI calculation in PDF', async () => {
    const result = await generatePdf(mockBrand, mockData, { locale: 'en' })

    expect(result).toBeInstanceOf(Buffer)
    expect(result.length).toBeGreaterThan(5000)
  })

  it('includes competitor analysis', async () => {
    const result = await generatePdf(mockBrand, mockData, { locale: 'en' })

    expect(result).toBeInstanceOf(Buffer)
  })

  it('includes sentiment data', async () => {
    const result = await generatePdf(mockBrand, mockData, { locale: 'en' })

    expect(result).toBeInstanceOf(Buffer)
  })

  it('includes recommendations', async () => {
    const result = await generatePdf(mockBrand, mockData, { locale: 'en' })

    expect(result).toBeInstanceOf(Buffer)
  })
})
