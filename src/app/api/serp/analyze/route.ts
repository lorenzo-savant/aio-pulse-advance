import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { DataForSEOProvider } from '@/lib/providers/dataforseo-provider'
import {
  analyzeBrandPresence,
  detectBrandInAiOverview,
  detectBrandInPaa,
  detectBrandInOrganic,
  calculateOpportunityScore,
  type OpportunityResult,
} from '@/lib/services/ai-overview-detector'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const brandId = searchParams.get('brandId')
  const keyword = searchParams.get('keyword')

  let userId: string
  try {
    userId = await getCurrentUserId(
      request.headers.get('authorization'),
      request.headers.get('cookie'),
    )
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 500 })
  }

  if (!brandId) {
    return NextResponse.json({ error: 'brandId required' }, { status: 400 })
  }

  if (!keyword) {
    return NextResponse.json({ error: 'keyword required' }, { status: 400 })
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  const { data: brand, error: brandError } = await db
    .from('brands')
    .select('id, name, domain')
    .eq('id', brandId)
    .eq('user_id', userId)
    .single()

  if (brandError || !brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  const brandDomain = brand.domain ? new URL(brand.domain).hostname : ''

  if (!brandDomain) {
    return NextResponse.json({ error: 'Brand domain not configured' }, { status: 400 })
  }

  try {
    const provider = new DataForSEOProvider()

    if (!provider.isConfigured()) {
      return NextResponse.json({ error: 'AI provider not configured' }, { status: 500 })
    }

    const response = await provider.execute({
      prompt: keyword,
      model: JSON.stringify({ depth: 20 }),
    })

    if (!response.success) {
      logger.warn('SERP analysis failed', {
        service: 'ai-overview-detector',
        keyword,
        error: response.error,
      })
      return NextResponse.json({ error: 'Failed to fetch SERP data' }, { status: 500 })
    }

    const serpData = response as unknown as Awaited<ReturnType<typeof provider.execute>>
    const result = analyzeBrandPresence(
      serpData as unknown as import('@/lib/providers/dataforseo-provider').DataForSEOResult,
      brandDomain,
    )

    return NextResponse.json({
      brandId,
      brandName: brand.name,
      keyword,
      brandDomain,
      analyzedAt: new Date().toISOString(),
      ...result,
    })
  } catch (error) {
    logger.error('SERP analysis error', { service: 'ai-overview-detector', keyword, error })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 },
    )
  }
}
