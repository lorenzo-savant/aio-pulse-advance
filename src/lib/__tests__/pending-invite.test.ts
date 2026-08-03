import { describe, it, expect, beforeEach } from 'vitest'
import { savePendingInvite, takePendingInvite, pendingInviteDestination } from '../pending-invite'

/**
 * The case this exists for: an invitee with NO account yet. Their path is
 * register → confirm email → sign in, and the confirmation link opens a NEW
 * TAB. sessionStorage is per-tab, so the token used to vanish there and the
 * invitee landed on the dashboard with the invitation still pending — no
 * error shown, simply not a member.
 */
describe('pending-invite', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('round-trips a token', () => {
    savePendingInvite('tok-123')
    expect(takePendingInvite()).toBe('tok-123')
  })

  it('persists in localStorage, so a NEW TAB can still read it', () => {
    savePendingInvite('tok-123')
    // sessionStorage is per-tab; the confirmation link opens a new one.
    expect(window.sessionStorage.getItem('pending_invite_token')).toBeNull()
    expect(window.localStorage.getItem('pending_invite_token')).toBeTruthy()
  })

  it('CONSUMES on read, so a single-use token is not replayed on the next sign-in', () => {
    savePendingInvite('tok-123')
    expect(takePendingInvite()).toBe('tok-123')
    expect(takePendingInvite()).toBeNull()
  })

  it('returns null when nothing was stashed', () => {
    expect(takePendingInvite()).toBeNull()
  })

  it('ignores an empty token rather than stashing a blank', () => {
    savePendingInvite('')
    expect(takePendingInvite()).toBeNull()
  })

  it('expires an entry older than the invitation validity window', () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    window.localStorage.setItem(
      'pending_invite_token',
      JSON.stringify({ token: 'stale', savedAt: eightDaysAgo }),
    )
    expect(takePendingInvite()).toBeNull()
  })

  it('keeps an entry still inside the window', () => {
    const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000
    window.localStorage.setItem(
      'pending_invite_token',
      JSON.stringify({ token: 'fresh', savedAt: sixDaysAgo }),
    )
    expect(takePendingInvite()).toBe('fresh')
  })

  it('clears the entry even when it is expired, so it cannot linger', () => {
    window.localStorage.setItem(
      'pending_invite_token',
      JSON.stringify({ token: 'stale', savedAt: 0 }),
    )
    takePendingInvite()
    expect(window.localStorage.getItem('pending_invite_token')).toBeNull()
  })

  it('falls back to a token stashed by the previous sessionStorage build', () => {
    window.sessionStorage.setItem('pending_invite_token', 'legacy-tok')
    expect(takePendingInvite()).toBe('legacy-tok')
    expect(window.sessionStorage.getItem('pending_invite_token')).toBeNull()
  })

  it('tolerates a malformed entry instead of throwing', () => {
    window.localStorage.setItem('pending_invite_token', '{not json')
    expect(() => takePendingInvite()).not.toThrow()
  })

  it('builds an accept destination with the token URL-encoded', () => {
    savePendingInvite('a b/c')
    expect(pendingInviteDestination()).toBe('/team/accept?token=a%20b%2Fc')
  })

  it('returns no destination when there is no pending invite', () => {
    expect(pendingInviteDestination()).toBeNull()
  })
})
