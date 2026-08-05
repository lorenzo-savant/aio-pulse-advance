import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { getAccessibleBrandIds } from '@/lib/authorize'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError)
      return NextResponse.json({ success: false, message: e.message }, { status: 401 })
    return NextResponse.json({ success: false, message: 'Authentication failed' }, { status: 401 })
  }

  const db = createServerClient()
  if (!db) {
    return NextResponse.json({
      success: true,
      stats: { brands: 0, prompts: 0, monitoringRuns: 0, unreadAlerts: 0, hasData: false },
    })
  }

  // The overview counts the caller's PROJECTS, not the caller's own rows.
  // Counting by `user_id` made a collaborator's dashboard read 0 prompts and
  // 0 runs while the brand pages beside it listed plenty — the summary
  // contradicted the thing it summarised.
  const accessibleBrandIds = await getAccessibleBrandIds(db, userId)

  async function countSafe(
    table: string,
    scopeColumn: 'id' | 'brand_id',
    filters: (q: any) => any = (q) => q,
  ): Promise<number> {
    if (accessibleBrandIds.length === 0) return 0
    try {
      const base = (db as any).from(table).select('*', { count: 'exact', head: true })
      const { count, error } = await filters(base.in(scopeColumn, accessibleBrandIds))
      if (error) {
        const msg = String(error.message || error)
        // Missing table = return 0, keep the rest of the page alive
        if (!/does not exist|not found/i.test(msg)) {
          logger.warn(`stats/overview count ${table} failed`, { error: msg })
        }
        return 0
      }
      return count ?? 0
    } catch (e) {
      logger.warn(`stats/overview exception ${table}`, { error: String(e) })
      return 0
    }
  }

  const [brands, prompts, monitoringRuns, unreadAlerts] = await Promise.all([
    countSafe('brands', 'id'),
    countSafe('prompts', 'brand_id'),
    countSafe('monitoring_results', 'brand_id'),
    countSafe('alert_events', 'brand_id', (q) => q.eq('is_read', false)),
  ])

  return NextResponse.json({
    success: true,
    stats: {
      brands,
      prompts,
      monitoringRuns,
      unreadAlerts,
      hasData: monitoringRuns > 0,
    },
    timestamp: Date.now(),
  })
}
