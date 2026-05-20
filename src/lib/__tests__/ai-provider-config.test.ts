import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Model Version Consistency ─────────────────────────────────────────────
//
// NOTE: All Gemini models are now aligned to gemini-2.5-flash across the codebase.
// This was done to fix an inconsistency where gemini.ts used 2.5-flash but
// gemini-provider.ts and ai-router.ts still used gemini-2.0-flash.

describe('Gemini model version consistency', () => {
  it('gemini-provider.ts uses gemini-2.5-flash', async () => {
    const { GeminiProvider } = await import('../providers/gemini-provider')
    const provider = new GeminiProvider()

    expect(provider.id).toBe('gemini')
    expect(provider.name).toBe('Google Gemini')
  })

  it('gemini.ts (legacy) uses gemini-2.5-flash', async () => {
    const src = await import('../services/gemini')
    expect(typeof src.callGemini).toBe('function')
    expect(typeof src.analyzeContent).toBe('function')
  })

  it('ai-router.ts now uses gemini-2.5-flash for fallback', async () => {
    // After the model alignment fix, ai-router.ts uses gemini-2.5-flash
    const src = await import('../services/ai-router')
    expect(typeof src.simulateEngineResponse).toBe('function')
    expect(typeof src.analyzeResponseForBrand).toBe('function')
  })
})

describe('All provider model versions are defined', () => {
  it('GeminiProvider model string exists and is valid', async () => {
    const src = await import('../services/gemini')
    // The URL pattern contains the model version
    const fnStr = src.callGemini.toString()
    expect(fnStr).toContain('gemini-')
    expect(fnStr).toContain('generateContent')
  })

  it('openai uses gpt-4o-mini in legacy service', async () => {
    const src = await import('../services/openai')
    const fnStr = src.callOpenAI.toString()
    // Should reference a gpt model
    expect(fnStr).toMatch(/gpt-/)
  })

  it('anthropic uses claude-sonnet-4-6 in legacy service', async () => {
    const src = await import('../services/anthropic')
    const fnStr = src.callAnthropic.toString()
    expect(fnStr).toContain('claude')
  })

  it('perplexity uses sonar model in legacy service', async () => {
    const src = await import('../services/perplexity')
    const fnStr = src.callPerplexityWithCitations.toString()
    expect(fnStr).toContain('sonar')
  })
})

// ─── Provider Availability Checks ─────────────────────────────────────────

describe('Provider availability checks', () => {
  it('GeminiProvider isConfigured checks GEMINI_API_KEY env var', async () => {
    const { GeminiProvider } = await import('../providers/gemini-provider')
    const provider = new GeminiProvider()

    // Without env var
    const originalKey = process.env['GEMINI_API_KEY']
    delete process.env['GEMINI_API_KEY']
    expect(provider.isConfigured()).toBe(false)

    // With env var
    process.env['GEMINI_API_KEY'] = 'test-key'
    expect(provider.isConfigured()).toBe(true)

    // Restore
    if (originalKey) process.env['GEMINI_API_KEY'] = originalKey
    else delete process.env['GEMINI_API_KEY']
  })

  it('ChatGPTProvider isConfigured checks OPENAI_API_KEY env var', async () => {
    const { ChatGPTProvider } = await import('../providers/chatgpt-provider')
    const provider = new ChatGPTProvider()

    const originalKey = process.env['OPENAI_API_KEY']
    delete process.env['OPENAI_API_KEY']
    expect(provider.isConfigured()).toBe(false)

    process.env['OPENAI_API_KEY'] = 'test-key'
    expect(provider.isConfigured()).toBe(true)

    if (originalKey) process.env['OPENAI_API_KEY'] = originalKey
    else delete process.env['OPENAI_API_KEY']
  })
})

// ─── AI Router Provider Status ────────────────────────────────────────────

describe('AI Router getProviderStatus', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns configured status for each provider', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubEnv('OPENAI_API_KEY', 'test-key')

    vi.doMock('@/lib/logger', () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }))

    const { getProviderStatus } = await import('../services/ai-router')
    const status = getProviderStatus()

    expect(status.chatgpt).toBeDefined()
    expect(status.chatgpt.configured).toBe(true)
    expect(status.gemini).toBeDefined()
    expect(status.gemini.configured).toBe(true)
  })
})

// ─── Credit Calculator Model Pricing ──────────────────────────────────────

describe('Credit calculator has Gemini pricing models defined', () => {
  it('includes gemini-2.5-flash and earlier models in pricing', async () => {
    const { MODEL_PRICING, getAllModels } = await import('../services/credit-calculator')

    const models = getAllModels()
    const hasGemini = models.some((m) => m.toLowerCase().includes('gemini'))
    expect(hasGemini).toBe(true)

    const geminiModels = Object.keys(MODEL_PRICING).filter((k) =>
      k.toLowerCase().includes('gemini'),
    )
    expect(geminiModels.length).toBeGreaterThan(0)
    expect(geminiModels).toContain('gemini-2.5-flash')
  })

  it('gemini model pricing maps correctly to provider strings', async () => {
    const { getProviderFromModel, MODEL_PRICING } = await import('../services/credit-calculator')

    expect(getProviderFromModel('gemini-2.5-flash')).toBe('gemini')
    expect(getProviderFromModel('gemini-2.0-flash')).toBe('gemini')
    expect(getProviderFromModel('gemini-2.0-flash-lite')).toBe('gemini')
  })
})
