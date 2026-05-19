import { describe, it, expect } from 'vitest'
import { StrategyOutputSchema, extractJson } from '../services/advisor'

describe('StrategyOutputSchema', () => {
  it('accepts a well-formed strategist output', () => {
    const valid = {
      summary: 'AVI dropped 12 points week-over-week, citation_rate fell on Perplexity.',
      recommendations: [
        {
          title: 'Seed 5 long-tail Swedish prompts for topic X',
          rationale: 'Citation rate on Perplexity dropped 18% while Swedish prompts are sparse.',
          impact: 'high',
          effort: 'low',
          actions: [
            'Draft 5 prompts in Swedish targeting "digital twin" long-tails',
            'Insert into prompts table with category=visibility',
          ],
          sources: ['citationRate -18% on perplexity', 'prompts.byLanguage.sv = 0'],
        },
      ],
      confidence: 0.7,
    }
    expect(StrategyOutputSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects more than 3 recommendations', () => {
    const tooMany = {
      summary: 'ok',
      confidence: 0.5,
      recommendations: Array.from({ length: 4 }, () => ({
        title: 'X',
        rationale: 'short rationale',
        impact: 'low',
        effort: 'low',
        actions: ['do a thing'],
        sources: ['some fact'],
      })),
    }
    expect(StrategyOutputSchema.safeParse(tooMany).success).toBe(false)
  })

  it('rejects empty actions and empty sources', () => {
    const base = {
      title: 'X title',
      rationale: 'good rationale',
      impact: 'low',
      effort: 'low',
      actions: [] as string[],
      sources: ['fact'],
    }
    expect(
      StrategyOutputSchema.safeParse({
        summary: 'ok',
        confidence: 0.5,
        recommendations: [base],
      }).success,
    ).toBe(false)

    expect(
      StrategyOutputSchema.safeParse({
        summary: 'ok',
        confidence: 0.5,
        recommendations: [{ ...base, actions: ['x'], sources: [] }],
      }).success,
    ).toBe(false)
  })

  it('rejects out-of-range confidence', () => {
    const base = {
      summary: 'ok',
      recommendations: [
        {
          title: 'X',
          rationale: 'short rationale',
          impact: 'low',
          effort: 'low',
          actions: ['do'],
          sources: ['fact'],
        },
      ],
    }
    expect(StrategyOutputSchema.safeParse({ ...base, confidence: 1.5 }).success).toBe(false)
    expect(StrategyOutputSchema.safeParse({ ...base, confidence: -0.1 }).success).toBe(false)
  })

  it('rejects invalid impact/effort enums', () => {
    expect(
      StrategyOutputSchema.safeParse({
        summary: 'ok',
        confidence: 0.5,
        recommendations: [
          {
            title: 'X',
            rationale: 'short rationale',
            impact: 'enormous',
            effort: 'low',
            actions: ['do'],
            sources: ['fact'],
          },
        ],
      }).success,
    ).toBe(false)
  })
})

describe('extractJson', () => {
  it('returns the input unchanged when no fence is present', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}')
  })

  it('strips a ```json fence', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('strips a bare ``` fence', () => {
    expect(extractJson('```\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('trims surrounding whitespace', () => {
    expect(extractJson('  \n {"a":1}  \n')).toBe('{"a":1}')
  })
})
