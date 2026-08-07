import { describe, it, expect } from 'vitest'
import { buildCreditWarning } from '../providers/credit-warning'

/**
 * On 2026-08-07 the Anthropic key returned "Your credit balance is too low" on
 * every request and nothing in the product said so. Engine Info reported Claude
 * as operational — its status was a hardcoded literal — no cost dashboard is
 * reachable from the sidebar, and no alert rules are configured. The outage was
 * invisible until someone queried the provider's own API by hand.
 *
 * What these tests protect is not the ability to warn. It is the SILENCE. A
 * badge that is always on screen stops being read, and is then worth nothing on
 * the day it matters — so every state except "confirmed refusing billed calls"
 * must produce nothing at all.
 */

const drained = { id: 'claude', name: 'Anthropic Claude', creditExhausted: true }
const healthy = { id: 'openai', name: 'OpenAI', creditExhausted: false }
const untried = { id: 'gemini', name: 'Google Gemini', creditExhausted: null }

describe('buildCreditWarning stays silent unless it matters', () => {
  it('says nothing when every provider can still transact', () => {
    expect(buildCreditWarning([healthy, { ...untried, creditExhausted: false }])).toBeNull()
  })

  it('says nothing when credit state is merely UNKNOWN', () => {
    // Credit state is learned from real traffic, so a provider nobody has
    // called yet has no verdict. Unknown is not bad news, and reporting it as
    // such would train operators to ignore the badge.
    expect(buildCreditWarning([untried])).toBeNull()
  })

  it('says nothing for an empty provider list', () => {
    expect(buildCreditWarning([])).toBeNull()
  })

  it('says nothing when the payload is malformed rather than inventing an alarm', () => {
    expect(buildCreditWarning(undefined)).toBeNull()
    expect(buildCreditWarning(null)).toBeNull()
    expect(buildCreditWarning({ providers: [] })).toBeNull()
    expect(buildCreditWarning('down')).toBeNull()
  })

  it('ignores malformed entries inside an otherwise valid list', () => {
    expect(buildCreditWarning([null, undefined, 'x', healthy])).toBeNull()
  })
})

describe('buildCreditWarning when a provider has genuinely run out', () => {
  it('names the one that stopped', () => {
    const w = buildCreditWarning([drained, healthy, untried])

    expect(w).not.toBeNull()
    expect(w!.drained).toHaveLength(1)
    expect(w!.badge).toBe('Anthropic Claude — no credit')
    expect(w!.label).toContain('Anthropic Claude')
    expect(w!.label).toContain('not answering')
  })

  it('counts and lists them when several are out', () => {
    const w = buildCreditWarning([drained, { ...healthy, creditExhausted: true }, untried])

    expect(w!.drained).toHaveLength(2)
    expect(w!.badge).toBe('2 providers')
    // The tooltip still names them: the badge is short, the label is complete.
    expect(w!.label).toContain('Anthropic Claude')
    expect(w!.label).toContain('OpenAI')
  })

  it('does not count unknown providers toward the total', () => {
    const w = buildCreditWarning([drained, untried, untried])

    expect(w!.drained).toHaveLength(1)
    expect(w!.badge).not.toContain('3')
  })
})
