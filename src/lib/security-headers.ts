import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), browsing-topics=(), join-ad-interest-group=(), private-state-token-issuance=(), private-state-token-redemption=(), run-ad-auction=(), attribution-reporting=()',
}

// NOTE: CSP is defined in next.config.ts headers() — do not duplicate here.
// next.config.ts headers() take precedence over middleware headers.

export function addSecurityHeaders(request: NextRequest, response: NextResponse): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    if (!response.headers.has(key)) {
      response.headers.set(key, value)
    }
  })

  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none')
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp')
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin')

  return response
}

export function securityHeadersMiddleware(request: NextRequest): NextResponse {
  const response = NextResponse.next()
  return addSecurityHeaders(request, response)
}
