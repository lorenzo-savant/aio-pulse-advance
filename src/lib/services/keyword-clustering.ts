import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import { suggestedClusterFor } from './keyword-tracker'

interface BrandInfo {
  name: string
  aliases: string[] | null
  competitors: string[] | null
  industry: string | null
}

async function getBrandInfo(brandId: string): Promise<BrandInfo | null> {
  const db = createServerClient()
  if (!db) return null

  const { data } = await db
    .from('brands')
    .select('name, aliases, competitors, industry')
    .eq('id', brandId)
    .single()

  return data as BrandInfo | null
}

// Brand names that are routinely confused with the monitored brand.
// Keep in sync with the disambiguation tables in brand-enrichment.ts /
// advisor.ts. Keywords matching one of these lookalikes for a given brand
// are NEVER classified as identity of THAT brand — they refer to a
// different company that happens to share letters.
const BRAND_LOOKALIKES: Array<{ brandMatch: RegExp; lookalikes: string[] }> = [
  // Monitoring Acasting (.se / .ai / .com) → "Acast" is a different company
  // (Swedish podcast hosting platform). Without this exclusion the
  // substring-bug below classifies "acast" as part of the Acasting brand
  // identity cluster.
  { brandMatch: /\bacasting\b/i, lookalikes: ['acast'] },
]

// Implicit competitor signals — by industry vertical. When brand.competitors
// is empty, the classifier seeds from the matching vertical's well-known
// competitors so Market Context isn't perpetually empty. User-configured
// competitors always override the implicit set.
//
// Aligned with the presets in src/lib/services/prompt-generator.ts. Add a
// new vertical here when adding to prompt-generator.
const INDUSTRY_IMPLICIT_COMPETITORS: Record<string, string[]> = {
  casting: ['stagepool', 'starnow', 'backstage', 'spotlight', 'statist.se', 'actoraccess'],
  saas: ['notion', 'airtable', 'monday', 'asana', 'clickup', 'linear'],
  ecommerce: ['shopify', 'woocommerce', 'bigcommerce', 'wix', 'squarespace', 'amazon'],
  local: ['google maps', 'yelp', 'tripadvisor', 'facebook'],
}

// Match brand.industry free-text to a vertical key. Same logic as in
// keyword-tracker.ts so the two stay aligned.
const INDUSTRY_PATTERNS: Array<{
  vertical: keyof typeof INDUSTRY_IMPLICIT_COMPETITORS
  patterns: RegExp[]
}> = [
  {
    vertical: 'casting',
    patterns: [
      /\bcasting\b/i,
      /\btalent\b/i,
      /\bactor\b/i,
      /\baudition\b/i,
      /\bfilm\b/i,
      /\bmedia\b/i,
    ],
  },
  {
    vertical: 'saas',
    patterns: [
      /\bsaas\b/i,
      /\bsoftware\b/i,
      /\b(b2b|enterprise|martech)\b/i,
      /\bcloud\b/i,
      /\bapi\b/i,
    ],
  },
  {
    vertical: 'ecommerce',
    patterns: [/\be-?commerce\b/i, /\bretail\b/i, /\bshop\b/i, /\bstore\b/i],
  },
  {
    vertical: 'local',
    patterns: [/\blocal\b/i, /\bsalon\b/i, /\bclinic\b/i, /\brestaurant\b/i, /\bservice\b/i],
  },
]

function verticalForIndustry(
  industry: string | null,
): keyof typeof INDUSTRY_IMPLICIT_COMPETITORS | null {
  if (!industry) return null
  for (const entry of INDUSTRY_PATTERNS) {
    if (entry.patterns.some((p) => p.test(industry))) return entry.vertical
  }
  return null
}

function implicitCompetitorsFor(brand: BrandInfo): string[] {
  // If the user has configured competitors, trust them — don't auto-add.
  if (brand.competitors && brand.competitors.length > 0) return []
  const vertical = verticalForIndustry(brand.industry)
  if (!vertical) return []
  const list = INDUSTRY_IMPLICIT_COMPETITORS[vertical]
  return list ? list.map((c) => c.toLowerCase()) : []
}

function lookalikesFor(brandName: string): Set<string> {
  const out = new Set<string>()
  for (const entry of BRAND_LOOKALIKES) {
    if (entry.brandMatch.test(brandName)) {
      for (const l of entry.lookalikes) out.add(l.toLowerCase())
    }
  }
  return out
}

// Word-boundary tester. Use this everywhere we'd otherwise be tempted to
// do `haystack.includes(needle)` for brand/competitor names — substring
// containment is a JS trap that conflates look-alike brands (the famous
// "acasting".includes("acast") === true bug).
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
function wholeWordMatch(haystack: string, needle: string): boolean {
  if (!needle) return false
  return new RegExp(`\\b${escapeRegex(needle)}\\b`, 'i').test(haystack)
}

function classifyKeyword(keyword: string, brand: BrandInfo): 'identity' | 'product' | 'market' {
  const lower = keyword.toLowerCase()

  const brandTokens = [
    brand.name.toLowerCase(),
    ...(brand.aliases ?? []).map((a) => a.toLowerCase()),
  ]
  const competitorTokens = [
    ...(brand.competitors ?? []).map((c) => c.toLowerCase()),
    ...implicitCompetitorsFor(brand),
  ]
  const lookalikes = lookalikesFor(brand.name)

  // If the keyword IS a known look-alike of this brand (e.g. "acast" when
  // we're monitoring "Acasting"), it represents a DIFFERENT company. Bucket
  // it as 'market' (competitor-ish) so it doesn't pollute the brand
  // identity cluster.
  if (lookalikes.has(lower)) return 'market'

  // Brand identity: keyword must MATCH the brand token as a whole word,
  // not be a substring of it. The previous `lower.includes(t) || t.includes(lower)`
  // form classified "acast" as identity of "Acasting" because the string
  // "acasting" contains "acast".
  if (brandTokens.some((t) => wholeWordMatch(lower, t))) {
    return 'identity'
  }

  // Same fix for competitors: word-boundary match only.
  if (competitorTokens.some((c) => wholeWordMatch(lower, c))) {
    return 'market'
  }

  // Industry vocabulary / geo signal: pre-classified bucket overrides the
  // generic term scoring below. "skådespelare" / "audition" → Product
  // (casting domain vocab); "subscription" / "pricing" → Product (SaaS);
  // "stockholm" / "milano" → Market Context (geo).
  // The brand.industry field picks the right vocab set; geo is industry-blind.
  const suggested = suggestedClusterFor(lower, brand.industry)
  if (suggested) return suggested

  const identityTerms = [
    'brand',
    'values',
    'mission',
    'vision',
    'heritage',
    'about',
    'founder',
    'culture',
    'philosophy',
    'identity',
  ]
  const productTerms = [
    'pricing',
    'price',
    'cost',
    'product',
    'feature',
    'integration',
    'tool',
    'platform',
    'software',
    'app',
    'solution',
    'service',
    'plan',
    'subscription',
    'tier',
    'enterprise',
    'business',
    'premium',
    'free',
    'trial',
    'demo',
    'support',
  ]
  const marketTerms = [
    'vs',
    'alternative',
    'competitor',
    'comparison',
    'review',
    'rating',
    'market',
    'industry',
    'trend',
    'share',
    'growth',
    'landscape',
    'best',
    'top',
    'leading',
    'cheap',
    'expensive',
  ]

  // Use word-boundary match for term scoring too — substring matches on
  // generic terms like "brand", "market", "tool" otherwise score
  // unrelated keywords (e.g. "platform" hits productScore via "plan").
  const identityScore = identityTerms.filter((t) => wholeWordMatch(lower, t)).length
  const productScore = productTerms.filter((t) => wholeWordMatch(lower, t)).length
  const marketScore =
    marketTerms.filter((t) => wholeWordMatch(lower, t)).length +
    competitorTokens.filter((c) => wholeWordMatch(lower, c)).length

  if (brand.industry && wholeWordMatch(lower, brand.industry.toLowerCase())) {
    return 'market'
  }

  if (identityScore >= productScore && identityScore >= marketScore && identityScore > 0) {
    return 'identity'
  }
  if (marketScore >= productScore && marketScore > 0) {
    return 'market'
  }

  return 'product'
}

export async function classifyKeywordsForBrand(
  brandId: string,
  options: { force?: boolean } = {},
): Promise<{ classified: number; errors: string[] }> {
  const errors: string[] = []
  const db = createServerClient()
  if (!db) {
    return { classified: 0, errors: ['Database not configured'] }
  }

  const brand = await getBrandInfo(brandId)
  if (!brand) {
    return { classified: 0, errors: [`Brand ${brandId} not found`] }
  }

  // By default, only classify rows that have never been classified
  // (cluster IS NULL). Pass `force: true` to re-classify EVERY keyword —
  // needed when the classifier rules change (e.g. after fixing the
  // substring-confusion bug that put "acast" into the Acasting identity
  // cluster, existing rows need re-classification with the corrected rules).
  let query = db.from('keyword_tracking').select('id, keyword, cluster').eq('brand_id', brandId)
  if (!options.force) query = query.is('cluster', null)
  const { data: keywords, error: fetchError } = await query

  if (fetchError || !keywords || keywords.length === 0) {
    return { classified: 0, errors: fetchError ? [fetchError.message] : [] }
  }

  let classified = 0
  for (const kw of keywords) {
    try {
      const cluster = classifyKeyword(kw.keyword, brand)
      const { error: updateError } = await db
        .from('keyword_tracking')
        .update({
          cluster,
          cluster_generated_at: new Date().toISOString(),
        })
        .eq('id', kw.id)

      if (updateError) {
        errors.push(`Failed to update ${kw.keyword}: ${updateError.message}`)
      } else {
        classified++
      }
    } catch (err) {
      errors.push(`Error classifying ${kw.keyword}: ${String(err)}`)
    }
  }

  if (classified > 0) {
    logger.info('Keywords classified', {
      service: 'keyword-clustering',
      brandId,
      classified,
    })
  }

  return { classified, errors }
}
