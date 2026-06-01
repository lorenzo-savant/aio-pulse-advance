import { describe, it, expect } from 'vitest'
import { suggestSeedVariations, buildFAQPageJsonLd } from '@/lib/services/aeo-snippets'

describe('suggestSeedVariations', () => {
  it('builds informational reformulations for an English topic', () => {
    const out = suggestSeedVariations('vegan hair care', 'en')
    expect(out).toContain('what is vegan hair care')
    expect(out).toContain('how does vegan hair care work')
    expect(out).toContain('vegan hair care benefits')
    expect(out.length).toBeLessThanOrEqual(4)
  })

  it('uses Swedish templates for sv', () => {
    const out = suggestSeedVariations('vegansk hårvård', 'sv')
    expect(out).toContain('vad är vegansk hårvård')
    expect(out).toContain('hur fungerar vegansk hårvård')
    expect(out.some((s) => s.includes('fördelar'))).toBe(true)
  })

  it('uses Italian templates for it', () => {
    const out = suggestSeedVariations('cura dei capelli', 'it')
    expect(out).toContain("cos'è cura dei capelli")
    expect(out).toContain('come funziona cura dei capelli')
  })

  it('strips an existing leading question word so it does not double up', () => {
    const out = suggestSeedVariations('what is keto diet', 'en')
    // base becomes "keto diet": no "what is what is …" double-up, and the
    // regenerated "what is keto diet" is filtered out as it equals the input.
    expect(out.every((s) => !s.includes('what is what is'))).toBe(true)
    expect(out).not.toContain('what is keto diet')
    expect(out).toContain('how does keto diet work')
    expect(out).toContain('keto diet benefits')
  })

  it('does not echo the original keyword back as a suggestion', () => {
    const out = suggestSeedVariations('best running shoes', 'en')
    expect(out).not.toContain('best running shoes')
  })

  it('returns empty for a blank/strippable seed', () => {
    expect(suggestSeedVariations('   ', 'en')).toEqual([])
  })
})

describe('buildFAQPageJsonLd', () => {
  it('produces a valid FAQPage shape', () => {
    const ld = buildFAQPageJsonLd([{ question: 'Q1?', answer: 'A1.' }])
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('FAQPage')
    const entities = ld.mainEntity as Array<Record<string, unknown>>
    expect(entities).toHaveLength(1)
    expect(entities[0]!['@type']).toBe('Question')
    expect(entities[0]!.name).toBe('Q1?')
    expect((entities[0]!.acceptedAnswer as Record<string, unknown>).text).toBe('A1.')
  })

  it('handles an empty item list', () => {
    const ld = buildFAQPageJsonLd([])
    expect((ld.mainEntity as unknown[]).length).toBe(0)
  })
})
