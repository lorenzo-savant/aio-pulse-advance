import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env['NEXT_PUBLIC_SENTRY_DSN'] || process.env['SENTRY_DSN']

Sentry.init({
  dsn: SENTRY_DSN || '',

  enabled: process.env.NODE_ENV === 'production',

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  environment: process.env.NODE_ENV,

  ignoreErrors: [
    'NetworkError when attempting to fetch resource',
    'ChunkLoadError',
    'Loading chunk',
    'ResizeObserver',
  ],

  beforeSend(event) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[Sentry] Event captured:', event)
    }
    return event
  },
})
