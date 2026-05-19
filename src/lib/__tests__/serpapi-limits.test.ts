import { describe, it, expect, afterEach } from 'vitest'
import { getPerKeyLimits } from '../services/serpapi'

const ORIGINAL = process.env.SERPAPI_MONTHLY_LIMIT

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.SERPAPI_MONTHLY_LIMIT
  else process.env.SERPAPI_MONTHLY_LIMIT = ORIGINAL
})

describe('getPerKeyLimits', () => {
  it('returns [] for zero keys', () => {
    expect(getPerKeyLimits(0)).toEqual([])
    expect(getPerKeyLimits(-1)).toEqual([])
  })

  it('defaults to 100 per key when unset', () => {
    delete process.env.SERPAPI_MONTHLY_LIMIT
    expect(getPerKeyLimits(3)).toEqual([100, 100, 100])
  })

  it('applies a single value to every key', () => {
    process.env.SERPAPI_MONTHLY_LIMIT = '250'
    expect(getPerKeyLimits(2)).toEqual([250, 250])
  })

  it('aligns a per-key list by index (the 250,250,1000 plan)', () => {
    process.env.SERPAPI_MONTHLY_LIMIT = '250,250,1000'
    expect(getPerKeyLimits(3)).toEqual([250, 250, 1000])
  })

  it('carries the last value forward when the list is shorter than keys', () => {
    process.env.SERPAPI_MONTHLY_LIMIT = '250,1000'
    expect(getPerKeyLimits(4)).toEqual([250, 1000, 1000, 1000])
  })

  it('ignores extra list entries beyond the key count', () => {
    process.env.SERPAPI_MONTHLY_LIMIT = '250,250,1000,9999'
    expect(getPerKeyLimits(3)).toEqual([250, 250, 1000])
  })

  it('falls back through invalid/blank tokens to the carried value', () => {
    process.env.SERPAPI_MONTHLY_LIMIT = '250,abc,,1000'
    // token0=250 (carry=250), token1 invalid → 250, token2 blank → 250, token3=1000
    expect(getPerKeyLimits(4)).toEqual([250, 250, 250, 1000])
  })

  it('uses default when the first token is invalid', () => {
    process.env.SERPAPI_MONTHLY_LIMIT = 'oops,250'
    expect(getPerKeyLimits(2)).toEqual([100, 250])
  })

  it('rejects zero/negative values, falling back to default/carry', () => {
    process.env.SERPAPI_MONTHLY_LIMIT = '0,-5,250'
    expect(getPerKeyLimits(3)).toEqual([100, 100, 250])
  })

  it('tolerates whitespace around tokens', () => {
    process.env.SERPAPI_MONTHLY_LIMIT = ' 250 , 1000 '
    expect(getPerKeyLimits(2)).toEqual([250, 1000])
  })
})
