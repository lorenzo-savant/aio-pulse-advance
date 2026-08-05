import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { generatePdf } from '@/lib/services/pdf-generator'
import { verifyBrandAccess } from '@/lib/authorize'
import { checkRateLimit, getClientIp } from '@/lib/ratelimit'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' })
  }

  const ip = getClientIp(req.headers)
  const rateCheck = await checkRateLimit(`reports:${ip}`, 10, 60_000)
  if (!rateCheck.success) {
    return NextResponse.json(
      { success: false, message: 'Rate limit exceeded. Try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rateCheck.resetAt - Date.now()) / 1000)) },
      },
    )
  }

  const { searchParams } = new URL(req.url)
  const brandId = searchParams.get('brandId')
  const locale = searchParams.get('locale') || 'en'

  if (!brandId) {
    return NextResponse.json({ success: false, message: 'brandId is required' }, { status: 400 })
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json(
      { success: false, message: 'Database not configured' },
      { status: 503 },
    )
  }

  const brand = await verifyBrandAccess(brandId, userId)
  if (!brand) {
    return NextResponse.json(
      { success: false, message: 'Brand not found or access denied' },
      { status: 404 },
    )
  }

  const fromDate =
    searchParams.get('from') ||
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const toDate = searchParams.get('to') || new Date().toISOString().split('T')[0]

  const { data: results, error: resultsError } = await db
    .from('monitoring_results')
    .select('*, prompt:prompts(text, category)')
    .eq('brand_id', brandId)
    .gte('created_at', fromDate)
    .lte('created_at', toDate + 'T23:59:59')
    .order('created_at', { ascending: false })

  if (resultsError) {
    logger.error('Failed to fetch monitoring results for PDF', {
      error: resultsError.message,
      brandId,
    })
    return NextResponse.json({ success: false, message: resultsError.message }, { status: 500 })
  }

  // `sentiment_history` does not exist. Verified read-only against production
  // on 2026-08-05: PostgREST answers "Could not find the table". The TODO that
  // stood here called it schema drift, which implied the table was somewhere —
  // it is not, in this project or any other.
  //
  // So every PDF has issued this query, taken the error, logged a warning and
  // shipped without the section. Removing the round-trip changes nothing a
  // reader sees and stops the report asking a question that has no answer.
  //
  // Not deleted, because whether this section comes back is a product call: the
  // data it wants is derivable from monitoring_results.sentiment_score grouped
  // by day, which is how it would be rebuilt if anyone wants it.
  const sentimentHistory: Array<{
    snapshot_date: string
    sentiment_score: number
    positive_count: number
    neutral_count: number
    negative_count: number
  }> = []

  const { data: recommendations, error: recError } = await db
    .from('recommendation_tracking')
    .select('recommendation_text, priority, category')
    .eq('brand_id', brandId)
    .eq('status', 'active')
    .order('priority', { ascending: false })
    .limit(10)

  if (recError) {
    logger.warn('Failed to fetch recommendations for PDF', { error: recError.message })
  }

  try {
    const brandData = {
      id: brand.id,
      user_id: brand.user_id || '',
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      domain: brand.domain,
      aliases: brand.aliases || [],
      domains: brand.domain ? [brand.domain] : [],
      competitors: brand.competitors || [],
      industry: brand.industry,
      color: brand.color || '#6366f1',
      logo_url: brand.logo_url,
      is_active: brand.is_active ?? true,
      created_at: brand.created_at || new Date().toISOString(),
      updated_at: brand.updated_at || new Date().toISOString(),
      language: (brand.language as 'en' | 'it' | 'sv') || 'en',
      report_logo_url: brand.report_logo_url,
      report_brand_name: brand.report_brand_name,
      report_primary_color: brand.report_primary_color,
    }

    const reportData = {
      brandName: brand.name || 'Brand',
      fromDate: fromDate as string,
      toDate: toDate as string,
      results: (results || []).map((r: any) => ({
        created_at: r.created_at,
        engine: r.engine,
        brand_mentioned: r.brand_mentioned ?? false,
        visibility_score: r.visibility_score ?? 0,
        sentiment: r.sentiment,
        sentiment_score: r.sentiment_score,
        url: r.url,
        cited_urls: r.cited_urls || [],
        has_hallucination: r.has_hallucination ?? false,
        competitor_mentions: r.competitor_mentions || [],
      })),
      sentimentHistory: sentimentHistory || [],
      recommendations: (recommendations || []).map((r: any) => ({
        recommendation_text: r.recommendation_text,
        priority: r.priority,
        category: r.category,
      })),
      competitors: brand.competitors || [],
    }

    const pdfBuffer = await generatePdf(brandData, reportData, { locale })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${brand.name || 'brand'}-report-${fromDate}-${toDate}.pdf"`,
      },
    })
  } catch (pdfError) {
    logger.error('PDF generation error', { source: 'reports', error: String(pdfError), brandId })
    return NextResponse.json(
      {
        success: false,
        message: `PDF generation failed: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`,
      },
      { status: 500 },
    )
  }
}
