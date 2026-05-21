import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Resilient provider chain: Groq → Cerebras → Mistral → Gemini → OpenAI.
// We mock global fetch by URL so we can simulate a provider hitting its limit
// and assert the chain falls through to the next configured provider.

const okJson = (content: string) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => '',
  }) as unknown as Response

const fail = (status: number) =>
  ({
    ok: false,
    status,
    json: async () => ({}),
    text: async () => `error ${status}`,
  }) as unknown as Response

describe('callLLM resilient fallback', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    // Start from a clean slate so real env keys don't leak into the chain.
    for (const k of [
      'GROQ_API_KEY',
      'CEREBRAS_API_KEY',
      'MISTRAL_API_KEY',
      'GEMINI_API_KEY',
      'OPENAI_API_KEY',
    ]) {
      vi.stubEnv(k, '')
    }
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('falls back from a rate-limited Groq to Cerebras', async () => {
    vi.stubEnv('GROQ_API_KEY', 'g')
    vi.stubEnv('CEREBRAS_API_KEY', 'c')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('groq.com')) return fail(429)
        if (url.includes('cerebras.ai')) return okJson('{"ok":true}')
        return fail(500)
      }),
    )
    const { callLLM } = await import('../services/prompt-generator-ai')
    const res = await callLLM('sys', 'user')
    expect(res.provider).toBe('cerebras')
  })

  it('falls back Groq → Cerebras → Mistral when both fail', async () => {
    vi.stubEnv('GROQ_API_KEY', 'g')
    vi.stubEnv('CEREBRAS_API_KEY', 'c')
    vi.stubEnv('MISTRAL_API_KEY', 'm')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('mistral.ai')) return okJson('{"ok":true}')
        return fail(429)
      }),
    )
    const { callLLM } = await import('../services/prompt-generator-ai')
    const res = await callLLM('sys', 'user')
    expect(res.provider).toBe('mistral')
  })

  it('throws a combined error when every provider fails', async () => {
    vi.stubEnv('GROQ_API_KEY', 'g')
    vi.stubEnv('CEREBRAS_API_KEY', 'c')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => fail(500)),
    )
    const { callLLM } = await import('../services/prompt-generator-ai')
    await expect(callLLM('sys', 'user')).rejects.toThrow(/All LLM providers failed/)
  })

  it('throws when no provider is configured', async () => {
    const { callLLM } = await import('../services/prompt-generator-ai')
    await expect(callLLM('sys', 'user')).rejects.toThrow(/No LLM provider configured/)
  })
})
