import { describe, it, expect } from 'vitest'
import { classifyPromptPortfolio, classifyPromptList } from '@/lib/utils/prompt-portfolio'

const ACME = { brandName: 'Acme', competitorNames: ['Rivalry', 'BigCorp'] }

describe('classifyPromptPortfolio', () => {
  it('classifies brand + competitor mention as "competitor"', () => {
    const r = classifyPromptPortfolio({
      prompt: 'Acme vs Rivalry — which is better?',
      ...ACME,
    })
    expect(r.type).toBe('competitor')
    expect(r.reasons.some((m) => m.includes('brand'))).toBe(true)
    expect(r.reasons.some((m) => m.includes('competitor'))).toBe(true)
  })

  it('classifies competitor-only mention as "gap"', () => {
    const r = classifyPromptPortfolio({
      prompt: 'best alternatives to Rivalry for small teams',
      ...ACME,
    })
    expect(r.type).toBe('gap')
    expect(r.reasons[0]).toMatch(/competitor/)
  })

  it('classifies brand + reputation keyword as "reputation"', () => {
    const r = classifyPromptPortfolio({
      prompt: 'Acme reviews — what do people think?',
      ...ACME,
    })
    expect(r.type).toBe('reputation')
  })

  it('classifies brand + buying-intent as "revenue"', () => {
    const r = classifyPromptPortfolio({
      prompt: 'Acme pricing and features — worth it for SaaS?',
      ...ACME,
    })
    expect(r.type).toBe('revenue')
  })

  it('classifies category buying-intent without brand/competitor as "revenue"', () => {
    const r = classifyPromptPortfolio({
      prompt: 'best CRM for small business',
      ...ACME,
    })
    expect(r.type).toBe('revenue')
    expect(r.reasons[0]).toMatch(/category/)
  })

  it('classifies non-brand non-competitor non-intent prompt as "other"', () => {
    const r = classifyPromptPortfolio({
      prompt: 'what is software',
      ...ACME,
    })
    expect(r.type).toBe('other')
  })

  it('returns "other" for empty prompt', () => {
    const r = classifyPromptPortfolio({ prompt: '', ...ACME })
    expect(r.type).toBe('other')
    expect(r.reasons[0]).toBe('empty prompt')
  })

  it('is diacritic- and case-insensitive when matching brand/competitor', () => {
    const r = classifyPromptPortfolio({
      prompt: 'ACME vs RIVALRY',
      brandName: 'Acmè',
      competitorNames: ['Rivalry'],
    })
    expect(r.type).toBe('competitor')
  })

  it('respects ≥3-char guard — short anchors do not match accidentally', () => {
    const r = classifyPromptPortfolio({
      prompt: 'is this fair?',
      brandName: 'ai', // length 2 — should be ignored
      competitorNames: ['fa'], // length 2 — should be ignored
    })
    expect(r.type).toBe('other')
  })

  it('matches Italian reputation + revenue keywords', () => {
    expect(
      classifyPromptPortfolio({
        prompt: 'Acme recensioni — vale la pena?',
        ...ACME,
      }).type,
    ).toBe('reputation')
    expect(
      classifyPromptPortfolio({
        prompt: 'migliori CRM per startup',
        ...ACME,
      }).type,
    ).toBe('revenue')
  })

  it('matches Swedish reputation + revenue keywords', () => {
    expect(
      classifyPromptPortfolio({
        prompt: 'Acme recensioner — vad tycker folk?',
        ...ACME,
      }).type,
    ).toBe('reputation')
    expect(
      classifyPromptPortfolio({
        prompt: 'bästa CRM för småföretag',
        ...ACME,
      }).type,
    ).toBe('revenue')
  })
})

describe('classifyPromptList', () => {
  it('aggregates per-bucket counts and average brand visibility', () => {
    const report = classifyPromptList(
      [
        { promptId: '1', prompt: 'Acme pricing', brandVisibility: 80 },
        { promptId: '2', prompt: 'Acme vs Rivalry', brandVisibility: 60 },
        { promptId: '3', prompt: 'alternatives to Rivalry', brandVisibility: 0 },
        { promptId: '4', prompt: 'Acme reviews', brandVisibility: 70 },
      ],
      ACME,
    )
    const get = (t: 'revenue' | 'competitor' | 'gap' | 'reputation' | 'other') =>
      report.buckets.find((b) => b.type === t)!
    expect(get('revenue').count).toBe(1)
    expect(get('competitor').count).toBe(1)
    expect(get('gap').count).toBe(1)
    expect(get('reputation').count).toBe(1)
    expect(get('revenue').averageBrandVisibility).toBe(80)
    expect(get('gap').averageBrandVisibility).toBe(0)
  })

  it('returns all 5 buckets even when some are empty', () => {
    const report = classifyPromptList(
      [{ promptId: '1', prompt: 'what is software', brandVisibility: null }],
      ACME,
    )
    expect(report.buckets).toHaveLength(5)
    expect(report.buckets.find((b) => b.type === 'other')!.count).toBe(1)
    expect(report.buckets.find((b) => b.type === 'revenue')!.count).toBe(0)
    expect(report.buckets.find((b) => b.type === 'revenue')!.averageBrandVisibility).toBeNull()
  })

  it('preserves input order in the rows array', () => {
    const report = classifyPromptList(
      [
        { promptId: 'B', prompt: 'Acme vs Rivalry' },
        { promptId: 'A', prompt: 'Acme pricing' },
      ],
      ACME,
    )
    expect(report.rows.map((r) => r.promptId)).toEqual(['B', 'A'])
  })
})

describe('classifyPromptList — brandedMix', () => {
  it('flags an over-indexed portfolio when ≥70% of prompts name the brand', () => {
    const report = classifyPromptList(
      [
        { promptId: '1', prompt: 'Acme pricing' },
        { promptId: '2', prompt: 'Acme vs Rivalry' },
        { promptId: '3', prompt: 'Acme reviews' },
        { promptId: '4', prompt: 'is Acme worth it' },
        { promptId: '5', prompt: 'best CRM for startups' },
      ],
      ACME,
    )
    expect(report.brandedMix.brandedCount).toBe(4)
    expect(report.brandedMix.categoryCount).toBe(1)
    expect(report.brandedMix.brandedRatio).toBe(80)
    expect(report.brandedMix.verdict).toBe('over_indexed')
  })

  it('flags a category-led portfolio when ≤40% of prompts name the brand', () => {
    const report = classifyPromptList(
      [
        { promptId: '1', prompt: 'Acme pricing' },
        { promptId: '2', prompt: 'best CRM for SaaS' },
        { promptId: '3', prompt: 'top sales tools 2026' },
        { promptId: '4', prompt: 'recommended CRM for startups' },
        { promptId: '5', prompt: 'CRM with Slack integration' },
      ],
      ACME,
    )
    expect(report.brandedMix.brandedRatio).toBe(20)
    expect(report.brandedMix.verdict).toBe('category_led')
  })

  it('reports balanced for ratios between the two thresholds', () => {
    const report = classifyPromptList(
      [
        { promptId: '1', prompt: 'Acme pricing' },
        { promptId: '2', prompt: 'Acme vs Rivalry' },
        { promptId: '3', prompt: 'best CRM for SaaS' },
        { promptId: '4', prompt: 'recommended CRM for startups' },
      ],
      ACME,
    )
    expect(report.brandedMix.brandedRatio).toBe(50)
    expect(report.brandedMix.verdict).toBe('balanced')
  })

  it('returns "balanced" with a small-sample message when fewer than 3 non-empty prompts', () => {
    const report = classifyPromptList(
      [
        { promptId: '1', prompt: 'Acme pricing' },
        { promptId: '2', prompt: '' },
      ],
      ACME,
    )
    expect(report.brandedMix.verdict).toBe('balanced')
    expect(report.brandedMix.message).toMatch(/not enough prompts/i)
  })
})
