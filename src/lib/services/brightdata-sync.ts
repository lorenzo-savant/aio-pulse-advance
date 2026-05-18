import {
  getBrightDataProvider,
  type BrightDataScrapeResult,
} from '@/lib/providers/brightdata-provider'
import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export interface BrandMonitorConfig {
  brandId: string
  brandName: string
  domain: string
  keywords: string[]
  datasetId: string
  geolocation?: string
}

export interface BrandMonitorResult {
  brandId: string
  results: Array<{
    keyword: string
    url: string
    scrapeResult: BrightDataScrapeResult
    timestamp: string
  }>
}

export async function scrapeBrandMentions(config: BrandMonitorConfig): Promise<BrandMonitorResult> {
  const provider = getBrightDataProvider()
  if (!provider.isConfigured()) {
    throw new Error('Bright Data not configured. Set BRIGHT_DATA_API_KEY')
  }

  const results: BrandMonitorResult['results'] = []

  for (const keyword of config.keywords) {
    try {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword + ' ' + config.brandName)}`

      const scrapeResult = await provider.scrape({
        datasetId: config.datasetId,
        url: searchUrl,
        prompt: `Find mentions of ${config.brandName} in the search results. Extract the brand name, any associated URLs, and whether the brand is cited in AI overviews or featured snippets.`,
        geolocation: config.geolocation,
      })

      results.push({
        keyword,
        url: searchUrl,
        scrapeResult,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      logger.error('Bright Data scrape failed', {
        brand: config.brandName,
        keyword,
        error: String(err),
      })
    }
  }

  const supabase = createServerClient()
  if (supabase) {
    const records = results.map((r) => ({
      brand_id: config.brandId,
      keyword: r.keyword,
      source_url: r.url,
      answer_text: r.scrapeResult.answer.slice(0, 5000),
      sources: r.scrapeResult.sources as unknown as string[],
      snapshot_id: r.scrapeResult.snapshotId,
      scraped_at: r.timestamp,
    }))

    const { error } = await (supabase as any).from('scraper_configs').insert(records)
    if (error) {
      logger.error('Failed to save scrape results', { error: String(error) })
    }
  }

  return {
    brandId: config.brandId,
    results,
  }
}

export async function scrapeAllBrands(): Promise<{
  success: number
  failed: number
  totalScrapes: number
}> {
  const supabase = createServerClient()
  if (!supabase) {
    throw new Error('Database not configured')
  }

  const { data: brands, error } = await supabase
    .from('brands')
    .select('id, name, domain')
    .eq('is_active', true)

  if (error) {
    throw new Error(`Failed to fetch brands: ${error.message}`)
  }

  let success = 0
  let failed = 0
  let totalScrapes = 0

  const defaultDatasetId = process.env.BRIGHT_DATA_DEFAULT_DATASET_ID || ''
  const defaultKeywords = ['AEO', 'GEO', 'AI optimization']

  for (const brand of brands || []) {
    try {
      if (!brand.domain) {
        logger.warn('Skipping brand - no domain', { brandId: brand.id })
        continue
      }

      const result = await scrapeBrandMentions({
        brandId: brand.id,
        brandName: brand.name,
        domain: brand.domain,
        keywords: defaultKeywords,
        datasetId: defaultDatasetId,
      })

      success++
      totalScrapes += result.results.length
      logger.info('Brand scrape complete', { brand: brand.name, scrapes: result.results.length })
    } catch (err) {
      failed++
      logger.error('Brand scrape failed', {
        brandId: brand.id,
        brand: brand.name,
        error: String(err),
      })
    }
  }

  return { success, failed, totalScrapes }
}
