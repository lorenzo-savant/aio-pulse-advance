// Error tracking utility for client-side errors
// Usage: import { trackError } from '@/lib/error-tracking'

interface ErrorEvent {
  name: string
  message: string
  stack?: string
  timestamp: string
  url: string
  userAgent: string
  userId?: string
  brandId?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  tags?: Record<string, string>
}

type ErrorHandler = (event: ErrorEvent) => void

const errorHandlers: ErrorHandler[] = []

export function trackError(
  error: Error | unknown,
  options?: {
    userId?: string
    brandId?: string
    severity?: ErrorEvent['severity']
    tags?: Record<string, string>
  },
): void {
  const event: ErrorEvent = {
    name: error instanceof Error ? error.name : 'Unknown',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : 'server',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    userId: options?.userId,
    brandId: options?.brandId,
    severity: options?.severity ?? 'medium',
    tags: options?.tags,
  }

  console.error('[ERROR TRACKED]', event)

  errorHandlers.forEach((handler) => {
    try {
      handler(event)
    } catch (e) {
      console.error('[Error handler failed]', e)
    }
  })
}

export function registerErrorHandler(handler: ErrorHandler): () => void {
  errorHandlers.push(handler)
  return () => {
    const index = errorHandlers.indexOf(handler)
    if (index > -1) {
      errorHandlers.splice(index, 1)
    }
  }
}

export function setupGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return

  window.onerror = (message, source, lineno, colno, error) => {
    trackError(error ?? new Error(String(message)), {
      severity: 'high',
      tags: { type: 'unhandled-error', source: source ?? 'unknown' },
    })
    return false
  }

  window.onunhandledrejection = (event) => {
    trackError(event.reason ?? new Error('Unhandled Promise Rejection'), {
      severity: 'high',
      tags: { type: 'unhandled-rejection' },
    })
  }

  const originalFetch = window.fetch
  window.fetch = async (...args) => {
    const startTime = Date.now()
    try {
      const response = await originalFetch(...args)
      const duration = Date.now() - startTime

      if (!response.ok && response.status >= 500) {
        trackError(new Error(`API Error: ${response.status} ${response.statusText}`), {
          severity: 'medium',
          tags: {
            type: 'api-error',
            status: String(response.status),
            url: String(args[0]),
            duration: String(duration),
          },
        })
      }

      return response
    } catch (error) {
      trackError(error as Error, {
        severity: 'high',
        tags: {
          type: 'network-error',
          url: String(args[0]),
        },
      })
      throw error
    }
  }

  console.log('[Error tracking initialized]')
}

export async function reportErrorToServer(event: ErrorEvent): Promise<void> {
  try {
    await fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })
  } catch {
    console.error('Failed to report error to server')
  }
}
