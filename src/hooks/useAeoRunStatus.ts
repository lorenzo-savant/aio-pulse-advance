import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

type RunStatus = 'idle' | 'pending' | 'running' | 'completed' | 'error'

export interface AeoRunState {
  runId: string | null
  status: RunStatus
  startedAt?: string
  completedAt?: string
  errorMessage?: string
}

const AEO_URL = process.env.NEXT_PUBLIC_AEO_SUPABASE_URL
const AEO_ANON_KEY = process.env.NEXT_PUBLIC_AEO_SUPABASE_ANON_KEY

export function useAeoRunStatus(runId: string | null) {
  const [state, setState] = useState<AeoRunState>({ runId: null, status: 'idle' })

  useEffect(() => {
    if (!runId || !AEO_URL || !AEO_ANON_KEY) return

    setState({ runId, status: 'pending' })

    const aeoClient = createClient(AEO_URL, AEO_ANON_KEY)

    const channel = aeoClient
      .channel(`aeo-run-${runId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'aeo_runs',
          filter: `id=eq.${runId}`,
        },
        (payload) => {
          const newStatus = payload.new.status as RunStatus
          setState((prev) => ({
            ...prev,
            status: newStatus,
            completedAt: newStatus === 'completed' ? new Date().toISOString() : prev.completedAt,
            errorMessage: newStatus === 'error' ? 'Analysis failed on AEO side' : undefined,
          }))
        },
      )
      .subscribe()

    const timeout = setTimeout(
      () => {
        setState((prev) =>
          prev.status !== 'completed'
            ? { ...prev, status: 'error', errorMessage: 'Timeout after 15 minutes' }
            : prev,
        )
      },
      15 * 60 * 1000,
    )

    return () => {
      clearTimeout(timeout)
      aeoClient.removeChannel(channel)
    }
  }, [runId])

  return state
}

export function resetAeoRunState(): AeoRunState {
  return { runId: null, status: 'idle' }
}
