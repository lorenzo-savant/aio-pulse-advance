import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Access guard for AI conversation reads (H1 from the 2026-08-05 review).
 *
 * getAccessibleConversation exists because the AI memory layer runs on the
 * service-role client, which bypasses RLS — so a caller who supplies another
 * user's conversation UUID could read their message history into the LLM
 * context and append attacker-authored messages.
 *
 * The rule depends on whether the conversation is attached to a brand:
 *
 *  - with a brand, access follows brand membership, because brand data is
 *    shared with the team and a conversation about a brand is brand data;
 *  - without a brand there is nothing to share it inside, so it stays with its
 *    author — this is the case where the guard is the only protection left, and
 *    where H1 must hold exactly as originally written.
 *
 * A conversation belonging to another brand is refused even to its author, so
 * an id cannot be used to hop between brands.
 */

const OWNER = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const BRAND = '00000000-0000-4000-8000-0000000000b1'
const OTHER_BRAND = '00000000-0000-4000-8000-0000000000b2'
const CONV_ID = '00000000-0000-4000-8000-0000000000c1'
const SOLO_CONV_ID = '00000000-0000-4000-8000-0000000000c2'
const MISSING_CONV_ID = '00000000-0000-4000-8000-000000000099'

type Row = Record<string, unknown>

// Query results keyed by `table::field=value` for deterministic chaining. Only
// the `ai_conversations` table is genuinely used by the guard's dependency
// (`getConversation` also fetches messages, but access is decided from the
// conversation row alone, so messages can fall back to empty).
let queryResults: Record<string, { data: unknown; error: unknown }> = {}

/** Brand ids the mocked caller is a member of, per test. */
let memberOfBrands: string[] = []

function resultKey(table: string, field: string, value: string): string {
  return `${table}::${field}=${value}`
}

function buildChain(table: string) {
  const filters: Record<string, string> = {}
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: (field: string, value: string) => {
      filters[field] = String(value)
      return chain
    },
    single: () => resolve(table, filters),
    order: () => chain,
    limit: () => chain,
  }
  return chain
}

function resolve(table: string, filters: Record<string, string>) {
  const field = Object.keys(filters)[0]
  const value = field ? filters[field] : undefined
  if (field && value !== undefined) {
    const key = resultKey(table, field, value)
    if (queryResults[key]) return queryResults[key]
  }
  return { data: null, error: null }
}

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn((table: string) => buildChain(table)),
  })),
}))

vi.mock('@/lib/authorize', () => ({
  verifyBrandAccess: vi.fn(async (brandId: string) =>
    memberOfBrands.includes(brandId) ? { id: brandId } : null,
  ),
}))

import { getAccessibleConversation } from '@/lib/agents/agent-memory'

beforeEach(() => {
  vi.clearAllMocks()
  memberOfBrands = [BRAND]
  queryResults = {
    [resultKey('ai_conversations', 'id', CONV_ID)]: {
      data: { id: CONV_ID, user_id: OWNER, brand_id: BRAND } satisfies Row,
      error: null,
    },
    // Same author, no brand attached — the guard's fallback case.
    [resultKey('ai_conversations', 'id', SOLO_CONV_ID)]: {
      data: { id: SOLO_CONV_ID, user_id: OWNER, brand_id: null } satisfies Row,
      error: null,
    },
  }
})

describe('getAccessibleConversation', () => {
  describe('conversation attached to a brand', () => {
    it('returns it to the author', async () => {
      expect(await getAccessibleConversation(CONV_ID, OWNER)).not.toBeNull()
    })

    it('returns it to a teammate who is not the author', async () => {
      expect(await getAccessibleConversation(CONV_ID, OTHER)).not.toBeNull()
    })

    it('returns null to someone with no access to that brand', async () => {
      memberOfBrands = []
      expect(await getAccessibleConversation(CONV_ID, OTHER)).toBeNull()
    })

    it('returns null when a different brand is named, even to the author', async () => {
      memberOfBrands = [BRAND, OTHER_BRAND]
      expect(await getAccessibleConversation(CONV_ID, OWNER, OTHER_BRAND)).toBeNull()
    })

    it('returns it when the named brand matches', async () => {
      expect(await getAccessibleConversation(CONV_ID, OWNER, BRAND)).not.toBeNull()
    })
  })

  describe('conversation with no brand', () => {
    it('returns it to its author', async () => {
      expect(await getAccessibleConversation(SOLO_CONV_ID, OWNER)).not.toBeNull()
    })

    it('returns null to anyone else, whatever brands they belong to', async () => {
      memberOfBrands = [BRAND, OTHER_BRAND]
      expect(await getAccessibleConversation(SOLO_CONV_ID, OTHER)).toBeNull()
    })
  })

  it('returns null for a missing conversation', async () => {
    expect(await getAccessibleConversation(MISSING_CONV_ID, OWNER)).toBeNull()
  })
})
