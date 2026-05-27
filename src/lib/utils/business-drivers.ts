// PATH: src/lib/utils/business-drivers.ts
//
// Mines AI-monitoring response text for "key business drivers" — the
// attributes LLMs use to differentiate brands (pricing, speed, quality,
// customer support, features, value, reliability, ease of use).
//
// Closes the gap from the industry research "Brand Performance" piece:
//   "The Key Business Drivers heatmap shows which attributes (like
//    pricing, fulfillment speed, or product assortment) AI mentions
//    most often for each brand in your category. Notice the trophy
//    icon marking the leader for each driver. Scan for topics where
//    competitors have the trophy and your brand ranks low — those are
//    your narrative gaps."
//
// We have monitoring_results.response_text per (brand, engine, prompt).
// For each row we count which drivers appear in the response text in
// the context of the brand vs each competitor. The "winner" for a
// driver is the brand mentioned alongside that driver most often.
//
// Pure, no network, no LLM. The driver keyword sets are
// multi-lingual (EN/IT/SV) so they work for the Swedish test brands
// without relying on an LLM classifier.

export type DriverId =
  | 'pricing'
  | 'speed'
  | 'quality'
  | 'support'
  | 'features'
  | 'value'
  | 'reliability'
  | 'ease_of_use'

export interface MonitoringRowForDrivers {
  brand_mentioned: boolean | null
  response_text: string | null
  competitor_mentions: Array<{ name?: string | null }> | null
}

export interface DriverDefinition {
  id: DriverId
  label: string
  keywords: string[]
}

// Keyword sets are intentionally short — recall over precision. Each
// keyword is matched case-insensitively as a substring (so "pricing"
// inside "best pricing" matches). We include EN + IT + SV variants for
// the brands acasting.se and savantmedia.se.
export const DRIVER_DEFINITIONS: DriverDefinition[] = [
  {
    id: 'pricing',
    label: 'Pricing',
    keywords: [
      'price',
      'pricing',
      'cost',
      'expensive',
      'affordable',
      'cheap',
      'budget',
      'free',
      'paid',
      // it
      'prezzo',
      'costo',
      'economico',
      'gratuito',
      // sv
      'pris',
      'kostnad',
      'billig',
      'dyr',
    ],
  },
  {
    id: 'speed',
    label: 'Speed',
    keywords: [
      'fast',
      'quick',
      'slow',
      'speed',
      'delivery',
      'turnaround',
      'response time',
      // it
      'veloce',
      'rapido',
      'lento',
      'consegna',
      // sv
      'snabb',
      'långsam',
      'leverans',
    ],
  },
  {
    id: 'quality',
    label: 'Quality',
    keywords: [
      'quality',
      'reliable',
      'professional',
      'premium',
      'high-quality',
      'low-quality',
      // it
      'qualità',
      'professionale',
      'affidabile',
      // sv
      'kvalitet',
      'professionell',
      'pålitlig',
    ],
  },
  {
    id: 'support',
    label: 'Support',
    keywords: [
      'support',
      'customer service',
      'help desk',
      'responsive',
      'unresponsive',
      'documentation',
      // it
      'assistenza',
      'supporto',
      'servizio clienti',
      // sv
      'support',
      'kundtjänst',
    ],
  },
  {
    id: 'features',
    label: 'Features',
    keywords: [
      'feature',
      'functionality',
      'capability',
      'tool',
      'option',
      'integration',
      'integrations',
      // it
      'funzionalità',
      'caratteristica',
      'integrazione',
      // sv
      'funktion',
      'integration',
    ],
  },
  {
    id: 'value',
    label: 'Value',
    keywords: [
      'value',
      'worth',
      'roi',
      'return on investment',
      'overpriced',
      'great deal',
      // it
      'valore',
      'conveniente',
      // sv
      'värde',
      'lönsam',
    ],
  },
  {
    id: 'reliability',
    label: 'Reliability',
    keywords: [
      'reliable',
      'reliability',
      'uptime',
      'downtime',
      'stable',
      'unstable',
      'consistent',
      // it
      'affidabilità',
      'stabile',
      // sv
      'tillförlitlig',
      'stabil',
    ],
  },
  {
    id: 'ease_of_use',
    label: 'Ease of use',
    keywords: [
      'easy to use',
      'user-friendly',
      'intuitive',
      'simple',
      'complicated',
      'learning curve',
      // it
      'facile',
      'intuitivo',
      // sv
      'användarvänlig',
      'enkel',
    ],
  },
]

export interface DriverScore {
  brand: string
  isBrand: boolean
  /** How many responses mention this driver alongside this brand. */
  mentions: number
  /** Share % within this driver column (1 decimal). */
  share: number
}

export interface DriverColumn {
  driver: DriverDefinition
  totalMentions: number
  /** Brand that leads on this driver — null when nobody mentioned it. */
  leader: DriverScore | null
  rows: DriverScore[]
}

export interface BusinessDriversReport {
  /** One row per driver with brand × score breakdown. */
  drivers: DriverColumn[]
  /** Total responses analysed. */
  totalResponses: number
  /** Brand list seen in the data, brand first, then competitors sorted by total mentions. */
  brands: Array<{ name: string; isBrand: boolean; totalMentions: number }>
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function findBrandsInText(text: string, names: string[]): Set<string> {
  const hit = new Set<string>()
  const norm = normalize(text)
  for (const name of names) {
    const n = normalize(name).trim()
    if (n.length < 3) continue
    if (norm.includes(n)) hit.add(name)
  }
  return hit
}

function findDriversInText(text: string): Set<DriverId> {
  const norm = normalize(text)
  const hit = new Set<DriverId>()
  for (const def of DRIVER_DEFINITIONS) {
    for (const kw of def.keywords) {
      const key = normalize(kw).trim()
      if (key.length === 0) continue
      if (norm.includes(key)) {
        hit.add(def.id)
        break
      }
    }
  }
  return hit
}

/**
 * Build a brand × driver mention matrix from a set of monitoring
 * responses. A (brand, driver) pair counts ONE if the response
 * mentions both the brand and at least one keyword of that driver.
 * Brand and competitor names are case- and diacritic-insensitive.
 */
export function extractBusinessDrivers(
  rows: MonitoringRowForDrivers[],
  brandName: string,
  competitorNames: string[] = [],
): BusinessDriversReport {
  const brandKey = normalize(brandName)
  // Brand display name + competitor list, dedup'd case-insensitively.
  const displayByKey = new Map<string, { name: string; isBrand: boolean }>()
  displayByKey.set(brandKey, { name: brandName, isBrand: true })
  for (const c of competitorNames) {
    const k = normalize(c)
    if (!k || k === brandKey) continue
    if (!displayByKey.has(k)) displayByKey.set(k, { name: c, isBrand: false })
  }

  // Pull additional competitor names from competitor_mentions[] so the
  // matrix covers everyone who appears in-window, not just the ones the
  // user pre-configured.
  for (const row of rows) {
    for (const cm of row.competitor_mentions ?? []) {
      const name = (cm?.name || '').trim()
      if (!name) continue
      const k = normalize(name)
      if (k === brandKey) continue
      if (!displayByKey.has(k)) displayByKey.set(k, { name, isBrand: false })
    }
  }

  const allNames = [...displayByKey.values()].map((d) => d.name)

  // Per (driver, brand) → mentions count.
  const counts = new Map<string, number>()
  let totalResponses = 0
  for (const row of rows) {
    const text = row.response_text || ''
    if (text.trim().length === 0) continue
    totalResponses++
    const drivers = findDriversInText(text)
    if (drivers.size === 0) continue
    // Which brands are referenced in this response? Always include the
    // user's brand when brand_mentioned=true.
    const brandsHere = findBrandsInText(text, allNames)
    if (row.brand_mentioned === true) brandsHere.add(brandName)
    if (brandsHere.size === 0) continue
    for (const driver of drivers) {
      for (const b of brandsHere) {
        const k = `${driver}::${normalize(b)}`
        counts.set(k, (counts.get(k) ?? 0) + 1)
      }
    }
  }

  // Build the per-driver columns + per-brand totals.
  const brandTotals = new Map<string, number>()
  const columns: DriverColumn[] = DRIVER_DEFINITIONS.map((def) => {
    const rows: DriverScore[] = []
    let total = 0
    for (const [k, info] of displayByKey) {
      const mentions = counts.get(`${def.id}::${k}`) ?? 0
      total += mentions
      brandTotals.set(k, (brandTotals.get(k) ?? 0) + mentions)
      rows.push({ brand: info.name, isBrand: info.isBrand, mentions, share: 0 })
    }
    for (const r of rows) r.share = total > 0 ? Math.round((r.mentions / total) * 1000) / 10 : 0
    rows.sort((a, b) => b.mentions - a.mentions || a.brand.localeCompare(b.brand))
    const leader = total > 0 && rows[0] && rows[0].mentions > 0 ? rows[0] : null
    return { driver: def, totalMentions: total, leader, rows }
  })

  const brands: BusinessDriversReport['brands'] = [...displayByKey.entries()]
    .map(([k, info]) => ({
      name: info.name,
      isBrand: info.isBrand,
      totalMentions: brandTotals.get(k) ?? 0,
    }))
    .sort(
      (a, b) =>
        (b.isBrand ? 1 : 0) - (a.isBrand ? 1 : 0) ||
        b.totalMentions - a.totalMentions ||
        a.name.localeCompare(b.name),
    )

  return { drivers: columns, totalResponses, brands }
}

/**
 * Convenience: "narrative gaps" — drivers where the user's brand is
 * NOT the leader. Sorted by how big the gap is (leader.mentions vs
 * brand.mentions) so the highest-impact rewrites surface first.
 */
export function findNarrativeGaps(report: BusinessDriversReport): Array<{
  driver: DriverDefinition
  leader: DriverScore
  brand: DriverScore | null
  gap: number
}> {
  const gaps: Array<{
    driver: DriverDefinition
    leader: DriverScore
    brand: DriverScore | null
    gap: number
  }> = []
  for (const col of report.drivers) {
    if (!col.leader || col.leader.isBrand) continue
    const brand = col.rows.find((r) => r.isBrand) ?? null
    const gap = col.leader.mentions - (brand?.mentions ?? 0)
    if (gap <= 0) continue
    gaps.push({ driver: col.driver, leader: col.leader, brand, gap })
  }
  return gaps.sort((a, b) => b.gap - a.gap)
}
