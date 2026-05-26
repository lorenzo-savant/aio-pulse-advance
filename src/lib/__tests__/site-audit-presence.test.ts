import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We mock safeFetchText at the module boundary so the service tests
// stay deterministic — no real network calls.
const fetchMock = vi.fn()
vi.mock('@/lib/utils/safe-fetch', () => ({
  safeFetchText: (...args: unknown[]) => fetchMock(...args),
}))

import { auditFoundations, normaliseBrandDomainForAudit } from '../services/site-audit-presence'

function okResponse(text: string, status = 200): { text: string; response: Response } {
  return { text, response: new Response(text, { status }) }
}

function notFoundResponse(): { text: string; response: Response } {
  return { text: '', response: new Response('', { status: 404 }) }
}

beforeEach(() => {
  fetchMock.mockReset()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('normaliseBrandDomainForAudit', () => {
  it('strips protocol + path + trailing slash + uppercases', () => {
    expect(normaliseBrandDomainForAudit('https://Acasting.SE/about/')).toBe('acasting.se')
    expect(normaliseBrandDomainForAudit('http://example.com')).toBe('example.com')
    expect(normaliseBrandDomainForAudit('acasting.se/llms.txt')).toBe('acasting.se')
  })
})

describe('auditFoundations — composite score', () => {
  it('returns 100 when all four foundations are present', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(okResponse(`<html>${url}</html>`)),
    )
    const r = await auditFoundations('acasting.se')
    expect(r.foundationsScore).toBe(100)
    expect(r.httpsAvailable).toBe(true)
    expect(r.llmsTxt.exists).toBe(true)
    expect(r.llmsFullTxt.exists).toBe(true)
    expect(r.sitemap.exists).toBe(true)
  })

  it('returns 0 when nothing is reachable', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('ENOTFOUND')))
    const r = await auditFoundations('nonexistent.example')
    expect(r.foundationsScore).toBe(0)
    expect(r.httpsAvailable).toBe(false)
    expect(r.llmsTxt.exists).toBe(false)
    expect(r.llmsTxt.error).toContain('ENOTFOUND')
  })

  it('weights llms.txt the most (35) — only llms.txt present = 35', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith('/llms.txt') ? okResponse('# Acasting\n') : notFoundResponse()),
    )
    const r = await auditFoundations('acasting.se')
    expect(r.foundationsScore).toBe(35)
    expect(r.llmsTxt.exists).toBe(true)
  })

  it('HTTPS + llms.txt + llms-full.txt without sitemap = 80', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(url.endsWith('/sitemap.xml') ? notFoundResponse() : okResponse('content')),
    )
    const r = await auditFoundations('acasting.se')
    expect(r.foundationsScore).toBe(80) // 20 + 35 + 25
    expect(r.sitemap.exists).toBe(false)
  })
})

describe('auditFoundations — recommendations', () => {
  it('prioritises HTTPS when root is unreachable', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('TLS handshake failed')))
    const r = await auditFoundations('broken.example')
    expect(r.recommendations[0]).toMatch(/HTTPS root/i)
  })

  it('recommends publishing llms.txt when missing', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === 'https://acasting.se/' ? okResponse('<html></html>') : notFoundResponse(),
      ),
    )
    const r = await auditFoundations('acasting.se')
    expect(r.recommendations.some((s) => /llms\.txt/.test(s))).toBe(true)
  })

  it('returns a single positive message when all foundations pass', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResponse('content')))
    const r = await auditFoundations('acasting.se')
    expect(r.recommendations).toHaveLength(1)
    expect(r.recommendations[0]).toMatch(/Foundations are in place/i)
  })
})

describe('auditFoundations — empty body handling', () => {
  it('treats a 200 with empty body as not-existing', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(okResponse('   \n  ', 200)))
    const r = await auditFoundations('acasting.se')
    // Empty/whitespace-only bodies don't count as "exists".
    expect(r.httpsAvailable).toBe(false)
    expect(r.llmsTxt.exists).toBe(false)
  })

  it('captures excerpt when content is present', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(okResponse('# Acasting\n\n> Casting platform for Sweden\n')),
    )
    const r = await auditFoundations('acasting.se')
    expect(r.llmsTxt.excerpt).toContain('# Acasting')
  })
})
