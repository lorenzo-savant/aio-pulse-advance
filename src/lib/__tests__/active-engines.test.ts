import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ALL_ENGINES, ACTIVE_ENGINES, isActiveEngine } from '@/types'

/**
 * Claude was retired on cost, and the point of these tests is that "retired"
 * has to mean two different things at once.
 *
 * It must stop COSTING: no new run may call it, whatever a stored prompt lists
 * or a request body asks for. Measured over 1768 results
 * (2026-05-18 → 2026-08-06), 179 Claude runs cost $1.30 of a $2.01 total —
 * 65% of the spend for 10% of the runs, at $0.0072 a run against Gemini's
 * $0.00015.
 *
 * It must stop SHOWING (narrowed 2026-08-17): originally every reading surface
 * kept iterating `ALL_ENGINES`, so a retired engine still drew a series in
 * per-engine charts and a row in client reports. On a brand with 427 results
 * Claude contributed 4 — a 0.9% series beside three real ones reads as a
 * finding, and the client asks about it. Presentation now filters on
 * `ACTIVE_ENGINES`.
 *
 * It must keep READING: 179 real measurements exist with engine='claude'.
 * Retiring an engine is a billing and presentation decision; it is not
 * permission to rewrite the archive. So the rows stay in the database, stay in
 * the raw export, and `ENGINE_LABEL` still renders them as "Claude" rather than
 * a bare slug.
 */

describe('engine retirement', () => {
  it('keeps every engine ever measured available for reading', () => {
    expect(ALL_ENGINES).toContain('claude')
    expect(ALL_ENGINES).toHaveLength(4)
  })

  it('does not let a new run use Claude', () => {
    expect(ACTIVE_ENGINES).not.toContain('claude')
    expect(isActiveEngine('claude')).toBe(false)
  })

  it('still allows the three that are paid for', () => {
    for (const e of ['chatgpt', 'gemini', 'perplexity']) {
      expect(isActiveEngine(e)).toBe(true)
    }
  })

  it('rejects anything that is not an engine at all', () => {
    expect(isActiveEngine('gpt-5')).toBe(false)
    expect(isActiveEngine('')).toBe(false)
  })
})

describe('the paying routes filter on ACTIVE_ENGINES', () => {
  // These two are where money is actually spent. Everything else — the UI
  // pickers, the zod enums — is convenience: a stored prompt still holds
  // 'claude' in its engines array, and only this filter stops it being called.
  const paths = ['src/app/api/monitoring/route.ts', 'src/app/api/cron/monitoring/route.ts']

  it.each(paths)('%s resolves engines through isActiveEngine', (p) => {
    const src = readFileSync(join(process.cwd(), p), 'utf8')
    expect(src).toMatch(/\.filter\(isActiveEngine\)/)
  })

  it.each(paths)('%s no longer carries its own engine list', (p) => {
    // A local `validEngines` array is how the two paths drifted apart before.
    const src = readFileSync(join(process.cwd(), p), 'utf8')
    expect(src).not.toMatch(/const validEngines\s*=/)
  })

  it.each(paths)('%s cannot reach Claude through a default either', (p) => {
    const src = readFileSync(join(process.cwd(), p), 'utf8')
    const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toMatch(/'claude'/)
  })
})

describe('a retired engine is not written into new rows', () => {
  // The runner filter stops the spend, but a prompt created with 'claude' in
  // its engines array is still wrong data, and the picker still showed it as a
  // choice the product would honour.
  const paths = [
    'src/app/api/prompts/route.ts',
    'src/app/api/prompts/seed/route.ts',
    'src/app/api/onboarding/route.ts',
    'src/app/dashboard/brands/new/page.tsx',
  ]

  it.each(paths)('%s offers no Claude option', (p) => {
    const src = readFileSync(join(process.cwd(), p), 'utf8')
    const code = src.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toMatch(/'claude'/)
  })
})

describe('a retired engine is not presented', () => {
  it('is excluded from the report engine table', async () => {
    const { buildEngineBreakdown } = await import('@/lib/services/report-sections')
    const row = (engine: string) => ({
      engine,
      brand_mentioned: true,
      mention_position: 1,
      visibility_score: 80,
      sentiment: 'positive',
      sentiment_score: 0.5,
      cited_urls: [],
      competitor_mentions: [],
    })
    // 12 rows each: well past the minRows floor, so only the retirement filter
    // can be what removes Claude here.
    const rows = [
      ...Array.from({ length: 12 }, () => row('chatgpt')),
      ...Array.from({ length: 12 }, () => row('claude')),
    ]
    const out = buildEngineBreakdown(rows as never)
    expect(out.map((e) => e.engine)).toEqual(['chatgpt'])
  })

  it('is excluded from the per-engine citations chart', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/dashboard/citations/page.tsx'), 'utf8')
    // The series list must come from ACTIVE_ENGINES, not a local literal.
    expect(src).toMatch(/const engines = \[\.\.\.ACTIVE_ENGINES\]/)
  })

  it('still renders a legacy row with a proper label rather than a slug', () => {
    const src = readFileSync(join(process.cwd(), 'src/app/api/reports/html/route.ts'), 'utf8')
    // ENGINE_LABEL is a lookup over whatever the data holds, so it keeps every
    // engine ever measured — that is archive fidelity, not presentation.
    expect(src).toMatch(/claude: 'Claude'/)
  })
})
