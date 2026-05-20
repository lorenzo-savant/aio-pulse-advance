import { describe, it, expect, afterEach } from 'vitest'
import { getPerKeyLimits } from '../services/brave-search'

const ORIGINAL = process.env.BRAVE_MONTHLY_LIMIT

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.BRAVE_MONTHLY_LIMIT
  else process.env.BRAVE_MONTHLY_LIMIT = ORIGINAL
})

describe('Brave Search — getPerKeyLimits', () => {
  it('returns [] for zero keys', () => {
    expect(getPerKeyLimits(0)).toEqual([])
    expect(getPerKeyLimits(-1)).toEqual([])
  })

  it('defaults to 2000/key (free tier) when env is unset', () => {
    delete process.env.BRAVE_MONTHLY_LIMIT
    expect(getPerKeyLimits(2)).toEqual([2000, 2000])
  })

  it('applies a single value to every key', () => {
    process.env.BRAVE_MONTHLY_LIMIT = '5000'
    expect(getPerKeyLimits(3)).toEqual([5000, 5000, 5000])
  })

  it('aligns per-key list by index (free + paid mix)', () => {
    process.env.BRAVE_MONTHLY_LIMIT = '2000,10000'
    expect(getPerKeyLimits(2)).toEqual([2000, 10000])
  })

  it('carries last value forward when list is shorter than keys', () => {
    process.env.BRAVE_MONTHLY_LIMIT = '2000,10000'
    expect(getPerKeyLimits(4)).toEqual([2000, 10000, 10000, 10000])
  })

  it('falls back through invalid/blank tokens', () => {
    process.env.BRAVE_MONTHLY_LIMIT = '2000,abc,,10000'
    expect(getPerKeyLimits(4)).toEqual([2000, 2000, 2000, 10000])
  })

  it('rejects zero/negative values, falls back to default/carry', () => {
    process.env.BRAVE_MONTHLY_LIMIT = '0,-100,5000'
    expect(getPerKeyLimits(3)).toEqual([2000, 2000, 5000])
  })

  it('tolerates whitespace around tokens', () => {
    process.env.BRAVE_MONTHLY_LIMIT = ' 2000 , 10000 '
    expect(getPerKeyLimits(2)).toEqual([2000, 10000])
  })
})
