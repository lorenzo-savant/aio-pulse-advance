import { describe, it, expect } from 'vitest'
import { SECTION_HELP, type HelpLocale } from '../data/section-help'

// Guards the in-app help content: every section must exist in all three
// locales with complete, parallel content (same number of metric rows). A new
// section added in only one language fails here before it ships half-localized.

const LOCALES: HelpLocale[] = ['en', 'it', 'sv']

describe('SECTION_HELP', () => {
  const sections = Object.keys(SECTION_HELP)

  it('defines at least one section', () => {
    expect(sections.length).toBeGreaterThan(0)
  })

  it.each(sections)('"%s" is complete and parallel across en/it/sv', (key) => {
    const entry = SECTION_HELP[key]!

    for (const loc of LOCALES) {
      const c = entry[loc]
      expect(c, `${key}.${loc} missing`).toBeTruthy()
      expect(c.whatItIs.trim().length, `${key}.${loc}.whatItIs empty`).toBeGreaterThan(0)
      expect(c.why.trim().length, `${key}.${loc}.why empty`).toBeGreaterThan(0)
      expect(c.inputs.trim().length, `${key}.${loc}.inputs empty`).toBeGreaterThan(0)
      expect(c.outputs.trim().length, `${key}.${loc}.outputs empty`).toBeGreaterThan(0)
      expect(c.metrics.length, `${key}.${loc} has no metrics`).toBeGreaterThan(0)
      for (const m of c.metrics) {
        expect(m.metric.trim().length, `${key}.${loc} metric name empty`).toBeGreaterThan(0)
        expect(m.meaning.trim().length, `${key}.${loc} meaning empty`).toBeGreaterThan(0)
        expect(m.howMeasured.trim().length, `${key}.${loc} howMeasured empty`).toBeGreaterThan(0)
        expect(m.range.trim().length, `${key}.${loc} range empty`).toBeGreaterThan(0)
      }
    }

    const counts = LOCALES.map((l) => entry[l].metrics.length)
    expect(new Set(counts).size, `${key}: metric-row counts differ across locales`).toBe(1)
  })
})
