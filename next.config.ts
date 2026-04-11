import type { NextConfig } from 'next'

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
            value: 'public, max-age=3600, stale-while-revalidate=86400',
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
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },

  reactStrictMode: true,

  typescript: {
    tsconfigPath: './tsconfig.json',
  },
}

export default nextConfig
