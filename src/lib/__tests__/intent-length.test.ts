import { describe, it, expect } from 'vitest'
import { analyseIntentLength, classifyPageIntent, INTENT_BANDS } from '@/lib/utils/intent-length'

function page(opts: { title?: string; h1?: string; words?: number }): string {
  const title = opts.title ? `<title>${opts.title}</title>` : ''
  const h1 = opts.h1 ? `<h1>${opts.h1}</h1>` : ''
  const body = opts.words ? `<p>${'word '.repeat(opts.words)}</p>` : ''
  return `<!doctype html><html><head>${title}</head><body>${h1}${body}</body></html>`
}

describe('classifyPageIntent', () => {
  it('detects informational from "What is" / "How to"', () => {
    expect(classifyPageIntent(page({ title: 'What is AEO?' }))).toBe('informational')
    expect(classifyPageIntent(page({ h1: 'How to set up GA4' }))).toBe('informational')
  })

  it('detects commercial from "best" / "vs" / "review"', () => {
    expect(classifyPageIntent(page({ title: 'Best CRM for SaaS' }))).toBe('commercial')
    expect(classifyPageIntent(page({ title: 'Asana vs Monday — full review' }))).toBe('commercial')
  })

  it('detects transactional from "buy" / "shop" / "pricing plans"', () => {
    expect(classifyPageIntent(page({ title: 'Buy hair clippers online' }))).toBe('transactional')
    expect(classifyPageIntent(page({ title: 'Our pricing plans' }))).toBe('transactional')
  })

  it('detects navigational from "login" / "contact" / "about us"', () => {
    expect(classifyPageIntent(page({ title: 'Customer login' }))).toBe('navigational')
    expect(classifyPageIntent(page({ title: 'About us' }))).toBe('navigational')
  })

  it('falls back to informational when no keyword hits', () => {
    expect(classifyPageIntent(page({ title: 'Acme Industries' }))).toBe('informational')
    expect(classifyPageIntent(page({ title: '' }))).toBe('informational')
  })

  it('breaks ties by priority (transactional > commercial > navigational > informational)', () => {
    // "Best" (commercial) + "buy" (transactional) → transactional wins.
    expect(classifyPageIntent(page({ title: 'Best place to buy CRM' }))).toBe('transactional')
  })

  it('matches Italian and Swedish intent keywords', () => {
    expect(classifyPageIntent(page({ title: 'Migliori CRM per piccole imprese' }))).toBe(
      'commercial',
    )
    expect(classifyPageIntent(page({ title: 'Vad är AEO?' }))).toBe('informational')
    expect(classifyPageIntent(page({ title: 'Köp hårklippare online' }))).toBe('transactional')
  })
})

describe('analyseIntentLength', () => {
  it('flags too-short pages with a "add ~N words" recommendation', () => {
    const r = analyseIntentLength(page({ title: 'What is AEO?', words: 100 }))
    expect(r.intent).toBe('informational')
    expect(r.fit).toBe('too_short')
    // wordCount also counts title + h1 (which are visible text); allow a
    // small overhead — the important assertion is that it's under the band.
    expect(r.wordCount).toBeLessThan(INTENT_BANDS.informational.min)
    expect(r.recommendation).toMatch(/Add/i)
    expect(r.recommendation).toMatch(/words/)
  })

  it('flags too-long pages with a "tighten / split" recommendation', () => {
    const r = analyseIntentLength(
      page({ title: 'Customer login', words: 5000 }), // navigational max=1000
    )
    expect(r.intent).toBe('navigational')
    expect(r.fit).toBe('too_long')
    expect(r.recommendation).toMatch(/tighten|split/i)
  })

  it('returns right_size when the count is inside the band', () => {
    const r = analyseIntentLength(page({ title: 'What is AEO?', words: 900 }))
    expect(r.intent).toBe('informational')
    expect(r.fit).toBe('right_size')
    expect(r.recommendation).toMatch(/within the AI-friendly band/i)
  })

  it('uses the correct band for each intent', () => {
    // Commercial pages need ≥800 words (per INTENT_BANDS.commercial.min)
    const r = analyseIntentLength(page({ title: 'Best CRM for finance', words: 600 }))
    expect(r.intent).toBe('commercial')
    expect(r.fit).toBe('too_short')
    expect(r.band.min).toBe(INTENT_BANDS.commercial.min)
  })

  it('strips scripts/styles when counting words', () => {
    const html = `
      <html><head><title>Login</title>
        <script>const x = 'a b c d e f g h i j k l m n o p q r s t u v w x y z';</script>
        <style>.a { color: red red red red red red red red red red; }</style>
      </head><body><h1>Login</h1><p>five visible words here please</p></body></html>`
    const r = analyseIntentLength(html)
    expect(r.intent).toBe('navigational')
    expect(r.wordCount).toBeLessThan(15) // not bloated by script/style content
  })

  it('produces an actionable recommendation including the target', () => {
    const r = analyseIntentLength(page({ title: 'Buy now', words: 150 }))
    expect(r.recommendation).toMatch(/transactional/)
    expect(r.recommendation).toMatch(/\d+/) // contains a number for either target or gap
  })
})
