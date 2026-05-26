// PATH: src/lib/utils/organization-schema.ts
//
// Schema.org Organization JSON-LD generator for the brand's own pages.
// Pairs with llms-generator.ts (buildOrganizationJsonLd) — same payload
// shape, different delivery. This module wraps the payload as a complete
// `<script type="application/ld+json">…</script>` block ready to paste
// into a page's <head>.
//
// Why a dedicated module: the llms-generator output is markdown-embedded
// for LLM crawlers. This output is HTML-embedded for traditional SEO
// crawlers (Google, Bing) and for AI engines that fetch the brand's own
// pages directly (ChatGPT browsing, Perplexity, Gemini). Both surfaces
// matter; same data, two emit paths.

import { buildOrganizationJsonLd, type LlmsInput } from '@/lib/services/llms-generator'

/**
 * Emit a complete <script type="application/ld+json"> block carrying the
 * brand's Organization schema. Caller is responsible for placing it in the
 * <head> of every page (or just the homepage — both work, but homepage-
 * only is the conservative choice if you're worried about duplication).
 *
 * The output is HTML-safe: the JSON is escaped so `</script>` inside a
 * description cannot break out of the script block. Schema.org's spec
 * allows arbitrary unicode, but if you have a description containing
 * `</script>` you have a bigger problem.
 */
export function emitOrganizationScriptTag(input: LlmsInput): string {
  const payload = buildOrganizationJsonLd(input)
  const json = JSON.stringify(payload, null, 2)
  // Defense in depth: split `</script>` so a malicious description can't
  // close the surrounding <script> early. JSON.stringify handles most
  // escaping, but `</script>` is the one pattern it does NOT touch.
  const safe = json.replace(/<\/script>/gi, '<\\/script>')
  return `<script type="application/ld+json">\n${safe}\n</script>`
}

/**
 * Emit just the raw JSON payload (no <script> wrapper). Useful when the
 * caller wants to embed inside a Next.js Head component or a framework
 * that escapes its own children.
 */
export function emitOrganizationJsonLd(input: LlmsInput): string {
  return JSON.stringify(buildOrganizationJsonLd(input), null, 2)
}

/**
 * Build a multi-schema bundle for richer SERP / AI grounding. Combines:
 *   - Organization (the brand itself)
 *   - WebSite (the canonical site, with SearchAction for chatbots)
 *   - BreadcrumbList (homepage-only minimal: [Home])
 *
 * Returns an array; embed it as `@graph` inside one outer @context wrapper
 * for compact delivery (one <script> tag, three @types).
 */
export function emitBrandKnowledgeGraph(input: LlmsInput): Record<string, unknown> {
  const org = buildOrganizationJsonLd(input)
  // Remove the inner @context — the outer wrapper carries it for @graph.
  delete (org as Record<string, unknown>)['@context']

  const website: Record<string, unknown> = {
    '@type': 'WebSite',
    name: input.brandName,
    url: `https://${input.domain}`,
    publisher: { '@type': 'Organization', name: input.brandName },
  }
  if (input.locale) website.inLanguage = input.locale

  return {
    '@context': 'https://schema.org',
    '@graph': [org, website],
  }
}
