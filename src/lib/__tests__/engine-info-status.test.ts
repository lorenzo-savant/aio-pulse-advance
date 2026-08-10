import { describe, it, expect } from 'vitest'
import { deriveStatus, type ProviderHealth } from '@/app/dashboard/monitor/page'

/**
 * The Engine Info page performed ZERO network requests. Engine status, model
 * names and a literal "2 min ago" were hardcoded, and the "all systems
 * operational" banner was computed with
 * `ENGINES.every(e => e.status === 'operational')` over that literal — so it
 * was true by construction, for all time.
 *
 * On 2026-08-07 the Anthropic key returned "Your credit balance is too low" on
 * every call. The page reported Claude as operational, last checked 2 minutes
 * ago. On a product whose proposition is telling you what AI engines say about
 * your brand, a page that invents which engines were reachable is not the same
 * class of defect as an off-by-one.
 *
 * `deriveStatus` is the function that decides what the page claims. These
 * tests pin the ordering, because the ordering is where the original failure
 * hides: a key with an exhausted balance authenticates perfectly, so anything
 * that checks reachability first will call it healthy.
 */

function health(over: Partial<ProviderHealth> = {}): ProviderHealth {
  return {
    id: 'claude',
    isConfigured: true,
    isAvailable: true,
    lastChecked: '2026-08-07T10:00:00.000Z',
    creditExhausted: null,
    ...over,
  }
}

describe('deriveStatus', () => {
  it('never reports operational before anything has been read', () => {
    // The literal default used to be 'operational'. Unknown is the honest
    // answer, and it is what the page shows while the request is in flight.
    expect(deriveStatus(undefined).status).toBe('unknown')
  })

  it('reports an exhausted balance even though the key authenticates', () => {
    // This is the 2026-08-07 case exactly: reachable, configured, and unable
    // to transact.
    const s = deriveStatus(
      health({
        isAvailable: true,
        creditExhausted: true,
        creditDetail: 'Your credit balance is too low to access the Anthropic API.',
      }),
    )

    expect(s.status).toBe('no_credit')
    expect(s.detail).toContain('credit balance is too low')
  })

  it('ranks an exhausted balance above reachability', () => {
    // If reachability were checked first, this returns 'operational' — which
    // is the bug.
    expect(deriveStatus(health({ isAvailable: true, creditExhausted: true })).status).toBe(
      'no_credit',
    )
  })

  it('distinguishes an unconfigured engine from a broken one', () => {
    expect(deriveStatus(health({ isConfigured: false })).status).toBe('unconfigured')
    expect(deriveStatus(health({ isAvailable: false })).status).toBe('outage')
  })

  it('reports operational only when configured, reachable, and not out of credit', () => {
    const s = deriveStatus(health({ model: 'claude-sonnet-4-6' }))
    expect(s.status).toBe('operational')
    expect(s.model).toBe('claude-sonnet-4-6')
  })

  it('carries the real timestamp through instead of a hardcoded string', () => {
    expect(deriveStatus(health()).lastChecked).toBe('2026-08-07T10:00:00.000Z')
  })

  it('treats unknown credit state as usable rather than blocking the engine', () => {
    // `null` means no real call has reported on billing yet. That must not
    // read as "out of credit" — it would take a working provider off the
    // board on a cold instance.
    expect(deriveStatus(health({ creditExhausted: null })).status).toBe('operational')
  })
})
