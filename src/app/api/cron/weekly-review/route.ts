// PATH: src/app/api/cron/weekly-review/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { generateWeeklyReview } from '@/lib/services/weekly-review'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET_TOKEN
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServerClient()

  const { data: brands } = await (db as any)
    .from('brands')
    .select('id, name, user_id')
    .eq('is_active', true)
    .is('deleted_at', null)

  if (!brands?.length) {
    return NextResponse.json({ message: 'No active brands', reviewsGenerated: 0 })
  }

  const results: Array<{
    brandId: string
    brandName: string
    success: boolean
    weekNumber?: number
    error?: string
  }> = []

  for (const brand of brands) {
    try {
      const review = await generateWeeklyReview(db, brand.id, brand.name, brand.user_id)

      // Save to recommendation_histories (legacy)
      await (db as any).from('recommendation_histories').insert({
        brand_id: brand.id,
        user_id: brand.user_id,
        recommendations: [{ type: 'weekly-review', ...review.metrics }],
        summary: `Weekly Review W${review.weekNumber}: AVI ${review.metrics.aviScoreCurrent.toFixed(1)} (${review.metrics.aviDelta > 0 ? '+' : ''}${review.metrics.aviDelta.toFixed(1)}), ${review.metrics.newHallucinations} new HALs`,
        based_on_count: review.metrics.totalMonitoringRuns,
      })

      // Save to weekly_reviews (structured persistence)
      await (db as any).from('weekly_reviews').upsert(
        {
          brand_id: brand.id,
          user_id: brand.user_id,
          week_number: review.weekNumber,
          year: new Date(review.weekStart).getFullYear(),
          week_start: review.weekStart,
          week_end: review.weekEnd,
          metrics: review.metrics,
          markdown: review.obsidianNote,
        },
        { onConflict: 'brand_id,year,week_number' },
      )

      results.push({
        brandId: brand.id,
        brandName: brand.name,
        success: true,
        weekNumber: review.weekNumber,
      })
    } catch (error: unknown) {
      results.push({
        brandId: brand.id,
        brandName: brand.name,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return NextResponse.json({
    success: true,
    reviewsGenerated: results.filter((r) => r.success).length,
    errors: results.filter((r) => !r.success).length,
    details: results,
  })
}
