import { describe, it, expect } from 'vitest'
import { maskEmail } from '@/app/api/invitations/accept/route'

/**
 * The invitation-accept route refuses when the signed-in account differs from
 * the invited address. That refusal names both sides so the recipient can act
 * on it — but the invited address is masked, because whoever holds the token
 * may not be the intended recipient (forwarded email, shared link).
 */
describe('maskEmail', () => {
  it('keeps the first character and the full domain', () => {
    expect(maskEmail('rebecca@savantmedia.se')).toBe('r••••••@savantmedia.se')
  })

  it('never leaks the rest of the local part', () => {
    const masked = maskEmail('rebecca@savantmedia.se')
    expect(masked).not.toContain('ebecca')
    expect(masked).not.toContain('rebecca')
  })

  it('keeps the domain visible so the recipient can pick the right account', () => {
    expect(maskEmail('lorenzo@savantmedia.se')).toContain('@savantmedia.se')
  })

  it('does not reveal the local-part length beyond a cap', () => {
    // A very long local part must not be measurable from the mask.
    const masked = maskEmail('averyveryverylongaddress@example.com')
    expect(masked).toBe('a••••••••@example.com')
  })

  it('handles a single-character local part', () => {
    expect(maskEmail('a@b.com')).toBe('a•••@b.com')
  })

  it('degrades safely on malformed input rather than echoing it', () => {
    expect(maskEmail('nodomain')).toBe('•••')
    expect(maskEmail('')).toBe('•••')
    expect(maskEmail('@nolocal.com')).toBe('•••')
  })
})
