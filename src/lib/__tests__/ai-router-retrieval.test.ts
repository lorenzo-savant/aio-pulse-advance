import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/openai', () => ({
  isOpenAIAvailable: vi.fn().mockReturnValue(true),
  callOpenAI: vi.fn().mockResolvedValue('OpenAI plain (model-memory) response'),
  callOpenAIWithWebSearch: vi
    .fn()
    .mockResolvedValue({
      text: 'OpenAI web-grounded response',
      citations: ['https://example.com'],
    }),
}))

vi.mock('../services/perplexity', () => ({
  isPerplexityAvailable: vi.fn().mockReturnValue(false),
  callPerplexityWithCitations: vi.fn(),
}))

vi.mock('../services/anthropic', () => ({
  isAnthropicAvailable: vi.fn().mockReturnValue(false),
  callAnthropic: vi.fn(),
  callAnthropicWithWebSearch: vi.fn(),
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

  it('uses live web search for ChatGPT by default (real data + citations)', async () => {
    const { simulateEngineResponse } = await import('../services/ai-router')
    const result = await simulateEngineResponse('test prompt', 'chatgpt')
    expect(result.retrieval).toBe('live')
    expect(result.provider).toContain('+web')
    expect(result.citations).toContain('https://example.com')
  })

  it('falls back to model-memory when ENGINE_WEB_SEARCH is disabled', async () => {
    vi.stubEnv('ENGINE_WEB_SEARCH', 'false')
    const { simulateEngineResponse } = await import('../services/ai-router')
    const result = await simulateEngineResponse('test prompt', 'chatgpt')
    expect(result.retrieval).toBe('model-memory')
    expect(['live', 'model-memory']).toContain(result.retrieval)
  })
})
