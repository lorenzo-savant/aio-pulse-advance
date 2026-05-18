// ╔════════════════════════════════════════════════════════════════════════════╗
// ║  Structured logger — pino + PII masking + Sentry forward                   ║
// ║                                                                            ║
// ║  Why this exists:                                                          ║
// ║  - CODE_REVIEW.md (March 2026) flagged 116+ console.log in production —    ║
// ║    no structured log format, no PII masking, Sentry blind to events.       ║
// ║  - T04 of the enterprise roadmap (docs/enterprise-roadmap/01-fase-0...).   ║
// ║                                                                            ║
// ║  Design constraints:                                                       ║
// ║  - Preserve the Logger interface so existing 76 residual console.* call    ║
// ║    sites can migrate via mechanical search/replace (T05).                  ║
// ║  - Auto-redact PII (email, password, apiKey, token, authorization, etc.)   ║
// ║    via pino `redact.paths`. The censor string is `[REDACTED]`.             ║
// ║  - Forward errors to Sentry as `captureException` + breadcrumbs for        ║
// ║    info/warn (lighter weight, only shown if error follows).                ║
// ║  - Edge runtime compatible — pino v9 ships a workerd-friendly build.       ║
// ║                                                                            ║
// ║  Anti-pattern to avoid (the reason PII masking exists):                    ║
// ║  ❌ logger.info(`user login: ${user.email}`)                               ║
// ║      → email interpolated into message string, NOT redacted                ║
// ║  ✅ logger.info('user login', { email: user.email })                       ║
// ║      → email is a named field, auto-redacted to '[REDACTED]'              ║
// ╚════════════════════════════════════════════════════════════════════════════╝

import pino from 'pino'
import * as Sentry from '@sentry/nextjs'

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
  debug(message: string, context?: Record<string, unknown>): void
}

// ─── PII redaction paths ─────────────────────────────────────────────────────
// pino walks each path and replaces the matching value with `[REDACTED]`.
// Add new paths here whenever a new sensitive field surface is introduced.
const REDACT_PATHS = [
  // Top-level common shapes
  'email',
  'password',
  'apiKey',
  'api_key',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'sessionToken',
  'session_token',
  'creditCard',
  'credit_card',
  'ssn',
  'authorization',
  // Headers (request/response objects)
  'headers.authorization',
  'headers.cookie',
  'headers["x-api-key"]',
  // Nested under common containers
  '*.email',
  '*.password',
  '*.apiKey',
  '*.api_key',
  '*.token',
  '*.accessToken',
  '*.access_token',
  '*.refreshToken',
  '*.refresh_token',
  '*.authorization',
  // Body shapes
  'body.password',
  'body.apiKey',
  'body.api_key',
  'body.token',
  'body.email',
  // User-shape (common Supabase pattern)
  'user.email',
  'user.password',
  'user.apiKey',
  'user.api_key',
  'user.token',
  'user.accessToken',
  // Supabase session
  'session.access_token',
  'session.refresh_token',
  'session.user.email',
]

// ─── Log level resolution ────────────────────────────────────────────────────
// Priority: LOG_LEVEL env > NODE_ENV-based default.
//   - production: 'info' (no debug noise)
//   - everything else (development, test, preview): 'debug'
function resolveLevel(): pino.LevelWithSilent {
  const envLevel = process.env['LOG_LEVEL']
  if (
    envLevel &&
    ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'].includes(envLevel)
  ) {
    return envLevel as pino.LevelWithSilent
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}

// ─── pino instance ───────────────────────────────────────────────────────────
const pinoLogger = pino({
  level: resolveLevel(),
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
    remove: false, // keep the key, just replace value (don't break downstream parsers)
  },
  // Production: JSON line per log entry (Vercel logs + downstream parsers).
  // Development: human-readable single-line format.
  transport:
    process.env.NODE_ENV !== 'production' && process.env['NEXT_RUNTIME'] !== 'edge'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level(label) {
      // Standard `level: "info"` instead of pino's numeric default — friendlier
      // for log aggregators (Datadog, Sumo, Vercel Log Drain).
      return { level: label }
    },
  },
  base: {
    // Identify the service in shared log surfaces.
    service: 'aio-pulse',
    env: process.env.NODE_ENV ?? 'development',
  },
})

// ─── Sentry forward helpers ──────────────────────────────────────────────────
// info/warn → breadcrumb (only emitted if a subsequent error fires within same scope)
// error      → captureException + breadcrumb
// debug      → never forwarded (would flood Sentry quota)
//
// We extract the `err` field from context if present and pass it as the actual
// exception. Other context fields become extras for forensics.

function forwardToSentry(
  level: 'info' | 'warn' | 'error',
  message: string,
  context?: Record<string, unknown>,
): void {
  // Skip if Sentry not initialized (DSN missing in dev/test) — avoid noisy errors.
  // The hub.getClient() check is cheap and safe.
  if (!Sentry.getClient()) return

  const { err, error: errAlias, ...rest } = context ?? {}
  const exception = (err ?? errAlias) as Error | undefined

  if (level === 'error') {
    if (exception instanceof Error) {
      Sentry.captureException(exception, {
        level: 'error',
        extra: { message, ...rest },
      })
    } else {
      Sentry.captureMessage(message, {
        level: 'error',
        extra: rest,
      })
    }
    return
  }

  // info + warn → breadcrumb only (shown if an error follows in same scope).
  Sentry.addBreadcrumb({
    level: level as 'info' | 'warning',
    category: 'logger',
    message,
    data: rest,
  })
}

// ─── Public Logger surface ───────────────────────────────────────────────────
// IMPORTANT: keep this interface identical to the prior logger.ts so the
// existing call sites (T05 migration target) work without source changes.
export const logger: Logger = {
  info(message, context) {
    pinoLogger.info(context ?? {}, message)
    forwardToSentry('info', message, context)
  },
  warn(message, context) {
    pinoLogger.warn(context ?? {}, message)
    forwardToSentry('warn', message, context)
  },
  error(message, context) {
    pinoLogger.error(context ?? {}, message)
    forwardToSentry('error', message, context)
  },
  debug(message, context) {
    pinoLogger.debug(context ?? {}, message)
    // debug NOT forwarded to Sentry — would explode quota.
  },
}

// ─── Re-export the raw pino instance for advanced cases ──────────────────────
// Only use directly if you need pino-specific features (child loggers, custom
// serializers, etc.). Prefer the `logger` named export above for >99% of cases.
export { pinoLogger as _rawPino }
