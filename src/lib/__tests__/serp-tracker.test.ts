import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  detectAiOverview,
  getTrends,
  type RankingResult,
  type TrendData,
} from '../services/serp-tracker'

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    }),
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe('detectAiOverview', () => {
  it('returns false when no aiOverviews', () => {
    const result = detectAiOverview([], 'example.com')
    expect(result).toBe(false)
  })

  it('returns false when brandDomain is empty', () => {
    const aiOverviews = [
      { text: 'Test', links: [{ title: 'Test', url: 'https://example.com/page' }] },
    ]
    const result = detectAiOverview(aiOverviews, '')
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
    const result = detectAiOverview(aiOverviews, 'example.com')
    expect(result).toBe(true)
  })

  it('returns false when brand domain not in AI Overview', () => {
    const aiOverviews = [
      {
        text: 'Test overview',
        links: [{ title: 'Competitor', url: 'https://competitor.com' }],
      },
    ]
    const result = detectAiOverview(aiOverviews, 'example.com')
    expect(result).toBe(false)
  })

  it('handles undefined links', () => {
    const aiOverviews = [{ text: 'Test', links: undefined as never }]
    const result = detectAiOverview(aiOverviews, 'example.com')
    expect(result).toBe(false)
  })

  it('handles empty links array', () => {
    const aiOverviews = [{ text: 'Test', links: [] }]
    const result = detectAiOverview(aiOverviews, 'example.com')
    expect(result).toBe(false)
  })

  it('handles subdomains correctly', () => {
    const aiOverviews = [
      { text: 'Test', links: [{ title: 'Blog', url: 'https://blog.example.com/post' }] },
    ]
    const result = detectAiOverview(aiOverviews, 'example.com')
    expect(result).toBe(true)
  })
})

describe('getTrends', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when db returns null data', async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }
    const { createServerClient } = await import('@/lib/supabase')
    vi.mocked(createServerClient).mockReturnValue(mockDb as never)

    const trends = await getTrends('brand-123', 30)
    expect(trends).toEqual([])
  })

  it('calculates average position correctly', async () => {
    const mockRankings = [
      {
        keyword: 'test',
        position: 5,
        ai_overview_present: false,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        keyword: 'test',
        position: 3,
        ai_overview_present: true,
        created_at: '2024-01-02T00:00:00Z',
      },
      {
        keyword: 'test',
        position: 7,
        ai_overview_present: false,
        created_at: '2024-01-03T00:00:00Z',
      },
    ]

    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockRankings, error: null }),
            }),
          }),
        }),
      }),
    }
    const { createServerClient } = await import('@/lib/supabase')
    vi.mocked(createServerClient).mockReturnValue(mockDb as never)

    const trends = await getTrends('brand-123', 30)

    expect(trends).toHaveLength(1)
    expect(trends[0]!.keyword).toBe('test')
    expect(trends[0]!.avgPosition).toBe(5)
    expect(trends[0]!.aiOverviewDays).toBe(1)
  })

  it('groups by keyword correctly', async () => {
    const mockRankings = [
      {
        keyword: 'keyword1',
        position: 1,
        ai_overview_present: false,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        keyword: 'keyword2',
        position: 2,
        ai_overview_present: false,
        created_at: '2024-01-01T00:00:00Z',
      },
    ]

    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockRankings, error: null }),
            }),
          }),
        }),
      }),
    }
    const { createServerClient } = await import('@/lib/supabase')
    vi.mocked(createServerClient).mockReturnValue(mockDb as never)

    const trends = await getTrends('brand-123', 30)

    expect(trends).toHaveLength(2)
    expect(trends.map((t) => t.keyword).sort()).toEqual(['keyword1', 'keyword2'])
  })

  it('ignores position 0 when calculating average', async () => {
    const mockRankings = [
      {
        keyword: 'test',
        position: 5,
        ai_overview_present: false,
        created_at: '2024-01-01T00:00:00Z',
      },
      {
        keyword: 'test',
        position: 0,
        ai_overview_present: false,
        created_at: '2024-01-02T00:00:00Z',
      },
      {
        keyword: 'test',
        position: 10,
        ai_overview_present: false,
        created_at: '2024-01-03T00:00:00Z',
      },
    ]

    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockRankings, error: null }),
            }),
          }),
        }),
      }),
    }
    const { createServerClient } = await import('@/lib/supabase')
    vi.mocked(createServerClient).mockReturnValue(mockDb as never)

    const trends = await getTrends('brand-123', 30)

    expect(trends[0]!.avgPosition).toBe(7.5)
  })

  it('returns empty array when db error occurs', async () => {
    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
            }),
          }),
        }),
      }),
    }
    const { createServerClient } = await import('@/lib/supabase')
    vi.mocked(createServerClient).mockReturnValue(mockDb as never)

    const trends = await getTrends('brand-123', 30)
    expect(trends).toEqual([])
  })
})

describe('RankingResult interface', () => {
  it('matches expected structure', () => {
    const result: RankingResult = {
      keyword: 'test keyword',
      url: 'https://example.com/page',
      position: 5,
      aiOverviewPresent: true,
      organicResults: [
        { title: 'Result 1', url: 'https://example.com/1', rank: 1 },
        { title: 'Result 2', url: 'https://example.com/2', rank: 2 },
      ],
      aiOverviews: [
        { text: 'AI Overview text', links: [{ title: 'Link', url: 'https://example.com' }] },
      ],
    }

    expect(result.keyword).toBe('test keyword')
    expect(result.url).toBe('https://example.com/page')
    expect(result.position).toBe(5)
    expect(result.aiOverviewPresent).toBe(true)
    expect(result.organicResults).toHaveLength(2)
    expect(result.aiOverviews).toHaveLength(1)
  })

  it('allows null url', () => {
    const result: RankingResult = {
      keyword: 'test',
      url: null,
      position: 0,
      aiOverviewPresent: false,
      organicResults: [],
      aiOverviews: [],
    }

    expect(result.url).toBeNull()
  })
})

describe('TrendData interface', () => {
  it('matches expected structure', () => {
    const trend: TrendData = {
      keyword: 'test keyword',
      positions: [
        { date: '2024-01-01', position: 3, aiOverviewPresent: false },
        { date: '2024-01-02', position: 2, aiOverviewPresent: true },
        { date: '2024-01-03', position: 1, aiOverviewPresent: true },
      ],
      avgPosition: 2,
      aiOverviewDays: 2,
    }

    expect(trend.keyword).toBe('test keyword')
    expect(trend.positions).toHaveLength(3)
    expect(trend.avgPosition).toBe(2)
    expect(trend.aiOverviewDays).toBe(2)
  })

  it('allows empty positions', () => {
    const trend: TrendData = {
      keyword: 'new keyword',
      positions: [],
      avgPosition: 0,
      aiOverviewDays: 0,
    }

    expect(trend.positions).toHaveLength(0)
    expect(trend.avgPosition).toBe(0)
  })
})
