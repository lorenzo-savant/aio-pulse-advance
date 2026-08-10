// PATH: src/lib/providers/credit-state.ts
//
// Tracks which providers are refusing work because the account is out of
// credit, learned from REAL calls rather than from a probe.
//
// WHY PASSIVE
// A health check answers "does this key authenticate". It cannot answer "does
// this key have credit" unless it spends some: three of the four providers
// probe free `/models` endpoints that return 200 with an empty balance, and
// the fourth used to POST a real billed inference on every cache miss, on a
// public endpoint, which made the status page a metered-spend surface.
//
// Every genuine request already carries the answer. A provider that is
// failing real work with a billing error IS unavailable, whatever a probe
// says — so the failures are read instead of bought.
//
// The cost is honest and bounded: a provider nobody has called yet has no
// credit state, and reports as unknown rather than as fine.
//
// STATE LIVES IN MEMORY, ON PURPOSE
// This is a cache of an observation, not a record. It is per-process, so a
// fresh serverless instance starts with no opinion and re-learns from its
// first real call. Persisting it would mean a stale "out of credit" flag
// outliving a top-up and suppressing a provider that works.

import type { AIProviderId } from './types'

export interface CreditState {
  /** True when the last observed call failed with a billing error. */
  exhausted: boolean
  /** When that was observed. */
  observedAt: string
  /** The provider's own words, truncated. Shown to operators. */
  detail: string
}

const state = new Map<AIProviderId, CreditState>()

/**
 * Per-provider rules for recognising "you are out of credit" as distinct from
 * "you are going too fast".
 *
 * Deliberately conservative: each rule needs textual evidence, not just a
 * status code. Gemini and Groq both answer 429 for plain rate limiting, and
 * flagging that as an exhausted balance would take a provider out of rotation
 * for the sixty seconds it needed to cool down.
 *
 * 402 Payment Required is the one status unambiguous enough to stand alone.
 */
const RULES: Partial<Record<AIProviderId, (status: number, text: string) => boolean>> = {
  // "Your credit balance is too low to access the Anthropic API."
  // Arrives as a 400 invalid_request_error, not a 402.
  claude: (status, text) => status === 400 && /credit balance is too low/i.test(text),

  // OpenAI signals an exhausted balance as 429 with code `insufficient_quota`,
  // which is a different thing from its plain 429 rate limit.
  chatgpt: (status, text) => status === 429 && /insufficient_quota/i.test(text),
  'azure-openai': (status, text) =>
    status === 429 && /insufficient_quota|quota exceeded/i.test(text),

  // Gemini answers 429 RESOURCE_EXHAUSTED for BOTH rate limits and quota, so
  // the status alone proves nothing. Require billing/quota wording.
  gemini: (status, text) =>
    status === 429 && /billing|quota (?:exceeded|exhausted)|free tier/i.test(text),

  perplexity: (status, text) => status === 401 && /credit|balance|payment/i.test(text),
}

/** 402 means the same thing everywhere and needs no provider-specific rule. */
const isUniversalBillingFailure = (status: number) => status === 402

export function isCreditExhaustionFailure(
  provider: AIProviderId,
  statusCode: number | undefined,
  errorText: string | undefined,
): boolean {
  if (statusCode == null) return false
  if (isUniversalBillingFailure(statusCode)) return true
  const rule = RULES[provider]
  return rule ? rule(statusCode, errorText ?? '') : false
}

/**
 * Record what a real call observed.
 *
 * A success clears the flag: the only reliable proof that credit is back is a
 * request that went through. Failures that are not billing failures leave the
 * state untouched — a timeout says nothing about the balance.
 */
export function recordProviderOutcome(
  provider: AIProviderId,
  outcome: { success: boolean; statusCode?: number; error?: string },
): void {
  if (outcome.success) {
    state.delete(provider)
    return
  }
  if (isCreditExhaustionFailure(provider, outcome.statusCode, outcome.error)) {
    state.set(provider, {
      exhausted: true,
      observedAt: new Date().toISOString(),
      detail: (outcome.error ?? '').slice(0, 200),
    })
  }
}

/** Current state, or null when no real call has reported one. */
export function getCreditState(provider: AIProviderId): CreditState | null {
  return state.get(provider) ?? null
}

/** Test seam and operator escape hatch after a top-up. */
export function clearCreditState(provider?: AIProviderId): void {
  if (provider) state.delete(provider)
  else state.clear()
}
