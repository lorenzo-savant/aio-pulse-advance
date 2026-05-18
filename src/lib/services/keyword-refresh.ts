import { DataForSEOProvider } from '@/lib/providers/dataforseo-provider'
import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export interface KeywordRefreshConfig {
  brandId: string
  keywords: string[]
  locationCode?: number
  languageCode?: string
}

export interface KeywordRefreshResult {
  brandId: string
  keywordsUpdated: number
  newKeywords: Array<{
    keyword: string
    searchVolume: number
    competition: number
    cpc: number
    intent?: string
  }>
}

export async function refreshKeywordData(
  config: KeywordRefreshConfig,
): Promise<KeywordRefreshResult> {
  const provider = new DataForSEOProvider()
  if (!provider.isConfigured()) {
    throw new Error('DataForSEO not configured')
  }

  const newKeywords: KeywordRefreshResult['newKeywords'] = []
  let keywordsUpdated = 0

  for (const keyword of config.keywords) {
    try {
      const suggestions = await provider.getKeywordSuggestions(
        keyword,
        config.locationCode || 2840,
        config.languageCode || 'en',
      )

      const data = suggestions[0]
      if (!data) continue

      const volume = data.searchVolume ?? 0
      const competition = data.competition ?? 0
      const cpc = data.cpc ?? 0
      const intent = detectSearchIntent(keyword, { keyword })

      newKeywords.push({
        keyword,
        searchVolume: volume,
        competition,
        cpc,
        intent,
      })

      keywordsUpdated++
    } catch (err) {
      logger.error('Keyword refresh failed', {
        keyword,
        error: String(err),
      })
    }
  }

  const supabase = createServerClient()
  if (supabase && newKeywords.length > 0) {
    const records = newKeywords.map((k) => ({
      brand_id: config.brandId,
      keyword: k.keyword,
      search_volume: k.searchVolume,
      competition: k.competition,
      cpc: k.cpc,
      intent: k.intent,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await (supabase as any).from('keyword_research').insert(records)
    if (error) {
      logger.error('Failed to save keyword data', { error: String(error) })
    }
  }

  return {
    brandId: config.brandId,
    keywordsUpdated,
    newKeywords,
  }
}

function detectSearchIntent(keyword: string, _data: { keyword: string }): string {
  const lower = keyword.toLowerCase()

  if (lower.startsWith('how') || lower.startsWith('what') || lower.startsWith('why')) {
    return 'informational'
  }
  if (lower.includes('buy') || lower.includes('price') || lower.includes('cheap')) {
    return 'transactional'
  }
  if (lower.includes('best') || lower.includes('top') || lower.includes('review')) {
    return 'commercial'
  }
  if (lower.includes('login') || lower.startsWith('www.')) {
    return 'navigational'
  }

  return 'informational'
}

export async function refreshAllBrandKeywords(): Promise<{
  success: number
  failed: number
  totalKeywords: number
}> {
  const supabase = createServerClient()
  if (!supabase) {
    throw new Error('Database not configured')
  }

  const { data: brands, error } = await supabase
    .from('brands')
    .select('id, name')
    .eq('is_active', true)

  if (error) {
    throw new Error(`Failed to fetch brands: ${error.message}`)
  }

  let success = 0
  let failed = 0
  let totalKeywords = 0

  const defaultKeywords = ['AEO optimization', 'GEO strategy', 'AI search optimization']

  for (const brand of brands || []) {
    try {
      const result = await refreshKeywordData({
        brandId: brand.id,
        keywords: defaultKeywords,
      })

      success++
      totalKeywords += result.keywordsUpdated
      logger.info('Keyword refresh complete', {
        brand: brand.name,
        keywords: result.keywordsUpdated,
      })
    } catch (err) {
      failed++
      logger.error('Keyword refresh failed for brand', {
        brandId: brand.id,
        brand: brand.name,
        error: String(err),
      })
    }
  }

  return { success, failed, totalKeywords }
}
