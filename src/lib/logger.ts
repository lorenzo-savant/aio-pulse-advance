/**
 * Simple logger utility for production use
 * Replace console.log/error/warn with this for structured logging
 */

import * as Sentry from '@sentry/nextjs'

const isDev = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'
const isProd = process.env.NODE_ENV === 'production'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: unknown
}

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString()
  const ctxStr = context ? ` ${JSON.stringify(context)}` : ''
  return `[${timestamp}] ${level.toUpperCase()} ${message}${ctxStr}`
}

function captureToSentry(level: LogLevel, message: string, context?: LogContext): void {
  if (!isProd) return

  const extra = context ? { ...context } : undefined

  switch (level) {
    case 'error':
      Sentry.captureMessage(message, {
        level: 'error',
        extra,
      })
      break
    case 'warn':
      Sentry.captureMessage(message, {
        level: 'warning',
        extra,
      })
      break
    default:
      Sentry.captureMessage(message, {
        level: 'info',
        extra,
      })
  }
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (isDev) {
      console.debug(formatMessage('debug', message, context))
    }
  },

  info(message: string, context?: LogContext): void {
    if (isDev) {
      console.info(formatMessage('info', message, context))
    }
    captureToSentry('info', message, context)
  },

  warn(message: string, context?: LogContext): void {
    if (isDev || isTest) {
      console.warn(formatMessage('warn', message, context))
    }
    captureToSentry('warn', message, context)
  },

  error(message: string, error?: Error | LogContext): void {
    const ctx =
      error instanceof Error
        ? { message: error.message, stack: isDev ? error.stack : undefined }
        : error

    if (isDev || isTest) {
      console.error(formatMessage('error', message, ctx as LogContext))
    }

    if (isProd) {
      if (error instanceof Error) {
        Sentry.captureException(error, {
          extra: { message, ...ctx },
        })
      } else {
        captureToSentry('error', message, ctx as LogContext)
      }
    }
  },

  catch(error: unknown, context?: LogContext): void {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    const ctx = { ...context, originalError: message, stack: isDev ? stack : undefined }

    if (isDev || isTest) {
      console.error(formatMessage('error', `Caught error: ${message}`, ctx))
    }

    if (isProd) {
      if (error instanceof Error) {
        Sentry.captureException(error, { extra: ctx })
      } else {
        captureToSentry('error', `Caught error: ${message}`, ctx)
      }
    }
  },
}

export default logger
