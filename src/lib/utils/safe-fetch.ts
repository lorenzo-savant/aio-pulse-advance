const BLOCKED_PROTOCOLS = ['file:', 'gopher:', 'ftp:', 'ssh:', 'telnet:', 'ldap:']

const BLOCKED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '::1',
  'metadata.googleusercontent.com',
  '169.254.169.254',
]

const PRIVATE_RANGES_IPV4 = [
  { pattern: /^10\./, range: '10.0.0.0/8' },
  { pattern: /^172\.(1[6-9]|2\d|3[01])\./, range: '172.16.0.0/12' },
  { pattern: /^192\.168\./, range: '192.168.0.0/16' },
  { pattern: /^127\./, range: '127.0.0.0/8' },
  { pattern: /^169\.254\./, range: '169.254.0.0/16' },
  { pattern: /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./, range: '100.64.0.0/10' },
  { pattern: /^192\.0\.0\./, range: '192.0.0.0/24' },
  { pattern: /^2(?:2[4-9]|[3-4]\d|5[0-5])\./, range: '224.0.0.0/4' },
]

const PRIVATE_RANGES_IPV6 = [
  { prefix: 'fc00::', range: 'fc00::/7' },
  { prefix: 'fe80::', range: 'fe80::/10' },
  { prefix: 'ff00::', range: 'ff00::/8' },
  { prefix: '::1', range: '::1 (loopback)' },
  { prefix: '::ffff:', range: '::ffff: (IPv4-mapped)' },
]

export type SsrfErrorCode =
  | 'BLOCKED_PROTOCOL'
  | 'BLOCKED_IP'
  | 'BLOCKED_HOST'
  | 'TIMEOUT'
  | 'REDIRECT_LOOP'

export class SsrfError extends Error {
  constructor(
    public readonly code: SsrfErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'SsrfError'
  }
}

function isPrivateIPv4(ip: string): boolean {
  for (const { pattern, range } of PRIVATE_RANGES_IPV4) {
    if (pattern.test(ip)) {
      return true
    }
  }
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  for (const { prefix, range } of PRIVATE_RANGES_IPV6) {
    if (lower.startsWith(prefix) || lower === prefix) {
      return true
    }
  }
  return false
}

function isBlockedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase()
  return BLOCKED_HOSTS.includes(lower)
}

async function resolveAndValidateHostname(hostname: string): Promise<string[]> {
  const dns = await import('dns/promises')
  const addresses: string[] = []

  try {
    const aRecords = await dns.resolve4(hostname)
    addresses.push(...aRecords)
  } catch {
    // DNS resolution failed, continue
  }

  try {
    const aaaaRecords = await dns.resolve6(hostname)
    addresses.push(...aaaaRecords)
  } catch {
    // DNS resolution failed, continue
  }

  return addresses
}

async function validateIPs(ips: string[], hostname: string): Promise<void> {
  for (const ip of ips) {
    if (isPrivateIPv4(ip) || isPrivateIPv6(ip)) {
      throw new SsrfError('BLOCKED_IP', `Private IP detected: ${ip} (${hostname})`)
    }
  }
}

export async function safeFetch(
  url: string | URL,
  options?: RequestInit & { timeout?: number },
): Promise<Response> {
  const normalized = typeof url === 'string' && !/^https?:\/\//i.test(url) ? `https://${url}` : url
  const parsedUrl = typeof normalized === 'string' ? new URL(normalized) : normalized

  if (BLOCKED_PROTOCOLS.includes(parsedUrl.protocol)) {
    throw new SsrfError('BLOCKED_PROTOCOL', `Protocol ${parsedUrl.protocol} is not allowed`)
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new SsrfError('BLOCKED_PROTOCOL', `Only HTTP/HTTPS protocols are allowed`)
  }

  const hostname = parsedUrl.hostname

  if (isBlockedHost(hostname)) {
    throw new SsrfError('BLOCKED_HOST', `Hostname ${hostname} is blocked`)
  }

  const resolvedIPs = await resolveAndValidateHostname(hostname)

  if (resolvedIPs.length === 0) {
    throw new SsrfError('BLOCKED_HOST', `DNS resolution failed for: ${hostname}`)
  }

  await validateIPs(resolvedIPs, hostname)

  const timeout = options?.timeout ?? 45000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    let response: Response | undefined
    let redirectCount = 0
    const maxRedirects = 3
    let currentUrl: URL = parsedUrl

    while (redirectCount < maxRedirects) {
      response = await fetch(currentUrl, {
        ...options,
        signal: controller.signal,
        redirect: 'manual',
      })

      if (response.status >= 300 && response.status <= 399 && response.headers.has('location')) {
        const location = response.headers.get('location')!

        try {
          currentUrl = new URL(location, currentUrl)
        } catch {
          throw new SsrfError('BLOCKED_HOST', `Invalid redirect location: ${location}`)
        }

        const redirectHostname = currentUrl.hostname

        if (isBlockedHost(redirectHostname)) {
          throw new SsrfError('BLOCKED_HOST', `Redirect to blocked hostname: ${redirectHostname}`)
        }

        const redirectIPs = await resolveAndValidateHostname(redirectHostname)
        await validateIPs(redirectIPs, redirectHostname)

        redirectCount++
        continue
      }

      clearTimeout(timeoutId)
      return response
    }

    response = await fetch(currentUrl, {
      ...options,
      signal: controller.signal,
      redirect: 'manual',
    })

    if (response.status >= 300 && response.status <= 399 && response.headers.has('location')) {
      throw new SsrfError('REDIRECT_LOOP', 'Too many redirects')
    }

    clearTimeout(timeoutId)
    return response
  } catch (err) {
    clearTimeout(timeoutId)

    if (err instanceof SsrfError) {
      throw err
    }

    if (
      err instanceof Error &&
      (err.name === 'AbortError' || (err as Error & { code?: string }).code === 'ABORT_ERR')
    ) {
      throw new SsrfError('TIMEOUT', `Request timed out after ${timeout}ms`)
    }

    throw err
  }
}
