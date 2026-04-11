import { NextResponse } from 'next/server'
import { getProviderManager, type ProviderHealthStatus } from '@/lib/providers'
import { logger } from '@/lib/logger'

export async function GET() {
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

export async function POST() {
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
    logger.error('Provider health refresh error', { source: 'providers/health', error: String(err) })
    return NextResponse.json(
      { success: false, message: 'Failed to refresh provider health' },
      { status: 500 },
    )
  }
}
