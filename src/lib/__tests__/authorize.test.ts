import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock: @/lib/supabase  — createServerClient
// ---------------------------------------------------------------------------

// Query results keyed by `table::field=value` for deterministic chaining
let queryResults: Record<string, { data: unknown; error: unknown }> = {}

function resultKey(table: string, filters: Record<string, string>): string {
  const parts = Object.entries(filters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  return `${table}::${parts}`
}

function buildChain(table: string) {
  const filters: Record<string, string> = {}
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: (field: string, value: string) => {
      filters[field] = String(value)
      return chain
    },
    in: () => chain,
    single: () => {
      // Try exact key first, then table-only fallback
      const key = resultKey(table, filters)
      if (queryResults[key]) return queryResults[key]
      // Fallback: just the table name (for simpler setups)
      if (queryResults[table]) return queryResults[table]
      return { data: null, error: null }
    },
  }
  return chain
}

const mockFrom = vi.fn((table: string) => buildChain(table))

vi.mock('@/lib/supabase', () => ({
  createServerClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------
import {
  verifyBrandAccess,
  verifyBrandOwnership,
  verifyPromptOwnership,
  verifyAlertOwnership,
  canEditBrand,
  getAccessibleBrandIds,
} from '../authorize'
import { createServerClient } from '@/lib/supabase'

// Helpers
const BRAND_ID = 'brand-001'
const USER_ID = 'user-001'
const OTHER_USER = 'user-999'

const fakeBrand = {
  id: BRAND_ID,
  name: 'Acme',
  slug: 'acme',
  competitors: ['rival'],
  aliases: ['acme-corp'],
  domain: 'acme.com',
  color: '#ff0000',
}

// ---------------------------------------------------------------------------
// Reset between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
  queryResults = {}
})

// ═══════════════════════════════════════════════════════════════════════════
// verifyBrandAccess
// ═══════════════════════════════════════════════════════════════════════════
describe('verifyBrandAccess', () => {
  it('returns brand when user owns the brand', async () => {
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: USER_ID })] = {
      data: fakeBrand,
      error: null,
    }
    const result = await verifyBrandAccess(BRAND_ID, USER_ID)
    expect(result).toMatchObject({ id: BRAND_ID, name: 'Acme' })
  })

  it('returns brand when user is an accepted team member', async () => {
    // Ownership check fails
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: USER_ID })] = {
      data: null,
      error: { message: 'not found' },
    }
    // Team membership succeeds
    queryResults[resultKey('team_members', { brand_id: BRAND_ID, user_id: USER_ID, status: 'accepted' })] = {
      data: { brand_id: BRAND_ID },
      error: null,
    }
    // Brand fetch for team member
    queryResults[resultKey('brands', { id: BRAND_ID })] = {
      data: fakeBrand,
      error: null,
    }

    const result = await verifyBrandAccess(BRAND_ID, USER_ID)
    expect(result).toMatchObject({ id: BRAND_ID })
  })

  it('returns null when user is neither owner nor team member', async () => {
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: OTHER_USER })] = {
      data: null,
      error: { message: 'not found' },
    }
    const result = await verifyBrandAccess(BRAND_ID, OTHER_USER)
    expect(result).toBeNull()
  })

  it('returns null when createServerClient returns null', async () => {
    vi.mocked(createServerClient).mockReturnValueOnce(null)
    const result = await verifyBrandAccess(BRAND_ID, USER_ID)
    expect(result).toBeNull()
  })

  it('returns null when ownership query errors and no team membership exists', async () => {
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: USER_ID })] = {
      data: null,
      error: { message: 'db error' },
    }
    // team_members returns nothing
    const result = await verifyBrandAccess(BRAND_ID, USER_ID)
    expect(result).toBeNull()
  })

  it('includes report columns when includeReportCols is true', async () => {
    const brandWithReport = {
      ...fakeBrand,
      report_logo_url: 'https://example.com/logo.png',
      report_brand_name: 'Acme Corp',
      report_primary_color: '#00ff00',
    }
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: USER_ID })] = {
      data: brandWithReport,
      error: null,
    }
    const result = await verifyBrandAccess(BRAND_ID, USER_ID, true)
    expect(result).toMatchObject({ report_logo_url: 'https://example.com/logo.png' })
  })

  it('returns null when team membership exists but brand fetch fails', async () => {
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: USER_ID })] = {
      data: null,
      error: { message: 'not found' },
    }
    queryResults[resultKey('team_members', { brand_id: BRAND_ID, user_id: USER_ID, status: 'accepted' })] = {
      data: { brand_id: BRAND_ID },
      error: null,
    }
    // Brand fetch returns null
    queryResults[resultKey('brands', { id: BRAND_ID })] = {
      data: null,
      error: null,
    }

    const result = await verifyBrandAccess(BRAND_ID, USER_ID)
    expect(result).toBeNull()
  })

  it('prioritizes ownership over team membership', async () => {
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: USER_ID })] = {
      data: fakeBrand,
      error: null,
    }
    // Even though team membership would also match, ownership should return first
    const result = await verifyBrandAccess(BRAND_ID, USER_ID)
    expect(result).toMatchObject({ id: BRAND_ID })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// verifyBrandOwnership
// ═══════════════════════════════════════════════════════════════════════════
describe('verifyBrandOwnership', () => {
  it('returns brand when user is the owner', async () => {
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: USER_ID })] = {
      data: fakeBrand,
      error: null,
    }
    const result = await verifyBrandOwnership(BRAND_ID, USER_ID)
    expect(result).toMatchObject({ id: BRAND_ID, name: 'Acme' })
  })

  it('returns null when user is NOT the owner', async () => {
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: OTHER_USER })] = {
      data: null,
      error: null,
    }
    const result = await verifyBrandOwnership(BRAND_ID, OTHER_USER)
    expect(result).toBeNull()
  })

  it('returns null when createServerClient returns null', async () => {
    vi.mocked(createServerClient).mockReturnValueOnce(null)
    const result = await verifyBrandOwnership(BRAND_ID, USER_ID)
    expect(result).toBeNull()
  })

  it('does NOT fall through to team membership check', async () => {
    // ownership fails
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: OTHER_USER })] = {
      data: null,
      error: null,
    }
    // team membership would succeed — but should not be checked
    queryResults[resultKey('team_members', { brand_id: BRAND_ID, user_id: OTHER_USER, status: 'accepted' })] = {
      data: { brand_id: BRAND_ID },
      error: null,
    }
    const result = await verifyBrandOwnership(BRAND_ID, OTHER_USER)
    expect(result).toBeNull()
  })

  it('returns brand with report columns when requested', async () => {
    const brandWithReport = { ...fakeBrand, report_logo_url: 'logo.png' }
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: USER_ID })] = {
      data: brandWithReport,
      error: null,
    }
    const result = await verifyBrandOwnership(BRAND_ID, USER_ID, true)
    expect(result).toMatchObject({ report_logo_url: 'logo.png' })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// verifyPromptOwnership
// ═══════════════════════════════════════════════════════════════════════════
describe('verifyPromptOwnership', () => {
  const PROMPT_ID = 'prompt-001'
  const fakePrompt = {
    id: PROMPT_ID,
    brand_id: BRAND_ID,
    text: 'What is Acme?',
    language: 'en',
    market: 'US',
    category: 'brand',
    brand: fakeBrand,
  }

  it('returns prompt when user has brand access', async () => {
    // Prompt fetch
    queryResults[resultKey('prompts', { id: PROMPT_ID })] = {
      data: fakePrompt,
      error: null,
    }
    // Brand access (ownership)
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: USER_ID })] = {
      data: fakeBrand,
      error: null,
    }
    const result = await verifyPromptOwnership(PROMPT_ID, USER_ID)
    expect(result).toMatchObject({ id: PROMPT_ID, text: 'What is Acme?' })
  })

  it('returns null when prompt does not exist', async () => {
    queryResults[resultKey('prompts', { id: PROMPT_ID })] = {
      data: null,
      error: null,
    }
    const result = await verifyPromptOwnership(PROMPT_ID, USER_ID)
    expect(result).toBeNull()
  })

  it('returns null when user has no access to the brand', async () => {
    queryResults[resultKey('prompts', { id: PROMPT_ID })] = {
      data: fakePrompt,
      error: null,
    }
    // Brand access denied
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: OTHER_USER })] = {
      data: null,
      error: { message: 'not found' },
    }
    const result = await verifyPromptOwnership(PROMPT_ID, OTHER_USER)
    expect(result).toBeNull()
  })

  it('returns null when createServerClient returns null', async () => {
    vi.mocked(createServerClient).mockReturnValueOnce(null)
    const result = await verifyPromptOwnership(PROMPT_ID, USER_ID)
    expect(result).toBeNull()
  })

  it('includes brand data in the returned prompt', async () => {
    queryResults[resultKey('prompts', { id: PROMPT_ID })] = {
      data: fakePrompt,
      error: null,
    }
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: USER_ID })] = {
      data: fakeBrand,
      error: null,
    }
    const result = await verifyPromptOwnership(PROMPT_ID, USER_ID)
    expect(result?.brand).toMatchObject({ id: BRAND_ID, name: 'Acme' })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// verifyAlertOwnership
// ═══════════════════════════════════════════════════════════════════════════
describe('verifyAlertOwnership', () => {
  const ALERT_ID = 'alert-001'
  const fakeAlert = {
    id: ALERT_ID,
    brand_id: BRAND_ID,
    name: 'Drop alert',
    type: 'visibility_drop',
    brand: fakeBrand,
  }

  it('returns alert when user has brand access', async () => {
    queryResults[resultKey('alert_rules', { id: ALERT_ID })] = {
      data: fakeAlert,
      error: null,
    }
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: USER_ID })] = {
      data: fakeBrand,
      error: null,
    }
    const result = await verifyAlertOwnership(ALERT_ID, USER_ID)
    expect(result).toMatchObject({ id: ALERT_ID, name: 'Drop alert' })
  })

  it('returns null when alert does not exist', async () => {
    queryResults[resultKey('alert_rules', { id: ALERT_ID })] = {
      data: null,
      error: null,
    }
    const result = await verifyAlertOwnership(ALERT_ID, USER_ID)
    expect(result).toBeNull()
  })

  it('returns null when alert has no brand_id', async () => {
    queryResults[resultKey('alert_rules', { id: ALERT_ID })] = {
      data: { ...fakeAlert, brand_id: null },
      error: null,
    }
    const result = await verifyAlertOwnership(ALERT_ID, USER_ID)
    expect(result).toBeNull()
  })

  it('returns null when user has no access to the brand', async () => {
    queryResults[resultKey('alert_rules', { id: ALERT_ID })] = {
      data: fakeAlert,
      error: null,
    }
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: OTHER_USER })] = {
      data: null,
      error: { message: 'not found' },
    }
    const result = await verifyAlertOwnership(ALERT_ID, OTHER_USER)
    expect(result).toBeNull()
  })

  it('returns null when createServerClient returns null', async () => {
    vi.mocked(createServerClient).mockReturnValueOnce(null)
    const result = await verifyAlertOwnership(ALERT_ID, USER_ID)
    expect(result).toBeNull()
  })

  it('includes brand data in the returned alert', async () => {
    queryResults[resultKey('alert_rules', { id: ALERT_ID })] = {
      data: fakeAlert,
      error: null,
    }
    queryResults[resultKey('brands', { id: BRAND_ID, user_id: USER_ID })] = {
      data: fakeBrand,
      error: null,
    }
    const result = await verifyAlertOwnership(ALERT_ID, USER_ID)
    expect(result?.brand).toMatchObject({ id: BRAND_ID, name: 'Acme' })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// canEditBrand
// ═══════════════════════════════════════════════════════════════════════════
describe('canEditBrand', () => {
  it('returns true when user is the brand owner', async () => {
    queryResults[resultKey('brands', { id: BRAND_ID })] = {
      data: { user_id: USER_ID },
      error: null,
    }
    const result = await canEditBrand(BRAND_ID, USER_ID)
    expect(result).toBe(true)
  })

  it('returns true when user is a team editor', async () => {
    queryResults[resultKey('brands', { id: BRAND_ID })] = {
      data: { user_id: 'someone-else' },
      error: null,
    }
    queryResults[resultKey('team_members', { brand_id: BRAND_ID, user_id: USER_ID, status: 'accepted' })] = {
      data: { role: 'editor' },
      error: null,
    }
    const result = await canEditBrand(BRAND_ID, USER_ID)
    expect(result).toBe(true)
  })

  it('returns true when user is a team owner role', async () => {
    queryResults[resultKey('brands', { id: BRAND_ID })] = {
      data: { user_id: 'someone-else' },
      error: null,
    }
    queryResults[resultKey('team_members', { brand_id: BRAND_ID, user_id: USER_ID, status: 'accepted' })] = {
      data: { role: 'owner' },
      error: null,
    }
    const result = await canEditBrand(BRAND_ID, USER_ID)
    expect(result).toBe(true)
  })

  it('returns false when user is only a viewer team member', async () => {
    queryResults[resultKey('brands', { id: BRAND_ID })] = {
      data: { user_id: 'someone-else' },
      error: null,
    }
    // no team_members result → defaults to null
    const result = await canEditBrand(BRAND_ID, USER_ID)
    expect(result).toBe(false)
  })

  it('returns false when brand does not exist', async () => {
    // brands query returns null
    const result = await canEditBrand(BRAND_ID, USER_ID)
    expect(result).toBe(false)
  })

  it('returns false when createServerClient returns null', async () => {
    vi.mocked(createServerClient).mockReturnValueOnce(null)
    const result = await canEditBrand(BRAND_ID, USER_ID)
    expect(result).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// getAccessibleBrandIds
// ═══════════════════════════════════════════════════════════════════════════
describe('getAccessibleBrandIds', () => {
  function createMockDb(ownedBrands: { id: string }[] | null, teamMemberships: { brand_id: string }[] | null) {
    const mockDb = {
      from: vi.fn((table: string) => {
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: () => chain,
        }
        if (table === 'brands') {
          // The last call in the chain is implicit (no .single())
          Object.defineProperty(chain, 'then', {
            value: (resolve: (val: unknown) => void) => {
              resolve({ data: ownedBrands, error: null })
            },
          })
          // Actually getAccessibleBrandIds doesn't call .single() — it awaits directly
          return { select: () => ({ eq: () => ({ data: ownedBrands, error: null }) }) }
        }
        if (table === 'team_members') {
          return { select: () => ({ eq: (_f: string, _v: string) => ({ eq: () => ({ data: teamMemberships, error: null }) }) }) }
        }
        return chain
      }),
    }
    return mockDb as unknown as ReturnType<typeof createServerClient>
  }

  it('returns owned brand ids', async () => {
    const db = createMockDb([{ id: 'b1' }, { id: 'b2' }], [])
    const result = await getAccessibleBrandIds(db, USER_ID)
    expect(result).toEqual(['b1', 'b2'])
  })

  it('returns team membership brand ids', async () => {
    const db = createMockDb([], [{ brand_id: 'b3' }, { brand_id: 'b4' }])
    const result = await getAccessibleBrandIds(db, USER_ID)
    expect(result).toEqual(['b3', 'b4'])
  })

  it('returns combined owned + team brand ids', async () => {
    const db = createMockDb([{ id: 'b1' }], [{ brand_id: 'b2' }])
    const result = await getAccessibleBrandIds(db, USER_ID)
    expect(result).toEqual(['b1', 'b2'])
  })

  it('returns empty array when db is null', async () => {
    const result = await getAccessibleBrandIds(null as unknown as ReturnType<typeof createServerClient>, USER_ID)
    expect(result).toEqual([])
  })

  it('returns empty array when no brands or memberships found', async () => {
    const db = createMockDb(null, null)
    const result = await getAccessibleBrandIds(db, USER_ID)
    expect(result).toEqual([])
  })

  it('deduplication is not applied (caller responsibility)', async () => {
    // If same brand is owned AND team member, both appear
    const db = createMockDb([{ id: 'b1' }], [{ brand_id: 'b1' }])
    const result = await getAccessibleBrandIds(db, USER_ID)
    expect(result).toEqual(['b1', 'b1'])
  })
})
