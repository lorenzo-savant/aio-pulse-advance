import { describe, it, expect } from 'vitest'
import { buildClassifierUserPrompt, type BrandContext } from '../services/homonym-audit'

const ACASTING: BrandContext = {
  name: 'Acasting',
  domain: 'acasting.se',
  industry: 'Casting platform',
  description: 'Swedish casting platform for actors and extras.',
  aliases: ['Acasting Sweden AB'],
  disambiguation: 'Not the podcast host Acast.',
  legalId: '556677-8899',
  legalIdType: 'orgnr',
}

describe('buildClassifierUserPrompt', () => {
  it('states the organisationsnummer in the brand profile', () => {
    // Name, domain and industry can all be shared with a homonym. The
    // registered identifier cannot, so the classifier has to see it.
    const prompt = buildClassifierUserPrompt(ACASTING, 'Some AI answer mentioning Acasting.')
    expect(prompt).toContain('556677-8899')
    expect(prompt).toContain('Swedish organisationsnummer')
  })

  it('puts the identifier before the homonym warning', () => {
    const prompt = buildClassifierUserPrompt(ACASTING, 'answer')
    expect(prompt.indexOf('556677-8899')).toBeLessThan(prompt.indexOf('Known homonym warning'))
  })

  it('labels a non-orgnr identifier generically instead of calling it Swedish', () => {
    const prompt = buildClassifierUserPrompt(
      { ...ACASTING, legalIdType: 'vat', legalId: 'SE556677889901' },
      'answer',
    )
    expect(prompt).toContain('Legal identifier (vat): SE556677889901')
    expect(prompt).not.toContain('organisationsnummer')
  })

  it('omits the line entirely when no identifier is on file', () => {
    const prompt = buildClassifierUserPrompt(
      { ...ACASTING, legalId: null, legalIdType: null },
      'answer',
    )
    expect(prompt).not.toContain('Legal identifier')
    expect(prompt).not.toContain('organisationsnummer')
    // The rest of the profile still stands.
    expect(prompt).toContain('acasting.se')
  })
})
