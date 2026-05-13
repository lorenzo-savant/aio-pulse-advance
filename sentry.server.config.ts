// Sentry server-side configuration (Node.js runtime).
// Edge runtime config is in sentry.edge.config.ts.
// Client config is in sentry.client.config.ts.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env['NEXT_PUBLIC_SENTRY_DSN'] || process.env['SENTRY_DSN'] || '',

  // Enable only in production by default. Override with SENTRY_FORCE_ENABLE=true
  // in staging/preview if you want events from non-prod environments.
  enabled:
    process.env.NODE_ENV === 'production' || process.env['SENTRY_FORCE_ENABLE'] === 'true',

  // Sample 10% of transactions for performance monitoring. Bump to 1.0 to debug
  // a specific issue, then revert (transactions count against quota).
  tracesSampleRate: 0.1,

  // Tag environment so dashboard/alerts can filter prod vs preview vs dev.
  environment: process.env.NODE_ENV,

  // Release tagging: use Git SHA when available (Vercel auto-sets VERCEL_GIT_COMMIT_SHA),
  // fall back to package version. Critical for sourcemap correlation.
  release:
    process.env['VERCEL_GIT_COMMIT_SHA']?.slice(0, 7) ??
    process.env['npm_package_version'] ??
    'unknown',

  // Defense in depth — even though logger.ts redacts PII, scrub Sentry events
  // as a second line of defense (some library may log via console.error which
  // Sentry captures automatically and bypasses our logger wrapper).
  beforeSend(event) {
    if (event.request) {
      if (event.request.cookies) {
        event.request.cookies = '[REDACTED_BY_BEFORESEND]'
      }
      if (event.request.headers) {
        const h = event.request.headers as Record<string, string>
        if (h['authorization']) h['authorization'] = '[REDACTED]'
        if (h['cookie']) h['cookie'] = '[REDACTED]'
        if (h['x-api-key']) h['x-api-key'] = '[REDACTED]'
      }
      if (event.request.data && typeof event.request.data === 'object') {
        const d = event.request.data as Record<string, unknown>
        for (const key of ['password', 'apiKey', 'api_key', 'token', 'authorization']) {
          if (key in d) d[key] = '[REDACTED]'
        }
      }
    }

    // Drop user.email — we already have user.id which is enough for correlation.
    if (event.user?.email) {
      event.user.email = '[REDACTED]'
    }

    return event
  },

  // Filter known-noisy errors that pollute the dashboard without action signal.
  ignoreErrors: [
    // Browser extension noise (mostly client-side but defensive here too)
    'top.GLOBALS',
    // Common Next.js dev artifacts
    'NEXT_NOT_FOUND',
    'NEXT_REDIRECT',
    // ResizeObserver loop limit — chromium quirk, never actionable
    'ResizeObserver loop limit exceeded',
  ],
})
