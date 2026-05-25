import { describe, it, expect, afterEach } from 'vitest'
import {
  getPerKeyLimits,
  getPerKeyLimitsForPool,
  getKeysForPool,
  isBraveSearchAvailable,
  isBraveAnswerAvailable,
} from '../services/brave-search'

const ENV_VARS = [
  'BRAVE_MONTHLY_LIMIT',
  'BRAVE_SEARCH_MONTHLY_LIMIT',
  'BRAVE_ANSWER_MONTHLY_LIMIT',
  'BRAVE_API_KEY',
  'BRAVE_API_KEYS',
  'BRAVE_SEARCH_API_KEY',
  'BRAVE_SEARCH_API_KEYS',
  'BRAVE_ANSWER_API_KEY',
  'BRAVE_ANSWER_API_KEYS',
] as const

const snapshot = Object.fromEntries(ENV_VARS.map((k) => [k, process.env[k]])) as Record<
  (typeof ENV_VARS)[number],
  string | undefined
>

afterEach(() => {
  for (const k of ENV_VARS) {
    if (snapshot[k] === undefined) delete process.env[k]
    else process.env[k] = snapshot[k]
  }
})

describe('Brave Search — getPerKeyLimits (legacy, search-pool default)', () => {
  it('returns [] for zero keys', () => {
    expect(getPerKeyLimits(0)).toEqual([])
    expect(getPerKeyLimits(-1)).toEqual([])
  })

  it('defaults to 2000/key (free tier) when env is unset', () => {
    delete process.env.BRAVE_MONTHLY_LIMIT
    delete process.env.BRAVE_SEARCH_MONTHLY_LIMIT
    expect(getPerKeyLimits(2)).toEqual([2000, 2000])
  })

  it('applies a single value to every key', () => {
    delete process.env.BRAVE_SEARCH_MONTHLY_LIMIT
    process.env.BRAVE_MONTHLY_LIMIT = '5000'
    expect(getPerKeyLimits(3)).toEqual([5000, 5000, 5000])
  })

  it('aligns per-key list by index (free + paid mix)', () => {
    delete process.env.BRAVE_SEARCH_MONTHLY_LIMIT
    process.env.BRAVE_MONTHLY_LIMIT = '2000,10000'
    expect(getPerKeyLimits(2)).toEqual([2000, 10000])
  })

  it('carries last value forward when list is shorter than keys', () => {
    delete process.env.BRAVE_SEARCH_MONTHLY_LIMIT
    process.env.BRAVE_MONTHLY_LIMIT = '2000,10000'
    expect(getPerKeyLimits(4)).toEqual([2000, 10000, 10000, 10000])
  })

  it('falls back through invalid/blank tokens', () => {
    delete process.env.BRAVE_SEARCH_MONTHLY_LIMIT
    process.env.BRAVE_MONTHLY_LIMIT = '2000,abc,,10000'
    expect(getPerKeyLimits(4)).toEqual([2000, 2000, 2000, 10000])
  })

  it('rejects zero/negative values, falls back to default/carry', () => {
    delete process.env.BRAVE_SEARCH_MONTHLY_LIMIT
    process.env.BRAVE_MONTHLY_LIMIT = '0,-100,5000'
    expect(getPerKeyLimits(3)).toEqual([2000, 2000, 5000])
  })

  it('tolerates whitespace around tokens', () => {
    delete process.env.BRAVE_SEARCH_MONTHLY_LIMIT
    process.env.BRAVE_MONTHLY_LIMIT = ' 2000 , 10000 '
    expect(getPerKeyLimits(2)).toEqual([2000, 10000])
  })
})

describe('Brave Search — pool-aware limits', () => {
  it('pool-specific override wins over legacy BRAVE_MONTHLY_LIMIT', () => {
    process.env.BRAVE_MONTHLY_LIMIT = '5000'
    process.env.BRAVE_SEARCH_MONTHLY_LIMIT = '8000'
    process.env.BRAVE_ANSWER_MONTHLY_LIMIT = '3000'
    expect(getPerKeyLimitsForPool('search', 2)).toEqual([8000, 8000])
    expect(getPerKeyLimitsForPool('answer', 2)).toEqual([3000, 3000])
  })

  it('legacy var serves both pools when pool-specific vars are unset', () => {
    delete process.env.BRAVE_SEARCH_MONTHLY_LIMIT
    delete process.env.BRAVE_ANSWER_MONTHLY_LIMIT
    process.env.BRAVE_MONTHLY_LIMIT = '4000'
    expect(getPerKeyLimitsForPool('search', 1)).toEqual([4000])
    expect(getPerKeyLimitsForPool('answer', 1)).toEqual([4000])
  })
})

describe('Brave Search — key pool resolution', () => {
  it('search pool reads from BRAVE_SEARCH_API_KEY first', () => {
    process.env.BRAVE_SEARCH_API_KEY = 'search-k1'
    process.env.BRAVE_ANSWER_API_KEY = 'answer-k1'
    process.env.BRAVE_API_KEYS = 'legacy-k1'
    expect(getKeysForPool('search')).toEqual(['search-k1'])
    expect(getKeysForPool('answer')).toEqual(['answer-k1'])
  })

  it('comma-separated multi-key list works for either pool', () => {
    process.env.BRAVE_SEARCH_API_KEYS = 'a,b,c'
    delete process.env.BRAVE_SEARCH_API_KEY
    expect(getKeysForPool('search')).toEqual(['a', 'b', 'c'])
  })

  it('falls back to legacy BRAVE_API_KEYS when pool var is unset (both pools share)', () => {
    delete process.env.BRAVE_SEARCH_API_KEY
    delete process.env.BRAVE_SEARCH_API_KEYS
    delete process.env.BRAVE_ANSWER_API_KEY
    delete process.env.BRAVE_ANSWER_API_KEYS
    process.env.BRAVE_API_KEYS = 'legacy-shared'
    expect(getKeysForPool('search')).toEqual(['legacy-shared'])
    expect(getKeysForPool('answer')).toEqual(['legacy-shared'])
  })

  it('returns empty list when no key is configured anywhere', () => {
    for (const k of [
      'BRAVE_API_KEY',
      'BRAVE_API_KEYS',
      'BRAVE_SEARCH_API_KEY',
      'BRAVE_SEARCH_API_KEYS',
      'BRAVE_ANSWER_API_KEY',
      'BRAVE_ANSWER_API_KEYS',
    ])
      delete process.env[k]
    expect(getKeysForPool('search')).toEqual([])
    expect(getKeysForPool('answer')).toEqual([])
    expect(isBraveSearchAvailable()).toBe(false)
    expect(isBraveAnswerAvailable()).toBe(false)
  })

  it('availability flags reflect pool-level configuration', () => {
    for (const k of [
      'BRAVE_API_KEY',
      'BRAVE_API_KEYS',
      'BRAVE_SEARCH_API_KEY',
      'BRAVE_SEARCH_API_KEYS',
      'BRAVE_ANSWER_API_KEY',
      'BRAVE_ANSWER_API_KEYS',
    ])
      delete process.env[k]
    process.env.BRAVE_SEARCH_API_KEY = 'only-search'
    expect(isBraveSearchAvailable()).toBe(true)
    expect(isBraveAnswerAvailable()).toBe(false)
  })
})
