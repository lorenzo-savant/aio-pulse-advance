import { describe, it, expect } from 'vitest'
import {
  calculateCost,
  estimateCost,
  MODEL_PRICING,
  getProviderFromModel,
  getModelPricing,
  getAllModels,
} from '../services/credit-calculator'

describe('Credit Calculator - MODEL_PRICING', () => {
  it('should have pricing for all 15 models', () => {
    // 15th entry added 2026-08-18: gemini-3.6-flash (2.5 retired by Google).
    const models = getAllModels()
    expect(models).toHaveLength(15)
  })

  it('should have pricing for OpenAI models', () => {
    expect(MODEL_PRICING['gpt-4o']).toBeDefined()
    expect(MODEL_PRICING['gpt-4o-mini']).toBeDefined()
    expect(MODEL_PRICING['gpt-4-turbo']).toBeDefined()
    expect(MODEL_PRICING['gpt-3.5-turbo']).toBeDefined()
  })

  it('should have pricing for Anthropic models', () => {
    expect(MODEL_PRICING['claude-3.5-sonnet']).toBeDefined()
    expect(MODEL_PRICING['claude-3-opus']).toBeDefined()
    expect(MODEL_PRICING['claude-3-haiku']).toBeDefined()
  })

  it('should have pricing for Gemini models', () => {
    expect(MODEL_PRICING['gemini-2.0-flash']).toBeDefined()
    expect(MODEL_PRICING['gemini-2.0-flash-lite']).toBeDefined()
    expect(MODEL_PRICING['gemini-1.5-pro']).toBeDefined()
    expect(MODEL_PRICING['gemini-1.5-flash']).toBeDefined()
  })

  it('should have pricing for Perplexity models', () => {
    expect(MODEL_PRICING['sonar-small']).toBeDefined()
    expect(MODEL_PRICING['sonar-medium']).toBeDefined()
  })
})

describe('Credit Calculator - getProviderFromModel', () => {
  it('should map OpenAI models', () => {
    expect(getProviderFromModel('gpt-4o')).toBe('openai')
    expect(getProviderFromModel('gpt-4o-mini')).toBe('openai')
    expect(getProviderFromModel('gpt-4-turbo')).toBe('openai')
    expect(getProviderFromModel('gpt-3.5-turbo')).toBe('openai')
  })

  it('should map Anthropic models', () => {
    expect(getProviderFromModel('claude-3.5-sonnet')).toBe('anthropic')
    expect(getProviderFromModel('claude-3-opus')).toBe('anthropic')
    expect(getProviderFromModel('claude-3-haiku')).toBe('anthropic')
  })

  it('should map Gemini models', () => {
    expect(getProviderFromModel('gemini-2.0-flash')).toBe('gemini')
    expect(getProviderFromModel('gemini-2.0-flash-lite')).toBe('gemini')
    expect(getProviderFromModel('gemini-1.5-pro')).toBe('gemini')
    expect(getProviderFromModel('gemini-1.5-flash')).toBe('gemini')
  })

  it('should map Perplexity models', () => {
    expect(getProviderFromModel('sonar-small')).toBe('perplexity')
    expect(getProviderFromModel('sonar-medium')).toBe('perplexity')
  })

  it('should return unknown for unknown model', () => {
    expect(getProviderFromModel('unknown-model')).toBe('unknown')
  })
})

/**
 * These expectations used to assert the bug.
 *
 * MODEL_PRICING holds USD per 1,000,000 tokens — the unit every provider
 * publishes, and the unit the twin implementation in cost-tracker.ts divides
 * by. calculateCost divided by 1,000 instead, so it returned 1000× the real
 * price, and this suite pinned those numbers: 1000 in + 500 out of gpt-4o was
 * asserted at $7.50 when it costs $0.0075. A test can only protect the
 * behaviour it describes, and this one described the defect — which is how it
 * survived in the sole source of the public /api/v1/credits/estimate endpoint.
 *
 * Every figure below is (tokens × price) / 1e6, worked from the published
 * rates in MODEL_PRICING, with an absolute tolerance rather than `toBeCloseTo`
 * digits — at this scale a digit-based tolerance passes almost anything.
 */
describe('Credit Calculator - calculateCost', () => {
  const near = (actual: number, expected: number) =>
    expect(Math.abs(actual - expected)).toBeLessThan(expected * 0.001)

  it('prices gpt-4o at $2.50/1M in + $10/1M out', () => {
    // (1000 × 2.50 + 500 × 10.00) / 1e6
    near(calculateCost('gpt-4o', 1000, 500), 0.0075)
  })

  it('prices gpt-4o-mini at $0.15/1M in + $0.60/1M out', () => {
    near(calculateCost('gpt-4o-mini', 1000, 500), 0.00045)
  })

  it('prices claude-3.5-sonnet at $3/1M in + $15/1M out', () => {
    near(calculateCost('claude-3.5-sonnet', 1000, 500), 0.0105)
  })

  it('prices gemini-1.5-flash at $0.075/1M in + $0.30/1M out', () => {
    near(calculateCost('gemini-1.5-flash', 1000, 500), 0.000225)
  })

  it('prices sonar-small at $0.20/1M both ways', () => {
    near(calculateCost('sonar-small', 1000, 500), 0.0003)
  })

  it('charges exactly the published rate for one million input tokens', () => {
    // The anchor that makes the unit impossible to get wrong again: a million
    // input tokens of gpt-4o is its headline price, $2.50.
    near(calculateCost('gpt-4o', 1_000_000, 0), 2.5)
  })

  it('keeps sub-cent precision instead of rounding a real call to zero', () => {
    // Rounding to 2 decimals reported nearly every genuine request as $0.00,
    // which is how a 1000× error stayed invisible.
    expect(calculateCost('gemini-1.5-flash', 1000, 500)).toBeGreaterThan(0)
  })

  it('should return 0 for unknown model', () => {
    const cost = calculateCost('unknown-model', 1000, 500)
    expect(cost).toBe(0)
  })

  it('should return 0 for free models (gemini-2.0-flash)', () => {
    const cost = calculateCost('gemini-2.0-flash', 1000, 500)
    expect(cost).toBe(0)
  })
})

describe('Credit Calculator - estimateCost', () => {
  it('should estimate cost from messages', () => {
    const messages = [
      { role: 'user' as const, content: 'Hello world this is a test message' },
      { role: 'assistant' as const, content: 'Response with some content here' },
    ]
    const cost = estimateCost('gpt-4o-mini', messages)
    expect(cost).toBeGreaterThan(0)
  })

  it('should estimate cost with system message', () => {
    const messages = [
      { role: 'system' as const, content: 'You are a helpful assistant' },
      { role: 'user' as const, content: 'What is SEO?' },
      { role: 'assistant' as const, content: 'SEO stands for Search Engine Optimization' },
    ]
    const cost = estimateCost('gpt-4o', messages)
    expect(cost).toBeGreaterThan(0)
  })

  it('should handle empty messages', () => {
    const cost = estimateCost('gpt-4o', [])
    expect(cost).toBe(0)
  })
})

describe('Credit Calculator - getModelPricing', () => {
  it('should return pricing for valid model', () => {
    const pricing = getModelPricing('gpt-4o')
    expect(pricing).not.toBeNull()
    expect(pricing?.input).toBe(2.5)
    expect(pricing?.output).toBe(10.0)
  })

  it('should return null for unknown model', () => {
    const pricing = getModelPricing('unknown-model')
    expect(pricing).toBeNull()
  })
})
