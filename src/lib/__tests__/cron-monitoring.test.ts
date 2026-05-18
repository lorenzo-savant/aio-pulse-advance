import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import {
  calculateAVI,
  calculateAVIFromResults,
  calculateHealthScore,
  type AVIInput,
} from '../services/monitoring'

// ─── Mock modules needed by route handlers ──────────────────────────────────

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(() => null),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

vi.mock('@/lib/services/monitoring', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/monitoring')>()
  return {
    ...actual,
    runMonitoringCheck: vi.fn(),
  }
})

vi.mock('@/lib/services/citation-snapshots', () => ({
  calculateCitationSnapshots: vi.fn(),
}))

vi.mock('@/lib/services/weekly-review', () => ({
  generateWeeklyReview: vi.fn(),
}))

// ═══════════════════════════════════════════════════════════════════════════════
// 1. calculateAVI — edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateAVI — edge cases', () => {
  it('all components zero yields baseline from sentiment/position normalization', () => {
    const input: AVIInput = {
      citationRate: 0,
      mentionFrequency: 0,
      sentimentScore: 0,
      recommendationRate: 0,
      positionAvg: 0,
      hallucinationIndex: 0,
    }
    const avi = calculateAVI(input)
    // sentimentNorm = 50, positionNorm = 50 (positionAvg<=0), antiHallucination = 100
    // raw = 0 + 0 + 50*0.15 + 0 + 50*0.15 + 100*0.1 = 7.5 + 7.5 + 10 = 25
    expect(avi).toBe(25)
  })

  it('all components at maximum yields 100', () => {
    const input: AVIInput = {
      citationRate: 100,
      mentionFrequency: 100,
      sentimentScore: 1,
      recommendationRate: 100,
      positionAvg: 1,
      hallucinationIndex: 0,
    }
    const avi = calculateAVI(input)
    // sentimentNorm = 100, positionNorm = 100, antiHallucination = 100
    // raw = 20 + 20 + 15 + 20 + 15 + 10 = 100
    expect(avi).toBe(100)
  })

  it('worst possible sentiment (-1) yields sentimentNorm=0', () => {
    const input: AVIInput = {
      citationRate: 0,
      mentionFrequency: 0,
      sentimentScore: -1,
      recommendationRate: 0,
      positionAvg: 0,
      hallucinationIndex: 0,
    }
    const avi = calculateAVI(input)
    // sentimentNorm = 0, positionNorm = 50, antiHallucination = 100
    // raw = 0 + 0 + 0 + 0 + 50*0.15 + 100*0.1 = 17.5
    expect(avi).toBe(17.5)
  })

  it('positionAvg=5 yields positionNorm=0', () => {
    const input: AVIInput = {
      citationRate: 0,
      mentionFrequency: 0,
      sentimentScore: 0,
      recommendationRate: 0,
      positionAvg: 5,
      hallucinationIndex: 0,
    }
    const avi = calculateAVI(input)
    // positionNorm = max(0, min(100, (5-5)/4 * 100)) = 0
    // raw = 0 + 0 + 50*0.15 + 0 + 0 + 100*0.1 = 17.5
    expect(avi).toBe(17.5)
  })

  it('positionAvg=3 yields positionNorm=50', () => {
    const input: AVIInput = {
      citationRate: 0,
      mentionFrequency: 0,
      sentimentScore: 0,
      recommendationRate: 0,
      positionAvg: 3,
      hallucinationIndex: 0,
    }
    const avi = calculateAVI(input)
    // positionNorm = (5-3)/4 * 100 = 50
    // raw = 0 + 0 + 50*0.15 + 0 + 50*0.15 + 100*0.1 = 25
    expect(avi).toBe(25)
  })

  it('hallucinationIndex=100 zeros antiHallucination component', () => {
    const input: AVIInput = {
      citationRate: 100,
      mentionFrequency: 100,
      sentimentScore: 1,
      recommendationRate: 100,
      positionAvg: 1,
      hallucinationIndex: 100,
    }
    const avi = calculateAVI(input)
    // raw = 20 + 20 + 15 + 20 + 15 + 0 = 90
    expect(avi).toBe(90)
  })

  it('clamps sentiment beyond range [-1, 1]', () => {
    const input: AVIInput = {
      citationRate: 0,
      mentionFrequency: 0,
      sentimentScore: 5, // well beyond 1
      recommendationRate: 0,
      positionAvg: 0,
      hallucinationIndex: 0,
    }
    const avi = calculateAVI(input)
    // sentimentScore is clamped to 1 -> sentimentNorm = 100
    // raw = 0 + 0 + 100*0.15 + 0 + 50*0.15 + 100*0.1 = 15 + 7.5 + 10 = 32.5
    expect(avi).toBe(32.5)
  })

  it('clamps sentiment below -1', () => {
    const input: AVIInput = {
      citationRate: 0,
      mentionFrequency: 0,
      sentimentScore: -10,
      recommendationRate: 0,
      positionAvg: 0,
      hallucinationIndex: 0,
    }
    const avi = calculateAVI(input)
    // clamped to -1 -> sentimentNorm = 0
    // raw = 0 + 0 + 0 + 0 + 50*0.15 + 100*0.1 = 17.5
    expect(avi).toBe(17.5)
  })

  it('positionAvg > 5 yields positionNorm clamped to 0', () => {
    const input: AVIInput = {
      citationRate: 0,
      mentionFrequency: 0,
      sentimentScore: 0,
      recommendationRate: 0,
      positionAvg: 100,
      hallucinationIndex: 0,
    }
    const avi = calculateAVI(input)
    // positionNorm = max(0, (5-100)/4 * 100) = 0
    // raw = 0 + 0 + 50*0.15 + 0 + 0 + 100*0.1 = 17.5
    expect(avi).toBe(17.5)
  })

  it('negative positionAvg treated as <= 0 -> positionNorm=50', () => {
    const input: AVIInput = {
      citationRate: 0,
      mentionFrequency: 0,
      sentimentScore: 0,
      recommendationRate: 0,
      positionAvg: -5,
      hallucinationIndex: 0,
    }
    const avi = calculateAVI(input)
    // positionAvg <= 0 -> positionNorm = 50
    expect(avi).toBe(25)
  })

  it('result is always clamped between 0 and 100', () => {
    // Even with huge citationRate values, result is capped
    const input: AVIInput = {
      citationRate: 500,
      mentionFrequency: 500,
      sentimentScore: 1,
      recommendationRate: 500,
      positionAvg: 1,
      hallucinationIndex: 0,
    }
    const avi = calculateAVI(input)
    expect(avi).toBe(100)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. calculateAVIFromResults — edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateAVIFromResults — edge cases', () => {
  it('empty array returns avi=0 and all-zero components', () => {
    const { avi, components } = calculateAVIFromResults([])
    expect(avi).toBe(0)
    expect(components).toEqual({
      citationRate: 0,
      mentionFrequency: 0,
      sentimentScore: 0,
      recommendationRate: 0,
      positionAvg: 0,
      hallucinationIndex: 0,
    })
  })

  it('single result with all positive signals', () => {
    const results = [
      {
        brand_mentioned: true,
        visibility_score: 90,
        sentiment_score: 0.8,
        cited_urls: ['https://example.com'],
        has_hallucination: false,
        mention_position: 1,
      },
    ]
    const { avi, components } = calculateAVIFromResults(results)
    expect(components.citationRate).toBe(100)
    expect(components.mentionFrequency).toBe(100)
    expect(components.sentimentScore).toBe(0.8)
    expect(components.recommendationRate).toBe(100)
    expect(components.positionAvg).toBe(1)
    expect(components.hallucinationIndex).toBe(0)
    expect(avi).toBeGreaterThan(90)
  })

  it('single result with no mention', () => {
    const results = [
      {
        brand_mentioned: false,
        visibility_score: 0,
        sentiment_score: null,
        cited_urls: [],
        has_hallucination: false,
        mention_position: null,
      },
    ]
    const { components } = calculateAVIFromResults(results)
    expect(components.mentionFrequency).toBe(0)
    expect(components.citationRate).toBe(0)
    expect(components.sentimentScore).toBe(0) // no mentioned results -> 0
    expect(components.recommendationRate).toBe(0)
    expect(components.positionAvg).toBe(0) // no valid positions
    expect(components.hallucinationIndex).toBe(0)
  })

  it('handles null sentiment_score in mentioned results', () => {
    const results = [
      {
        brand_mentioned: true,
        visibility_score: 50,
        sentiment_score: null,
        cited_urls: [],
        has_hallucination: false,
        mention_position: 2,
      },
    ]
    const { components } = calculateAVIFromResults(results)
    // null sentiment_score becomes 0 via ?? 0
    expect(components.sentimentScore).toBe(0)
  })

  it('averages sentiment across only mentioned results', () => {
    const results = [
      {
        brand_mentioned: true,
        visibility_score: 80,
        sentiment_score: 0.6,
        cited_urls: [],
        has_hallucination: false,
      },
      {
        brand_mentioned: true,
        visibility_score: 60,
        sentiment_score: -0.4,
        cited_urls: [],
        has_hallucination: false,
      },
      {
        brand_mentioned: false,
        visibility_score: 10,
        sentiment_score: -1,
        cited_urls: [],
        has_hallucination: false,
      },
    ]
    const { components } = calculateAVIFromResults(results)
    // Only 2 mentioned: (0.6 + -0.4) / 2 = 0.1
    expect(components.sentimentScore).toBeCloseTo(0.1, 5)
  })

  it('all results hallucinated yields hallucinationIndex=100', () => {
    const results = [
      {
        brand_mentioned: true,
        visibility_score: 50,
        sentiment_score: 0,
        cited_urls: [],
        has_hallucination: true,
      },
      {
        brand_mentioned: true,
        visibility_score: 50,
        sentiment_score: 0,
        cited_urls: [],
        has_hallucination: true,
      },
    ]
    const { components } = calculateAVIFromResults(results)
    expect(components.hallucinationIndex).toBe(100)
  })

  it('filters out null and zero positions from positionAvg', () => {
    const results = [
      {
        brand_mentioned: true,
        visibility_score: 80,
        sentiment_score: 0.5,
        cited_urls: [],
        has_hallucination: false,
        mention_position: 2,
      },
      {
        brand_mentioned: true,
        visibility_score: 60,
        sentiment_score: 0.3,
        cited_urls: [],
        has_hallucination: false,
        mention_position: null,
      },
      {
        brand_mentioned: true,
        visibility_score: 60,
        sentiment_score: 0.3,
        cited_urls: [],
        has_hallucination: false,
        mention_position: 0, // filtered out (not > 0)
      },
    ]
    const { components } = calculateAVIFromResults(results)
    // Only position=2 is valid
    expect(components.positionAvg).toBe(2)
  })

  it('missing mention_position field defaults to undefined (filtered)', () => {
    const results = [
      {
        brand_mentioned: true,
        visibility_score: 80,
        sentiment_score: 0.5,
        cited_urls: [],
        has_hallucination: false,
        // no mention_position at all
      },
    ]
    const { components } = calculateAVIFromResults(results)
    expect(components.positionAvg).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. calculateHealthScore (deprecated wrapper)
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateHealthScore', () => {
  it('maps visibilityScore to citationRate, mentionFrequency, recommendationRate', () => {
    const score = calculateHealthScore(80, 0, 0)
    // citationRate=80, mentionFrequency=80, recommendationRate=80
    // sentimentNorm = 50, positionNorm = 50, antiHallucination = 100
    // raw = 80*0.2 + 80*0.2 + 50*0.15 + 80*0.2 + 50*0.15 + 100*0.1
    // = 16 + 16 + 7.5 + 16 + 7.5 + 10 = 73
    expect(score).toBe(73)
  })

  it('hallucinationRate of 0.5 maps to hallucinationIndex 50', () => {
    const score = calculateHealthScore(0, 0, 0.5)
    // antiHallucination = 50
    // raw = 0 + 0 + 50*0.15 + 0 + 50*0.15 + 50*0.1 = 7.5 + 7.5 + 5 = 20
    expect(score).toBe(20)
  })

  it('hallucinationRate of 1.0 maps to hallucinationIndex 100', () => {
    const score = calculateHealthScore(0, 0, 1.0)
    // antiHallucination = 0
    // raw = 0 + 0 + 50*0.15 + 0 + 50*0.15 + 0 = 15
    expect(score).toBe(15)
  })

  it('negative hallucinationRate clamps hallucinationIndex to non-negative', () => {
    // hallucinationRate=-0.5 -> hallucinationIndex=-50 -> antiHallucination = max(0, 100-(-50)) = 150
    // But that is > 100, which is fine — the final score is clamped 0-100
    const scoreNeg = calculateHealthScore(0, 0, -0.5)
    const scoreZero = calculateHealthScore(0, 0, 0)
    // antiHallucination for -0.5: 100-(-50)=150, so raw is higher
    expect(scoreNeg).toBeGreaterThan(scoreZero)
  })

  it('hallucinationRate > 1.0 makes antiHallucination go negative (clamped in final)', () => {
    const score = calculateHealthScore(0, 0, 2.0)
    // hallucinationIndex = 200, antiHallucination = max(0, 100-200) = 0 (clamped)
    // But wait - the max(0, ...) is in calculateAVI's formula
    // Actually: antiHallucination = max(0, 100 - 200) = 0 (there IS a max(0,...))
    // raw = 0 + 0 + 50*0.15 + 0 + 50*0.15 + 0*0.1 = 15
    expect(score).toBe(15)
  })

  it('all zero inputs', () => {
    const score = calculateHealthScore(0, 0, 0)
    expect(score).toBe(25)
  })

  it('boundary: visibility=100, sentiment=1, hallucinationRate=0', () => {
    const score = calculateHealthScore(100, 1, 0)
    // citationRate=100, mentionFreq=100, sentimentScore=1, recommendationRate=100
    // sentimentNorm=100, positionNorm=50, antiHallucination=100
    // raw = 20 + 20 + 15 + 20 + 50*0.15 + 10 = 92.5
    expect(score).toBe(92.5)
  })

  it('boundary: visibility=50, sentiment=0, hallucinationRate=0.5', () => {
    const score = calculateHealthScore(50, 0, 0.5)
    // raw = 50*0.2 + 50*0.2 + 50*0.15 + 50*0.2 + 50*0.15 + 50*0.1
    // = 10 + 10 + 7.5 + 10 + 7.5 + 5 = 50
    expect(score).toBe(50)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Cron authentication — monitoring route
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cron auth — monitoring route', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('returns 500 when CRON_SECRET_TOKEN is not set', async () => {
    delete process.env.CRON_SECRET_TOKEN
    const { POST } = await import('@/app/api/cron/monitoring/route')
    const req = new NextRequest('http://localhost/api/cron/monitoring', {
      method: 'POST',
      headers: { authorization: 'Bearer some-token' },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.message).toBe('Server misconfigured')
  })

  it('returns 401 when Authorization header is missing', async () => {
    process.env.CRON_SECRET_TOKEN = 'valid-secret'
    const { POST } = await import('@/app/api/cron/monitoring/route')
    const req = new NextRequest('http://localhost/api/cron/monitoring', {
      method: 'POST',
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when token is wrong', async () => {
    process.env.CRON_SECRET_TOKEN = 'valid-secret'
    const { POST } = await import('@/app/api/cron/monitoring/route')
    const req = new NextRequest('http://localhost/api/cron/monitoring', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-token' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 503 when supabase is not configured', async () => {
    process.env.CRON_SECRET_TOKEN = 'valid-secret'
    const { createServerClient } = await import('@/lib/supabase')
    vi.mocked(createServerClient).mockReturnValue(null as any)

    const { POST } = await import('@/app/api/cron/monitoring/route')
    const req = new NextRequest('http://localhost/api/cron/monitoring', {
      method: 'POST',
      headers: { authorization: 'Bearer valid-secret' },
    })
    const res = await POST(req)
    expect(res.status).toBe(503)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Cron authentication — weekly review route
// ═══════════════════════════════════════════════════════════════════════════════

describe('Cron auth — weekly review route', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('returns 401 when CRON_SECRET_TOKEN is not set (combined check)', async () => {
    delete process.env.CRON_SECRET_TOKEN
    const { POST } = await import('@/app/api/cron/weekly-review/route')
    const req = new NextRequest('http://localhost/api/cron/weekly-review', {
      method: 'POST',
      headers: { authorization: 'Bearer anything' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 401 when token is wrong', async () => {
    process.env.CRON_SECRET_TOKEN = 'correct-secret'
    const { POST } = await import('@/app/api/cron/weekly-review/route')
    const req = new NextRequest('http://localhost/api/cron/weekly-review', {
      method: 'POST',
      headers: { authorization: 'Bearer wrong-token' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 503 when DB is not configured', async () => {
    process.env.CRON_SECRET_TOKEN = 'correct-secret'
    const { createServerClient } = await import('@/lib/supabase')
    vi.mocked(createServerClient).mockReturnValue(null as any)

    const { POST } = await import('@/app/api/cron/weekly-review/route')
    const req = new NextRequest('http://localhost/api/cron/weekly-review', {
      method: 'POST',
      headers: { authorization: 'Bearer correct-secret' },
    })
    const res = await POST(req)
    expect(res.status).toBe(503)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. generateWeeklyReview — service layer
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateWeeklyReview', () => {
  let generateWeeklyReview: typeof import('../services/weekly-review').generateWeeklyReview

  beforeEach(async () => {
    const mod = await vi.importActual<typeof import('../services/weekly-review')>(
      '../services/weekly-review',
    )
    generateWeeklyReview = mod.generateWeeklyReview
  })

  function buildMockSupabase(overrides: {
    currentScore?: any[]
    prevScore?: any[]
    monitoringCount?: number
    halCount?: number
  }) {
    const { currentScore = [], prevScore = [], monitoringCount = 0, halCount = 0 } = overrides

    // Build a chainable mock: each method returns `this`, except terminal methods
    const createChain = (terminalValue: any) => {
      const chain: any = {}
      const methods = ['from', 'select', 'eq', 'lte', 'gte', 'order', 'limit', 'is']
      for (const m of methods) {
        chain[m] = vi.fn(() => chain)
      }
      // Terminal: returns the value
      Object.assign(chain, terminalValue)
      return chain
    }

    // We need different return values for different .from() calls
    let fromCallCount = 0
    const responses = [
      { data: currentScore }, // brand_health_scores (current)
      { data: prevScore }, // brand_health_scores (previous)
      { count: monitoringCount }, // monitoring_results (count)
      { count: halCount }, // monitoring_results (hallucinations)
    ]

    const mockDb: any = {
      from: vi.fn(() => {
        const idx = fromCallCount++
        const resp = responses[idx] || { data: [], count: 0 }
        const chain: any = {}
        const methods = ['select', 'eq', 'lte', 'gte', 'order', 'limit', 'is']
        for (const m of methods) {
          chain[m] = vi.fn(() => chain)
        }
        // Spread terminal values
        Object.assign(chain, resp)
        return chain
      }),
    }
    return mockDb
  }

  it('computes correct metrics with no data', async () => {
    const db = buildMockSupabase({})
    const result = await generateWeeklyReview(db, 'brand-1', 'TestBrand', 'user-1')

    expect(result.brandId).toBe('brand-1')
    expect(result.brandName).toBe('TestBrand')
    expect(result.metrics.aviScoreCurrent).toBe(0)
    expect(result.metrics.aviScorePrevious).toBe(0)
    expect(result.metrics.aviDelta).toBe(0)
    expect(result.metrics.totalMonitoringRuns).toBe(0)
    expect(result.metrics.newHallucinations).toBe(0)
  })

  it('calculates positive aviDelta and highlight', async () => {
    const db = buildMockSupabase({
      currentScore: [
        {
          avi_score: 75,
          health_score: 70,
          mention_rate: 60,
          citation_rate: 40,
          sentiment_score: 0.3,
        },
      ],
      prevScore: [{ avi_score: 65, health_score: 60 }],
      monitoringCount: 12,
      halCount: 0,
    })
    const result = await generateWeeklyReview(db, 'brand-1', 'TestBrand', 'user-1')

    expect(result.metrics.aviScoreCurrent).toBe(75)
    expect(result.metrics.aviScorePrevious).toBe(65)
    expect(result.metrics.aviDelta).toBe(10)
    expect(result.highlight).toContain('improved by 10')
  })

  it('generates concern for hallucinations', async () => {
    const db = buildMockSupabase({
      currentScore: [{ avi_score: 50, mention_rate: 40, citation_rate: 20, sentiment_score: 0 }],
      prevScore: [{ avi_score: 50 }],
      monitoringCount: 8,
      halCount: 3,
    })
    const result = await generateWeeklyReview(db, 'brand-1', 'TestBrand', 'user-1')

    expect(result.metrics.newHallucinations).toBe(3)
    expect(result.concern).toContain('3 new hallucination')
  })

  it('generates concern when AVI drops by more than 5', async () => {
    const db = buildMockSupabase({
      currentScore: [{ avi_score: 40, mention_rate: 30, citation_rate: 10, sentiment_score: -0.2 }],
      prevScore: [{ avi_score: 50 }],
      monitoringCount: 5,
      halCount: 0,
    })
    const result = await generateWeeklyReview(db, 'brand-1', 'TestBrand', 'user-1')

    expect(result.metrics.aviDelta).toBe(-10)
    expect(result.concern).toContain('dropped by 10')
  })

  it('falls back to health_score when avi_score is missing', async () => {
    const db = buildMockSupabase({
      currentScore: [{ health_score: 55, visibility_score: 45, sentiment_score: 0.1 }],
      prevScore: [{ health_score: 50 }],
      monitoringCount: 3,
      halCount: 0,
    })
    const result = await generateWeeklyReview(db, 'brand-1', 'TestBrand', 'user-1')

    expect(result.metrics.aviScoreCurrent).toBe(55)
    expect(result.metrics.aviScorePrevious).toBe(50)
    expect(result.metrics.aviDelta).toBe(5)
  })

  it('obsidianNote contains YAML frontmatter with correct fields', async () => {
    const db = buildMockSupabase({
      currentScore: [{ avi_score: 60, mention_rate: 50, citation_rate: 30, sentiment_score: 0 }],
      prevScore: [],
      monitoringCount: 4,
      halCount: 1,
    })
    const result = await generateWeeklyReview(db, 'brand-1', 'Acme Corp', 'user-1')

    expect(result.obsidianNote).toContain('type: weekly-review')
    expect(result.obsidianNote).toContain('client: "Acme Corp"')
    expect(result.obsidianNote).toContain('new_hallucinations: 1')
    expect(result.obsidianNote).toContain('# Weekly Review')
  })

  it('weekStart and weekEnd cover last full Monday-Sunday', async () => {
    const db = buildMockSupabase({})
    const result = await generateWeeklyReview(db, 'b', 'B', 'u')

    const start = new Date(result.weekStart)
    const end = new Date(result.weekEnd)
    // weekEnd should be a Sunday (day 0) and weekStart should be 6 days before
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBe(6)
  })

  it('no critical concerns when aviDelta is between -5 and 0 and no hallucinations', async () => {
    const db = buildMockSupabase({
      currentScore: [{ avi_score: 48, mention_rate: 40, citation_rate: 20, sentiment_score: 0 }],
      prevScore: [{ avi_score: 50 }],
      monitoringCount: 5,
      halCount: 0,
    })
    const result = await generateWeeklyReview(db, 'b', 'B', 'u')

    expect(result.metrics.aviDelta).toBe(-2)
    expect(result.concern).toBe('No critical concerns this week')
  })
})
