import { describe, it, expect, beforeEach } from 'vitest'
import {
  isCreditExhaustionFailure,
  recordProviderOutcome,
  getCreditState,
  clearCreditState,
} from '../providers/credit-state'

/**
 * On 2026-08-07 the Anthropic key returned "Your credit balance is too low"
 * on every call, and no part of the product noticed: not the Engine Info page,
 * not any cost dashboard, not the alerts. The key authenticated fine — a key
 * with an exhausted balance always does — so every check that asked "does this
 * authenticate" answered yes.
 *
 * Three of the four providers probe free `/models` endpoints that return 200
 * with an empty balance, so no probe can settle this without spending money.
 * The fourth used to POST a real billed inference on every health-cache miss,
 * on a public unauthenticated endpoint.
 *
 * So the answer is read from real calls instead of bought from a probe.
 *
 * The rules must be CONSERVATIVE. Gemini answers 429 for both plain rate
 * limiting and quota exhaustion; treating a bare 429 as an empty wallet would
 * pull a working provider out of rotation for the sixty seconds it needed to
 * cool down. Every rule below therefore needs textual evidence, except 402,
 * which means the same thing everywhere.
 *
 * The error bodies used here are the real ones, taken from live responses.
 */

// Verbatim from the Anthropic API on 2026-08-07, as BaseProvider formats it.
const ANTHROPIC_NO_CREDIT =
  'API error 400: {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}'

const OPENAI_NO_QUOTA =
  'API error 429: {"error":{"message":"You exceeded your current quota, please check your plan and billing details.","type":"insufficient_quota","code":"insufficient_quota"}}'

const OPENAI_RATE_LIMIT =
  'API error 429: {"error":{"message":"Rate limit reached for gpt-4o in organization org-x on requests per min (RPM): Limit 500, Used 500.","type":"requests","code":"rate_limit_exceeded"}}'

const GEMINI_RATE_LIMIT =
  'API error 429: {"error":{"code":429,"message":"Resource has been exhausted (e.g. check quota).","status":"RESOURCE_EXHAUSTED"}}'

const GEMINI_FREE_TIER =
  'API error 429: {"error":{"code":429,"message":"You exceeded your current quota. Please enable billing on your project.","status":"RESOURCE_EXHAUSTED"}}'

beforeEach(() => clearCreditState())

describe('isCreditExhaustionFailure — an empty wallet, not a busy one', () => {
  it('recognises the Anthropic 400 that started this', () => {
    expect(isCreditExhaustionFailure('claude', 400, ANTHROPIC_NO_CREDIT)).toBe(true)
  })

  it('recognises OpenAI insufficient_quota', () => {
    expect(isCreditExhaustionFailure('chatgpt', 429, OPENAI_NO_QUOTA)).toBe(true)
  })

  it('does NOT mistake an OpenAI rate limit for an empty balance', () => {
    // Same status code, entirely different meaning. Flagging this would take a
    // healthy provider out of rotation.
    expect(isCreditExhaustionFailure('chatgpt', 429, OPENAI_RATE_LIMIT)).toBe(false)
  })

  it('does NOT mistake a bare Gemini RESOURCE_EXHAUSTED for an empty balance', () => {
    // Gemini uses 429 RESOURCE_EXHAUSTED for plain rate limiting too, so the
    // status proves nothing on its own.
    expect(isCreditExhaustionFailure('gemini', 429, GEMINI_RATE_LIMIT)).toBe(false)
  })

  it('does recognise Gemini when the wording names billing', () => {
    expect(isCreditExhaustionFailure('gemini', 429, GEMINI_FREE_TIER)).toBe(true)
  })

  it('treats 402 as billing for any provider, without a rule', () => {
    expect(isCreditExhaustionFailure('perplexity', 402, 'API error 402: Payment Required')).toBe(
      true,
    )
    expect(isCreditExhaustionFailure('brightdata', 402, '')).toBe(true)
  })

  it('says nothing about timeouts, server errors or auth failures', () => {
    expect(isCreditExhaustionFailure('claude', 408, 'Request timeout after 60000ms')).toBe(false)
    expect(isCreditExhaustionFailure('claude', 500, 'API error 500: internal')).toBe(false)
    expect(isCreditExhaustionFailure('claude', 401, 'API error 401: invalid x-api-key')).toBe(false)
    expect(isCreditExhaustionFailure('claude', undefined, undefined)).toBe(false)
  })
})

describe('recordProviderOutcome — learned from real traffic', () => {
  it('starts with no opinion: unknown is not the same as fine', () => {
    expect(getCreditState('claude')).toBeNull()
  })

  it('records a billing failure with the provider wording kept', () => {
    recordProviderOutcome('claude', {
      success: false,
      statusCode: 400,
      error: ANTHROPIC_NO_CREDIT,
    })

    const state = getCreditState('claude')
    expect(state?.exhausted).toBe(true)
    expect(state?.detail).toContain('credit balance is too low')
    expect(state?.observedAt).toBeTruthy()
  })

  it('a successful call clears it — the only reliable proof credit is back', () => {
    recordProviderOutcome('claude', { success: false, statusCode: 400, error: ANTHROPIC_NO_CREDIT })
    expect(getCreditState('claude')?.exhausted).toBe(true)

    recordProviderOutcome('claude', { success: true })

    expect(getCreditState('claude')).toBeNull()
  })

  it('a non-billing failure leaves the state untouched', () => {
    // A timeout says nothing about the balance in either direction, so it must
    // neither set nor clear the flag.
    recordProviderOutcome('claude', { success: false, statusCode: 400, error: ANTHROPIC_NO_CREDIT })

    recordProviderOutcome('claude', { success: false, statusCode: 408, error: 'timeout' })

    expect(getCreditState('claude')?.exhausted).toBe(true)
  })

  it('keeps providers independent', () => {
    recordProviderOutcome('claude', { success: false, statusCode: 400, error: ANTHROPIC_NO_CREDIT })

    expect(getCreditState('claude')?.exhausted).toBe(true)
    expect(getCreditState('gemini')).toBeNull()
  })
})
