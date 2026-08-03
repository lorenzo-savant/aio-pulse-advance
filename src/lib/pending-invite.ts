// PATH: src/lib/pending-invite.ts
//
// Carries an invitation token across the sign-in / sign-up detour.
//
// /team/accept bounces an unauthenticated invitee to the auth pages, so the
// token has to survive that round-trip. It used to live in sessionStorage,
// which breaks the case that matters most: an invitee with NO account yet.
// Their path is register → confirm email → sign in, and the confirmation link
// opens a NEW TAB. sessionStorage is per-tab, so the token was gone and they
// landed on the dashboard with the invitation still pending — no error, no
// hint, just silently not a member.
//
// localStorage is per-origin, so it survives the new tab and a browser
// restart. Entries carry a timestamp and expire on read: a token must not
// linger indefinitely on a shared machine, and an invitation that outlives
// its own 7-day validity is useless anyway.
//
// Still bounded by the browser: confirming the email on a different device
// cannot work by this route. That case needs the invite link itself, which
// is why the email is the durable copy.

const KEY = 'pending_invite_token'
const LEGACY_KEY = 'pending_invite_token' // sessionStorage, pre-localStorage
const TTL_MS = 7 * 24 * 60 * 60 * 1000 // matches invitation expiry

interface StoredInvite {
  token: string
  savedAt: number
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/** Stash a token before bouncing the invitee to sign in / sign up. */
export function savePendingInvite(token: string): void {
  if (!canUseStorage() || !token) return
  try {
    const payload: StoredInvite = { token, savedAt: Date.now() }
    window.localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // Private mode / quota — the invite link in the email still works.
  }
}

/**
 * Read and CONSUME the stashed token. Returns null when absent or expired.
 * Consuming on read keeps a single-use token from being replayed on the next
 * unrelated sign-in.
 */
export function takePendingInvite(): string | null {
  if (!canUseStorage()) return null

  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(KEY)
    window.localStorage.removeItem(KEY)
  } catch {
    return null
  }

  // Back-compat: a token stashed by the previous sessionStorage build.
  if (!raw) {
    try {
      const legacy = window.sessionStorage.getItem(LEGACY_KEY)
      if (legacy) {
        window.sessionStorage.removeItem(LEGACY_KEY)
        return legacy
      }
    } catch {
      /* ignore */
    }
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredInvite>
    if (typeof parsed?.token !== 'string' || !parsed.token) return null
    if (typeof parsed.savedAt !== 'number') return null
    if (Date.now() - parsed.savedAt > TTL_MS) return null
    return parsed.token
  } catch {
    // A raw string from an older build that wrote localStorage directly.
    return raw || null
  }
}

/** Where to send the user once they are authenticated. */
export function pendingInviteDestination(): string | null {
  const token = takePendingInvite()
  return token ? `/team/accept?token=${encodeURIComponent(token)}` : null
}
