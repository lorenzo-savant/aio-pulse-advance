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

// ─── Gemini grounding — Interactions path, labels, 429 retry ────────────────
//
// The Gemini branch is not module-mocked like the other providers: its callers
// are internal to ai-router, so these tests stub global fetch and assert on
// the real request the router builds.
//
// Reality these tests pin (verified live 2026-08-18): gemini-2.5-flash was
// retired by Google (404), and on 3.x models the googleSearch tool on
// generateContent is silently ignored — grounding only runs through the
// Interactions API. The default model is therefore 3.6 + Interactions; a 2.x
// override still exercises the legacy generateContent grounded path.

describe('Gemini engine grounding', () => {
  const interactionsResponse = {
    status: 'completed',
    steps: [
      { content: [{ text: '' }] }, // search step — must not win the walk-back
      {
        content: [
          {
            text: 'Grounded answer naming brands.',
            annotations: [
              // Direct (non-vertex) URL: passes through resolveVertexRedirects
              // untouched, so the test needs no redirect stubbing.
              { url: 'https://tradera.com/guide', start_index: 0, end_index: 10 },
              { url: 'https://tradera.com/guide', start_index: 11, end_index: 20 }, // dup → de-duped
            ],
          },
        ],
      },
    ],
  }

  const legacyGroundedResponse = {
    candidates: [
      {
        content: { parts: [{ text: 'Grounded answer naming brands.' }] },
        groundingMetadata: {
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

  it('default model grounds via the Interactions API with an honest label', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(okJson(interactionsResponse))
    vi.stubGlobal('fetch', fetchSpy)

    const { simulateEngineResponse } = await import('../services/ai-router')
    const result = await simulateEngineResponse('var köper jag begagnat?', 'gemini', 'sv')

    expect(result.retrieval).toBe('live')
    expect(result.provider).toBe('gemini:flash-3.6+search')
    // De-duped: two annotations pointing at the same URL yield one citation.
    expect(result.citations).toEqual(['https://tradera.com/guide'])

    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toContain('/v1beta/interactions')
    const body = String(calledInit.body)
    expect(body).toContain('"gemini-3.6-flash"')
    expect(body).toContain('google_search')
  })

  it('retries once on 429 and still returns a live grounded result', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response('quota', { status: 429 }))
      .mockResolvedValueOnce(okJson(interactionsResponse))
    vi.stubGlobal('fetch', fetchSpy)

    const { simulateEngineResponse } = await import('../services/ai-router')
    const result = await simulateEngineResponse('test', 'gemini')

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(result.retrieval).toBe('live')
    expect(result.provider).toBe('gemini:flash-3.6+search')
  }, 10_000)

  it('a 2.x override routes through the legacy generateContent grounded path', async () => {
    vi.stubEnv('GEMINI_ENGINE_MODEL', 'gemini-2.5-flash')
    const fetchSpy = vi.fn().mockResolvedValue(okJson(legacyGroundedResponse))
    vi.stubGlobal('fetch', fetchSpy)

    const { simulateEngineResponse } = await import('../services/ai-router')
    const result = await simulateEngineResponse('test', 'gemini')

    // Continuity: a 2.x override aggregates with its own historical rows
    // under the exact legacy label.
    expect(result.provider).toBe('gemini:flash-2.5+search')
    expect(result.citations).toContain('https://tradera.com/guide')
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toContain('gemini-2.5-flash:generateContent')
    expect(String(calledInit.body)).toContain('googleSearch')
  })

  it('never leaks the measured brand into the outbound engine prompt', async () => {
    // Client-facing incident, 2026-08-18: the simulation prompt used to carry
    // the brand card (name, domain, aliases, competitors) before the user
    // question — every mention-rate was measured with the witness led. This
    // pins the fix: whatever a caller passes as brand, the request body the
    // engine sees contains only persona + locale + the user question.
    const fetchSpy = vi.fn().mockResolvedValue(okJson(interactionsResponse))
    vi.stubGlobal('fetch', fetchSpy)

    const brand = {
      name: 'Relovie',
      domain: 'relovie.com',
      aliases: ['Re Lovie'],
      domains: ['relovie.se'],
      competitors: ['Tradera', 'Sellpy'],
      industry: 'second-hand marketplace',
      description: 'category-wide used-goods search engine',
    }

    const { simulateEngineResponse } = await import('../services/ai-router')
    await simulateEngineResponse(
      'var köper jag begagnad elektronik?',
      'gemini',
      'sv',
      brand as never,
    )

    const body = String((fetchSpy.mock.calls[0] as [string, RequestInit])[1].body)
    for (const leak of ['Relovie', 'relovie.com', 'Re Lovie', 'Tradera', 'Sellpy']) {
      expect(body).not.toContain(leak)
    }
    expect(body).toContain('var köper jag begagnad elektronik?')
  })

  it('keeps the analysis brain pinned when the engine model is overridden', async () => {
    vi.stubEnv('GEMINI_ENGINE_MODEL', 'gemini-2.5-flash')
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
    const [calledUrl, calledInit] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(calledUrl).toContain('gemini-3.6-flash:generateContent')
    // 3.x rejects thinkingConfig with 400 — the jsonMode guard must not send it.
    expect(String(calledInit.body)).not.toContain('thinkingConfig')
    expect(String(calledInit.body)).toContain('application/json')
  })
})
