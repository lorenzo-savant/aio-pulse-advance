import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Ownership guard for AI conversation access (H1 from the 2026-08-05 review).
 *
 * getOwnedConversation exists because the AI memory layer runs on the
 * service-role client, which bypasses RLS — so a caller who supplies another
 * user's conversation UUID could read their message history into the LLM
 * context and append attacker-authored messages. The guard must prove the
 * conversation belongs to the caller (and, when a brand is supplied, to that
 * brand) before any read/write is allowed.
 */

const OWNER = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const BRAND = '00000000-0000-4000-8000-0000000000b1'
const OTHER_BRAND = '00000000-0000-4000-8000-0000000000b2'
const CONV_ID = '00000000-0000-4000-8000-0000000000c1'

type Row = Record<string, unknown>

// Query results keyed by `table::field=value` for deterministic chaining. Only
// the `ai_conversations` table is genuinely used by the guard's dependency
// (`getConversation` also fetches messages, but ownership is decided from the
// conversation row alone, so messages can fall back to empty).
let queryResults: Record<string, { data: unknown; error: unknown }> = {}

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

import { getOwnedConversation } from '@/lib/agents/agent-memory'

beforeEach(() => {
  vi.clearAllMocks()
  const conv: Row = {
    id: CONV_ID,
    user_id: OWNER,
    brand_id: BRAND,
  }
  queryResults = {
    [resultKey('ai_conversations', 'id', CONV_ID)]: { data: conv, error: null },
  }
})

describe('getOwnedConversation', () => {
  it('returns the conversation to the owner', async () => {
    const conv = await getOwnedConversation(CONV_ID, OWNER)
    expect(conv).not.toBeNull()
  })

  it('returns null to a user who does not own the conversation', async () => {
    const conv = await getOwnedConversation(CONV_ID, OTHER)
    expect(conv).toBeNull()
  })

  it('returns null when the brand does not match even for the owner', async () => {
    const conv = await getOwnedConversation(CONV_ID, OWNER, OTHER_BRAND)
    expect(conv).toBeNull()
  })

  it('returns the conversation to the owner when the brand matches', async () => {
    const conv = await getOwnedConversation(CONV_ID, OWNER, BRAND)
    expect(conv).not.toBeNull()
  })

  it('returns null for a missing conversation', async () => {
    const conv = await getOwnedConversation('00000000-0000-4000-8000-000000000099', OWNER)
    expect(conv).toBeNull()
  })
})
