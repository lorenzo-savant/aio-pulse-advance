import { describe, it, expect, afterEach, vi } from 'vitest'

// Mock createServerClient before importing the SUT — the module reads it at
// call time, not at import, so the mock just needs to be in place before the
// first invocation. We return null to exercise the "no DB" fast paths
// without needing a Supabase test fixture.
vi.mock('@/lib/supabase', () => ({
  createServerClient: () => null,
}))

import {
  getDataforseoQuota,
  assertCapAvailable,
  DataforseoCapExceeded,
} from '../services/dataforseo-quota'

const ORIGINAL_CAP = process.env.DATAFORSEO_MONTHLY_CAP_CENTS

afterEach(() => {
  if (ORIGINAL_CAP === undefined) delete process.env.DATAFORSEO_MONTHLY_CAP_CENTS
  else process.env.DATAFORSEO_MONTHLY_CAP_CENTS = ORIGINAL_CAP
})

describe('DataForSEO quota helper', () => {
  it('returns default $20 cap when DB is unavailable', async () => {
    delete process.env.DATAFORSEO_MONTHLY_CAP_CENTS
    const q = await getDataforseoQuota()
    expect(q.count).toBe(0)
    expect(q.costCents).toBe(0)
    expect(q.capCents).toBe(2000) // $20 in cents
    expect(q.remainingCents).toBe(2000)
    expect(q.utilization).toBe(0)
  })

  it('honors DATAFORSEO_MONTHLY_CAP_CENTS override', async () => {
    process.env.DATAFORSEO_MONTHLY_CAP_CENTS = '3000' // $30
    const q = await getDataforseoQuota()
    expect(q.capCents).toBe(3000)
    expect(q.remainingCents).toBe(3000)
  })

  it('rejects invalid cap env values, falls back to default', async () => {
    process.env.DATAFORSEO_MONTHLY_CAP_CENTS = 'not-a-number'
    const q = await getDataforseoQuota()
    expect(q.capCents).toBe(2000)
  })

  it('rejects zero/negative cap', async () => {
    process.env.DATAFORSEO_MONTHLY_CAP_CENTS = '0'
    const q = await getDataforseoQuota()
    expect(q.capCents).toBe(2000)
  })

  it('assertCapAvailable is a no-op for zero estimated cost', async () => {
    await expect(assertCapAvailable(0)).resolves.toBeUndefined()
  })

  it('assertCapAvailable passes when budget remains (DB-less = 0 used)', async () => {
    delete process.env.DATAFORSEO_MONTHLY_CAP_CENTS
    await expect(assertCapAvailable(100)).resolves.toBeUndefined()
  })

  it('DataforseoCapExceeded is a typed error class', () => {
    const e = new DataforseoCapExceeded('test')
    expect(e).toBeInstanceOf(Error)
    expect(e.name).toBe('DataforseoCapExceeded')
    expect(e.message).toBe('test')
  })
})
