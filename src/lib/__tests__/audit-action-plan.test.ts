import { describe, it, expect } from 'vitest'
import { prioritizeAuditActions } from '@/lib/utils/audit-action-plan'
import type { AuditResult, AuditCheck } from '@/lib/services/technical-seo-audit'

function mkCheck(id: string, status: AuditCheck['status'], msg = 'test'): AuditCheck {
  return { id, name: id, status, message: msg }
}

function mkAudit(perCategory: Record<string, AuditCheck[]>): AuditResult {
  return {
    url: 'https://example.com',
    timestamp: '2026-05-25T00:00:00Z',
    overallScore: 50,
    // We only fill the categories we care about per test; the shape is
    // satisfied because audit.categories is typed as Record<string,
    // AuditCategory> in this util's internal cast.
    categories: Object.fromEntries(
      Object.entries(perCategory).map(([k, checks]) => [k, { score: 50, weight: 0.1, checks }]),
    ) as unknown as AuditResult['categories'],
  }
}

describe('prioritizeAuditActions — basics', () => {
  it('returns 0 actions when every check passes', () => {
    const audit = mkAudit({ schemaMarkup: [mkCheck('schema-organization', 'pass')] })
    const plan = prioritizeAuditActions(audit)
    expect(plan.totalActions).toBe(0)
    expect(plan.today).toEqual([])
    expect(plan.thisWeek).toEqual([])
    expect(plan.thisMonth).toEqual([])
  })

  it('ignores info checks (n/a, not actionable)', () => {
    const audit = mkAudit({ contentStructure: [mkCheck('content-img-alt', 'info')] })
    const plan = prioritizeAuditActions(audit)
    expect(plan.totalActions).toBe(0)
  })

  it('surfaces failed checks first, then warnings', () => {
    const audit = mkAudit({
      contentStructure: [
        mkCheck('content-answer-first', 'warning'), // medium impact + medium ease
        mkCheck('content-meta-robots', 'fail'), // very high impact + easy
      ],
    })
    const plan = prioritizeAuditActions(audit)
    expect(plan.totalActions).toBe(2)
    // content-meta-robots has impact 95 × ease 90 = 85.5 → far ahead of warnings.
    const all = [...plan.today, ...plan.thisWeek, ...plan.thisMonth]
    expect(all[0]!.checkId).toBe('content-meta-robots')
  })
})

describe('prioritizeAuditActions — bucket assignment', () => {
  it('puts very easy fixes (ease ≥75) into Today', () => {
    const audit = mkAudit({
      metaTags: [mkCheck('meta-title', 'fail')], // ease 90
    })
    const plan = prioritizeAuditActions(audit)
    expect(plan.today.map((a) => a.checkId)).toContain('meta-title')
    expect(plan.thisWeek.find((a) => a.checkId === 'meta-title')).toBeUndefined()
  })

  it('puts mid-effort, high-impact fixes (ease 50-74 OR impact ≥70) into This Week', () => {
    const audit = mkAudit({
      contentStructure: [
        mkCheck('content-answer-first', 'fail'), // impact 75, ease 50
        mkCheck('content-eeat-markup', 'fail'), // impact 70, ease 55
      ],
    })
    const plan = prioritizeAuditActions(audit)
    expect(plan.thisWeek.map((a) => a.checkId)).toEqual(
      expect.arrayContaining(['content-answer-first', 'content-eeat-markup']),
    )
  })

  it('puts low-impact, hard-to-do fixes (ease <50, impact <70) into This Month', () => {
    const audit = mkAudit({
      securityHeaders: [mkCheck('sec-csp', 'fail')], // impact 15, ease 40
    })
    const plan = prioritizeAuditActions(audit)
    expect(plan.thisMonth.map((a) => a.checkId)).toContain('sec-csp')
  })
})

describe('prioritizeAuditActions — sorting', () => {
  it('sorts within each bucket by priorityScore desc', () => {
    const audit = mkAudit({
      aiCrawlerAccess: [
        mkCheck('ai-crawler-gptbot', 'fail'), // impact 90, ease 85 → 76.5
        mkCheck('ai-crawler-ccbot', 'fail'), // impact 60, ease 85 → 51
      ],
    })
    const plan = prioritizeAuditActions(audit)
    expect(plan.today.map((a) => a.checkId)).toEqual(['ai-crawler-gptbot', 'ai-crawler-ccbot'])
  })

  it('warning severity is weighted lower than fail (0.7×)', () => {
    const audit = mkAudit({
      schemaMarkup: [
        mkCheck('schema-organization', 'warning'), // impact 70 × 0.7 = 49
      ],
      aiCrawlerAccess: [
        mkCheck('ai-crawler-ccbot', 'fail'), // impact 60 × 1.0 = 60
      ],
    })
    const plan = prioritizeAuditActions(audit)
    const all = [...plan.today, ...plan.thisWeek, ...plan.thisMonth]
    // ccbot (impact 60) should outrank a warning schema (effective impact 49).
    expect(all[0]!.checkId).toBe('ai-crawler-ccbot')
  })
})

describe('prioritizeAuditActions — metadata', () => {
  it('uses curated title/why for known check ids', () => {
    const audit = mkAudit({
      contentStructure: [mkCheck('content-last-updated', 'warning')],
    })
    const plan = prioritizeAuditActions(audit)
    const action = plan.thisWeek.find((a) => a.checkId === 'content-last-updated')!
    expect(action.title).toMatch(/dateModified/)
    expect(action.why).toMatch(/95%|citations|1\.8/)
  })

  it('falls back to generic metadata for unknown check ids', () => {
    const audit = mkAudit({ misc: [mkCheck('unknown-check-id', 'fail')] })
    const plan = prioritizeAuditActions(audit)
    const action = [...plan.today, ...plan.thisWeek, ...plan.thisMonth].find(
      (a) => a.checkId === 'unknown-check-id',
    )!
    expect(action.title).toBe('Fix this audit finding')
  })

  it('exposes impact, ease, priorityScore, and bucket per action', () => {
    const audit = mkAudit({ metaTags: [mkCheck('meta-title', 'fail')] })
    const plan = prioritizeAuditActions(audit)
    const a = plan.today[0]!
    expect(a.impact).toBe(80) // 80 × fail severity 1.0
    expect(a.ease).toBe(90)
    expect(a.priorityScore).toBe(72) // round(80 × 90 / 100)
    expect(a.bucket).toBe('today')
    expect(a.category).toBe('metaTags')
  })
})
