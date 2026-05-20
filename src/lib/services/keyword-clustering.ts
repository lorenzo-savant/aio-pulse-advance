import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

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

// Implicit competitor signals for brands whose `competitors` column is empty
// in onboarding. Without these, the Market Context cluster is always 0
// because no keyword matches `brand.competitors`. We bootstrap a sane
// default from the brand name / industry — these are well-known
// competitors that appear in monitoring data even when not configured.
// User can still curate brand.competitors to override.
const IMPLICIT_COMPETITORS: Array<{ brandMatch: RegExp; competitors: string[] }> = [
  // Casting / talent platforms — Swedish + global. Mirrors the Casting
  // industry preset from prompt-generator.ts so monitoring and tooling
  // agree on the set.
  {
    brandMatch: /\bacasting\b/i,
    competitors: ['stagepool', 'starnow', 'backstage', 'spotlight', 'statist.se'],
  },
]

function implicitCompetitorsFor(brand: BrandInfo): string[] {
  // If the user has configured competitors, trust them — don't auto-add.
  if (brand.competitors && brand.competitors.length > 0) return []
  for (const entry of IMPLICIT_COMPETITORS) {
    if (entry.brandMatch.test(brand.name)) return entry.competitors.map((c) => c.toLowerCase())
  }
  return []
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
