import { describe, it, expect } from 'vitest'
import { detectCannibalization, type QueryPageRow } from '@/lib/utils/keyword-cannibalization'

const row = (over: Partial<QueryPageRow>): QueryPageRow => ({
  query: 'q',
  page: 'p',
  position: 10,
  impressions: 100,
  clicks: 5,
  ...over,
})

describe('detectCannibalization — detection', () => {
  it('flags a query when ≥2 distinct pages rank in the top N', () => {
    const r = detectCannibalization([
      row({ query: 'best crm', page: 'https://acme.com/a', position: 5, impressions: 200 }),
      row({ query: 'best crm', page: 'https://acme.com/b', position: 12, impressions: 150 }),
    ])
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]!.query).toBe('best crm')
    expect(r.rows[0]!.pageCount).toBe(2)
    expect(r.rows[0]!.bestPosition).toBe(5)
  })

  it('skips queries with only one page ranking', () => {
    const r = detectCannibalization([
      row({ query: 'unique', page: 'https://acme.com/x', position: 5, impressions: 500 }),
    ])
    expect(r.rows).toHaveLength(0)
  })

  it('case-insensitively groups queries that differ only in casing', () => {
    const r = detectCannibalization([
      row({ query: 'Best CRM', page: 'https://acme.com/a', position: 5 }),
      row({ query: 'best crm', page: 'https://acme.com/b', position: 12 }),
    ])
    expect(r.rows).toHaveLength(1)
  })

  it('dedupes the same page within a query, keeping the best position', () => {
    const r = detectCannibalization([
      row({ query: 'best crm', page: 'https://acme.com/a', position: 8, impressions: 100 }),
      row({ query: 'best crm', page: 'https://acme.com/a', position: 4, impressions: 100 }),
      row({ query: 'best crm', page: 'https://acme.com/b', position: 12 }),
    ])
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]!.bestPosition).toBe(4) // /a kept at its best
  })
})

describe('detectCannibalization — filters', () => {
  it('skips queries below the minImpressions threshold', () => {
    const r = detectCannibalization(
      [
        row({ query: 'tiny', page: 'p1', position: 5, impressions: 10 }),
        row({ query: 'tiny', page: 'p2', position: 12, impressions: 10 }),
      ],
      { minImpressions: 100 },
    )
    expect(r.rows).toHaveLength(0)
  })

  it('skips pages beyond maxPosition', () => {
    const r = detectCannibalization(
      [
        row({ query: 'q', page: 'p1', position: 5, impressions: 100 }),
        row({ query: 'q', page: 'p2', position: 80, impressions: 100 }),
      ],
      { maxPosition: 50 },
    )
    // p2 (pos 80) drops → only 1 page left → not cannibalised.
    expect(r.rows).toHaveLength(0)
  })

  it('respects custom severity thresholds', () => {
    const rows: QueryPageRow[] = [
      row({ query: 'q', page: 'p1', position: 5, impressions: 200 }),
      row({ query: 'q', page: 'p2', position: 8, impressions: 150 }),
      row({ query: 'q', page: 'p3', position: 15, impressions: 100 }),
      row({ query: 'q', page: 'p4', position: 25, impressions: 80 }),
    ]
    const r = detectCannibalization(rows, { criticalPageCount: 4 })
    // 4 pages competing → critical (criticalPageCount=4 threshold met).
    expect(r.rows[0]!.severity).toBe('critical')
  })
})

describe('detectCannibalization — severity bands', () => {
  it('marks ≥3 pages as critical', () => {
    const rows: QueryPageRow[] = [
      row({ query: 'q', page: 'p1', position: 5 }),
      row({ query: 'q', page: 'p2', position: 8 }),
      row({ query: 'q', page: 'p3', position: 15 }),
    ]
    const r = detectCannibalization(rows)
    expect(r.rows[0]!.severity).toBe('critical')
  })

  it('marks 2 pages with bestPosition ≤20 as moderate', () => {
    const r = detectCannibalization([
      row({ query: 'q', page: 'p1', position: 10 }),
      row({ query: 'q', page: 'p2', position: 18 }),
    ])
    expect(r.rows[0]!.severity).toBe('moderate')
  })

  it('marks 2 pages with bestPosition >20 as minor', () => {
    const r = detectCannibalization([
      row({ query: 'q', page: 'p1', position: 25 }),
      row({ query: 'q', page: 'p2', position: 35 }),
    ])
    expect(r.rows[0]!.severity).toBe('minor')
  })
})

describe('detectCannibalization — report metrics', () => {
  it('sorts rows by totalImpressions desc', () => {
    const rows: QueryPageRow[] = [
      row({ query: 'low', page: 'p1', position: 5, impressions: 100 }),
      row({ query: 'low', page: 'p2', position: 10, impressions: 50 }),
      row({ query: 'high', page: 'p1', position: 5, impressions: 600 }),
      row({ query: 'high', page: 'p2', position: 10, impressions: 400 }),
    ]
    const r = detectCannibalization(rows)
    expect(r.rows.map((x) => x.query)).toEqual(['high', 'low'])
  })

  it('counts unique affected pages across the report', () => {
    const rows: QueryPageRow[] = [
      row({ query: 'q1', page: 'p1', position: 5 }),
      row({ query: 'q1', page: 'p2', position: 10 }),
      row({ query: 'q2', page: 'p2', position: 7 }),
      row({ query: 'q2', page: 'p3', position: 15 }),
    ]
    const r = detectCannibalization(rows)
    expect(r.affectedPagesCount).toBe(3)
  })

  it('healthScore reflects the share of impressions that are cannibalised', () => {
    const rows: QueryPageRow[] = [
      // Cannibalised: 200 impressions
      row({ query: 'cann', page: 'p1', position: 5, impressions: 100 }),
      row({ query: 'cann', page: 'p2', position: 10, impressions: 100 }),
      // Healthy single-page queries: 800 impressions total
      row({ query: 'a', page: 'pa', position: 5, impressions: 400 }),
      row({ query: 'b', page: 'pb', position: 5, impressions: 400 }),
    ]
    const r = detectCannibalization(rows)
    // healthScore = 100 × (1 − 200/1000) = 80
    expect(r.healthScore).toBeCloseTo(80, 1)
  })

  it('healthScore is 100 when the input is empty', () => {
    const r = detectCannibalization([])
    expect(r.healthScore).toBe(100)
    expect(r.rows).toEqual([])
  })
})
