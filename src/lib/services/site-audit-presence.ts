// PATH: src/lib/services/site-audit-presence.ts
//
// Foundational presence checks for the Site Audit Hub. We probe a few
// well-known URLs on the brand domain to see whether the AI-readiness
// foundations exist: the llms.txt v0.2 spec files, sitemap.xml, and a
// working HTTPS root. Each check is binary; the composite is a small
// 0-100 score so operators see in one glance whether the basics are
// in place before drilling into the heavier panels (crawler access,
// citation capture, citation quality).
//
// Pure service-layer: fetches via safeFetchText so SSRF protection +
// body-cap apply by default. Caller (API route) is responsible for
// auth + rate limiting.

import { safeFetchText } from '@/lib/utils/safe-fetch'

export interface PresenceCheck {
  /** Absolute URL we probed. */
  url: string
  /** True when the URL returned a 2xx response with non-empty body. */
  exists: boolean
  /** HTTP status code (null when fetch threw before a response). */
  status: number | null
  /** Short content excerpt when present — lets the panel display a
   *  "looks valid" preview (first 200 chars). Null when not exists. */
  excerpt: string | null
  /** Surfaces network / SSRF / timeout errors so the panel can
   *  distinguish "not configured" from "unreachable". */
  error?: string
}

export interface FoundationsReport {
  /** Brand domain after normalisation (no protocol, no path). */
  domain: string
  /** True when HTTPS root resolves successfully. */
  httpsAvailable: boolean
  llmsTxt: PresenceCheck
  llmsFullTxt: PresenceCheck
  sitemap: PresenceCheck
  /** 0-100 composite — weighted: HTTPS 20, llms.txt 35, llms-full.txt
   *  25, sitemap 20. Designed so a brand that publishes llms.txt
   *  variants gets ≥60 (medium); plus sitemap pushes to "strong". */
  foundationsScore: number
  /** Ranked next-action hints — sorted by missing-pillar weight. */
  recommendations: string[]
}

// Cap presence-check bodies at 256 KB. None of the files we probe
// should reasonably be larger; capping defends against pathological
// servers returning multi-megabyte responses for these paths.
const PRESENCE_MAX_BYTES = 256 * 1024

/** Strip protocol + path from a brand domain. Mirrors the normalisation
 *  used by crawler-access-audit so the two services agree on what
 *  "domain" means. */
export function normaliseBrandDomainForAudit(domain: string): string {
  return domain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
}

async function probe(url: string): Promise<PresenceCheck> {
  try {
    const { text, response } = await safeFetchText(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AIOPulseBot/1.0; +https://aio-pulse.app)',
        Accept: '*/*',
      },
      timeout: 15_000,
      maxBytes: PRESENCE_MAX_BYTES,
    })
    const exists = response.ok && text.trim().length > 0
    return {
      url,
      exists,
      status: response.status,
      excerpt: exists ? text.slice(0, 200) : null,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      url,
      exists: false,
      status: null,
      excerpt: null,
      error: message,
    }
  }
}

/** Probe the four foundation URLs in parallel and compose a verdict. */
export async function auditFoundations(rawDomain: string): Promise<FoundationsReport> {
  const domain = normaliseBrandDomainForAudit(rawDomain)
  const root = `https://${domain}/`
  const llmsTxtUrl = `https://${domain}/llms.txt`
  const llmsFullUrl = `https://${domain}/llms-full.txt`
  const sitemapUrl = `https://${domain}/sitemap.xml`

  // Parallel — each fetch is independent.
  const [rootProbe, llmsTxt, llmsFullTxt, sitemap] = await Promise.all([
    probe(root),
    probe(llmsTxtUrl),
    probe(llmsFullUrl),
    probe(sitemapUrl),
  ])

  const httpsAvailable = rootProbe.exists

  // Composite score — weighted toward llms.txt v0.2 emit because that's
  // the direct AI-citation signal we ship llms-generator.ts for. HTTPS
  // is mandatory hygiene; sitemap helps crawlers discover content.
  let score = 0
  if (httpsAvailable) score += 20
  if (llmsTxt.exists) score += 35
  if (llmsFullTxt.exists) score += 25
  if (sitemap.exists) score += 20
  const foundationsScore = Math.min(100, score)

  const recommendations: string[] = []
  if (!httpsAvailable) {
    recommendations.push(
      `HTTPS root at ${root} is unreachable — every other AI-readiness signal stacks on top of this. Fix the certificate / DNS first.`,
    )
  }
  if (!llmsTxt.exists) {
    recommendations.push(
      `Publish \`/llms.txt\` (the short variant). Use the Generate llms.txt button on the brand detail page, then upload to the site root.`,
    )
  }
  if (!llmsFullTxt.exists) {
    recommendations.push(
      `Publish \`/llms-full.txt\` (the long variant with FAQ + key takeaways + Schema.org JSON-LD embedded).`,
    )
  }
  if (!sitemap.exists) {
    recommendations.push(
      `Publish \`/sitemap.xml\` — AI crawlers discover content faster when an explicit sitemap is declared in robots.txt and at the root.`,
    )
  }
  if (recommendations.length === 0) {
    recommendations.push(
      'Foundations are in place. Keep llms.txt + llms-full.txt updated whenever brand facts change.',
    )
  }

  return {
    domain,
    httpsAvailable,
    llmsTxt,
    llmsFullTxt,
    sitemap,
    foundationsScore,
    recommendations,
  }
}
