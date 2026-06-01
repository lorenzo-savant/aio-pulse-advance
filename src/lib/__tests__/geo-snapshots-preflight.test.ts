import { describe, it, expect, vi } from 'vitest'
import { geoSnapshotsTableExists } from '@/lib/services/geo-score-precompute'

// Minimal fake of the Supabase query builder chain used by the preflight:
//   db.from(...).select(..., { head: true }).limit(1) → { error }
function fakeDb(error: { code?: string; message?: string } | null) {
  const builder = {
    select: () => builder,
    limit: () => Promise.resolve({ error }),
  }
  return { from: () => builder } as never
}

describe('geoSnapshotsTableExists', () => {
  it('returns true when the table responds with no error', async () => {
    expect(await geoSnapshotsTableExists(fakeDb(null))).toBe(true)
  })

  it('returns false on Postgres 42P01 (undefined_table)', async () => {
    expect(await geoSnapshotsTableExists(fakeDb({ code: '42P01' }))).toBe(false)
  })

  it('returns false on PostgREST PGRST205', async () => {
    expect(await geoSnapshotsTableExists(fakeDb({ code: 'PGRST205' }))).toBe(false)
  })

  it('returns false when the error message names the missing relation', async () => {
    expect(
      await geoSnapshotsTableExists(
        fakeDb({ message: 'relation "public.geo_score_snapshots" does not exist' }),
      ),
    ).toBe(false)
  })

  it('returns true on an unknown error (do not silently skip the run)', async () => {
    // e.g. a transient/permission error — assume present so the normal path
    // surfaces the real failure instead of masking it as "migration pending".
    expect(
      await geoSnapshotsTableExists(fakeDb({ code: '08006', message: 'connection error' })),
    ).toBe(true)
  })
})
