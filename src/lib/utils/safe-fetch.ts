// Pure-JS IP literal classifier. Previously this used `isIP` from Node's
// `net` module, but that's a static Node-only import that the Edge Runtime
// can't tolerate at build time (next build fails the Edge App Routes that
// transitively import safe-fetch, e.g. /api/crawlability/bots).
//
// Returns 4 for IPv4, 6 for IPv6, 0 for everything else. Matches the
// contract of `net.isIP()` for the cases this module needs.
function isIP(s: string): 0 | 4 | 6 {
  if (!s || typeof s !== 'string') return 0
  // IPv4 — 4 dot-separated decimal octets, each 0–255.
  if (/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(s)) return 4
  // IPv6 — accept any colon-containing form. We don't need to fully
  // validate IPv6 syntax here because the downstream isPrivateIPv6 check
  // is the part that actually gates security. A loose match here just
  // tells assertHostnameAllowed / assertResolvedIPsAllowed "treat this as
  // an IPv6 literal".
  if (s.includes(':') && /^[0-9a-fA-F:.]+$/.test(s)) return 6
  return 0
}

const BLOCKED_PROTOCOLS = ['file:', 'gopher:', 'ftp:', 'ssh:', 'telnet:', 'ldap:']

const BLOCKED_HOSTS = [
  'localhost',
  'ip6-localhost',
  'metadata.google.internal',
  'metadata.googleusercontent.com',
]

const PRIVATE_RANGES_IPV4 = [
  { pattern: /^0\./, range: '0.0.0.0/8 (this host)' },
  { pattern: /^10\./, range: '10.0.0.0/8' },
  { pattern: /^172\.(1[6-9]|2\d|3[01])\./, range: '172.16.0.0/12' },
  { pattern: /^192\.168\./, range: '192.168.0.0/16' },
  { pattern: /^127\./, range: '127.0.0.0/8' },
  { pattern: /^169\.254\./, range: '169.254.0.0/16' },
  { pattern: /^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\./, range: '100.64.0.0/10' },
  { pattern: /^192\.0\.0\./, range: '192.0.0.0/24' },
  { pattern: /^2(?:2[4-9]|[3-4]\d|5[0-5])\./, range: '224.0.0.0/4 + 240.0.0.0/4' },
]

export type SsrfErrorCode =
  | 'BLOCKED_PROTOCOL'
  | 'BLOCKED_IP'
  | 'BLOCKED_HOST'
  | 'TIMEOUT'
  | 'REDIRECT_LOOP'
  | 'RESPONSE_TOO_LARGE'

export class SsrfError extends Error {
  constructor(
    public readonly code: SsrfErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'SsrfError'
  }
}

/**
 * Parse an IPv4 literal in ANY radix/short form (inet_aton semantics):
 * dotted decimal/hex/octal, 1–4 parts, or a single integer. Returns the
 * canonical "a.b.c.d" string, or null if not an IPv4 literal.
 *
 * This defeats SSRF bypasses like 2130706433, 0x7f000001, 0177.0.0.1, 127.1.
 */
function canonicalizeIPv4(host: string): string | null {
  const parts = host.split('.')
  if (parts.length === 0 || parts.length > 4) return null

  const nums: number[] = []
  for (const p of parts) {
    if (p === '') return null
    let n: number
    if (/^0x[0-9a-f]+$/i.test(p)) n = parseInt(p, 16)
    else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8)
    else if (/^[0-9]+$/.test(p)) n = parseInt(p, 10)
    else return null
    if (!Number.isFinite(n) || n < 0) return null
    nums.push(n)
  }

  let value: number
  if (nums.length === 1) {
    value = nums[0] ?? -1
  } else {
    // Last part takes the remaining bytes; leading parts must be < 256.
    const last = nums[nums.length - 1] ?? -1
    const lead = nums.slice(0, -1)
    if (last < 0 || lead.some((x) => x > 255)) return null
    const maxLast = Math.pow(256, 4 - lead.length)
    if (last >= maxLast) return null
    value = 0
    lead.forEach((x, i) => {
      value += x * Math.pow(256, 3 - i)
    })
    value += last
  }
  if (value < 0 || value > 0xffffffff) return null
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff].join(
    '.',
  )
}

function isPrivateIPv4(ip: string): boolean {
  return PRIVATE_RANGES_IPV4.some(({ pattern }) => pattern.test(ip))
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, '')
  if (lower === '::1' || lower === '::' || lower === '0:0:0:0:0:0:0:1') return true
  if (
    lower.startsWith('fc') ||
    lower.startsWith('fd') || // fc00::/7 (unique local)
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb') || // fe80::/10 (link-local)
    lower.startsWith('ff') // ff00::/8 (multicast)
  ) {
    return true
  }
  // IPv4-mapped / -embedded (::ffff:a.b.c.d, ::ffff:7f00:1, 64:ff9b::a.b.c.d)
  const v4 = lower.match(/(?:\d{1,3}\.){3}\d{1,3}$/)
  if (v4) {
    const canon = canonicalizeIPv4(v4[0])
    if (canon && isPrivateIPv4(canon)) return true
  }
  if (lower.startsWith('::ffff:') || lower.startsWith('::') || lower.startsWith('64:ff9b:')) {
    return true
  }
  return false
}

/**
 * Validate a hostname/IP literal. Throws SsrfError if it is a blocked host,
 * a private/loopback/link-local/metadata IP, or an obfuscated IP literal
 * that resolves into a blocked range.
 */
function assertHostnameAllowed(hostname: string): void {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')

  if (BLOCKED_HOSTS.includes(host)) {
    throw new SsrfError('BLOCKED_HOST', `Hostname ${hostname} is blocked`)
  }

  // IPv6 literal
  if (isIP(host) === 6 || host.includes(':')) {
    if (isPrivateIPv6(host)) {
      throw new SsrfError('BLOCKED_IP', `Blocked IPv6 address: ${hostname}`)
    }
    return
  }

  // IPv4 literal (any radix / short form)
  const canon = canonicalizeIPv4(host)
  if (canon) {
    if (isPrivateIPv4(canon)) {
      throw new SsrfError('BLOCKED_IP', `Blocked IPv4 address: ${hostname} (${canon})`)
    }
  }
}

async function resolveHostname(hostname: string): Promise<string[]> {
  const dns = await import('dns/promises')
  const addresses: string[] = []
  try {
    addresses.push(...(await dns.resolve4(hostname)))
  } catch {
    /* no A records */
  }
  try {
    addresses.push(...(await dns.resolve6(hostname)))
  } catch {
    /* no AAAA records */
  }
  return addresses
}

function assertResolvedIPsAllowed(ips: string[], hostname: string): void {
  for (const ip of ips) {
    const kind = isIP(ip)
    if (kind === 4 && isPrivateIPv4(ip)) {
      throw new SsrfError('BLOCKED_IP', `Private IP detected: ${ip} (${hostname})`)
    }
    if (kind === 6 && isPrivateIPv6(ip)) {
      throw new SsrfError('BLOCKED_IP', `Private IP detected: ${ip} (${hostname})`)
    }
  }
}

/** Full SSRF validation for a single URL hop. */
async function validateUrlHop(parsedUrl: URL): Promise<void> {
  if (BLOCKED_PROTOCOLS.includes(parsedUrl.protocol)) {
    throw new SsrfError('BLOCKED_PROTOCOL', `Protocol ${parsedUrl.protocol} is not allowed`)
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new SsrfError('BLOCKED_PROTOCOL', 'Only HTTP/HTTPS protocols are allowed')
  }

  const hostname = parsedUrl.hostname
  assertHostnameAllowed(hostname)

  // If the host is NOT a literal IP, resolve and validate every A/AAAA record.
  if (isIP(hostname.replace(/^\[|\]$/g, '')) === 0 && canonicalizeIPv4(hostname) === null) {
    const ips = await resolveHostname(hostname)
    if (ips.length === 0) {
      throw new SsrfError('BLOCKED_HOST', `DNS resolution failed for: ${hostname}`)
    }
    assertResolvedIPsAllowed(ips, hostname)
  }
}

export interface SafeFetchOptions extends RequestInit {
  timeout?: number
  /** Max response body bytes to buffer when using safeFetchText (default 10MB). */
  maxBytes?: number
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024

export async function safeFetch(url: string | URL, options?: SafeFetchOptions): Promise<Response> {
  const normalized =
    typeof url === 'string' && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? `https://${url}` : url
  const parsedUrl = typeof normalized === 'string' ? new URL(normalized) : normalized

  await validateUrlHop(parsedUrl)

  const timeout = options?.timeout ?? 45000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    let currentUrl: URL = parsedUrl
    const maxRedirects = 3

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount++) {
      // Re-validate the host + resolved IPs on EVERY hop (including the first
      // and the last) before issuing the request.
      if (redirectCount > 0) await validateUrlHop(currentUrl)

      const response = await fetch(currentUrl, {
        ...options,
        signal: controller.signal,
        redirect: 'manual',
      })

      const isRedirect =
        response.status >= 300 && response.status <= 399 && response.headers.has('location')

      if (!isRedirect) {
        clearTimeout(timeoutId)
        return response
      }

      if (redirectCount === maxRedirects) {
        throw new SsrfError('REDIRECT_LOOP', 'Too many redirects')
      }

      const location = response.headers.get('location')!
      try {
        currentUrl = new URL(location, currentUrl)
      } catch {
        throw new SsrfError('BLOCKED_HOST', `Invalid redirect location: ${location}`)
      }
    }

    throw new SsrfError('REDIRECT_LOOP', 'Too many redirects')
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof SsrfError) throw err
    if (
      err instanceof Error &&
      (err.name === 'AbortError' || (err as Error & { code?: string }).code === 'ABORT_ERR')
    ) {
      throw new SsrfError('TIMEOUT', `Request timed out after ${timeout}ms`)
    }
    throw err
  }
}

/**
 * SSRF-safe fetch that also enforces a hard cap on the buffered response body
 * (defends against memory-exhaustion DoS via huge/infinite responses).
 */
export async function safeFetchText(
  url: string | URL,
  options?: SafeFetchOptions,
): Promise<{ text: string; response: Response }> {
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES
  const response = await safeFetch(url, options)

  const declared = Number(response.headers.get('content-length') || '0')
  if (declared && declared > maxBytes) {
    throw new SsrfError('RESPONSE_TOO_LARGE', `Response exceeds ${maxBytes} bytes`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    const text = await response.text()
    if (Buffer.byteLength(text) > maxBytes) {
      throw new SsrfError('RESPONSE_TOO_LARGE', `Response exceeds ${maxBytes} bytes`)
    }
    return { text, response }
  }

  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        throw new SsrfError('RESPONSE_TOO_LARGE', `Response exceeds ${maxBytes} bytes`)
      }
      chunks.push(value)
    }
  }
  return { text: Buffer.concat(chunks).toString('utf8'), response }
}
