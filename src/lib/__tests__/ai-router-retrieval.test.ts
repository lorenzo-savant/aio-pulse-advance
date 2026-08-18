import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../services/openai', () => ({
  isOpenAIAvailable: vi.fn().mockReturnValue(true),
  callOpenAI: vi.fn().mockResolvedValue('OpenAI plain (model-memory) response'),
  callOpenAIWithWebSearch: vi.fn().mockResolvedValue({
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

// ─── Gemini grounding — model selection, labels, 429 retry ───────────────────
//
// The Gemini branch is not module-mocked like the other providers: its callers
// are internal to ai-router, so these tests stub global fetch and assert on
// the real request the router builds.

describe('Gemini engine grounding', () => {
  const groundedResponse = {
    candidates: [
      {
        content: { parts: [{ text: 'Grounded answer naming brands.' }] },
        groundingMetadata: {
          // A direct (non-vertex) URI passes through resolveVertexRedirects
          // untouched, so the test needs no redirect-resolution stubbing.
          groundingChunks: [{ web: { uri: 'https://tradera.com/guide', title: 'tradera.com' } }],
          webSearchQueries: ['begagnad elektronik'],
        },
      },
    ],
  }

  const okJson = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    // No OpenAI key: keeps the cross-provider fallback from swallowing a
    // Gemini failure and masking what these tests assert.
    vi.stubEnv('OPENAI_API_KEY', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('grounds via googleSearch and returns engine citations with the legacy label', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(okJson(groundedResponse))
    vi.stubGlobal('fetch', fetchSpy)

    const { simulateEngineResponse } = await import('../services/ai-router')
    const result = await simulateEngineResponse('var köper jag begagnat?', 'gemini', 'sv')

    expect(result.retrieval).toBe('live')
    // Default model keeps the EXACT historical label so old and new
    // monitoring_results rows aggregate together.
    expect(result.provider).toBe('gemini:flash-2.5+search')
    expect(result.citations).toContain('https://tradera.com/guide')

    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toContain('gemini-2.5-flash:generateContent')
    expect(String(calledInit.body)).toContain('googleSearch')
  })

  it('retries once on 429 and still returns a live grounded result', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response('quota', { status: 429 }))
      .mockResolvedValueOnce(okJson(groundedResponse))
    vi.stubGlobal('fetch', fetchSpy)

    const { simulateEngineResponse } = await import('../services/ai-router')
    const result = await simulateEngineResponse('test', 'gemini')

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(result.retrieval).toBe('live')
    expect(result.provider).toBe('gemini:flash-2.5+search')
  }, 10_000)

  it('honours GEMINI_ENGINE_MODEL and labels the override honestly', async () => {
    vi.stubEnv('GEMINI_ENGINE_MODEL', 'gemini-3.6-flash')
    const fetchSpy = vi.fn().mockResolvedValue(okJson(groundedResponse))
    vi.stubGlobal('fetch', fetchSpy)

    const { simulateEngineResponse } = await import('../services/ai-router')
    const result = await simulateEngineResponse('test', 'gemini')

    // A bumped model must be visible in the data, never hidden behind the
    // legacy label — response_provider is how a score shift gets explained.
    expect(result.provider).toBe('gemini:gemini-3.6-flash+search')
    const [calledUrl] = fetchSpy.mock.calls[0] as [string]
    expect(calledUrl).toContain('gemini-3.6-flash:generateContent')
  })

  it('keeps the analysis brain pinned when the engine model is overridden', async () => {
    vi.stubEnv('GEMINI_ENGINE_MODEL', 'gemini-3.6-flash')
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        okJson({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }),
      )
    vi.stubGlobal('fetch', fetchSpy)

    const { analyzeResponseForBrand } = await import('../services/ai-router')
    await analyzeResponseForBrand('analyse this')

    // Measurement instrument and analysis brain are separate roles: the env
    // override moves the first, never the second.
    const [calledUrl] = fetchSpy.mock.calls[0] as [string]
    expect(calledUrl).toContain('gemini-2.5-flash:generateContent')
  })
})
