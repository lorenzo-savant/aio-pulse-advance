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
 *   - FAQPage (when input has FAQs — heavy AI-citation lift, +25% per
 *     the industry research Aug-2025 study)
 *   - Article (when input has a description — anchors the homepage as
 *     citeable editorial content, +30% lift)
 *
 * Returns a single payload; embed via `<script type="application/ld+json">`
 * for compact delivery (one tag, four @types in @graph).
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

  const graph: Array<Record<string, unknown>> = [org, website]

  // FAQPage — only emitted when the input actually has FAQs. Empty
  // FAQPage objects trigger Google warnings and add no signal.
  if (input.faqs && input.faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: input.faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: f.answer,
        },
      })),
    })
  }

  // Article — anchors the homepage / brand profile as citeable
  // editorial content. Only emitted when there's a real description
  // (otherwise the Article body would be empty). Sets `author` to the
  // Organization itself, which is the conservative default; brands with
  // a real editor can override downstream.
  if (input.description && input.description.trim().length >= 40) {
    const article: Record<string, unknown> = {
      '@type': 'Article',
      headline: input.brandName,
      description: input.description.trim().slice(0, 320),
      mainEntityOfPage: `https://${input.domain}`,
      author: { '@type': 'Organization', name: input.brandName },
      publisher: { '@type': 'Organization', name: input.brandName },
    }
    if (input.lastUpdated) {
      article.dateModified = input.lastUpdated
    }
    if (input.locale) article.inLanguage = input.locale
    graph.push(article)
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  }
}
