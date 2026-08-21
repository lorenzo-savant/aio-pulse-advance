import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * /api/answers — the grounded answer endpoint.
 *
 * The property worth defending here is negative: on every path where the data
 * cannot support an answer, no model is called at all. A refusal that still
 * burned an LLM call would mean the guard is decorative, and a regression there
 * would be invisible — the endpoint would keep returning plausible prose.
 *
 * So most of these tests assert on `callLLM` NOT having run.
 */

const USER = '00000000-0000-4000-8000-000000000001'
const BRAND = '00000000-0000-4000-8000-0000000000b1'

// vi.mock factories are hoisted above ordinary top-level constants, so the
// shared spies have to be created inside vi.hoisted to exist by the time they
// run.
const mocks = vi.hoisted(() => ({
  callLLM: vi.fn(),
  logCost: vi.fn(),
  wouldExceedBudget: vi.fn(),
  requireBrandRole: vi.fn(),
  collectAttributionEvidence: vi.fn(),
  collectDeltaEvidence: vi.fn(),
}))

vi.mock('@/lib/api-auth', () => ({
  requireUser: vi.fn(async () => ({ userId: '00000000-0000-4000-8000-000000000001' })),
  rateLimitGate: vi.fn(async () => null),
}))

vi.mock('@/lib/authorize', () => ({ requireBrandRole: mocks.requireBrandRole }))

vi.mock('@/lib/cost-monitor', () => ({
  BudgetManager: class {
    wouldExceedBudget = mocks.wouldExceedBudget
  },
  getCostTracker: () => ({ logCost: mocks.logCost }),
  estimateBlendedCost: () => 0.001,
}))

vi.mock('@/lib/services/prompt-generator-ai', () => ({ callLLM: mocks.callLLM }))

vi.mock('@/lib/agents/grounding', () => ({
  collectAttributionEvidence: mocks.collectAttributionEvidence,
  collectDeltaEvidence: mocks.collectDeltaEvidence,
  collectDeliveredRecommendations: vi.fn(async () => ({
    titles: [],
    provenance: { table: 'recommendation_history', detail: 'none', rowCount: 0 },
  })),
  isPillar: (v: string) => ['citation', 'presence', 'authority', 'position', 'trust'].includes(v),
}))

const { callLLM, logCost, wouldExceedBudget, requireBrandRole } = mocks
const { collectAttributionEvidence, collectDeltaEvidence } = mocks

import { POST } from '@/app/api/answers/route'

/** Minimal stand-in for NextRequest: the handler only calls `.json()` on it. */
function request(body: unknown) {
  return { json: async () => body } as never
}

const GROUNDED = {
  grounded: true as const,
  evidence: {
    facts: ['The brand is named in 4 of 12 responses.'],
    definitions: ['Brand Presence (25%) — share of answers naming the brand.'],
    provenance: [{ table: 'monitoring_results', detail: 'brand_mentioned', rowCount: 12 }],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  wouldExceedBudget.mockResolvedValue({ allowed: true })
  requireBrandRole.mockResolvedValue({})
  callLLM.mockResolvedValue({
    text: 'Because the brand is named late.',
    provider: 'groq',
    model: 'llama',
  })
})

describe('refusing without spending', () => {
  it('returns the refusal reason and never calls the model', async () => {
    collectAttributionEvidence.mockResolvedValue({
      grounded: false,
      reason: 'no_monitoring_data',
    })

    const res = await POST(request({ brandId: BRAND, kind: 'attribution', pillar: 'presence' }))
    const body = await res.json()

    // A refusal is a real answer, not an error — the UI renders it in the
    // user's language from the reason code.
    expect(res.status).toBe(200)
    expect(body).toEqual({ grounded: false, reason: 'no_monitoring_data' })
    expect(callLLM).not.toHaveBeenCalled()
    expect(logCost).not.toHaveBeenCalled()
  })

  it('refuses a delta with too little history without calling the model', async () => {
    collectDeltaEvidence.mockResolvedValue({ grounded: false, reason: 'not_enough_history' })

    const res = await POST(request({ brandId: BRAND, kind: 'delta' }))
    expect((await res.json()).reason).toBe('not_enough_history')
    expect(callLLM).not.toHaveBeenCalled()
  })
})

describe('gates that run before the model', () => {
  it('stops on an exhausted budget with 402 and no model call', async () => {
    wouldExceedBudget.mockResolvedValue({
      allowed: false,
      reason: 'daily_limit',
      limitUsd: 10,
    })

    const res = await POST(request({ brandId: BRAND, kind: 'delta' }))
    expect(res.status).toBe(402)
    expect((await res.json()).reason).toBe('daily_limit')
    expect(callLLM).not.toHaveBeenCalled()
    expect(collectDeltaEvidence).not.toHaveBeenCalled()
  })

  it('returns the authorization response when the caller lacks editor rights', async () => {
    const denied = new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    requireBrandRole.mockResolvedValue({ response: denied })

    const res = await POST(request({ brandId: BRAND, kind: 'delta' }))
    expect(res.status).toBe(403)
    expect(callLLM).not.toHaveBeenCalled()
    expect(wouldExceedBudget).not.toHaveBeenCalled()
  })

  it('rejects an attribution request that names no pillar', async () => {
    const res = await POST(request({ brandId: BRAND, kind: 'attribution' }))
    expect(res.status).toBe(400)
    expect(callLLM).not.toHaveBeenCalled()
  })

  it('rejects a brand id that is not a uuid', async () => {
    const res = await POST(request({ brandId: 'not-a-uuid', kind: 'delta' }))
    expect(res.status).toBe(400)
    expect(requireBrandRole).not.toHaveBeenCalled()
  })
})

describe('answering when the data supports it', () => {
  beforeEach(() => {
    collectAttributionEvidence.mockResolvedValue(GROUNDED)
  })

  it('returns the answer with the tables it came from', async () => {
    const res = await POST(request({ brandId: BRAND, kind: 'attribution', pillar: 'presence' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.grounded).toBe(true)
    expect(body.answer).toContain('named late')
    expect(body.provenance[0]).toMatchObject({ table: 'monitoring_results', rowCount: 12 })
    // The facts travel with the answer so a reader can check it rather than
    // trust it.
    expect(body.facts).toEqual(GROUNDED.evidence.facts)
  })

  it('hands the model the evidence and nothing else to work from', async () => {
    await POST(request({ brandId: BRAND, kind: 'attribution', pillar: 'presence' }))

    const [systemPrompt, userPrompt] = callLLM.mock.calls[0] as unknown as [string, string]
    expect(systemPrompt).toContain('ONLY the facts')
    expect(userPrompt).toContain('The brand is named in 4 of 12 responses.')
    expect(userPrompt).toContain('Brand Presence (25%)')
  })

  it('logs the cost of an answer it did produce', async () => {
    await POST(request({ brandId: BRAND, kind: 'attribution', pillar: 'presence' }))

    expect(logCost).toHaveBeenCalledTimes(1)
    expect(logCost.mock.calls[0]?.[0]).toMatchObject({
      userId: USER,
      brandId: BRAND,
      agentType: 'grounded_answer:attribution',
      success: true,
    })
  })

  it('clamps the window to the range the schema allows', async () => {
    const res = await POST(
      request({ brandId: BRAND, kind: 'attribution', pillar: 'presence', days: 5000 }),
    )
    expect(res.status).toBe(400)
  })
})
