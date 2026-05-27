// PATH: src/lib/utils/comparison-table-check.ts
//
// Detects image-based pricing/comparison tables — the industry research "SaaS AI
// search optimization" pitfall #5: "tables saved as screenshots are
// invisible to AI extraction". When a page's URL signals it's a pricing
// or comparison page, we want at least one real HTML <table>; if all the
// table-shaped content lives in <img>, AI engines can't extract it.
//
// Heuristic — intentionally narrow to keep false positives down:
//   1. URL signals comparison/pricing/feature-matrix context.
//   2. Body contains 1+ <img> whose src/alt/file-name suggests a table
//      ("pricing-table", "comparison", "feature-matrix", "tiers", etc.).
//   3. Body contains 0 HTML <table> elements.
//
// Verdict:
//   - skipped:    URL doesn't look like a comparison/pricing page.
//   - ok:         page has at least one HTML <table> OR no table-like images.
//   - vulnerable: comparison page with table-like images and no <table>.

export type ComparisonTableVerdict = 'skipped' | 'ok' | 'vulnerable'

export interface ComparisonTableCheck {
  verdict: ComparisonTableVerdict
  /** Why we landed on this verdict. */
  reason: string
  /** Number of `<table>` tags found in the body. */
  htmlTableCount: number
  /** Filenames/alt strings flagged as table-like images. */
  flaggedImages: string[]
}

const URL_HINTS = [
  '/pricing',
  '/price',
  '/plans',
  '/compare',
  '/comparison',
  '-vs-',
  '/vs/',
  '/vs-',
  '/feature-matrix',
  '/features-comparison',
  // it
  '/prezzi',
  '/confronto',
  '/piani',
  // sv
  '/priser',
  '/jamfor',
  '/jämför',
  '/abonnemang',
]

const IMG_TABLE_HINTS = [
  'pricing-table',
  'pricing_table',
  'pricingtable',
  'price-table',
  'comparison-table',
  'comparison_table',
  'comparisontable',
  'feature-matrix',
  'feature_matrix',
  'featurematrix',
  'feature-comparison',
  'pricing-tier',
  'pricing_tier',
  'pricing-grid',
  'plan-comparison',
  'plans-comparison',
  'tier-comparison',
  'price-chart',
  'pricing-chart',
  'pricing-page',
  'plans-table',
  'compare-plans',
  'compare-pricing',
  // it
  'tabella-prezzi',
  'confronto-piani',
  // sv
  'prislista',
  'pristabell',
  'planjämförelse',
  'planjamforelse',
]

function urlLooksLikeComparison(url: string): boolean {
  const lower = url.toLowerCase()
  return URL_HINTS.some((h) => lower.includes(h))
}

function countHtmlTables(html: string): number {
  // `<table` followed by whitespace or '>' to avoid matching e.g. <tablet>.
  return [...html.matchAll(/<table[\s>]/gi)].length
}

function extractImgTags(html: string): Array<{ src: string; alt: string }> {
  const tags: Array<{ src: string; alt: string }> = []
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]
    const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']*)["']/i)
    const altMatch = tag.match(/\balt\s*=\s*["']([^"']*)["']/i)
    tags.push({ src: srcMatch?.[1] ?? '', alt: altMatch?.[1] ?? '' })
  }
  return tags
}

function imgLooksLikeTable(img: { src: string; alt: string }): string | null {
  const haystack = `${img.src} ${img.alt}`.toLowerCase().replace(/[\s_]+/g, '-')
  for (const hint of IMG_TABLE_HINTS) {
    const needle = hint.replace(/[_\s]+/g, '-')
    if (haystack.includes(needle)) {
      // Prefer the filename for display; fall back to alt.
      const display = img.src ? img.src.split('/').filter(Boolean).pop() || img.src : img.alt
      return display
    }
  }
  return null
}

export function checkComparisonTable(html: string, url: string): ComparisonTableCheck {
  if (!urlLooksLikeComparison(url)) {
    return {
      verdict: 'skipped',
      reason: 'URL does not look like a pricing or comparison page',
      htmlTableCount: 0,
      flaggedImages: [],
    }
  }

  const htmlTableCount = countHtmlTables(html)
  const flaggedImages = extractImgTags(html)
    .map(imgLooksLikeTable)
    .filter((x): x is string => x !== null)

  if (flaggedImages.length === 0) {
    return {
      verdict: 'ok',
      reason: 'No table-like images detected on this comparison page',
      htmlTableCount,
      flaggedImages: [],
    }
  }

  if (htmlTableCount > 0) {
    return {
      verdict: 'ok',
      reason: `Comparison page has ${htmlTableCount} HTML <table>(s) backing the ${flaggedImages.length} image asset(s)`,
      htmlTableCount,
      flaggedImages,
    }
  }

  return {
    verdict: 'vulnerable',
    reason: `Comparison page relies on ${flaggedImages.length} table-like image(s) and 0 HTML <table>s — AI engines can't extract this content`,
    htmlTableCount,
    flaggedImages,
  }
}
