import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The white-label logo never appeared on any PDF this product produced, on
 * either of the two builders, for two different reasons.
 *
 *   · api/export/route.ts read `brand.report_logo_url` into a variable and
 *     never used it. Colour and brand name rendered; the logo did not.
 *   · services/pdf-generator.ts DID call
 *     `doc.addImage(brand.report_logo_url, 'PNG', …)` — which cannot work.
 *     jsPDF in Node treats a string argument as a FILESYSTEM PATH, not a URL,
 *     and throws "Trying to read a file from local file system" straight into
 *     an empty `catch {}`. Verified by running it against the real library.
 *
 * So the feature was configurable, stored in the database, and dead. Reading
 * the code suggested one path worked; executing it showed neither did.
 *
 * `report_logo_url` is user-supplied and fetched server-side, which makes it
 * an SSRF vector, so it goes through the same guard the crawlability service
 * uses. Every failure has to degrade to a text-only header: a report without a
 * logo is fine, a report that throws is not.
 */

const { fetchImpl } = vi.hoisted(() => ({
  fetchImpl: { value: null as null | (() => Promise<Response>) },
}))

vi.mock('@/lib/utils/safe-fetch', () => ({
  safeFetch: async () => {
    if (!fetchImpl.value) throw new Error('SSRF guard refused the target')
    return fetchImpl.value()
  },
}))
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

const { loadBrandLogo, drawBrandedHeader, hexToRgb } = await import('../services/report-branding')

// A real 1x1 PNG. jsPDF accepts this shape; it rejects a URL string.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

function serve(body: Buffer, contentType: string, status = 200) {
  fetchImpl.value = async () =>
    new Response(new Uint8Array(body), { status, headers: { 'content-type': contentType } })
}

/** Records what was drawn, so the assertions are about output not calls. */
function recorder() {
  const drawn: { images: Array<{ data: string; format: string }>; texts: string[] } = {
    images: [],
    texts: [],
  }
  return {
    drawn,
    doc: {
      setFillColor: () => {},
      rect: () => {},
      setTextColor: () => {},
      setFontSize: () => {},
      setFont: () => {},
      text: (t: string) => drawn.texts.push(t),
      addImage: (data: string, format: string) => drawn.images.push({ data, format }),
    },
  }
}

beforeEach(() => {
  fetchImpl.value = null
})

describe('loadBrandLogo', () => {
  it('returns a data URI, which is the only shape jsPDF can consume in Node', async () => {
    serve(PNG_BYTES, 'image/png')

    const logo = await loadBrandLogo('https://cdn.example.com/logo.png')

    expect(logo?.format).toBe('PNG')
    expect(logo?.dataUri.startsWith('data:image/png;base64,')).toBe(true)
    // Never the raw URL — that is what silently failed before.
    expect(logo?.dataUri).not.toContain('https://')
  })

  it('handles JPEG as well as PNG', async () => {
    serve(PNG_BYTES, 'image/jpeg')
    expect((await loadBrandLogo('https://cdn.example.com/logo.jpg'))?.format).toBe('JPEG')
  })

  it('skips SVG rather than handing jsPDF something it cannot rasterise', async () => {
    // The common real case: customers upload the SVG their brand kit ships.
    serve(Buffer.from('<svg/>'), 'image/svg+xml')
    expect(await loadBrandLogo('https://cdn.example.com/logo.svg')).toBeNull()
  })

  it('returns null when the SSRF guard refuses the target', async () => {
    fetchImpl.value = null // the mock throws, standing in for a blocked host
    expect(await loadBrandLogo('http://169.254.169.254/latest/meta-data/')).toBeNull()
  })

  it('returns null on a non-ok response instead of throwing', async () => {
    serve(Buffer.from(''), 'image/png', 404)
    expect(await loadBrandLogo('https://cdn.example.com/gone.png')).toBeNull()
  })

  it('refuses an oversized logo', async () => {
    serve(Buffer.alloc(3 * 1024 * 1024), 'image/png')
    expect(await loadBrandLogo('https://cdn.example.com/huge.png')).toBeNull()
  })

  it('returns null for a brand with no logo configured, without fetching', async () => {
    expect(await loadBrandLogo(null)).toBeNull()
    expect(await loadBrandLogo(undefined)).toBeNull()
    expect(await loadBrandLogo('')).toBeNull()
  })
})

describe('drawBrandedHeader', () => {
  it('draws the logo when one loaded', async () => {
    serve(PNG_BYTES, 'image/png')
    const logo = await loadBrandLogo('https://cdn.example.com/logo.png')
    const { doc, drawn } = recorder()

    drawBrandedHeader(doc, {
      brandName: 'Acme',
      title: 'Brand Report: Acme',
      color: { r: 1, g: 2, b: 3 },
      logo,
      pageWidth: 210,
    })

    expect(drawn.images).toHaveLength(1)
    expect(drawn.images[0]!.format).toBe('PNG')
    expect(drawn.texts).toContain('Acme')
    expect(drawn.texts).toContain('Brand Report: Acme')
  })

  it('still draws name and title when there is no logo', async () => {
    const { doc, drawn } = recorder()

    drawBrandedHeader(doc, {
      brandName: 'Acme',
      title: 'Brand Report: Acme',
      color: { r: 1, g: 2, b: 3 },
      logo: null,
      pageWidth: 210,
    })

    expect(drawn.images).toHaveLength(0)
    expect(drawn.texts).toContain('Acme')
  })
})

describe('hexToRgb', () => {
  it('parses a six-digit hex with or without the hash', () => {
    expect(hexToRgb('#ff8000')).toEqual({ r: 255, g: 128, b: 0 })
    expect(hexToRgb('ff8000')).toEqual({ r: 255, g: 128, b: 0 })
  })

  it('falls back to the default brand indigo on anything unparseable', () => {
    const fallback = { r: 99, g: 102, b: 241 }
    expect(hexToRgb('nonsense')).toEqual(fallback)
    expect(hexToRgb('#fff')).toEqual(fallback)
    expect(hexToRgb(null)).toEqual(fallback)
  })
})
