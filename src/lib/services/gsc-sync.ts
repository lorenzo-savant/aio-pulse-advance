import { getGscProvider, type GscRow } from '@/lib/providers/gsc-provider'
import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export interface GscSyncConfig {
  siteUrl: string
  daysBack: number
  brandId: string
}

export interface GscSyncResult {
  rowsSynced: number
  topQueries: GscRow[]
  topPages: GscRow[]
  dailyTrend: GscRow[]
  deviceBreakdown: GscRow[]
  countryBreakdown: GscRow[]
}

function getDateRange(daysBack: number): { startDate: string; endDate: string } {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - daysBack)

  return {
    startDate: startDate.toISOString().split('T')[0] ?? '',
    endDate: endDate.toISOString().split('T')[0] ?? '',
  }
}

export async function syncGscData(config: GscSyncConfig): Promise<GscSyncResult> {
  const provider = getGscProvider()
  if (!provider.isConfigured()) {
    throw new Error('GSC not configured. Set GSC_ACCESS_TOKEN or GSC_SERVICE_ACCOUNT_KEY')
  }

  const { startDate, endDate } = getDateRange(config.daysBack)

  const [topQueries, topPages, dailyTrend, deviceBreakdown, countryBreakdown] = await Promise.all([
    provider.getTopQueries(config.siteUrl, startDate, endDate, 100),
    provider.getTopPages(config.siteUrl, startDate, endDate, 100),
    provider.getDailyTrend(config.siteUrl, startDate, endDate),
    provider.getDeviceBreakdown(config.siteUrl, startDate, endDate),
    provider.getCountryBreakdown(config.siteUrl, startDate, endDate),
  ])

  const supabase = createServerClient()
  if (!supabase) {
    throw new Error('Database not configured')
  }

  const records = [
    ...topQueries.map((r) => ({
      brand_id: config.brandId,
      date: endDate,
      dimension_type: 'query',
      dimension_value: r.keys[0] ?? '',
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    })),
    ...topPages.map((r) => ({
      brand_id: config.brandId,
      date: endDate,
      dimension_type: 'page',
      dimension_value: r.keys[0] ?? '',
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    })),
    ...dailyTrend.map((r) => ({
      brand_id: config.brandId,
      date: r.keys[0] ?? endDate,
      dimension_type: 'date',
      dimension_value: r.keys[0] ?? '',
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    })),
  ]

  const { error } = await (supabase as any).from('gsc_performance').insert(records)

  if (error) {
    logger.error('GSC sync DB error', { error: String(error) })
    throw new Error(`Failed to save GSC data: ${error.message}`)
  }

  const totalRows = topQueries.length + topPages.length + dailyTrend.length

  return {
    rowsSynced: totalRows,
    topQueries,
    topPages,
    dailyTrend,
    deviceBreakdown,
    countryBreakdown,
  }
}

export async function syncAllBrandsGsc(): Promise<{
  success: number
  failed: number
  totalRows: number
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
  let totalRows = 0

  for (const brand of brands || []) {
    try {
      const siteUrl = brand.domain
      if (!siteUrl) {
        logger.warn('Skipping brand - no domain', { brandId: brand.id })
        continue
      }

      const result = await syncGscData({
        siteUrl: `https://${siteUrl}`,
        daysBack: 30,
        brandId: brand.id,
      })

      success++
      totalRows += result.rowsSynced
      logger.info('GSC sync success', { brand: brand.name, rows: result.rowsSynced })
    } catch (err) {
      failed++
      logger.error('GSC sync failed for brand', {
        brandId: brand.id,
        brand: brand.name,
        error: String(err),
      })
    }
  }

  return { success, failed, totalRows }
}
