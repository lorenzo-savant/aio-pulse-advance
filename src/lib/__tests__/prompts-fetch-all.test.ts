import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchAllPrompts } from '@/app/dashboard/prompts/page'

/**
 * The Prompts page showed 20 prompts out of 76 and said nothing about it.
 *
 * `/api/prompts` is paginated — `defaultLimit: 20`, `maxLimit: 100` — and the
 * page called it with no parameters at all, so it got page one. The response
 * carried the real total the whole time and the page discarded it, which is why
 * nothing on screen admitted the list was short.
 *
 * Raising the limit does not fix it: the account has 205 prompts, more than
 * `maxLimit` allows in a single request, so the pages have to be walked. These
 * tests pin the walk, and pin that a walk which cannot finish says so instead
 * of returning a short list as though it were the whole one.
 */

interface PageSpec {
  data: Array<{ id: string }>
  total: number
  hasMore: boolean
}

/** Serve a scripted sequence of pages and record the URLs requested. */
function serve(pages: PageSpec[] | 'error') {
  const urls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      urls.push(url)
      if (pages === 'error') return { json: async () => ({ success: false }) }
      const page = Number(new URL(url, 'http://x').searchParams.get('page') ?? '1')
      const spec = pages[page - 1]
      if (!spec) return { json: async () => ({ success: false }) }
      return {
        json: async () => ({
          success: true,
          data: spec.data,
          pagination: { page, total: spec.total, hasMore: spec.hasMore },
        }),
      }
    }),
  )
  return urls
}

const ids = (n: number, offset = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + offset}` }))

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => vi.unstubAllGlobals())

describe('fetchAllPrompts walks every page', () => {
  it('returns the whole list when it spans several pages', async () => {
    // 205 prompts at 100 a page: the real shape of this account.
    serve([
      { data: ids(100), total: 205, hasMore: true },
      { data: ids(100, 100), total: 205, hasMore: true },
      { data: ids(5, 200), total: 205, hasMore: false },
    ])

    const out = await fetchAllPrompts()

    expect(out.prompts).toHaveLength(205)
    expect(out.total).toBe(205)
    expect(out.truncated).toBe(false)
  })

  it('stops after one request when there is nothing more', async () => {
    const urls = serve([{ data: ids(7), total: 7, hasMore: false }])

    const out = await fetchAllPrompts()

    expect(out.prompts).toHaveLength(7)
    expect(urls).toHaveLength(1)
  })

  it('asks for the maximum the endpoint allows, not the default 20', async () => {
    const urls = serve([{ data: ids(1), total: 1, hasMore: false }])

    await fetchAllPrompts()

    expect(urls[0]).toContain('limit=100')
    expect(urls[0]).toContain('page=1')
  })

  it('passes the brand filter through on every page', async () => {
    const urls = serve([
      { data: ids(100), total: 150, hasMore: true },
      { data: ids(50, 100), total: 150, hasMore: false },
    ])

    await fetchAllPrompts('brand-42')

    expect(urls).toHaveLength(2)
    expect(urls.every((u) => u.includes('brand_id=brand-42'))).toBe(true)
  })

  it('handles an empty account without a second request', async () => {
    const urls = serve([{ data: [], total: 0, hasMore: false }])

    const out = await fetchAllPrompts()

    expect(out.prompts).toEqual([])
    expect(out.total).toBe(0)
    expect(out.truncated).toBe(false)
    expect(urls).toHaveLength(1)
  })
})

describe('fetchAllPrompts admits when the list is short', () => {
  it('flags truncation when a page fails mid-walk, keeping what it got', async () => {
    // Page 2 fails. Returning 100 prompts as though that were all of them is
    // exactly the silent-short-list bug this replaced.
    serve([{ data: ids(100), total: 205, hasMore: true }])

    const out = await fetchAllPrompts()

    expect(out.prompts).toHaveLength(100)
    expect(out.total).toBe(205)
    expect(out.truncated).toBe(true)
  })

  it('flags truncation when the very first request fails', async () => {
    serve('error')

    const out = await fetchAllPrompts()

    expect(out.prompts).toEqual([])
    expect(out.truncated).toBe(true)
  })

  it('stops at the hard limit rather than looping forever on a lying endpoint', async () => {
    // An endpoint that always claims `hasMore` must not hang the page.
    const urls = serve(
      Array.from({ length: 200 }, () => ({ data: ids(100), total: 99999, hasMore: true })),
    )

    const out = await fetchAllPrompts()

    expect(urls.length).toBeLessThanOrEqual(50)
    expect(out.truncated).toBe(true)
  })
})
