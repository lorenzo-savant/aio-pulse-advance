import { describe, it, expect } from 'vitest'
import {
  suggestSeedVariations,
  buildFAQPageJsonLd,
  buildAnswerPrompt,
  filterForeignPaa,
  hostOf,
  hostsMatch,
  isUrlSeed,
  questionNamesHost,
} from '@/lib/services/aeo-snippets'

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

describe('isUrlSeed', () => {
  it('rejects the seed that produced the Relovie contamination', () => {
    expect(isUrlSeed('https://relovie.com/')).toBe(true)
    expect(isUrlSeed('relovie.com')).toBe(true)
    expect(isUrlSeed('www.relovie.com/faq')).toBe(true)
  })

  it('accepts real question and topic seeds', () => {
    expect(isUrlSeed('vad är begagnad elektronik')).toBe(false)
    expect(isUrlSeed('köpa begagnat online')).toBe(false)
    expect(isUrlSeed('')).toBe(false)
  })

  it('does not mistake a single word or a sentence with a dot for a URL', () => {
    expect(isUrlSeed('relovie')).toBe(false)
    expect(isUrlSeed('Är det tryggt. Ja.')).toBe(false)
  })
})

describe('hostOf / hostsMatch', () => {
  it('normalises away scheme and www', () => {
    expect(hostOf('https://www.Relovie.com/faq')).toBe('relovie.com')
    expect(hostOf('relovie.com')).toBe('relovie.com')
    expect(hostOf(null)).toBe(null)
    expect(hostOf('not a url')).toBe(null)
  })

  it('treats a subdomain as the same site', () => {
    expect(hostsMatch('shop.relovie.com', 'relovie.com')).toBe(true)
    expect(hostsMatch('relovie.com', 'stadsmissionen.se')).toBe(false)
    expect(hostsMatch(null, 'relovie.com')).toBe(false)
  })
})

describe('questionNamesHost', () => {
  it('matches across Swedish inflection', () => {
    // The real case: label "stadsmissionen" vs "Stadsmissions" in the question.
    expect(
      questionNamesHost(
        'Stöder jag Stockholms Stadsmissions arbete när jag handlar second hand?',
        'stadsmissionen.se',
      ),
    ).toBe(true)
  })

  it('leaves a generic question alone', () => {
    expect(questionNamesHost('Hur kontaktar jag kundservice?', 'stadsmissionen.se')).toBe(false)
  })

  it('requires a whole word for short labels', () => {
    expect(questionNamesHost('Vad kostar en ikea-hylla?', 'ikea.se')).toBe(true)
    expect(questionNamesHost('Vad är ikeaeffekten?', 'ikea.se')).toBe(false)
  })
})

describe('filterForeignPaa', () => {
  const q = (question: string, sourceUrl: string | null) => ({ question, sourceUrl })

  it("discards a batch that is one foreign page's FAQ section", () => {
    // Reproduces the 11 Aug Relovie run: 8 questions, one foreign source.
    const paa = [
      q('Hur kontaktar jag kundservice?', 'https://www.stadsmissionen.se/shop'),
      q('Kan jag lämna tillbaka om det inte passar?', 'https://www.stadsmissionen.se/shop'),
      q('Hur ofta fylls webshopen på?', 'https://www.stadsmissionen.se/shop'),
    ]
    const { kept, dropped } = filterForeignPaa(paa, 'relovie.com')
    expect(kept).toHaveLength(0)
    expect(dropped).toHaveLength(3)
    expect(dropped.every((d) => d.reason === 'foreign-faq-block')).toBe(true)
  })

  it('keeps a genuine PAA box sourced from several third parties', () => {
    // The case the naive "same domain as the brand" rule would have destroyed.
    const paa = [
      q('Är det tryggt att köpa begagnad mobil?', 'https://www.pricerunner.se/guide'),
      q('Vad är skillnaden mellan begagnad och renoverad?', 'https://prisjakt.nu/artikel'),
      q('Hur länge håller ett begagnat batteri?', 'https://www.reddit.com/r/sweden'),
    ]
    const { kept, dropped } = filterForeignPaa(paa, 'relovie.com')
    expect(kept).toHaveLength(3)
    expect(dropped).toHaveLength(0)
  })

  it('keeps a single-source batch when the source is the brand itself', () => {
    const paa = [
      q('Vad är Relovie?', 'https://relovie.com/faq'),
      q('Hur fungerar Relovie?', 'https://relovie.com/faq'),
    ]
    expect(filterForeignPaa(paa, 'relovie.com').kept).toHaveLength(2)
  })

  it('drops only the question that names the third party it came from', () => {
    const paa = [
      q('Är det tryggt att köpa begagnat?', 'https://www.pricerunner.se/guide'),
      q('Stöder jag Stockholms Stadsmissions arbete?', 'https://www.stadsmissionen.se/shop'),
    ]
    const { kept, dropped } = filterForeignPaa(paa, 'relovie.com')
    expect(kept).toHaveLength(1)
    expect(dropped[0]!.reason).toBe('foreign-brand-in-question')
  })

  it('keeps everything when the brand host is unknown', () => {
    const paa = [q('Hur kontaktar jag kundservice?', 'https://www.stadsmissionen.se/shop')]
    expect(filterForeignPaa(paa, null).kept).toHaveLength(1)
  })
})

describe('buildAnswerPrompt', () => {
  const brand = {
    name: 'Relovie',
    domain: 'relovie.com',
    description: 'Söktjänst för begagnad elektronik och möbler.',
  }

  it('grounds the answer in the brand so the snippet can earn a citation', () => {
    const p = buildAnswerPrompt('Hur fungerar leveransen?', 'sv', brand)
    expect(p).toContain('Relovie')
    expect(p).toContain('relovie.com')
    expect(p).toContain('Söktjänst för begagnad elektronik')
    expect(p).toContain('Svara på svenska')
  })

  it('forbids naming another organisation', () => {
    expect(buildAnswerPrompt('Q?', 'sv', brand)).toContain('Never name any other company')
  })

  it('omits the optional lines when the brand has no domain or description', () => {
    const p = buildAnswerPrompt('Q?', 'en', { name: 'Relovie', domain: null, description: null })
    expect(p).not.toContain('That website is')
    expect(p).not.toContain('About the company:')
    expect(p).toContain('Relovie')
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
