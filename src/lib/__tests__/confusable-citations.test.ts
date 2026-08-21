import { describe, it, expect } from 'vitest'
import {
  classifyCitedUrl,
  findConfusableCitations,
  foldName,
  hostLabel,
  type BrandIdentity,
} from '../services/confusable-citations'

const RELOVIE: BrandIdentity = {
  name: 'Relovie AB',
  aliases: ['Relovie', 'Relovie.com'],
  domain: 'relovie.com',
}

// Captured live on 2026-08-20: what ChatGPT cited when asked to recommend
// Relovie AB, in a run where it performed no searches at all. Relivo and Reliwe
// are real, separate Swedish companies — the last URL is Relivo writing about
// Athletic Greens, a supplements brand. None of it is about Relovie.
const WRONG_CITATIONS = [
  'https://www.reliwe.se/',
  'https://optiman.se/relivo-recension',
  'https://relivo.se',
  'https://se.trustpilot.com/review/relivo.se',
  'https://relivo.se/artiklar/relivo-basta-alternativet-till-athletic-greens-ag1',
]

describe('hostLabel', () => {
  it('reduces a host to the name that can be confused', () => {
    expect(hostLabel('https://www.relivo.se/')).toBe('relivo')
    expect(hostLabel('se.trustpilot.com')).toBe('trustpilot')
    expect(hostLabel('relovie.com')).toBe('relovie')
  })

  it('looks past a country-code second level', () => {
    expect(hostLabel('shop.example.co.uk')).toBe('example')
  })
})

describe('foldName', () => {
  it('folds case, accents and punctuation to the comparison alphabet', () => {
    expect(foldName('Relovie AB')).toBe('relovieab')
    expect(foldName('Björk & Co.')).toBe('bjorkco')
  })
})

describe('classifyCitedUrl', () => {
  it('flags every wrong citation from the 2026-08-20 run', () => {
    for (const url of WRONG_CITATIONS) {
      const verdict = classifyCitedUrl(url, RELOVIE)
      expect(verdict, `expected a verdict for ${url}`).not.toBeNull()
      expect(verdict!.similarTo).toMatch(/relovie/)
    }
  })

  it('catches the look-alike in the host, and in a third party’s path', () => {
    expect(classifyCitedUrl('https://relivo.se', RELOVIE)).toMatchObject({ where: 'host' })
    // Trustpilot is a legitimate site; the page is a review of the other
    // company, which the host alone cannot reveal.
    expect(classifyCitedUrl('https://se.trustpilot.com/review/relivo.se', RELOVIE)).toMatchObject({
      where: 'path',
    })
    expect(classifyCitedUrl('https://optiman.se/relivo-recension', RELOVIE)).toMatchObject({
      where: 'path',
    })
  })

  it('reads relivo as the same letters reshuffled, not as a typo', () => {
    // Levenshtein('relivo','relovie') is 3 — outside any typo threshold that
    // would not also flag half the web. The shared prefix plus the near-equal
    // letter bag is what identifies it.
    const v = classifyCitedUrl('https://relivo.se', RELOVIE)
    expect(v).toMatchObject({ reason: 'reshuffled', similarTo: 'relovie' })
    expect(v!.distance).toBeGreaterThan(2)
  })

  it('says nothing about the brand’s own domain', () => {
    expect(classifyCitedUrl('https://relovie.com/om-oss', RELOVIE)).toBeNull()
    expect(classifyCitedUrl('https://www.relovie.com/', RELOVIE)).toBeNull()
    expect(classifyCitedUrl('https://relovie.se/blog', RELOVIE)).toBeNull()
  })

  it('says nothing about ordinary third parties', () => {
    // The whole value of this check is that it stays quiet on real sources.
    for (const url of [
      'https://tradera.com/kategori/begagnat',
      'https://blocket.se/annons/1',
      'https://allabolag.se/5594445685/relovie-ab',
      'https://impactloop.se/artikel/forsta-aret-med-intakter-for-begagnat-uppstickaren-relovie',
      'https://prisjakt.nu/produkt',
      'https://sv.wikipedia.org/wiki/Begagnathandel',
    ]) {
      expect(classifyCitedUrl(url, RELOVIE), `false positive on ${url}`).toBeNull()
    }
  })

  it('flags a one-edit typosquat as a typo', () => {
    expect(classifyCitedUrl('https://relovie.co', RELOVIE)).toBeNull() // same label, our name
    expect(classifyCitedUrl('https://reIovie.se', RELOVIE)).toMatchObject({ reason: 'typo' })
  })

  it('needs a brand identity to say anything', () => {
    expect(classifyCitedUrl('https://relivo.se', { name: '' })).toBeNull()
    // Very short names are excluded: at three letters everything resembles
    // everything.
    expect(classifyCitedUrl('https://abd.se', { name: 'abc' })).toBeNull()
  })

  it('survives a string that is not a URL', () => {
    expect(classifyCitedUrl('not a url', RELOVIE)).toBeNull()
  })
})

describe('findConfusableCitations', () => {
  it('groups by host and ranks by how often the engines reached for it', () => {
    const rows = [
      WRONG_CITATIONS,
      ['https://relivo.se/nagot-annat', 'https://relovie.com/om-oss'],
      ['https://tradera.com/x'],
      null,
    ]
    const found = findConfusableCitations(rows, RELOVIE)
    expect(found.map((f) => f.domain)).toEqual([
      'relivo.se',
      'optiman.se',
      'reliwe.se',
      'se.trustpilot.com',
    ])
    expect(found[0]).toMatchObject({ domain: 'relivo.se', citations: 3 })
    expect(found[0]!.sampleUrls.length).toBeLessThanOrEqual(3)
  })

  it('returns nothing when every citation is legitimate', () => {
    expect(
      findConfusableCitations([['https://tradera.com/x', 'https://relovie.com/y']], RELOVIE),
    ).toEqual([])
  })
})
