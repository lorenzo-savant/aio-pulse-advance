// PATH: src/lib/utils/citation-classifier.ts
//
// Deterministic classifier that buckets a cited URL into one of three types
// that match how AI engines actually surface citations (informational links
// in the answer body, product links in shopping carousels, multimedia thumbs
// in image/video panels). Pure, no network, no LLM, no dependency.
//
// Heuristic order: multimedia > product > informational (default). The order
// matters because some product pages live on multimedia hosts (e.g. an
// Instagram product post) — we treat multimedia hosts as multimedia first.
//
// References:
//   - industry research "AI Citations" article — 3 citation types (informational /
//     product / multimedia) match what users observe in ChatGPT, Google AI
//     Mode and AI Overviews.

export type CitationType = 'informational' | 'product' | 'multimedia'

const MULTIMEDIA_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.avif',
  '.bmp',
  '.tif',
  '.tiff',
  '.heic',
  '.mp4',
  '.webm',
  '.mov',
  '.m4v',
  '.avi',
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.flac',
]

const MULTIMEDIA_HOSTS = [
  'youtube.com',
  'youtu.be',
  'vimeo.com',
  'dailymotion.com',
  'twitch.tv',
  'tiktok.com',
  'imgur.com',
  'flickr.com',
  'unsplash.com',
  'pexels.com',
  'pixabay.com',
  'pinterest.com',
  'pinterest.it',
  'pinterest.co.uk',
  'giphy.com',
  'tenor.com',
  'soundcloud.com',
  'spotify.com',
  'instagram.com', // overwhelmingly visual content
  'cdn.shopify.com', // image CDN
]

const PRODUCT_HOSTS = [
  'amazon.com',
  'amazon.it',
  'amazon.co.uk',
  'amazon.de',
  'amazon.fr',
  'amazon.es',
  'amazon.se',
  'ebay.com',
  'ebay.it',
  'ebay.co.uk',
  'etsy.com',
  'aliexpress.com',
  'alibaba.com',
  'walmart.com',
  'target.com',
  'bestbuy.com',
  'ikea.com',
  'shopify.com',
  'merchantcenter.google.com',
  'shopping.google.com',
  'temu.com',
  'shein.com',
  'wayfair.com',
  'zalando.it',
  'zalando.com',
  'asos.com',
  'farfetch.com',
  'ssense.com',
]

const PRODUCT_PATH_SEGMENTS = [
  '/product/',
  '/products/',
  '/p/',
  '/item/',
  '/items/',
  '/dp/', // amazon
  '/itm/', // ebay
  '/listing/', // etsy
  '/shop/',
  '/store/',
  '/buy/',
  '/cart/',
  '/checkout/',
  '/catalog/',
  '/collections/',
  '/sku/',
]

const PRODUCT_QUERY_KEYS = ['sku', 'product_id', 'productid', 'asin', 'item_id', 'itemid', 'pid']

/** Lowercase, www-stripped hostname. Returns null on un-parseable URL. */
function hostOf(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`)
    return u.hostname.toLowerCase().replace(/^www\./, '') || null
  } catch {
    return null
  }
}

/** Match a host against a list, accepting the bare host or any subdomain. */
function hostMatches(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith(`.${h}`))
}

/**
 * Classify a cited URL as multimedia, product, or informational (default).
 * Returns 'informational' for empty / un-parseable input so callers never
 * have to handle a null type.
 */
export function classifyCitation(rawUrl: string): CitationType {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return 'informational'

  let parsed: URL
  try {
    parsed = new URL(rawUrl.includes('://') ? rawUrl : `https://${rawUrl}`)
  } catch {
    return 'informational'
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  const pathLower = parsed.pathname.toLowerCase()

  // 1) Multimedia first — host OR file extension.
  if (hostMatches(host, MULTIMEDIA_HOSTS)) return 'multimedia'
  if (MULTIMEDIA_EXTENSIONS.some((ext) => pathLower.endsWith(ext))) return 'multimedia'

  // 2) Product — host, path segment, or query key.
  if (hostMatches(host, PRODUCT_HOSTS)) return 'product'
  if (PRODUCT_PATH_SEGMENTS.some((seg) => pathLower.includes(seg))) return 'product'
  for (const key of PRODUCT_QUERY_KEYS) {
    if (parsed.searchParams.has(key)) return 'product'
  }

  // 3) Default — informational.
  return 'informational'
}

/** Convenience: classify and group hostname together. Returns null host for
 *  un-parseable URLs but always returns a valid type. */
export function classifyCitationWithHost(rawUrl: string): {
  type: CitationType
  host: string | null
} {
  return { type: classifyCitation(rawUrl), host: hostOf(rawUrl) }
}
