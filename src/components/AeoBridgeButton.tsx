'use client'

import { useState, useCallback } from 'react'
import { Send, Loader2, CheckCircle2, XCircle, Zap, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAeoRunStatus, type AeoRunState, resetAeoRunState } from '@/hooks/useAeoRunStatus'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface AeoBridgeButtonProps {
  brandId: string
  clientDomain: string
  className?: string
  dateRangeDays?: number
}

interface ExportResponse {
  success: boolean
  run_id?: string
  data_points?: number
  message?: string
}

export function AeoBridgeButton({
  brandId,
  clientDomain,
  className,
  dateRangeDays = 30,
}: AeoBridgeButtonProps) {
  const [runState, setRunState] = useState<AeoRunState>(resetAeoRunState())
  const [isExporting, setIsExporting] = useState(false)
  const [dataPoints, setDataPoints] = useState<number | null>(null)

  const runStatus = useAeoRunStatus(runState.runId)

  const isDomainConfigured = !!clientDomain && clientDomain.trim() !== ''
  const currentStatus = runStatus.status !== 'idle' ? runStatus.status : runState.status
  const isDisabled =
    !isDomainConfigured || isExporting || currentStatus === 'running' || currentStatus === 'pending'

  const handleClick = useCallback(async () => {
    if (currentStatus === 'pending' || currentStatus === 'running') return

    if (!isDomainConfigured) {
      toast.error('Configure a domain for this brand to enable AEO integration')
      return
    }

    setIsExporting(true)
    setRunState({ runId: null, status: 'pending' })
    setDataPoints(null)

    try {
      const res = await fetch('/api/aeo-bridge/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId, clientDomain, dateRangeDays }),
      })

      const data: ExportResponse = await res.json()

      if (!data.success || !data.run_id) {
        throw new Error(data.message || 'Failed to trigger AEO analysis')
      }

      setRunState({ runId: data.run_id, status: 'pending' })
      setDataPoints(data.data_points ?? null)
      toast.success(`AEO analysis triggered! ${data.data_points ?? 0} data points exported.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export data'
      setRunState({ runId: null, status: 'error', errorMessage: message })
      toast.error(message)
    } finally {
      setIsExporting(false)
    }
  }, [brandId, clientDomain, dateRangeDays, isDomainConfigured, currentStatus])

  const handleRetry = useCallback(() => {
    setRunState(resetAeoRunState())
    setTimeout(handleClick, 0)
  }, [handleClick])

  const getNextCronTime = () => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(7, 0, 0, 0)
    return tomorrow.toLocaleDateString('sv-SE', {
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const renderButtonContent = () => {
    switch (currentStatus) {
      case 'pending':
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Skickar data...
          </>
        )
      case 'running':
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Agenter kör...
          </>
        )
      case 'completed':
        return (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Analys klar
          </>
        )
      case 'error':
        return (
          <>
            <XCircle className="h-4 w-4" />
            Försök igen
          </>
        )
      default:
        return (
          <>
            <Send className="h-4 w-4" />
            Kör AEO-analys
          </>
        )
    }
  }

  const getVariant = () => {
    switch (currentStatus) {
      case 'completed':
        return 'success'
      case 'error':
        return 'danger'
      case 'running':
      case 'pending':
        return 'secondary'
      default:
        return 'primary'
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      {isDomainConfigured ? (
        <>
          <Button
            variant={getVariant()}
            onClick={currentStatus === 'error' ? handleRetry : handleClick}
            disabled={isDisabled}
            className="w-full"
          >
            {renderButtonContent()}
          </Button>

          {dataPoints !== null && currentStatus !== 'idle' && currentStatus !== 'error' && (
            <div className="flex items-center justify-center">
              <Badge variant="brand" size="sm">
                {dataPoints} datapunkter
              </Badge>
            </div>
          )}

          {(currentStatus === 'running' || currentStatus === 'pending') && (
            <div className="space-y-1">
              <div className="h-1 w-full overflow-hidden rounded-full bg-surface-800">
                <div
                  className="h-full animate-pulse bg-brand-500"
                  style={{ width: currentStatus === 'pending' ? '30%' : '60%' }}
                />
              </div>
              <p className="text-center text-[10px] text-surface-500">
                {currentStatus === 'pending' ? 'Väntar på agent...' : 'Agenter analyserar...'}
              </p>
            </div>
          )}

          {currentStatus === 'completed' && (
            <p className="text-center text-xs text-surface-400">
              Nästa automatiska körning: {getNextCronTime()}
            </p>
          )}

          {currentStatus === 'error' && (
            <p className="text-error-400 text-center text-xs">
              Kontakta support om problemet kvarstår
            </p>
          )}

          {currentStatus === 'idle' && (
            <p className="text-center text-xs text-surface-500">
              Skickar alla brand-data till AEO-agentsystemet
            </p>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-surface-700 p-4 text-center">
          <p className="text-sm text-surface-500">
            Konfigurera en domän för detta varumärke för att aktivera AEO-integration.
          </p>
        </div>
      )}
    </div>
  )
}
