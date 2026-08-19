import { describe, it, expect } from 'vitest'
import { classifySources, type SourceTaxonomyRow } from '../services/source-taxonomy'

const COMPETITORS = ['Tradera', 'Blocket AB']

function row(over: Partial<SourceTaxonomyRow> = {}): SourceTaxonomyRow {
  return {
    cited_urls: ['https://example.com/guide'],
    brand_mentioned: false,
    competitor_mentions: null,
    ...over,
  }
}

/** A response that named the brand and cited these domains. */
function withBrand(urls: string[]): SourceTaxonomyRow {
  return row({ cited_urls: urls, brand_mentioned: true })
}

/** A response that named a declared competitor and cited these domains. */
function withRival(urls: string[], name = 'Tradera'): SourceTaxonomyRow {
  return row({ cited_urls: urls, brand_mentioned: false, competitor_mentions: [{ name }] })
}

describe('classifySources', () => {
  it('files a domain the engines only use for the rivals as missing', () => {
    const r = classifySources(
      [withRival(['https://prisjakt.nu/a']), withRival(['https://prisjakt.nu/b'])],
      {
        competitors: COMPETITORS,
      },
    )
    expect(r.sources).toHaveLength(1)
    expect(r.sources[0]).toMatchObject({
      domain: 'prisjakt.nu',
      class: 'missing',
      citedWithBrand: 0,
      citedWithCompetitors: 2,
    })
  })

  it('files a domain only we activate as unique', () => {
    const r = classifySources(
      [withBrand(['https://relovie.se/blog']), withBrand(['https://relovie.se/x'])],
      {
        competitors: COMPETITORS,
      },
    )
    expect(r.sources[0]).toMatchObject({ class: 'unique', citedWithCompetitors: 0 })
  })

  it('separates strong from shared by which side the domain leans to', () => {
    const strong = classifySources(
      [
        withBrand(['https://idg.se/a']),
        withBrand(['https://idg.se/b']),
        withBrand(['https://idg.se/c']),
        withRival(['https://idg.se/d']),
      ],
      { competitors: COMPETITORS },
    )
    expect(strong.sources[0]).toMatchObject({
      class: 'strong',
      citedWithBrand: 3,
      citedWithCompetitors: 1,
    })

    const shared = classifySources(
      [withBrand(['https://idg.se/a']), withRival(['https://idg.se/b'])],
      {
        competitors: COMPETITORS,
      },
    )
    expect(shared.sources[0]).toMatchObject({
      class: 'shared',
      citedWithBrand: 1,
      citedWithCompetitors: 1,
    })
  })

  it('ranks the gaps first — missing before strong, unique and shared', () => {
    const r = classifySources(
      [
        withBrand(['https://mine.se/a', 'https://both.se/a']),
        withBrand(['https://mine.se/b', 'https://both.se/b']),
        withRival(['https://theirs.se/a', 'https://both.se/c']),
        withRival(['https://theirs.se/b', 'https://both.se/d']),
      ],
      { competitors: COMPETITORS },
    )
    expect(r.sources.map((s) => s.class)).toEqual(['missing', 'unique', 'shared'])
  })

  it('holds back a domain seen only once, and says how many', () => {
    const r = classifySources([withRival(['https://onceonly.se/a'])], { competitors: COMPETITORS })
    expect(r.sources).toEqual([])
    expect(r.belowThreshold).toBe(1)
    // A caller that wants every observation can lower the bar.
    expect(
      classifySources([withRival(['https://onceonly.se/a'])], {
        competitors: COMPETITORS,
        minCitations: 1,
      }).sources,
    ).toHaveLength(1)
  })

  it('counts one response once, however many of a domain’s pages it cited', () => {
    const r = classifySources(
      [
        withRival(['https://prisjakt.nu/a', 'https://prisjakt.nu/b', 'https://prisjakt.nu/c']),
        withRival(['https://prisjakt.nu/d']),
      ],
      { competitors: COMPETITORS },
    )
    expect(r.sources[0]!.totalCitations).toBe(2)
  })

  it('treats www.tradera.com and tradera.com as one domain', () => {
    const r = classifySources(
      [withRival(['https://www.tradera.com/x']), withRival(['https://tradera.com/y'])],
      { competitors: COMPETITORS },
    )
    expect(r.sources).toHaveLength(1)
    expect(r.sources[0]).toMatchObject({ domain: 'tradera.com', totalCitations: 2 })
  })

  it('matches a competitor named without its legal suffix', () => {
    // Declared "Blocket AB", observed "Blocket" — the shared matcher folds the
    // suffix, so this is the same company, not an unknown name.
    const r = classifySources(
      [
        withRival(['https://prisjakt.nu/a'], 'Blocket'),
        withRival(['https://prisjakt.nu/b'], 'Blocket'),
      ],
      { competitors: COMPETITORS },
    )
    expect(r.sources[0]).toMatchObject({ class: 'missing', citedWithCompetitors: 2 })
  })

  it('ignores a name that is not on the declared list', () => {
    const r = classifySources(
      [
        withRival(['https://prisjakt.nu/a'], 'Someone Else'),
        withRival(['https://prisjakt.nu/b'], 'Someone Else'),
      ],
      { competitors: COMPETITORS },
    )
    // Cited in answers about neither side: category background, not a plan.
    expect(r.sources).toEqual([])
  })

  it('reports the brand’s own domain apart instead of classifying it', () => {
    const r = classifySources(
      [
        withBrand(['https://relovie.se/a', 'https://idg.se/a']),
        withBrand(['https://blog.relovie.se/b', 'https://idg.se/b']),
      ],
      { competitors: COMPETITORS, ownDomain: 'relovie.se' },
    )
    expect(r.sources.map((s) => s.domain)).toEqual(['idg.se'])
    // Subdomains count as own too.
    expect(r.ownDomain).toEqual({ domain: 'relovie.se', totalCitations: 2 })
  })

  it('refuses to classify at all when no competitor is declared', () => {
    // Without a list every domain would land in 'unique' — a confident answer
    // that means nothing. The flag is how the UI knows to ask for the list.
    const r = classifySources([withBrand(['https://idg.se/a']), withBrand(['https://idg.se/b'])], {
      competitors: [],
    })
    expect(r).toMatchObject({ sources: [], requiresDeclaredCompetitors: true })
  })

  it('survives rows with no citations and unparseable urls', () => {
    const r = classifySources(
      [
        row({ cited_urls: null }),
        row({ cited_urls: [] }),
        withRival(['not a url', 'https://prisjakt.nu/a']),
        withRival(['https://prisjakt.nu/b']),
      ],
      { competitors: COMPETITORS },
    )
    expect(r.sources.map((s) => s.domain)).toEqual(['prisjakt.nu'])
  })
})
