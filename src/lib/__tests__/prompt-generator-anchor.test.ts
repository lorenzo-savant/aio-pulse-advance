import { describe, it, expect } from 'vitest'
import {
  anchorBrand,
  normaliseDomainForPrompt,
  shouldAnchorBrandDomain,
  expandKeywords,
} from '../services/prompt-generator'

describe('normaliseDomainForPrompt', () => {
  it('strips https + trailing slash', () => {
    expect(normaliseDomainForPrompt('https://acasting.se/')).toBe('acasting.se')
  })
  it('strips http + path', () => {
    expect(normaliseDomainForPrompt('http://acasting.se/about/team')).toBe('acasting.se')
  })
  it('passes plain domain through', () => {
    expect(normaliseDomainForPrompt('acasting.se')).toBe('acasting.se')
  })
  it('handles empty + null gracefully', () => {
    expect(normaliseDomainForPrompt('')).toBe('')
    expect(normaliseDomainForPrompt(null)).toBe('')
    expect(normaliseDomainForPrompt(undefined)).toBe('')
  })
})

describe('shouldAnchorBrandDomain', () => {
  it('anchors short single-word brands (homonym risk)', () => {
    expect(shouldAnchorBrandDomain('Acasting')).toBe(true) // 8 chars
    expect(shouldAnchorBrandDomain('Savant')).toBe(true) // 6 chars
    expect(shouldAnchorBrandDomain('Klarna')).toBe(true) // 6 chars
  })
  it('does NOT anchor multi-word brands (self-disambiguating)', () => {
    expect(shouldAnchorBrandDomain('Savant Media AB')).toBe(false)
    expect(shouldAnchorBrandDomain('Microsoft Corporation')).toBe(false)
    expect(shouldAnchorBrandDomain('Acme Inc')).toBe(false)
  })
  it('does NOT anchor long distinctive single-word brands', () => {
    expect(shouldAnchorBrandDomain('Salesforceforce')).toBe(false) // 15 chars
  })
  it('rejects empty / whitespace-only input', () => {
    expect(shouldAnchorBrandDomain('')).toBe(false)
    expect(shouldAnchorBrandDomain('   ')).toBe(false)
  })
})

describe('anchorBrand', () => {
  it('produces the anchored form for short single-word brand + domain', () => {
    expect(anchorBrand('Acasting', 'acasting.se')).toBe('Acasting (acasting.se)')
    expect(anchorBrand('Savant', 'https://savantmedia.se/')).toBe('Savant (savantmedia.se)')
  })
  it('returns bare brand when no domain', () => {
    expect(anchorBrand('Acasting', null)).toBe('Acasting')
    expect(anchorBrand('Acasting', '')).toBe('Acasting')
    expect(anchorBrand('Acasting', undefined)).toBe('Acasting')
  })
  it('returns bare brand for multi-word names even with domain', () => {
    expect(anchorBrand('Savant Media AB', 'savantmedia.se')).toBe('Savant Media AB')
  })
  it('returns bare brand for long single-word names', () => {
    expect(anchorBrand('Salesforceforce', 'salesforce.com')).toBe('Salesforceforce')
  })
})

describe('expandKeywords with brandDomain', () => {
  it('substitutes the anchored brand into {brand} placeholders', () => {
    const queries = expandKeywords(
      'Acasting',
      'casting-talent',
      'sv',
      'Stockholm',
      [],
      'acasting.se',
    )
    // At least one query should contain the anchored form. We don't pin
    // the exact phrasing because the casting preset has many templates.
    const anchored = queries.filter((q) => q.query.includes('Acasting (acasting.se)'))
    expect(anchored.length).toBeGreaterThan(0)
  })

  it('falls back to bare brand when no brandDomain is provided', () => {
    const queries = expandKeywords('Acasting', 'casting-talent', 'sv', 'Stockholm', [])
    // No query should anchor — the brand isn't accompanied by a domain.
    const anchored = queries.filter((q) => q.query.includes('(acasting.se)'))
    expect(anchored.length).toBe(0)
    // But the bare brand still appears.
    const bare = queries.filter((q) => q.query.includes('Acasting'))
    expect(bare.length).toBeGreaterThan(0)
  })

  it('does not anchor multi-word brands even with a domain', () => {
    const queries = expandKeywords(
      'Savant Media AB',
      'marketing-advertising',
      'sv',
      'Stockholm',
      [],
      'savantmedia.se',
    )
    const anchored = queries.filter((q) => q.query.includes('(savantmedia.se)'))
    expect(anchored.length).toBe(0)
  })
})
