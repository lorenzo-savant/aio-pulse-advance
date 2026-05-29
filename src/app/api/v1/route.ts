import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { API_VERSION, getApiVersion, getDeprecationWarning, API_VERSIONS } from '@/lib/api-version'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'
export const revalidate = 3600

export async function GET(req: NextRequest) {
  return handleRequest(req)
}

export async function POST(req: NextRequest) {
  return handleRequest(req)
}

export async function PATCH(req: NextRequest) {
  return handleRequest(req)
}

export async function PUT(req: NextRequest) {
  return handleRequest(req)
}

export async function DELETE(req: NextRequest) {
  return handleRequest(req)
}

async function handleRequest(req: NextRequest): Promise<NextResponse> {
  const version = getApiVersion(req)
  const deprecationWarning = getDeprecationWarning(version)

  const response = NextResponse.json({
    success: true,
    api: {
      version: API_VERSION,
      supportedVersions: Object.keys(API_VERSIONS),
      docs: '/docs/api',
      endpoints: {
        brands: '/api/brands',
        prompts: '/api/prompts',
        monitoring: '/api/monitoring',
        scans: '/api/scans',
        team: '/api/team',
        alerts: '/api/alerts',
      },
    },
    message: 'Welcome to AEO Pulse API. Visit /docs/api for documentation.',
  })

  response.headers.set('X-API-Version', API_VERSION)

  if (deprecationWarning) {
    response.headers.set('Deprecation', 'true')
    response.headers.set('Link', '</api/v2>; rel="successor-version"')
  }

  return response
}
