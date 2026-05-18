import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

interface RealtimeOptions {
  enabled?: boolean
  onHealthScoreUpdate?: (data: any) => void
  onGscUpdate?: (data: any) => void
  onKeywordUpdate?: (data: any) => void
  onScraperUpdate?: (data: any) => void
  onMessageUpdate?: (data: any) => void
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
  const channelRef = useRef<any>(null)
  const supabaseRef = useRef<any>(null)

  const connect = useCallback(() => {
    if (!enabled) return

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase realtime not configured')
      return
    }

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
