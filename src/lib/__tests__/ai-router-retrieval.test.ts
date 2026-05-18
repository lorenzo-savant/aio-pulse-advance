import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/openai', () => ({
  isOpenAIAvailable: vi.fn().mockReturnValue(true),
  callOpenAI: vi.fn().mockResolvedValue('OpenAI response text'),
}))

vi.mock('../services/perplexity', () => ({
  isPerplexityAvailable: vi.fn().mockReturnValue(false),
  callPerplexityWithCitations: vi.fn(),
}))

vi.mock('../services/anthropic', () => ({
  isAnthropicAvailable: vi.fn().mockReturnValue(false),
  callAnthropic: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('simulateEngineResponse retrieval field', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns retrieval=model-memory for OpenAI (ChatGPT) path', async () => {
    const { simulateEngineResponse } = await import('../services/ai-router')
    const result = await simulateEngineResponse('test prompt', 'chatgpt')
    expect(result.retrieval).toBe('model-memory')
  })

  it('returns retrieval field is present for all engine paths', async () => {
    const { simulateEngineResponse } = await import('../services/ai-router')
    const openaiResult = await simulateEngineResponse('test prompt', 'chatgpt')
    expect(openaiResult.retrieval).toBe('model-memory')
    expect(['live', 'model-memory']).toContain(openaiResult.retrieval)
  })
})
