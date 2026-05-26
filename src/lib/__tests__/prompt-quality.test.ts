import { describe, it, expect } from 'vitest'
import { findPerformativePatterns, hasPerformativePhrasing } from '../prompt-quality'

describe('findPerformativePatterns — English', () => {
  it('flags "Act as a <role>" framing', () => {
    const m = findPerformativePatterns('Act as a tax advisor and explain section 179')
    expect(m).toHaveLength(1)
    expect(m[0]?.locale).toBe('en')
    expect(m[0]?.phrase.toLowerCase()).toContain('act as a')
  })

  it('flags "Act like an <role>" variant', () => {
    const m = findPerformativePatterns('Act like an expert lawyer')
    expect(m.length).toBeGreaterThan(0)
  })

  it('flags "Pretend you are <role>"', () => {
    const m = findPerformativePatterns('Pretend you are a doctor and diagnose…')
    expect(m.length).toBeGreaterThan(0)
    expect(m[0]?.locale).toBe('en')
  })

  it('flags "Imagine you are <role>"', () => {
    const m = findPerformativePatterns('Imagine you are a Stockholm casting director.')
    expect(m.length).toBeGreaterThan(0)
  })

  it('flags "Roleplay as" / "Role-play as"', () => {
    expect(findPerformativePatterns('Roleplay as a senior engineer').length).toBeGreaterThan(0)
    expect(findPerformativePatterns('Role-play as a doctor').length).toBeGreaterThan(0)
  })

  it('flags "You are now a <role>"', () => {
    const m = findPerformativePatterns('You are now a senior compliance officer.')
    expect(m.length).toBeGreaterThan(0)
  })
})

describe('findPerformativePatterns — Italian', () => {
  it('flags "Agisci come un <role>"', () => {
    const m = findPerformativePatterns('Agisci come un avvocato esperto')
    expect(m).toHaveLength(1)
    expect(m[0]?.locale).toBe('it')
  })

  it('flags "Fingi di essere <role>"', () => {
    const m = findPerformativePatterns('Fingi di essere un dottore.')
    expect(m.length).toBeGreaterThan(0)
  })

  it('flags "Fai finta di <role>"', () => {
    const m = findPerformativePatterns('Fai finta di essere un consulente fiscale.')
    expect(m.length).toBeGreaterThan(0)
  })

  it('flags "Immagina di essere <role>"', () => {
    const m = findPerformativePatterns('Immagina di essere un cliente di Acasting.')
    expect(m.length).toBeGreaterThan(0)
  })

  it('flags "Impersona un <role>"', () => {
    const m = findPerformativePatterns('Impersona un esperto di marketing.')
    expect(m.length).toBeGreaterThan(0)
  })
})

describe('findPerformativePatterns — Swedish', () => {
  it('flags "Låtsas vara"', () => {
    const m = findPerformativePatterns('Låtsas vara en advokat och förklara…')
    expect(m).toHaveLength(1)
    expect(m[0]?.locale).toBe('sv')
  })

  it('flags "Föreställ dig att du är"', () => {
    const m = findPerformativePatterns('Föreställ dig att du är en castingregissör.')
    expect(m.length).toBeGreaterThan(0)
  })

  it('flags "Agera som en"', () => {
    const m = findPerformativePatterns('Agera som en revisor och analysera siffrorna.')
    expect(m.length).toBeGreaterThan(0)
  })
})

describe('findPerformativePatterns — clean (no false positives)', () => {
  it('does not flag the safe directive form', () => {
    expect(
      findPerformativePatterns('What are the leading casting platforms in Sweden?'),
    ).toHaveLength(0)
  })

  it('does not flag bare role nouns without performative framing', () => {
    expect(findPerformativePatterns('I am a developer looking for tools')).toHaveLength(0)
  })

  it('does not flag plausible {brand} review templates', () => {
    expect(findPerformativePatterns('Acasting review 2026')).toHaveLength(0)
    expect(findPerformativePatterns('best castingplattform Stockholm')).toHaveLength(0)
    expect(findPerformativePatterns('miglior agenzia di marketing Milano')).toHaveLength(0)
  })

  it('does not flag the homonym audit classifier system prompt', () => {
    // The classifier we ship says "You are an entity-resolution auditor"
    // — that's role assignment with strict output constraints, not
    // performative framing. Should stay clean.
    const sys =
      'You are an entity-resolution auditor. You MUST output strict JSON, no prose, no markdown fences.'
    expect(findPerformativePatterns(sys)).toHaveLength(0)
  })

  it('returns empty on empty/whitespace input', () => {
    expect(findPerformativePatterns('')).toHaveLength(0)
    expect(findPerformativePatterns('   \n  ')).toHaveLength(0)
  })
})

describe('hasPerformativePhrasing convenience', () => {
  it('returns true when any rule fires', () => {
    expect(hasPerformativePhrasing('Act as a lawyer')).toBe(true)
  })

  it('returns false on clean input', () => {
    expect(hasPerformativePhrasing('Explain section 179')).toBe(false)
  })
})

describe('output shape', () => {
  it('exposes phrase + locale + reason + suggestion per match', () => {
    const m = findPerformativePatterns('Act as a tax advisor')
    expect(m[0]).toMatchObject({
      phrase: expect.any(String),
      locale: 'en',
      reason: expect.any(String),
      suggestion: expect.any(String),
    })
    // Reason + suggestion are not empty strings
    expect(m[0]?.reason.length).toBeGreaterThan(10)
    expect(m[0]?.suggestion.length).toBeGreaterThan(10)
  })
})
