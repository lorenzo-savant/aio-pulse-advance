'use client'

import { useEffect, useState } from 'react'

export interface OverviewStats {
  brands: number
  prompts: number
  monitoringRuns: number
  unreadAlerts: number
  hasData: boolean
}

const EMPTY: OverviewStats = {
  brands: 0,
  prompts: 0,
  monitoringRuns: 0,
  unreadAlerts: 0,
  hasData: false,
}

let cache: { stats: OverviewStats; ts: number } | null = null
const CACHE_TTL = 60_000

export function useOverviewStats(refreshMs: number = 60_000) {
  const [stats, setStats] = useState<OverviewStats>(cache?.stats ?? EMPTY)
  const [loading, setLoading] = useState(!cache)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      const now = Date.now()
      if (cache && now - cache.ts < CACHE_TTL) {
        if (mounted) {
          setStats(cache.stats)
          setLoading(false)
        }
        return
      }
      try {
        const res = await fetch('/api/stats/overview')
        if (!res.ok) throw new Error('stats fetch failed')
        const data = await res.json()
        if (data.success && data.stats) {
          cache = { stats: data.stats, ts: now }
          if (mounted) setStats(data.stats)
        }
      } catch {
        // silent fail — keep EMPTY
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    const interval = refreshMs > 0 ? setInterval(load, refreshMs) : null
    return () => {
      mounted = false
      if (interval) clearInterval(interval)
    }
  }, [refreshMs])

  return { stats, loading }
}
