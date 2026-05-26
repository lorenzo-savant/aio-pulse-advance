'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface UseRealtimeOptions {
  table: string
  brandId?: string
  onNewResult?: (result: Record<string, unknown>) => void
  onNewAlert?: (alert: Record<string, unknown>) => void
  enabled?: boolean
}

export function useRealtimeMonitoring({
  table,
  brandId,
  onNewResult,
  onNewAlert,
  enabled = true,
}: UseRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const channelName = `monitoring-${table}-${Date.now()}`
    const filter = brandId ? `brand_id=eq.${brandId}` : undefined

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table,
          filter,
        },
        (payload) => {
          if (table === 'monitoring_results' && onNewResult) {
            onNewResult(payload.new as Record<string, unknown>)
          } else if (table === 'alert_events' && onNewAlert) {
            onNewAlert(payload.new as Record<string, unknown>)
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
          setError(null)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError(`Connection ${status}`)
          setIsConnected(false)
        }
      })

    return () => {
      supabase.removeChannel(channel)
      setIsConnected(false)
    }
  }, [table, brandId, enabled, onNewResult, onNewAlert])

  return { isConnected, error }
}

export function useRealtimeAlerts(
  brandId: string,
  onNewAlert?: (alert: Record<string, unknown>) => void,
) {
  return useRealtimeMonitoring({
    table: 'alert_events',
    brandId,
    onNewAlert,
    enabled: !!brandId,
  })
}

export function useRealtimeResults(
  brandId: string,
  onNewResult?: (result: Record<string, unknown>) => void,
) {
  return useRealtimeMonitoring({
    table: 'monitoring_results',
    brandId,
    onNewResult,
    enabled: !!brandId,
  })
}
