import { type NextRequest, NextResponse } from 'next/server'
import { getProviderManager } from '@/lib/providers'
import { requireUser, rateLimitGate } from '@/lib/api-auth'
import { logger } from '@/lib/logger'

// ─── GET /api/providers/health — provider status (no tenant data) ───────────
// Read-only; public but rate-limited so it can't be hammered anonymously.
export async function GET(req: NextRequest) {
  const limited = await rateLimitGate(req, 'providers-health', 30)
  if (limited) return limited

  try {
    const manager = getProviderManager()
    const health = await manager.getProviderHealth()
    const stats = manager.getProviderStats()

    const response = {
      success: true,
      providers: health,
      stats,
      summary: {
        totalConfigured: health.filter((p) => p.isConfigured).length,
        totalAvailable: health.filter((p) => p.isAvailable).length,
        activeJobs: manager.getActiveJobsCount(),
      },
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (err) {
    logger.error('Provider health check error', { source: 'providers/health', error: String(err) })
    return NextResponse.json(
      { success: false, message: 'Failed to check provider health' },
      { status: 500 },
    )
  }
}

// ─── POST /api/providers/health — clear caches + force recheck ──────────────
// State-changing. Was UNAUTHENTICATED: anyone could force cache-clear storms
// (minor DoS / forced provider-recheck). Now requires auth + a tight rate-limit.
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  const limited = await rateLimitGate(req, 'providers-health-refresh', 5)
  if (limited) return limited

  try {
    const manager = getProviderManager()
    manager.clearHealthCache()
    manager.clearMRUCache()
    const health = await manager.getProviderHealth()

    return NextResponse.json({
      success: true,
      message: 'Health cache and MRU cache cleared, providers rechecked',
      providers: health,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    logger.error('Provider health refresh error', {
      source: 'providers/health',
      error: String(err),
    })
    return NextResponse.json(
      { success: false, message: 'Failed to refresh provider health' },
      { status: 500 },
    )
  }
}
