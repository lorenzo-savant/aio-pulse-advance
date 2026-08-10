// PATH: src/lib/services/report-branding.ts
//
// The branded header shared by every PDF this product produces.
//
// WHY THIS EXISTS
// Two builders draw PDFs — services/pdf-generator.ts (scheduled reports and
// /api/reports/pdf) and an inline one in api/export/route.ts — and each had its
// own idea of the white-label header. Neither of them ever rendered the logo a
// customer configured.
//
//   · The export route read `brand.report_logo_url` into a variable and never
//     used it. Colour and brand name rendered; the logo silently did not.
//   · pdf-generator DID call `doc.addImage(brand.report_logo_url, 'PNG', …)`,
//     which cannot work: jsPDF in Node treats a string argument as a
//     FILESYSTEM PATH, not a URL. It throws
//     "Trying to read a file from local file system", straight into an empty
//     `catch {}`. Verified by running it.
//
// So the feature was configurable, stored, and dead on both paths.
//
// SECURITY
// `report_logo_url` is user-supplied and fetched server-side, which makes it an
// SSRF vector — the same shape the crawlability service already guards. It goes
// through `safeFetch`, with a size cap and a content-type allowlist, and any
// failure degrades to the text-only header rather than breaking the export.

import { safeFetch } from '@/lib/utils/safe-fetch'
import { logger } from '@/lib/logger'

/** jsPDF renders raster formats only. An SVG logo is skipped, not attempted. */
const SUPPORTED = {
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/jpg': 'JPEG',
  'image/webp': 'WEBP',
} as const

/** A logo is chrome, not content. Cap it well below the generic fetch limit. */
const MAX_LOGO_BYTES = 2 * 1024 * 1024

export interface BrandLogo {
  /** `data:image/png;base64,…` — what jsPDF can actually consume. */
  dataUri: string
  /** Format token jsPDF expects as its second argument. */
  format: (typeof SUPPORTED)[keyof typeof SUPPORTED]
}

/**
 * Fetch a brand logo and return it in the only shape jsPDF accepts in Node.
 *
 * Returns null for every failure — missing URL, blocked host, wrong type, too
 * large, network error. A report without a logo is a fine report; a report that
 * throws is not.
 */
export async function loadBrandLogo(url: string | null | undefined): Promise<BrandLogo | null> {
  if (!url) return null

  try {
    const response = await safeFetch(url, { timeout: 10_000 })
    if (!response.ok) {
      logger.warn('report-branding: logo fetch returned non-ok', { status: response.status })
      return null
    }

    const contentType = (response.headers.get('content-type') ?? '')
      .split(';')[0]!
      .trim()
      .toLowerCase()
    const format = SUPPORTED[contentType as keyof typeof SUPPORTED]
    if (!format) {
      // SVG is the common case here: customers upload one because it is what
      // their brand kit ships, and jsPDF cannot rasterise it.
      logger.warn('report-branding: unsupported logo content-type', { contentType })
      return null
    }

    const declared = Number(response.headers.get('content-length') || '0')
    if (declared && declared > MAX_LOGO_BYTES) {
      logger.warn('report-branding: logo too large', { declared })
      return null
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength > MAX_LOGO_BYTES) {
      logger.warn('report-branding: logo too large after download', { bytes: buffer.byteLength })
      return null
    }

    return { dataUri: `data:${contentType};base64,${buffer.toString('base64')}`, format }
  } catch (err) {
    logger.warn('report-branding: logo unavailable', { err: String(err) })
    return null
  }
}

/** Minimal surface of jsPDF that the header needs. Keeps this module testable. */
export interface PdfHeaderTarget {
  setFillColor(r: number, g: number, b: number): void
  rect(x: number, y: number, w: number, h: number, style: string): void
  setTextColor(r: number, g: number, b: number): void
  setFontSize(size: number): void
  setFont(family: string, style: string): void
  text(text: string, x: number, y: number, options?: { align?: string }): void
  addImage(data: string, format: string, x: number, y: number, w: number, h: number): void
}

export interface BrandedHeaderOptions {
  brandName: string
  /** Right-aligned line: report title, or the brand being reported on. */
  title: string
  /** `{ r, g, b }` already parsed from the brand's hex colour. */
  color: { r: number; g: number; b: number }
  logo: BrandLogo | null
  pageWidth: number
}

/**
 * Draw the header both builders share: colour band, brand name on the left,
 * title on the right, logo in the top-right when one loaded.
 */
export function drawBrandedHeader(doc: PdfHeaderTarget, opts: BrandedHeaderOptions): void {
  const { brandName, title, color, logo, pageWidth } = opts

  doc.setFillColor(color.r, color.g, color.b)
  doc.rect(0, 0, pageWidth, 25, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(brandName, 15, 16)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  // Shift the title left when a logo occupies the corner, so they cannot
  // overlap on a long report name.
  doc.text(title, pageWidth - (logo ? 50 : 15), 16, { align: 'right' })

  if (logo) {
    doc.addImage(logo.dataUri, logo.format, pageWidth - 45, 3, 20, 10)
  }
}

/** Parse `#rrggbb` into the channel triple jsPDF wants. Falls back to indigo. */
export function hexToRgb(hex: string | null | undefined): { r: number; g: number; b: number } {
  const match = /^#?([0-9a-f]{6})$/i.exec((hex ?? '').trim())
  if (!match) return { r: 99, g: 102, b: 241 }
  const value = parseInt(match[1]!, 16)
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 }
}
