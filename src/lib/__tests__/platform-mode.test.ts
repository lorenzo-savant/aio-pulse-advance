import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * The platform runs in one of two modes, chosen before the process starts.
 *
 *   metered    — the real thing. Every paid query goes through the credit ledger.
 *   unlimited  — development. Credit checks are bypassed at zero cost.
 *
 * This is the single front door for that choice. It exists because the state was
 * previously only expressible as a pair of negatively-named booleans
 * (AIO_UNLIMITED_CREDITS + AIO_UNLIMITED_CREDITS_ALLOW_PRODUCTION), which reads
 * as an escape hatch rather than as "which mode am I in".
 *
 * The production lock is the point of the whole design and is asserted hardest:
 * copying a development env file onto production must NEVER silently hand out
 * unmetered spend on paid LLM keys.
 */

const { errorMock, warnMock } = vi.hoisted(() => ({ errorMock: vi.fn(), warnMock: vi.fn() }))

vi.mock('@/lib/logger', () => ({
  logger: { error: errorMock, warn: warnMock, info: vi.fn(), debug: vi.fn() },
}))

const KEYS = [
  'AIO_MODE',
  'AIO_UNLIMITED_CREDITS',
  'AIO_UNLIMITED_CREDITS_ALLOW_PRODUCTION',
  'VERCEL_ENV',
] as const

describe('platform mode', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    for (const k of KEYS) delete process.env[k]
    // vitest sets NODE_ENV=test; be explicit so "not production" is deliberate.
    vi.stubEnv('NODE_ENV', 'test')
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllEnvs()
  })

  const load = async () => (await import('../platform-mode')).getPlatformMode()

  it('defaults to metered when nothing is set', async () => {
    expect(await load()).toBe('metered')
  })

  it('AIO_MODE=unlimited selects unlimited outside production', async () => {
    process.env['AIO_MODE'] = 'unlimited'
    expect(await load()).toBe('unlimited')
  })

  it('AIO_MODE=metered selects metered', async () => {
    process.env['AIO_MODE'] = 'metered'
    expect(await load()).toBe('metered')
  })

  it('an unrecognised AIO_MODE falls back to metered and says so', async () => {
    // Failing safe matters more than failing loudly: a typo must not be a
    // billing bypass, and must not be silent either.
    process.env['AIO_MODE'] = 'unlimted'
    expect(await load()).toBe('metered')
    expect(warnMock).toHaveBeenCalled()
  })

  it('honours the legacy AIO_UNLIMITED_CREDITS flag', async () => {
    process.env['AIO_UNLIMITED_CREDITS'] = 'true'
    expect(await load()).toBe('unlimited')
  })

  it('AIO_MODE wins over the legacy flag', async () => {
    process.env['AIO_MODE'] = 'metered'
    process.env['AIO_UNLIMITED_CREDITS'] = 'true'
    expect(await load()).toBe('metered')
  })

  it('refuses unlimited in production without the explicit acknowledgement', async () => {
    process.env['AIO_MODE'] = 'unlimited'
    vi.stubEnv('NODE_ENV', 'production')
    expect(await load()).toBe('metered')
    expect(errorMock).toHaveBeenCalled()
  })

  it('refuses unlimited when VERCEL_ENV is production', async () => {
    process.env['AIO_MODE'] = 'unlimited'
    process.env['VERCEL_ENV'] = 'production'
    expect(await load()).toBe('metered')
    expect(errorMock).toHaveBeenCalled()
  })

  it('allows unlimited in production only with the acknowledgement', async () => {
    process.env['AIO_MODE'] = 'unlimited'
    process.env['AIO_UNLIMITED_CREDITS_ALLOW_PRODUCTION'] = 'true'
    vi.stubEnv('NODE_ENV', 'production')
    expect(await load()).toBe('unlimited')
  })

  it('the acknowledgement alone never enables unlimited', async () => {
    // It is an acknowledgement, not a switch.
    process.env['AIO_UNLIMITED_CREDITS_ALLOW_PRODUCTION'] = 'true'
    expect(await load()).toBe('metered')
  })
})

describe('credits service delegates to the platform mode', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    for (const k of KEYS) delete process.env[k]
    vi.stubEnv('NODE_ENV', 'test')
  })

  afterEach(() => {
    process.env = originalEnv
    vi.unstubAllEnvs()
  })

  it('isUnlimitedCreditsMode follows AIO_MODE', async () => {
    // The two must never disagree — one source of truth, two spellings.
    process.env['AIO_MODE'] = 'unlimited'
    const { isUnlimitedCreditsMode } = await import('../services/credits')
    expect(isUnlimitedCreditsMode()).toBe(true)
  })

  it('isUnlimitedCreditsMode is false in metered mode', async () => {
    process.env['AIO_MODE'] = 'metered'
    const { isUnlimitedCreditsMode } = await import('../services/credits')
    expect(isUnlimitedCreditsMode()).toBe(false)
  })
})
