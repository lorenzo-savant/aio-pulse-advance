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

function classifyKeyword(keyword: string, brand: BrandInfo): 'identity' | 'product' | 'market' {
  const lower = keyword.toLowerCase()

  const brandTokens = [
    brand.name.toLowerCase(),
    ...(brand.aliases ?? []).map((a) => a.toLowerCase()),
  ]
  const competitorTokens = (brand.competitors ?? []).map((c) => c.toLowerCase())

  if (brandTokens.some((t) => lower === t || lower.includes(t) || t.includes(lower))) {
    return 'identity'
  }

  if (competitorTokens.some((c) => lower === c || lower.includes(c))) {
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

  const identityScore = identityTerms.filter((t) => lower.includes(t)).length
  const productScore = productTerms.filter((t) => lower.includes(t)).length
  const marketScore =
    marketTerms.filter((t) => lower.includes(t)).length +
    competitorTokens.filter((c) => lower.includes(c)).length

  if (brand.industry && lower.includes(brand.industry.toLowerCase())) {
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

  const { data: keywords, error: fetchError } = await db
    .from('keyword_tracking')
    .select('id, keyword, cluster')
    .eq('brand_id', brandId)
    .is('cluster', null)

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
