// PATH: src/lib/utils/citation-depth.ts
//
// Deterministic classifier that buckets a cited URL by PAGE DEPTH — i.e.
// how far the cited page sits from the root of its domain.
//
// Motivation (from Semrush "SEO vs AEO" April 2026 piece):
//   "AI doesn't necessarily cite high-ranking pages: AI often pulls deeper
//   subpages, blog posts, or documentation within trusted domains instead
//   of the exact ranking URLs."
//
// What we measure:
//   - root  — the homepage of a domain (path is "/", ""/index, etc).
//   - hub   — top-level section / category landing page (e.g. /blog,
//             /docs, /products) with exactly one meaningful path segment.
//   - leaf  — a deep article / product / doc page (≥2 meaningful segments,
//             or a single deep slug that is clearly content, not a hub).
//
// Plus a secondary "kind" hint useful for the UI (blog / docs / product /
// other) derived from the first path segment. Kind is independent of
// depth — a /blog/* page is "leaf" depth + "blog" kind; the /blog landing
// itself is "hub" depth + "blog" kind.
//
// Pure, no network, no LLM, no dependency — same posture as
// citation-classifier.ts. Pairs with it (type x depth = 2D citation
// matrix in the Citation Sources UI).

export type CitationDepth = 'root' | 'hub' | 'leaf'
export type CitationKind = 'blog' | 'docs' | 'product' | 'support' | 'other'

const HUB_FIRST_SEGMENTS = new Set([
  'blog',
  'docs',
  'documentation',
  'guides',
  'tutorials',
  'help',
  'support',
  'faq',
  'pricing',
  'products',
  'product',
  'features',
  'solutions',
  'industries',
  'use-cases',
  'resources',
  'learn',
  'academy',
  'news',
  'press',
  'about',
  'company',
  'contact',
  'shop',
  'store',
])

const BLOG_SEGMENTS = new Set(['blog', 'news', 'press', 'posts', 'articles', 'stories'])
const DOCS_SEGMENTS = new Set(['docs', 'documentation', 'guides', 'tutorials', 'learn', 'academy'])
const SUPPORT_SEGMENTS = new Set(['help', 'support', 'faq', 'kb', 'knowledge-base'])
const PRODUCT_SEGMENTS = new Set([
  'product',
  'products',
  'shop',
  'store',
  'p',
  'item',
  'items',
  'sku',
  'dp', // amazon
  'itm', // ebay
  'listing',
])

const LANG_CODES = new Set([
  'en',
  'it',
  'sv',
  'fr',
  'de',
  'es',
  'pt',
  'nl',
  'pl',
  'da',
  'fi',
  'no',
  'cs',
  'sk',
  'ja',
  'zh',
  'ko',
  'ar',
  'he',
  'tr',
  'ru',
  'uk',
  'el',
  'hu',
  'ro',
  'bg',
])

/** Drop empty + index-like + locale-only segments so they don't inflate depth. */
function meaningfulSegments(pathname: string): string[] {
  const parts = pathname
    .split('/')
    .map((p) => p.trim().toLowerCase())
    .filter((p) => p.length > 0 && p !== 'index.html' && p !== 'index.htm' && p !== 'index.php')
  // Drop a leading locale-only segment (e.g. /en/blog/post → blog/post).
  if (parts.length > 0 && LANG_CODES.has(parts[0]!)) parts.shift()
  return parts
}

/**
 * Classify a cited URL by depth. Returns 'leaf' for empty / un-parseable
 * input as a safe default (the typical un-parseable string is a relative
 * path like "/foo/bar" which IS a leaf in spirit).
 */
export function classifyCitationDepth(rawUrl: string): CitationDepth {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return 'leaf'

  let parsed: URL
  try {
    parsed = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`)
  } catch {
    return 'leaf'
  }

  const segments = meaningfulSegments(parsed.pathname)

  if (segments.length === 0) return 'root'
  if (segments.length === 1) {
    // One segment — hub if it's a recognised top-level section, otherwise
    // still treat as 'leaf' (a one-off slug page like /about-the-founder).
    return HUB_FIRST_SEGMENTS.has(segments[0]!) ? 'hub' : 'leaf'
  }
  return 'leaf'
}

/**
 * Classify a cited URL by content kind (blog / docs / product / support /
 * other). Independent of depth — useful for breaking down "what KIND of
 * content the AI is citing from this domain".
 */
export function classifyCitationKind(rawUrl: string): CitationKind {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return 'other'

  let parsed: URL
  try {
    parsed = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`)
  } catch {
    return 'other'
  }

  const segments = meaningfulSegments(parsed.pathname)
  if (segments.length === 0) return 'other'

  const first = segments[0]!
  if (BLOG_SEGMENTS.has(first)) return 'blog'
  if (DOCS_SEGMENTS.has(first)) return 'docs'
  if (SUPPORT_SEGMENTS.has(first)) return 'support'
  if (PRODUCT_SEGMENTS.has(first)) return 'product'
  return 'other'
}

/** Convenience: depth + kind together (one URL parse, two values). */
export function classifyCitationDepthAndKind(rawUrl: string): {
  depth: CitationDepth
  kind: CitationKind
} {
  return { depth: classifyCitationDepth(rawUrl), kind: classifyCitationKind(rawUrl) }
}

export interface DepthBreakdown {
  root: number
  hub: number
  leaf: number
}

export function emptyDepthBreakdown(): DepthBreakdown {
  return { root: 0, hub: 0, leaf: 0 }
}

/**
 * Deep-page citation rate as a percentage (0-100, 1 decimal). This is the
 * KPI the Semrush article highlights: "AI cites deep subpages, not the
 * homepage." A high rate means your blog/docs do the citation-earning
 * work; a low rate means AI engines mostly cite your homepage and you
 * may have a "deep content gap".
 */
export function deepPageRate(breakdown: DepthBreakdown): number {
  const total = breakdown.root + breakdown.hub + breakdown.leaf
  if (total === 0) return 0
  return Math.round((breakdown.leaf / total) * 1000) / 10
}
