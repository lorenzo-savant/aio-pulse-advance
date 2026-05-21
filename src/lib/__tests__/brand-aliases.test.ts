import { describe, it, expect } from 'vitest'
import { stripLegalSuffix, withDerivedAliases } from '../brand-aliases'

describe('stripLegalSuffix', () => {
  it('strips Nordic suffixes', () => {
    expect(stripLegalSuffix('Savant Media AB')).toBe('Savant Media')
    expect(stripLegalSuffix('Foo Bar AS')).toBe('Foo Bar')
    expect(stripLegalSuffix('Nokia Oyj')).toBe('Nokia')
  })

  it('strips punctuated / multi-token suffixes', () => {
    expect(stripLegalSuffix('Acme S.r.l.')).toBe('Acme')
    expect(stripLegalSuffix('Acme Pty Ltd')).toBe('Acme')
    expect(stripLegalSuffix('Telecom AB (publ)')).toBe('Telecom')
    expect(stripLegalSuffix('Globex Inc.')).toBe('Globex')
  })

  it('returns null when there is no suffix to strip', () => {
    expect(stripLegalSuffix('Acasting')).toBeNull()
    expect(stripLegalSuffix('Spotify')).toBeNull()
  })

  it('never strips down to nothing', () => {
    expect(stripLegalSuffix('AB')).toBeNull()
    expect(stripLegalSuffix('Co Ltd')).toBeNull()
  })

  it('handles empty / whitespace input', () => {
    expect(stripLegalSuffix('')).toBeNull()
    expect(stripLegalSuffix('   ')).toBeNull()
  })
})

describe('withDerivedAliases', () => {
  it('adds the stripped name as an alias', () => {
    expect(withDerivedAliases('Savant Media AB', [])).toEqual(['Savant Media'])
  })

  it('preserves existing aliases and de-dupes', () => {
    expect(withDerivedAliases('Savant Media AB', ['Savant', 'savant media'])).toEqual([
      'Savant',
      'savant media',
    ])
  })

  it('keeps existing aliases when no suffix to strip', () => {
    expect(withDerivedAliases('Acasting', ['Acasting.se'])).toEqual(['Acasting.se'])
  })

  it('does not add a duplicate of the brand name', () => {
    // stripping yields the same as name → nothing added
    expect(withDerivedAliases('Acasting', [])).toEqual([])
  })

  it('trims and drops empty aliases', () => {
    expect(withDerivedAliases('Acme Inc', ['  Acme HQ  ', ''])).toEqual(['Acme HQ', 'Acme'])
  })
})
