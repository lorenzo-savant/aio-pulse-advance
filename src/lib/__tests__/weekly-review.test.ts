import { describe, it, expect } from 'vitest'
import { generateWeeklyReview } from '../services/weekly-review'

function makeSupabaseMock(options: {
  currentScore?: Record<string, number> | null
  previousScore?: Record<string, number> | null
  monitoringCount?: number
  hallucinationCount?: number
}) {
  const {
    currentScore = null,
    previousScore = null,
    monitoringCount = 0,
    hallucinationCount = 0,
  } = options

  // Supabase query builder returns itself from each chain method until
  // the terminal await-able, which resolves to { data, count, error }.
  function makeQuery(terminalResponse: { data?: any; count?: number; error?: any }) {
    const q: any = {
      select: () => q,
      eq: () => q,
      lte: () => q,
      gte: () => q,
      order: () => q,
      limit: () => Promise.resolve(terminalResponse),
    }
    // If it's a count query, resolve directly on await too.
    if ('count' in terminalResponse) {
      q.then = (resolve: any) => resolve(terminalResponse)
    }
    return q
  }

  let brandHealthCall = 0
  let monitoringCall = 0

  return {
    from(table: string) {
      if (table === 'brand_health_scores') {
        brandHealthCall++
        const payload = brandHealthCall === 1 ? currentScore : previousScore
        return makeQuery({ data: payload ? [payload] : [], error: null })
      }
      if (table === 'monitoring_results') {
        monitoringCall++
        const count = monitoringCall === 1 ? monitoringCount : hallucinationCount
        return makeQuery({ count, error: null })
      }
      return makeQuery({ data: [], error: null })
    },
  }
}

describe('generateWeeklyReview', () => {
  it('computes positive delta when current AVI exceeds previous', async () => {
    const supabase = makeSupabaseMock({
      currentScore: { avi_score: 82, mention_rate: 55, citation_rate: 40, sentiment_score: 0.3 },
      previousScore: { avi_score: 70 },
      monitoringCount: 100,
      hallucinationCount: 0,
    })

    const result = await generateWeeklyReview(supabase, 'brand-1', 'Acme', 'user-1')

    expect(result.brandId).toBe('brand-1')
    expect(result.brandName).toBe('Acme')
    expect(result.metrics.aviScoreCurrent).toBe(82)
    expect(result.metrics.aviScorePrevious).toBe(70)
    expect(result.metrics.aviDelta).toBe(12)
    expect(result.metrics.totalMonitoringRuns).toBe(100)
    expect(result.highlight).toContain('improved')
    expect(result.concern).toContain('No critical')
  })

  it('flags hallucinations as concern', async () => {
    const supabase = makeSupabaseMock({
      currentScore: { avi_score: 75 },
      previousScore: { avi_score: 75 },
      monitoringCount: 50,
      hallucinationCount: 3,
    })

    const result = await generateWeeklyReview(supabase, 'b', 'Bravo', 'u')
    expect(result.metrics.newHallucinations).toBe(3)
    expect(result.concern).toContain('3 new hallucination')
  })

  it('flags AVI drop > 5 as concern when no hallucinations', async () => {
    const supabase = makeSupabaseMock({
      currentScore: { avi_score: 60 },
      previousScore: { avi_score: 80 },
      monitoringCount: 20,
      hallucinationCount: 0,
    })

    const result = await generateWeeklyReview(supabase, 'b', 'Bravo', 'u')
    expect(result.metrics.aviDelta).toBe(-20)
    expect(result.concern).toContain('AVI dropped by 20')
  })

  it('falls back to legacy health_score when avi_score is absent', async () => {
    const supabase = makeSupabaseMock({
      currentScore: { health_score: 55, visibility_score: 40 },
      previousScore: { health_score: 50 },
      monitoringCount: 10,
      hallucinationCount: 0,
    })

    const result = await generateWeeklyReview(supabase, 'b', 'Bravo', 'u')
    expect(result.metrics.aviScoreCurrent).toBe(55)
    expect(result.metrics.aviScorePrevious).toBe(50)
    expect(result.metrics.aviDelta).toBe(5)
  })

  it('produces obsidian note with YAML frontmatter and metrics table', async () => {
    const supabase = makeSupabaseMock({
      currentScore: { avi_score: 75 },
      previousScore: { avi_score: 75 },
      monitoringCount: 42,
      hallucinationCount: 0,
    })

    const result = await generateWeeklyReview(supabase, 'b', 'Bravo', 'u')
    expect(result.obsidianNote).toMatch(/^---\n/)
    expect(result.obsidianNote).toContain('type: weekly-review')
    expect(result.obsidianNote).toContain('client: "Bravo"')
    expect(result.obsidianNote).toContain('| AVI Score |')
    expect(result.obsidianNote).toContain('## Highlights')
    expect(result.obsidianNote).toContain('## Concerns')
  })

  it('uses ISO week number and date range in output', async () => {
    const supabase = makeSupabaseMock({
      currentScore: { avi_score: 50 },
      previousScore: null,
      monitoringCount: 0,
      hallucinationCount: 0,
    })

    const result = await generateWeeklyReview(supabase, 'b', 'Bravo', 'u')
    expect(result.weekNumber).toBeGreaterThan(0)
    expect(result.weekNumber).toBeLessThanOrEqual(53)
    expect(result.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.weekEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
