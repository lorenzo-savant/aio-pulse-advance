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
  it('should have pricing for all 13 models', () => {
    const models = getAllModels()
    expect(models).toHaveLength(13)
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

describe('Credit Calculator - calculateCost', () => {
  it('should calculate cost for gpt-4o', () => {
    const cost = calculateCost('gpt-4o', 1000, 500)
    expect(cost).toBeCloseTo(7.5, 1)
  })

  it('should calculate cost for gpt-4o-mini', () => {
    const cost = calculateCost('gpt-4o-mini', 1000, 500)
    expect(cost).toBeCloseTo(0.45, 1)
  })

  it('should calculate cost for claude-3.5-sonnet', () => {
    const cost = calculateCost('claude-3.5-sonnet', 1000, 500)
    expect(cost).toBeCloseTo(10.5, 1)
  })

  it('should calculate cost for gemini-1.5-flash', () => {
    const cost = calculateCost('gemini-1.5-flash', 1000, 500)
    expect(cost).toBeCloseTo(0.225, 1)
  })

  it('should calculate cost for sonar-small', () => {
    const cost = calculateCost('sonar-small', 1000, 500)
    expect(cost).toBeCloseTo(0.3, 1)
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
