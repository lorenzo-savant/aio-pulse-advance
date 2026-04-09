import { NextRequest } from 'next/server'

export const API_VERSION = 'v1'
export const API_VERSION_HEADER = 'X-API-Version'

export interface ApiVersionConfig {
  version: string
  deprecated: boolean
  sunsetDate?: string
  docsUrl: string
}

export const API_VERSIONS: Record<string, ApiVersionConfig> = {
  v1: {
    version: 'v1',
    deprecated: false,
    docsUrl: '/docs/api',
  },
}

export function getApiVersion(req: NextRequest): string {
  const versionHeader = req.headers.get(API_VERSION_HEADER)
  if (versionHeader && API_VERSIONS[versionHeader]) {
    return versionHeader
  }

  const url = new URL(req.url)
  const pathMatch = url.pathname.match(/^\/api\/(v\d+)/)
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1]
  }

  return API_VERSION
}

export function isVersionSupported(version: string): boolean {
  return version in API_VERSIONS
}

export function getDeprecationWarning(version: string): string | null {
  const config = API_VERSIONS[version]
  if (config?.deprecated) {
    return `API version ${version} is deprecated. Please migrate to a supported version. ${config.sunsetDate ? `Will be sunset on ${config.sunsetDate}.` : ''}`
  }
  return null
}
