// PATH: src/lib/platform-mode.ts
//
// Which mode is this process running in? Chosen before the process starts and
// constant for its lifetime.
//
//   metered    — the real thing. Every paid query goes through the credit ledger.
//   unlimited  — development. Credit checks are bypassed at zero cost.
//
// Why this module exists: the choice used to be expressible only as a pair of
// negatively-named booleans (AIO_UNLIMITED_CREDITS plus an acknowledgement),
// which reads as an escape hatch rather than as "which mode am I in". One
// front door, one spelling, one place to delete when the unlimited mode is
// retired.

import { logger } from '@/lib/logger'

export type PlatformMode = 'metered' | 'unlimited'

export const PLATFORM_MODES = ['metered', 'unlimited'] as const

/** Vercel sets VERCEL_ENV; NODE_ENV covers a self-hosted production build. */
function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production' || process.env['VERCEL_ENV'] === 'production'
}

/**
 * The mode this process is running in.
 *
 * Reads the environment on every call rather than caching, so tests and
 * serverless cold starts always see the current values — it is a handful of
 * string comparisons, not a hot path.
 */
export function getPlatformMode(): PlatformMode {
  const raw = process.env['AIO_MODE']?.trim().toLowerCase()

  let requested: PlatformMode

  if (raw) {
    if (raw !== 'metered' && raw !== 'unlimited') {
      // Fail safe, but never silently: a typo must not become a billing
      // bypass, and must not be invisible either.
      logger.warn(`AIO_MODE="${raw}" is not a valid mode — falling back to "metered".`, {
        source: 'platform-mode',
        valid: PLATFORM_MODES.join(' | '),
      })
      return 'metered'
    }
    requested = raw
  } else {
    // Back-compat: the original flag still works when AIO_MODE is unset.
    requested = process.env['AIO_UNLIMITED_CREDITS'] === 'true' ? 'unlimited' : 'metered'
  }

  if (requested === 'metered') return 'metered'

  // The production lock is the point of the design: copying a development env
  // file onto production must not hand out unmetered spend on paid LLM keys.
  if (
    isProductionEnvironment() &&
    process.env['AIO_UNLIMITED_CREDITS_ALLOW_PRODUCTION'] !== 'true'
  ) {
    logger.error(
      'Unlimited mode was requested in a PRODUCTION environment and was IGNORED. ' +
        'Set AIO_UNLIMITED_CREDITS_ALLOW_PRODUCTION=true to acknowledge unmetered spend, ' +
        'or set AIO_MODE=metered.',
      { source: 'platform-mode' },
    )
    return 'metered'
  }

  return 'unlimited'
}
