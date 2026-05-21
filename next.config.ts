import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import { withSentryConfig } from '@sentry/nextjs'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * PERFORMANCE OPTIMIZATIONS
   * ═══════════════════════════════════════════════════════════════════════════
   */

  // Enable compression (handled by Vercel automatically)

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24, // 24 hours
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Experimental features for performance
  experimental: {
    optimizeCss: false,
    optimizePackageImports: ['lucide-react', 'recharts', '@radix-ui/react-icons'],
  },

  serverExternalPackages: ['dns'],

  turbopack: {
    root: './',
  },

  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * SECURITY HEADERS CONFIGURATION
   * ═══════════════════════════════════════════════════════════════════════════
   */
  async headers() {
    // In development, Turbopack reuses chunk filenames (no content hash), so
    // any cacheable Cache-Control — especially `immutable` on /_next/static —
    // makes the browser serve STALE JS chunks indefinitely (the recurring
    // "module factory not available / old code" problem). So in dev we force
    // no-store everywhere and skip the immutable static rule. Production keeps
    // the long-lived caching, which is safe because prod chunks are
    // content-hashed.
    const isDev = process.env.NODE_ENV !== 'production'

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value:
              'geolocation=(), microphone=(), camera=(), payment=(), usb=(), browsing-topics=(), join-ad-interest-group=(), private-state-token-issuance=(), private-state-token-redemption=(), run-ad-auction=(), attribution-reporting=()',
          },
          // CSP is set dynamically by middleware with a per-request nonce (see src/middleware.ts)
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Cache-Control',
            value: isDev
              ? 'no-store, must-revalidate'
              : 'public, max-age=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
      // Long-lived immutable caching for hashed static assets — production
      // only. Omitted in dev to avoid pinning stale Turbopack chunks.
      ...(isDev
        ? []
        : [
            {
              source: '/_next/static/(.*)',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'public, max-age=31536000, immutable',
                },
              ],
            },
          ]),
    ]
  },

  reactStrictMode: true,

  typescript: {
    tsconfigPath: './tsconfig.json',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// CF-04 — Sentry build-time wrapper.
// Uploads source maps for human-readable stack traces in production.
// Requires env: SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN.
// If those are missing locally, the wrap is a no-op (build still succeeds).
// ─────────────────────────────────────────────────────────────────────────────
const sentryWebpackPluginOptions = {
  org: process.env['SENTRY_ORG'],
  project: process.env['SENTRY_PROJECT'],
  authToken: process.env['SENTRY_AUTH_TOKEN'],
  silent: process.env.NODE_ENV !== 'production',
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
}

export default withSentryConfig(withNextIntl(nextConfig), sentryWebpackPluginOptions)
