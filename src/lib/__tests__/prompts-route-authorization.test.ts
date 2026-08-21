import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Route-level authorization tests for /api/prompts.
 *
 * The static guards in brand-scoped-reads.test.ts prove no route filters by the
 * caller's own id. They cannot prove the opposite — that a collaborator
 * actually RECEIVES a colleague's rows, that a viewer is actually refused a
 * write, or that a stranger gets 404 rather than 403. That needs the handler to
 * run.
 *
 * So the mock below is a small in-memory PostgREST rather than a lookup table
 * of canned answers: it really applies eq / in / not-in against rows, and the
 * REAL authorize.ts runs on top of it. A mock that just returns what the test
 * expects would agree with a broken implementation.
 *
 * The scenario mirrors production on 2026-08-04: brand Relovie owned by one
 * account, 13 prompts all authored by that owner, and a second account holding
 * an accepted editor membership. Under author-scoped reads the collaborator saw
 * 0 of the 13.
 */

// Real UUIDs: the POST schema validates brand_id as a uuid, so placeholder
// strings would be rejected at validation and never reach the gate under test.
const OWNER = '00000000-0000-4000-8000-000000000001'
const EDITOR = '00000000-0000-4000-8000-000000000002'
const VIEWER = '00000000-0000-4000-8000-000000000003'
const STRANGER = '00000000-0000-4000-8000-000000000004'
const INVITED = '00000000-0000-4000-8000-000000000005'
const BRAND = '00000000-0000-4000-8000-0000000000b1'
const OTHER_BRAND = '00000000-0000-4000-8000-0000000000b2'

interface Row {
  [k: string]: unknown
}

let tables: Record<string, Row[]> = {}

function parseInList(raw: string): string[] {
  // PostgREST literal list: ("pending","declined")
  return raw
    .replace(/^\(|\)$/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^"|"$/g, ''))
}

function makeQuery(table: string) {
  let rows = () => [...(tables[table] ?? [])]
  const filters: Array<(r: Row) => boolean> = []
  let limitN: number | null = null

  const apply = () => {
    let out = rows().filter((r) => filters.every((f) => f(r)))
    if (limitN !== null) out = out.slice(0, limitN)
    return out
  }

  const chain: any = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      filters.push((r) => String(r[col]) === String(val))
      return chain
    },
    in: (col: string, vals: unknown[]) => {
      const set = new Set(vals.map(String))
      filters.push((r) => set.has(String(r[col])))
      return chain
    },
    not: (col: string, op: string, list: string) => {
      if (op !== 'in') throw new Error(`unsupported not(${op})`)
      const excluded = new Set(parseInList(list))
      filters.push((r) => !excluded.has(String(r[col])))
      return chain
    },
    order: () => chain,
    range: (from: number, to: number) => {
      const prev = rows
      rows = () => prev().slice(from, to + 1)
      return chain
    },
    limit: (n: number) => {
      limitN = n
      return chain
    },
    single: async () => {
      const out = apply()
      return out.length === 1
        ? { data: out[0], error: null, count: out.length }
        : { data: null, error: { message: 'no rows' }, count: 0 }
    },
    maybeSingle: async () => {
      const out = apply()
      return { data: out[0] ?? null, error: null, count: out.length }
    },
    delete: () => chain,
    insert: (row: Row | Row[]) => {
      const added = (Array.isArray(row) ? row : [row]).map((r, i) => ({
        id: `inserted-${(tables[table] ?? []).length + i}`,
        ...r,
      }))
      tables[table] = [...(tables[table] ?? []), ...added]
      // Reads after an insert see the inserted rows, exactly like the real
      // client's `.insert().select().single()`.
      rows = () => added
      return chain
    },
    upsert: (row: Row | Row[]) => chain.insert(row),
    then: (resolve: (v: unknown) => unknown) => {
      const out = apply()
      return Promise.resolve({ data: out, error: null, count: out.length }).then(resolve)
    },
  }
  return chain
}

const fakeDb = { from: (t: string) => makeQuery(t) }

let currentUser = OWNER

vi.mock('@/lib/supabase', () => ({
  createServerClient: () => fakeDb,
  getCurrentUserId: async () => currentUser,
  AuthError: class AuthError extends Error {},
}))

vi.mock('@/lib/ratelimit', () => ({
  checkRateLimit: async () => ({ success: true, remaining: 99, resetAt: Date.now() + 60_000 }),
  getClientIp: () => '127.0.0.1',
}))

vi.mock('@/lib/services/semantic', () => ({
  embedText: async () => null,
  mostSimilar: () => null,
  NEAR_DUPLICATE_THRESHOLD: 0.9,
}))

import { GET, POST } from '@/app/api/prompts/route'

function req(url: string, init?: RequestInit) {
  return new Request(url, init) as never
}

beforeEach(() => {
  currentUser = OWNER
  tables = {
    brands: [
      { id: BRAND, user_id: OWNER, name: 'Relovie', slug: 'relovie', color: '#fff' },
      { id: OTHER_BRAND, user_id: STRANGER, name: 'Other', slug: 'other', color: '#000' },
    ],
    team_members: [
      { brand_id: BRAND, user_id: EDITOR, role: 'editor', status: 'accepted' },
      { brand_id: BRAND, user_id: VIEWER, role: 'viewer', status: 'accepted' },
    ],
    // Every prompt authored by the OWNER — the production shape.
    prompts: Array.from({ length: 13 }, (_, i) => ({
      id: `p${i}`,
      brand_id: BRAND,
      user_id: OWNER,
      text: `prompt ${i}`,
    })),
  }
})

describe('GET /api/prompts — reads are scoped by brand', () => {
  it('gives an editor all 13 prompts a colleague wrote', async () => {
    currentUser = EDITOR
    const res = await GET(req('http://x/api/prompts?limit=100'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(13)
  })

  it('gives a viewer the same 13 — reading is not gated on writing', async () => {
    currentUser = VIEWER
    const res = await GET(req('http://x/api/prompts?limit=100'))
    expect((await res.json()).data).toHaveLength(13)
  })

  it('still gives the owner their own prompts', async () => {
    currentUser = OWNER
    const res = await GET(req('http://x/api/prompts?limit=100'))
    expect((await res.json()).data).toHaveLength(13)
  })

  it('gives a stranger nothing at all', async () => {
    currentUser = STRANGER
    const res = await GET(req('http://x/api/prompts?limit=100'))
    expect((await res.json()).data).toHaveLength(0)
  })

  it('refuses an explicit brand_id the caller cannot reach, rather than widening', async () => {
    currentUser = EDITOR
    const res = await GET(req(`http://x/api/prompts?brand_id=${OTHER_BRAND}`))
    expect(res.status).toBe(404)
  })

  it('does not leak another brand’s prompts into an unfiltered list', async () => {
    tables.prompts!.push({
      id: 'foreign',
      brand_id: OTHER_BRAND,
      user_id: STRANGER,
      text: 'not yours',
    })
    currentUser = EDITOR
    const res = await GET(req('http://x/api/prompts?limit=100'))
    const body = await res.json()
    expect(body.data).toHaveLength(13)
    expect(body.data.map((p: { id: string }) => p.id)).not.toContain('foreign')
  })
})

describe('POST /api/prompts — writes are gated on role', () => {
  const valid = (brandId: string) => ({
    method: 'POST',
    // 'category' is required since C4 — the body has to be valid for the
    // request to reach the authorization check these tests are about.
    body: JSON.stringify({
      brand_id: brandId,
      text: 'a new prompt for the brand',
      category: 'custom',
    }),
    headers: { 'content-type': 'application/json' },
  })

  it('lets an editor create', async () => {
    currentUser = EDITOR
    const res = await POST(req('http://x/api/prompts', valid(BRAND)))
    expect(res.status).not.toBe(403)
    expect(res.status).not.toBe(404)
  })

  it('refuses a viewer with 403, naming the required role', async () => {
    currentUser = VIEWER
    const res = await POST(req('http://x/api/prompts', valid(BRAND)))
    expect(res.status).toBe(403)
    expect((await res.json()).message).toMatch(/editor/i)
  })

  it('answers a stranger with 404, so the brand’s existence stays hidden', async () => {
    currentUser = STRANGER
    const res = await POST(req('http://x/api/prompts', valid(BRAND)))
    expect(res.status).toBe(404)
  })

  it('refuses an editor of one brand writing into another', async () => {
    currentUser = EDITOR
    const res = await POST(req('http://x/api/prompts', valid(OTHER_BRAND)))
    expect(res.status).toBe(404)
  })

  it('refuses a member whose invitation is still pending', async () => {
    tables.team_members!.push({
      brand_id: BRAND,
      user_id: INVITED,
      role: 'editor',
      status: 'pending',
    })
    currentUser = INVITED
    const res = await POST(req('http://x/api/prompts', valid(BRAND)))
    expect(res.status).toBe(404)
  })
})
