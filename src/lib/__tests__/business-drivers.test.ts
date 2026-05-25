import { describe, it, expect } from 'vitest'
import {
  extractBusinessDrivers,
  findNarrativeGaps,
  DRIVER_DEFINITIONS,
  type MonitoringRowForDrivers,
} from '@/lib/utils/business-drivers'

function row(
  text: string,
  opts: { brandMentioned?: boolean; competitors?: string[] } = {},
): MonitoringRowForDrivers {
  return {
    brand_mentioned: opts.brandMentioned ?? false,
    response_text: text,
    competitor_mentions: (opts.competitors ?? []).map((name) => ({ name })),
  }
}

describe('extractBusinessDrivers — basic mining', () => {
  it('counts (brand, driver) pairs from response text', () => {
    const rows: MonitoringRowForDrivers[] = [
      row('Acme has the best pricing in the market.', { brandMentioned: true }),
      row('Rivalry offers premium quality but at a higher price.', {
        competitors: ['Rivalry'],
      }),
      row('Acme is also known for great customer support and reliability.', {
        brandMentioned: true,
      }),
    ]
    const r = extractBusinessDrivers(rows, 'Acme', ['Rivalry'])
    const pricing = r.drivers.find((d) => d.driver.id === 'pricing')!
    const support = r.drivers.find((d) => d.driver.id === 'support')!
    const quality = r.drivers.find((d) => d.driver.id === 'quality')!
    expect(pricing.rows.find((b) => b.isBrand)!.mentions).toBe(1)
    expect(pricing.rows.find((b) => b.brand === 'Rivalry')!.mentions).toBe(1)
    expect(support.rows.find((b) => b.isBrand)!.mentions).toBe(1)
    expect(quality.rows.find((b) => b.brand === 'Rivalry')!.mentions).toBe(1)
  })

  it('picks the leader per driver (highest mentions wins)', () => {
    const rows: MonitoringRowForDrivers[] = [
      row('Acme has fast delivery.', { brandMentioned: true }),
      row('Acme is fast and reliable.', { brandMentioned: true }),
      row('Rivalry is quick and offers same-day delivery.', {
        competitors: ['Rivalry'],
      }),
    ]
    const r = extractBusinessDrivers(rows, 'Acme', ['Rivalry'])
    const speed = r.drivers.find((d) => d.driver.id === 'speed')!
    expect(speed.leader?.isBrand).toBe(true) // Acme wins (2 vs 1)
  })

  it('leader is null when no row mentions the driver', () => {
    const rows: MonitoringRowForDrivers[] = [row('Acme is a brand.', { brandMentioned: true })]
    const r = extractBusinessDrivers(rows, 'Acme')
    // 'ease_of_use' driver never appears.
    const ease = r.drivers.find((d) => d.driver.id === 'ease_of_use')!
    expect(ease.leader).toBeNull()
  })
})

describe('extractBusinessDrivers — multilingual matching', () => {
  it('matches Italian driver keywords', () => {
    const rows: MonitoringRowForDrivers[] = [
      row('Acme ha un ottimo prezzo e qualità professionale.', { brandMentioned: true }),
    ]
    const r = extractBusinessDrivers(rows, 'Acme')
    expect(r.drivers.find((d) => d.driver.id === 'pricing')!.leader?.isBrand).toBe(true)
    expect(r.drivers.find((d) => d.driver.id === 'quality')!.leader?.isBrand).toBe(true)
  })

  it('matches Swedish driver keywords', () => {
    const rows: MonitoringRowForDrivers[] = [
      row('Acme har bra pris och snabb leverans.', { brandMentioned: true }),
    ]
    const r = extractBusinessDrivers(rows, 'Acme')
    expect(r.drivers.find((d) => d.driver.id === 'pricing')!.leader?.isBrand).toBe(true)
    expect(r.drivers.find((d) => d.driver.id === 'speed')!.leader?.isBrand).toBe(true)
  })

  it('matches the brand name case- and diacritic-insensitively', () => {
    const rows: MonitoringRowForDrivers[] = [
      row('SAVÀNT has excellent pricing.', { brandMentioned: true }),
    ]
    const r = extractBusinessDrivers(rows, 'Savant')
    expect(r.drivers.find((d) => d.driver.id === 'pricing')!.leader?.isBrand).toBe(true)
  })
})

describe('extractBusinessDrivers — competitor discovery', () => {
  it('picks up un-configured competitors from competitor_mentions[]', () => {
    const rows: MonitoringRowForDrivers[] = [
      row('NewRival is the cheapest option on the market.', {
        competitors: ['NewRival'],
      }),
    ]
    const r = extractBusinessDrivers(rows, 'Acme') // no configured competitors
    expect(r.brands.find((b) => b.name === 'NewRival')).toBeDefined()
    const pricing = r.drivers.find((d) => d.driver.id === 'pricing')!
    // NewRival wins pricing (mentioned via competitor_mentions[]).
    expect(pricing.leader?.brand).toBe('NewRival')
  })

  it('treats configured competitor with brand-equal name as the brand', () => {
    const rows: MonitoringRowForDrivers[] = [
      row('Acme has cheap pricing.', { brandMentioned: false, competitors: ['Acme'] }),
    ]
    const r = extractBusinessDrivers(rows, 'Acme', ['Acme'])
    expect(r.brands.filter((b) => b.name === 'Acme')).toHaveLength(1)
  })
})

describe('extractBusinessDrivers — share + totals', () => {
  it('share % sums to ~100 per driver column with mentions', () => {
    const rows: MonitoringRowForDrivers[] = [
      row('Acme has cheap pricing.', { brandMentioned: true }),
      row('Rivalry has cheap pricing too.', { competitors: ['Rivalry'] }),
    ]
    const r = extractBusinessDrivers(rows, 'Acme', ['Rivalry'])
    const pricing = r.drivers.find((d) => d.driver.id === 'pricing')!
    const sum = pricing.rows.reduce((s, b) => s + b.share, 0)
    expect(Math.abs(sum - 100)).toBeLessThan(0.5)
  })

  it('totalResponses counts every analysed row (with non-empty text)', () => {
    const rows: MonitoringRowForDrivers[] = [
      row('Acme has good pricing.', { brandMentioned: true }),
      row('Rivalry has fast support.', { competitors: ['Rivalry'] }),
      row('', { brandMentioned: true }), // empty — should be skipped
    ]
    const r = extractBusinessDrivers(rows, 'Acme', ['Rivalry'])
    expect(r.totalResponses).toBe(2)
  })

  it('returns full DRIVER_DEFINITIONS columns even when nobody talks about a driver', () => {
    const r = extractBusinessDrivers([], 'Acme')
    expect(r.drivers).toHaveLength(DRIVER_DEFINITIONS.length)
    expect(r.drivers.every((d) => d.totalMentions === 0 && d.leader === null)).toBe(true)
  })
})

describe('findNarrativeGaps', () => {
  it('lists drivers where a competitor leads, sorted by gap desc', () => {
    const rows: MonitoringRowForDrivers[] = [
      row('Rivalry has the cheapest pricing on the market.', {
        competitors: ['Rivalry'],
      }),
      row('Rivalry pricing is excellent.', { competitors: ['Rivalry'] }),
      row('Acme has good quality and reliable service.', { brandMentioned: true }),
    ]
    const r = extractBusinessDrivers(rows, 'Acme', ['Rivalry'])
    const gaps = findNarrativeGaps(r)
    // Acme leads quality + reliability, Rivalry leads pricing — pricing is the gap.
    expect(gaps.some((g) => g.driver.id === 'pricing')).toBe(true)
    expect(gaps[0]!.driver.id).toBe('pricing')
    expect(gaps[0]!.leader.brand).toBe('Rivalry')
  })

  it('returns empty when the brand leads on every mentioned driver', () => {
    const rows: MonitoringRowForDrivers[] = [
      row('Acme has the best pricing, fast delivery, and high quality.', {
        brandMentioned: true,
      }),
    ]
    const r = extractBusinessDrivers(rows, 'Acme')
    expect(findNarrativeGaps(r)).toEqual([])
  })
})
