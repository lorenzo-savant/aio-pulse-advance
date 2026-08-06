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
 * It must keep READING: 179 real measurements exist with engine='claude', and
 * a history page, snapshot filter or per-engine chart that quietly drops them
 * would be hiding data that was genuinely collected. Retiring an engine is a
 * billing decision; it is not permission to rewrite the archive.
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
