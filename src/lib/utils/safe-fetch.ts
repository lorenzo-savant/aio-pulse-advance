import dns from 'dns/promises'
import { NextResponse } from 'next/server'

const PRIVATE_RANGES = [
  { pattern: /^10\./, range: '10.0.0.0/8' },
  { pattern: /^172\.(1[6-9]|2\d|3[01])\./, range: '172.16.0.0/12' },
  { pattern: /^192\.168\./, range: '192.168.0.0/16' },
  { pattern: /^127\./, range: '127.0.0.0/8' },
  { pattern: /^169\.254\./, range: '169.254.0.0/16' },
]

const BLOCKED_HOSTS = [
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.google',
]

function isPrivateIP(ip: string): boolean {
  for (const { pattern, range } of PRIVATE_RANGES) {
    if (pattern.test(ip)) {
      return true
    }
  }
  return false
}

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  return BLOCKED_HOSTS.includes(lower)
}

export async function safeFetch(url: string | URL, options?: RequestInit): Promise<Response> {
  const parsedUrl = typeof url === 'string' ? new URL(url) : url

  const hostname = parsedUrl.hostname

  if (isBlockedHost(hostname)) {
    throw new Error(`Blocked hostname: ${hostname}`)
  }

  try {
    const addresses = await dns.resolve4(hostname).catch(() => [])
    const addresses6 = await dns.resolve6(hostname).catch(() => [])
    const allAddresses = [...addresses, ...addresses6]

    if (allAddresses.length === 0) {
      throw new Error(`DNS resolution failed for: ${hostname}`)
    }

    for (const ip of allAddresses) {
      if (isPrivateIP(ip)) {
        throw new Error(`Private IP detected: ${ip} (${hostname})`)
      }
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('Private IP') || err.message.includes('Blocked hostname'))
    ) {
      throw err
    }
  }

  return fetch(parsedUrl, options)
}

export function isPrivateRangeURL(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname

    if (isBlockedHost(hostname)) return true

    return false
  } catch {
    return false
  }
}
