'use client'

// Single home for the Supabase realtime hooks. A second use-realtime.ts used
// to live in src/lib/hooks/ with a different, overview-specific hook —
// same filename, different API — which is exactly how the wrong one gets
// imported. Both now live here.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

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

// ─── Overview realtime (multi-table dashboard feed) ─────────────────────────

type RealtimePayload = Record<string, unknown>

interface RealtimeOptions {
  enabled?: boolean
  onHealthScoreUpdate?: (data: RealtimePayload) => void
  onGscUpdate?: (data: RealtimePayload) => void
  onKeywordUpdate?: (data: RealtimePayload) => void
  onScraperUpdate?: (data: RealtimePayload) => void
  onMessageUpdate?: (data: RealtimePayload) => void
}

export function useRealtime(options: RealtimeOptions = {}) {
  const {
    enabled = true,
    onHealthScoreUpdate,
    onGscUpdate,
    onKeywordUpdate,
    onScraperUpdate,
    onMessageUpdate,
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const supabaseRef = useRef<SupabaseClient | null>(null)

  const connect = useCallback(() => {
    if (!enabled) return

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) return

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    supabaseRef.current = supabase

    const channel = supabase
      .channel('brand-overview-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'brand_health_scores' },
        (payload) => {
          onHealthScoreUpdate?.(payload)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gsc_performance' },
        (payload) => {
          onGscUpdate?.(payload)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'keyword_research' },
        (payload) => {
          onKeywordUpdate?.(payload)
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scraper_configs' },
        (payload) => {
          onScraperUpdate?.(payload)
        },
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_messages' }, (payload) => {
        onMessageUpdate?.(payload)
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel
  }, [enabled, onHealthScoreUpdate, onGscUpdate, onKeywordUpdate, onScraperUpdate, onMessageUpdate])

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      supabaseRef.current?.removeChannel(channelRef.current)
      channelRef.current = null
    }
    setIsConnected(false)
  }, [])

  useEffect(() => {
    connect()
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return { isConnected, connect, disconnect }
}
