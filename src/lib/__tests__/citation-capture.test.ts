import { describe, it, expect } from 'vitest'
import {
  buildOwnedDomainSet,
  computeCitationCapture,
  hostOf,
  type CaptureInputRow,
} from '../services/citation-capture'

const OWNED = buildOwnedDomainSet('acasting.se', ['acasting.com'])

function row(overrides: Partial<CaptureInputRow>): CaptureInputRow {
  return {
    id: 'r1',
    engine: 'chatgpt',
    prompt_text: 'What is the best Swedish casting platform?',
    cited_urls: null,
    brand_mentioned: true,
    confusion_flag: false,
    created_at: '2026-05-25T10:00:00Z',
    ...overrides,
  }
}

describe('hostOf', () => {
  it('extracts lowercase host without www', () => {
    expect(hostOf('https://www.Acasting.SE/about')).toBe('acasting.se')
  })
  it('handles bare host strings', () => {
    expect(hostOf('acasting.se')).toBe('acasting.se')
  })
  it('returns null for nonsense', () => {
    expect(hostOf('not a url')).toBe(null)
    expect(hostOf(null)).toBe(null)
  })
})

describe('buildOwnedDomainSet', () => {
  it('includes primary + extras', () => {
    const s = buildOwnedDomainSet('acasting.se', ['acasting.com', 'https://acasting.no/'])
    expect(s.has('acasting.se')).toBe(true)
    expect(s.has('acasting.com')).toBe(true)
    expect(s.has('acasting.no')).toBe(true)
  })
  it('skips empty / invalid entries', () => {
    const s = buildOwnedDomainSet(null, ['', 'not a url'])
    expect(s.size).toBe(0)
  })
})

describe('computeCitationCapture — basic counting', () => {
  it('counts mention as captured when an owned URL is cited', () => {
    const report = computeCitationCapture(
      [row({ cited_urls: ['https://acasting.se/about', 'https://other.com'] })],
      OWNED,
    )
    expect(report.totalMentions).toBe(1)
    expect(report.capturedMentions).toBe(1)
    expect(report.captureRate).toBe(100)
    expect(report.gapList).toHaveLength(0)
  })

  it('counts mention as a gap when no owned URL is cited', () => {
    const report = computeCitationCapture(
      [row({ id: 'gap1', cited_urls: ['https://wikipedia.org/X', 'https://competitor.com'] })],
      OWNED,
    )
    expect(report.totalMentions).toBe(1)
    expect(report.capturedMentions).toBe(0)
    expect(report.captureRate).toBe(0)
    expect(report.gapList).toHaveLength(1)
    expect(report.gapList[0]?.citedInstead).toEqual(['wikipedia.org', 'competitor.com'])
  })

  it('matches subdomains as owned', () => {
    const report = computeCitationCapture(
      [row({ cited_urls: ['https://blog.acasting.se/post'] })],
      OWNED,
    )
    expect(report.capturedMentions).toBe(1)
  })

  it('does NOT count look-alike domains as owned (acasting.se vs xacasting.se)', () => {
    const report = computeCitationCapture([row({ cited_urls: ['https://xacasting.se'] })], OWNED)
    expect(report.capturedMentions).toBe(0)
  })

  it('counts mentions across multiple owned domains', () => {
    const report = computeCitationCapture(
      [row({ cited_urls: ['https://acasting.com/help'] })],
      OWNED,
    )
    expect(report.capturedMentions).toBe(1)
  })
})

describe('computeCitationCapture — filtering', () => {
  it('skips rows where brand_mentioned is false', () => {
    const report = computeCitationCapture(
      [
        row({ brand_mentioned: true, cited_urls: ['https://acasting.se'] }),
        row({ id: 'r2', brand_mentioned: false, cited_urls: ['https://acasting.se'] }),
      ],
      OWNED,
    )
    expect(report.totalMentions).toBe(1)
  })

  it('skips homonym-confusion rows', () => {
    const report = computeCitationCapture(
      [
        row({ confusion_flag: true, cited_urls: ['https://acasting.se'] }),
        row({ id: 'r2', confusion_flag: false, cited_urls: ['https://acasting.se'] }),
      ],
      OWNED,
    )
    expect(report.totalMentions).toBe(1)
  })

  it('handles null cited_urls as a gap with no "cited instead"', () => {
    const report = computeCitationCapture([row({ cited_urls: null })], OWNED)
    expect(report.totalMentions).toBe(1)
    expect(report.capturedMentions).toBe(0)
    expect(report.mentionsWithoutAnyCitation).toBe(1)
    expect(report.gapList[0]?.citedInstead).toEqual([])
  })
})

describe('computeCitationCapture — per-engine breakdown', () => {
  it('groups by engine and sorts by mention volume desc', () => {
    const rows: CaptureInputRow[] = [
      row({ id: 'a', engine: 'chatgpt', cited_urls: ['https://acasting.se'] }),
      row({ id: 'b', engine: 'chatgpt', cited_urls: ['https://other.com'] }),
      row({ id: 'c', engine: 'chatgpt', cited_urls: ['https://wikipedia.org'] }),
      row({ id: 'd', engine: 'perplexity', cited_urls: ['https://acasting.se'] }),
    ]
    const report = computeCitationCapture(rows, OWNED)
    expect(report.byEngine[0]?.engine).toBe('chatgpt')
    expect(report.byEngine[0]?.mentions).toBe(3)
    expect(report.byEngine[0]?.capturedMentions).toBe(1)
    expect(report.byEngine[0]?.captureRate).toBeCloseTo(33.3, 1)
    expect(report.byEngine[1]?.engine).toBe('perplexity')
    expect(report.byEngine[1]?.captureRate).toBe(100)
  })
})

describe('computeCitationCapture — gap list ordering', () => {
  it('returns most-recent gaps first, capped by gapLimit', () => {
    const rows: CaptureInputRow[] = [
      row({ id: 'old', created_at: '2026-05-01T00:00:00Z', cited_urls: ['https://other.com'] }),
      row({ id: 'new', created_at: '2026-05-20T00:00:00Z', cited_urls: ['https://other.com'] }),
      row({ id: 'mid', created_at: '2026-05-10T00:00:00Z', cited_urls: ['https://other.com'] }),
    ]
    const report = computeCitationCapture(rows, OWNED, { gapLimit: 2 })
    expect(report.gapList).toHaveLength(2)
    expect(report.gapList[0]?.id).toBe('new')
    expect(report.gapList[1]?.id).toBe('mid')
  })

  it('caps citedInstead to 3 hosts', () => {
    const report = computeCitationCapture(
      [
        row({
          cited_urls: [
            'https://a.com',
            'https://b.com',
            'https://c.com',
            'https://d.com',
            'https://e.com',
          ],
        }),
      ],
      OWNED,
    )
    expect(report.gapList[0]?.citedInstead).toHaveLength(3)
    expect(report.gapList[0]?.citedCount).toBe(5)
  })
})

describe('computeCitationCapture — empty / edge', () => {
  it('returns zeros for empty input', () => {
    const r = computeCitationCapture([], OWNED)
    expect(r.totalMentions).toBe(0)
    expect(r.captureRate).toBe(0)
    expect(r.gapList).toHaveLength(0)
    expect(r.byEngine).toHaveLength(0)
  })

  it('skips invalid URLs in cited_urls without crashing', () => {
    const r = computeCitationCapture(
      [row({ cited_urls: ['not a url', '', 'https://acasting.se'] })],
      OWNED,
    )
    expect(r.capturedMentions).toBe(1)
  })
})
