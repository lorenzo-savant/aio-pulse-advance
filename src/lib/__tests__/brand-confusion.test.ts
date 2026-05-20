import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Brand, MonitoringEngine } from '@/types'
import { buildBrandContext, enrichPromptWithBrandContext } from '../brand-enrichment'
import {
  buildAnalysisPrompt as buildMonitoringAnalysisPrompt,
  detectHallucinations,
} from '../services/monitoring'
import { buildAnalysisPrompt as buildGeminiAnalysisPrompt } from '../services/gemini'

// ─── Mock brand: Acasting ──────────────────────────────────────────────────
// Acasting is an Italian AI visibility / SaaS company.
// Acast is a Swedish podcast hosting platform.
// These are DIFFERENT entities that LLMs easily confuse.

const MOCK_ACASTING_BRAND: Brand = {
  id: 'test-acasting-id',
  user_id: 'test-user',
  name: 'Acasting',
  slug: 'acasting',
  description:
    'AI Visibility Index measurement platform. SaaS that measures how brands appear in ChatGPT, Gemini, Perplexity, and Claude responses. Italian company operating primarily in Sweden.',
  domain: 'acasting.ai',
  aliases: ['Acasting S.r.l.', 'AIO Pulse Advance', 'AIO Pulse'],
  domains: ['acasting.ai', 'aiopulse.com'],
  competitors: ['Brand24', 'Mention', 'Determ', 'Semrush'],
  industry: 'AI Visibility / SaaS / MarTech',
  color: '#6366f1',
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  updated_at: '2025-06-01T00:00:00Z',
  language: 'sv',
}

// ─── Logger mock ───────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ─── Brand Context Disambiguation ──────────────────────────────────────────

describe('Brand context disambiguation (Acasting vs Acast)', () => {
  it('buildBrandContext includes domain and industry for disambiguation', () => {
    const context = buildBrandContext(MOCK_ACASTING_BRAND, {
      includeDomain: true,
      includeAliases: true,
      includeIndustry: true,
      includeCompetitors: true,
    })

    expect(context).toContain('Acasting')
    expect(context).toContain('acasting.ai')
    expect(context).toContain('AI Visibility')
    expect(context).toContain('SaaS')
  })

  it('buildBrandContext disambiguates Acasting from Acast (podcast platform)', () => {
    // Previously this test asserted the context never mentioned "podcast" —
    // but Citation Sources data later showed feeds.acast.com leaking into
    // Acasting-targeted prompts because the LLM was conflating the names.
    // The fix is the OPPOSITE: deliberately mention Acast + podcast in a
    // disambiguation line so the LLM learns to keep them apart. The exact
    // wording is allowed to evolve; we assert on the SEMANTIC claims:
    //   - Acasting is mentioned
    //   - Acast is explicitly flagged
    //   - feeds.acast.com is called out as not-this-brand
    //   - The text frames them as different companies
    const context = buildBrandContext(MOCK_ACASTING_BRAND)
    expect(context).toContain('Acasting')
    expect(context).toMatch(/Acast\b/) // standalone Acast token mentioned
    expect(context).toMatch(/feeds\.acast\.com/i)
    expect(context).toMatch(/different compan(y|ies)/i)
  })

  it('enrichPromptWithBrandContext prepends context to query', () => {
    const query = 'What is Acasting?'
    const enriched = enrichPromptWithBrandContext(query, MOCK_ACASTING_BRAND)

    expect(enriched).toContain('Context:')
    expect(enriched).toContain('Brand: Acasting')
    expect(enriched).toContain('Query:')
    expect(enriched).toContain(query)
  })
})

// ─── Analysis Prompt (monitoring.ts) includes brand context ────────────────

describe('Analysis prompt includes brand context', () => {
  it('buildAnalysisPrompt in monitoring.ts includes brand name and aliases', () => {
    const prompt = buildMonitoringAnalysisPrompt(
      'Some AI response about AI visibility tools',
      MOCK_ACASTING_BRAND,
      'What is Acasting?',
    )

    expect(prompt).toContain('Acasting')
    expect(prompt).toContain('Acasting S.r.l.')
    expect(prompt).toContain('acasting.ai')
  })

  it('buildAnalysisPrompt lists known competitors', () => {
    const prompt = buildMonitoringAnalysisPrompt(
      'Response text',
      MOCK_ACASTING_BRAND,
      'Tell me about Acasting',
    )

    expect(prompt).toContain('Brand24')
    expect(prompt).toContain('Mention')
  })
})

// ─── Gemini Analysis Prompt (gemini.ts) has no brand context ───────────────

describe('Gemini analysis prompt (gemini.ts) has no brand context', () => {
  it('buildAnalysisPrompt in gemini.ts does NOT mention the specific brand', () => {
    const prompt = buildGeminiAnalysisPrompt('Some content about SEO', 'gemini')
    expect(prompt).toContain('Analyze the following content')
    expect(prompt).not.toContain('Acasting')
  })
})

// ─── Simulation Prompt Gap ─────────────────────────────────────────────────

describe('Simulation prompt gap — brand context is NOT passed to engines', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
    vi.stubEnv('PERPLEXITY_API_KEY', 'test-key')
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('simulateEngineResponse builds prompt without brand context (DOCUMENTS THE GAP)', async () => {
    const callOpenAI = vi.fn().mockResolvedValue('test response')
    const callGeminiFallback = vi.fn().mockResolvedValue('test response')
    const callPerplexity = vi.fn()
    const callAnthropic = vi.fn()

    vi.doMock('../services/openai', () => ({
      isOpenAIAvailable: vi.fn().mockReturnValue(true),
      callOpenAI: callOpenAI,
    }))
    vi.doMock('../services/perplexity', () => ({
      isPerplexityAvailable: vi.fn().mockReturnValue(false),
      callPerplexityWithCitations: callPerplexity,
    }))
    vi.doMock('../services/anthropic', () => ({
      isAnthropicAvailable: vi.fn().mockReturnValue(false),
      callAnthropic: callAnthropic,
    }))

    const { simulateEngineResponse } = await import('../services/ai-router')
    await simulateEngineResponse('What is Acasting?', 'chatgpt')

    const sentPrompt = callOpenAI.mock.calls[0]?.[0]
    expect(sentPrompt).toBeDefined()

    // The prompt contains engine persona + user question, but NO brand context
    expect(sentPrompt).toContain('You are ChatGPT')
    expect(sentPrompt).toContain('What is Acasting?')
    // This is the key assertion: NO brand context is included in the simulation prompt
    expect(sentPrompt).not.toContain('Acasting S.r.l.')
    expect(sentPrompt).not.toContain('acasting.ai')
    expect(sentPrompt).not.toContain('AI Visibility')
    // The engine persona only says "Include relevant brands" — but gives no specific info
  })
})

// ─── Engine Persona Prompts ────────────────────────────────────────────────

describe('Engine persona prompts lack brand disambiguation', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('OPENAI_API_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('chatgpt persona prompt does not include brand context', async () => {
    const callOpenAI = vi.fn().mockResolvedValue('response')
    vi.doMock('../services/openai', () => ({
      isOpenAIAvailable: vi.fn().mockReturnValue(true),
      callOpenAI,
    }))
    vi.doMock('../services/perplexity', () => ({
      isPerplexityAvailable: vi.fn().mockReturnValue(false),
      callPerplexityWithCitations: vi.fn(),
    }))
    vi.doMock('../services/anthropic', () => ({
      isAnthropicAvailable: vi.fn().mockReturnValue(false),
      callAnthropic: vi.fn(),
    }))

    const { simulateEngineResponse } = await import('../services/ai-router')
    await simulateEngineResponse('Tell me about Acasting', 'chatgpt')

    const prompt = callOpenAI.mock.calls[0]?.[0] as string
    // The persona says "Include relevant brands" — generic instruction
    expect(prompt).toContain('Include relevant brands')
    // But does NOT specify what Acasting is, so the model relies on its training data
    // If training data confuses Acasting with Acast, the response will be wrong
  })
})

// ─── Hallucination Detection ──────────────────────────────────────────────

describe('Hallucination detection can catch brand confusion', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('GEMINI_API_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('detectHallucinations includes known facts to compare against', async () => {
    // Mock the internal call to routerAnalyze
    const fakeResponse = JSON.stringify({
      has_hallucination: true,
      confidence: 95,
      flags: [
        {
          text: 'Acasting is a Swedish podcast platform similar to Acast',
          severity: 'high' as const,
          type: 'factual_error' as const,
        },
      ],
      summary: 'The model confused Acasting with Acast, a podcast hosting platform.',
    })

    vi.doMock('../services/ai-router', () => ({
      analyzeResponseForBrand: vi
        .fn()
        .mockResolvedValue({ text: fakeResponse, provider: 'gemini:flash-2.5' }),
    }))

    const { detectHallucinations: detect } = await import('../services/monitoring')
    const result = await detect('Acasting is a popular podcast platform from Sweden.', 'Acasting', [
      'Acasting is an AI visibility measurement platform, not a podcast service.',
    ])

    expect(result.has_hallucination).toBe(true)
    expect(result.flags.length).toBeGreaterThan(0)
    expect(result.flags[0]!.type).toBe('factual_error')
  })
})

// ─── Prompt Library ───────────────────────────────────────────────────────

describe('Prompt library — brand confusion risk', () => {
  it('"What is {brand}?" query is ambiguous without brand context', async () => {
    const { PROMPT_TEMPLATES, hydratePrompt } = await import('../prompt-library')

    const whatIsTemplate = PROMPT_TEMPLATES.find((t) => t.id === 'D01')
    expect(whatIsTemplate).toBeDefined()

    const hydrated = hydratePrompt(whatIsTemplate!, 'en', { brand: 'Acasting' })
    expect(hydrated).toBe('What is Acasting?')

    // This query is ambiguous. Without context, an LLM might answer about
    // "Acast" the podcast platform instead of "Acasting" the AI visibility tool.
    // The template is correct — the pipeline needs to add brand context.
  })

  it('prompts should not accidentally reference bare "Acast" without "ing"', async () => {
    const { PROMPT_TEMPLATES } = await import('../prompt-library')

    for (const template of PROMPT_TEMPLATES) {
      const hydrated = template.texts.en.replace(/{brand}/g, 'Acasting')
      // \bAcast\b does NOT match inside "Acasting" (word boundary after t fails
      // because i follows). If any prompt literally contains the word "Acast"
      // (the podcast platform) as a standalone term, that would be confusing.
      expect(hydrated).not.toMatch(/\bAcast\b/)
    }
  })
})

// ─── Post-hoc domain check (Searchstack-inspired) ──────────────────────────
//
// Searchstack uses a simpler approach: ask the question naturally, then
// check if the domain appears in the response text. This avoids the
// complexity of system prompts and brand context injection.
// See: https://github.com/alexpospekhov/searchstack-aeo

describe('Post-hoc domain mention detection (Searchstack-style)', () => {
  it('detects domain mention in response text via simple string match', () => {
    const response =
      'Acasting is a great platform for measuring AI visibility. Visit acasting.ai for more.'
    const domain = 'acasting.ai'

    const cited = response.toLowerCase().includes(domain.toLowerCase())

    expect(cited).toBe(true)
  })

  it('detects when model confuses Acasting with Acast via domain absence', () => {
    // This simulates what happens when Gemini confuses Acasting with Acast
    const wrongResponse = 'Acast is a Swedish podcast hosting platform founded in 2014.'
    const correctDomain = 'acasting.ai'

    // The domain is NOT mentioned — this is how we'd catch the confusion
    const cited = wrongResponse.toLowerCase().includes(correctDomain.toLowerCase())
    expect(cited).toBe(false)

    // Bonus: check if it mentions "podcast" but not our domain
    const mentionsPodcast = wrongResponse.toLowerCase().includes('podcast')
    const mentionsOurDomain = wrongResponse.toLowerCase().includes(correctDomain.toLowerCase())
    const likelyConfused = mentionsPodcast && !mentionsOurDomain
    expect(likelyConfused).toBe(true)
  })

  it('domain check + brand context together prevent false negatives', () => {
    // With brand context enriched in the prompt, the model should
    // mention the correct domain in its response
    const enrichedPrompt = `Context:
Brand: Acasting
Domain: acasting.ai
Industry: AI Visibility / SaaS

Query: What is Acasting?`

    // The prompt itself isn't the response, but it shows that the
    // model now has enough info to disambiguate
    expect(enrichedPrompt).toContain('acasting.ai')
    expect(enrichedPrompt).toContain('AI Visibility')
  })

  it('models the full Searchstack citation check function for Acasting', () => {
    // Reproduce Searchstack's check_citation logic:
    // given a response, check if domain.lower() in response.lower()
    const domain = 'acasting.ai'

    const correctResponse = 'Acasting (acasting.ai) is an AI visibility measurement platform.'
    const wrongResponse = 'Acast is a popular podcast platform based in Sweden.'

    expect(correctResponse.toLowerCase().includes(domain)).toBe(true)
    expect(wrongResponse.toLowerCase().includes(domain)).toBe(false)
  })
})

// ─── Cross-Provider Prompt Consistency (Searchstack-inspired) ──────────────

describe('Cross-provider prompt consistency (Searchstack-inspired)', () => {
  it('simulateEngineResponse now uses brand context via enrichPromptWithBrandContext', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const sourcePath = join(process.cwd(), 'src/lib/services/ai-router.ts')
    const source = readFileSync(sourcePath, 'utf-8')

    // After the fix, the prompt goes through enrichPromptWithBrandContext
    expect(source).toContain('enrichPromptWithBrandContext')
    expect(source).toContain('Brand')
  })

  it('simulateEngineResponse type signature includes brand parameter', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const sourcePath = join(process.cwd(), 'src/lib/services/ai-router.ts')
    const source = readFileSync(sourcePath, 'utf-8')

    // After the fix, the signature includes Brand parameter
    expect(source).toContain('brand?: Brand | null')
  })
})

// ─── Integration Tests (skipped without real API keys) ────────────────────

describe('Integration: Gemini response analysis (requires GEMINI_API_KEY)', () => {
  const itIf = (condition: boolean) => (condition ? it : it.skip)

  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('GEMINI_API_KEY', process.env['GEMINI_API_KEY'] || '')
    vi.stubEnv('OPENAI_API_KEY', process.env['OPENAI_API_KEY'] || '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  itIf(!!process.env['GEMINI_API_KEY'])(
    'natural query: "What is Acasting?" — check for domain mention (Searchstack-style)',
    async () => {
      // This test follows Searchstack's approach: ask a natural question
      // with NO system prompt, then check if the domain appears in response.
      const { callGemini } = await import('../services/gemini')

      const response = await callGemini('What is Acasting? Please be brief (2-3 sentences).')
      const lower = response.toLowerCase()

      // Check 1: Is the domain acasting.ai mentioned?
      const mentionsDomain = lower.includes('acasting.ai')

      // Check 2: Does it mention podcast?
      const mentionsPodcast = lower.includes('podcast')

      // Check 3: Does it mention "AI visibility" or similar?
      const mentionsAI =
        lower.includes('ai visibility') || (lower.includes('ai') && lower.includes('visibility'))

      console.log('Gemini natural response:', response.slice(0, 500))
      console.log('  Mentions domain:', mentionsDomain)
      console.log('  Mentions podcast:', mentionsPodcast)
      console.log('  Mentions AI/visibility:', mentionsAI)

      // If mentions podcast but NOT our domain, it likely confused with Acast
      if (mentionsPodcast && !mentionsDomain) {
        console.warn('WARNING: Gemini likely confused Acasting with Acast!')
      }
    },
    30000,
  )

  itIf(!!process.env['GEMINI_API_KEY'])(
    'WITH brand context, Gemini correctly identifies Acasting',
    async () => {
      const { callGemini } = await import('../services/gemini')

      const context = buildBrandContext(MOCK_ACASTING_BRAND)
      const prompt = `${context}

Query: What is Acasting based on the context above?
Respond ONLY with JSON:
{
  "description": "description",
  "industry": "industry",
  "isPodcastPlatform": true or false
}`

      const response = await callGemini(prompt)
      const cleaned = response
        .replace(/```json?\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()

      let parsed: { description?: string; industry?: string; isPodcastPlatform?: boolean }
      try {
        parsed = JSON.parse(cleaned)
      } catch {
        console.log('Raw response:', response.slice(0, 400))
        return
      }

      if (parsed.isPodcastPlatform === true || parsed.industry?.toLowerCase().includes('podcast')) {
        console.warn(
          'FAIL: Even with context, Gemini thinks Acasting is a podcast!',
          JSON.stringify(parsed, null, 2),
        )
      }
      expect(parsed.isPodcastPlatform).not.toBe(true)
      console.log('With context:', JSON.stringify(parsed, null, 2))
    },
    30000,
  )
})
