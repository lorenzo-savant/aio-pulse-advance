// PATH: src/lib/services/llms-enrichment.ts
//
// Enrichment layer for the llms.txt generator. The base generator
// (llms-generator.ts) only renders the sections it's handed — and the UI
// historically passed nothing beyond the brand record, so the output was
// just a "Brand Identity" stub. This service gathers REAL data from four
// sources so the generated file is dense enough to actually help AI
// crawlers understand the brand:
//
//   1. Website scrape  — homepage <title> / meta description / og:* and
//      sitemap.xml → description + Important Links. SSRF-safe via safeFetch.
//   2. AEO snippets    — aeo_snippets.question/answer rows → FAQ section.
//   3. Keywords        — keyword_tracking top terms → Key Facts specialties.
//   4. AI synthesis    — Groq (chain → Gemini → OpenAI) turns the raw scraped
//      text + brand data into a polished About paragraph + product list.
//
// Every source soft-fails independently: a dead website, an empty AEO table,
// or a missing LLM key never aborts generation — the file just gets the
// sections we could fill. Toggle the whole thing with the `enrich` flag in
// the route; individual sources are switched via EnrichOptions.

import type { createServerClient } from '@/lib/supabase'
import { asUntyped } from '@/lib/supabase-untyped'
import { logger } from '@/lib/logger'
import { safeFetchText } from '@/lib/utils/safe-fetch'
import { callLLM } from './prompt-generator-ai'
import type { LlmsInput } from './llms-generator'
import { disambiguationFor } from '@/lib/brand-enrichment'
import { GEO } from '@/lib/geo-config'
import { searchBrandRanking, isBraveSearchAvailable } from './brave-search'

// Reference market for a brand: explicit field wins, else derived from the
// brand language, else the workspace-wide configured market. Keeps generation
// market-aware (e.g. "Sweden", not a US-default assumption).
function deriveMarket(explicit: string | null | undefined, language?: string | null): string {
  if (explicit && explicit.trim()) return explicit.trim()
  if (language === 'sv') return 'Sweden'
  if (language === 'it') return 'Italy'
  return GEO.marketName
}

// Brave grounding: search the brand name and report what the web actually
// says — used to confirm the brand's category/market and to flag look-alike
// confusion (when the brand's own domain doesn't dominate its own name).
async function braveGroundBrand(
  brandName: string,
  domain: string,
  language?: string,
): Promise<{ summary: string; lookAlikeRisk: boolean } | null> {
  if (!isBraveSearchAvailable() || !domain) return null
  try {
    const res = await searchBrandRanking(brandName, domain, language)
    const top = res.organicResults.slice(0, 4)
    if (top.length === 0) return null
    const lines = top.map((r) => `  #${r.rank} ${r.title} — ${r.url}`)
    const ranks =
      res.position > 0
        ? `The brand's own site (${domain}) ranks at #${res.position}.`
        : `The brand's own site (${domain}) does NOT appear in the top results — possible name collision with another company.`
    return {
      summary: `Top results for "${brandName}":\n${lines.join('\n')}\n${ranks}`,
      lookAlikeRisk: res.position === 0,
    }
  } catch (err) {
    logger.warn('llms-enrichment: brave grounding failed', { err: String(err) })
    return null
  }
}

type Db = ReturnType<typeof createServerClient>

export interface EnrichOptions {
  scrapeSite: boolean
  aeoFaqs: boolean
  keywordSpecialties: boolean
  aiSynthesis: boolean
}

export interface EnrichmentResult {
  /** Fields to merge into LlmsInput. Only set what we actually found. */
  patch: Partial<LlmsInput>
  /** Per-source diagnostics for the UI ("scraped 8 pages", "AI: groq", …). */
  sources: {
    scrape: { ok: boolean; pages: number; description: boolean; note?: string }
    aeo: { ok: boolean; faqs: number; note?: string }
    keywords: { ok: boolean; specialties: number; note?: string }
    ai: { ok: boolean; provider: string | null; products: number; note?: string }
  }
}

// ─── 1. Website scrape ───────────────────────────────────────────────────────

interface ScrapeResult {
  title: string | null
  description: string | null
  /** Combined visible-ish text across the homepage + a few key pages, for the
   *  AI synthesis + FAQ extraction step. */
  rawText: string | null
  importantPages: Array<{ title: string; url: string; description: string }>
  /** FAQs lifted directly from JSON-LD FAQPage schema on any crawled page. */
  jsonLdFaqs: Array<{ question: string; answer: string }>
}

// Parse FAQ Q&A out of JSON-LD FAQPage / Question blocks embedded in the HTML.
// This is the most reliable signal when a site ships structured data.
function extractJsonLdFaqs(html: string): Array<{ question: string; answer: string }> {
  const out: Array<{ question: string; answer: string }> = []
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )
  for (const b of blocks) {
    const raw = b[1]
    if (!raw) continue
    let json: unknown
    try {
      json = JSON.parse(raw.trim())
    } catch {
      continue
    }
    // The block can be a single object or an array (or @graph).
    const j = json as Record<string, unknown> | unknown[]
    const graph = !Array.isArray(j) && j ? (j as Record<string, unknown>)['@graph'] : null
    const nodes: unknown[] = Array.isArray(j) ? j : Array.isArray(graph) ? graph : [j]
    for (const rawNode of nodes) {
      if (!rawNode || typeof rawNode !== 'object') continue
      const node = rawNode as Record<string, unknown>
      const mainEntity = node.mainEntity
      const isQuestion = node['@type'] === 'Question'
      const entities = mainEntity ?? (isQuestion ? [node] : null)
      const list: unknown[] = Array.isArray(entities) ? entities : entities ? [entities] : []
      for (const rawQ of list) {
        if (!rawQ || typeof rawQ !== 'object') continue
        const q = rawQ as Record<string, unknown>
        const question = typeof q.name === 'string' ? q.name.trim() : ''
        const accepted = q.acceptedAnswer as Record<string, unknown> | undefined
        const text = accepted && typeof accepted.text === 'string' ? accepted.text : ''
        const answer = text ? stripTags(text).trim() : ''
        if (question && answer) out.push({ question, answer })
      }
    }
  }
  return out
}

// Extract internal links from homepage <a href> tags — a fallback for sites
// without a sitemap.xml, and the source of pages we deep-crawl for FAQs.
function extractInternalLinks(html: string, base: string): string[] {
  let origin: string
  try {
    origin = new URL(base).origin
  } catch {
    return []
  }
  const hrefs = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)]
    .map((m) => m[1]?.trim())
    .filter((h): h is string => !!h)
  const out = new Set<string>()
  for (const href of hrefs) {
    let abs: string
    try {
      abs = new URL(href, origin).toString()
    } catch {
      continue
    }
    if (new URL(abs).origin !== origin) continue // same-site only
    if (/\.(jpg|jpeg|png|gif|webp|svg|css|js|pdf|zip|mp4)(\?|$)/i.test(abs)) continue
    out.add(abs.split('#')[0]!.replace(/\/$/, ''))
  }
  return [...out]
}

// Pages most likely to carry FAQ / product / about content, so the deep crawl
// spends its budget where the useful info lives.
const KEY_PAGE_HINTS =
  /(faq|vanliga|fragor|fr%C3%A5gor|domande|about|om-oss|chi-siamo|pricing|pris|prezzi|product|produkt|prodotto|service|tjanst|servizi|features|funktioner|funzioni|digital-twin|support|help|hjalp)/i

function titleFromPath(url: string): string {
  let path: string
  try {
    path = new URL(url).pathname.replace(/\/$/, '')
  } catch {
    return ''
  }
  const slug = path.split('/').filter(Boolean).pop() ?? ''
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\.\w+$/, '')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function extractMeta(html: string, names: string[]): string | null {
  for (const name of names) {
    // matches <meta name="description" content="..."> in either attribute order
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, 'i'),
    ]
    for (const re of patterns) {
      const m = re.exec(html)
      if (m && m[1]) return decodeEntities(m[1])
    }
  }
  return null
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' '),
  )
}

async function scrapeSite(domain: string): Promise<ScrapeResult> {
  const base = domain.startsWith('http') ? domain : `https://${domain}`
  const result: ScrapeResult = {
    title: null,
    description: null,
    rawText: null,
    importantPages: [],
    jsonLdFaqs: [],
  }

  const textParts: string[] = []
  let homepageLinks: string[] = []

  // ── Homepage ──────────────────────────────────────────────────────────────
  try {
    const { text: html } = await safeFetchText(base, { timeout: 10_000, maxBytes: 1_500_000 })
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
    result.title = titleMatch?.[1] ? decodeEntities(titleMatch[1]) : null
    result.description =
      extractMeta(html, ['description', 'og:description', 'twitter:description']) ?? null
    textParts.push(stripTags(html).slice(0, 3000))
    result.jsonLdFaqs.push(...extractJsonLdFaqs(html))
    homepageLinks = extractInternalLinks(html, base)
  } catch (err) {
    logger.warn('llms-enrichment: homepage scrape failed', {
      domain,
      err: err instanceof Error ? err.message : String(err),
    })
  }

  // ── Discover candidate URLs: sitemap.xml first, then homepage links ────────
  let urls: string[] = []
  try {
    const { text: xml } = await safeFetchText(`${base}/sitemap.xml`, {
      timeout: 8_000,
      maxBytes: 2_000_000,
    })
    urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
      .map((m) => m[1]?.trim())
      .filter((u): u is string => !!u)
  } catch {
    /* no sitemap — fall back to homepage links below */
  }
  if (urls.length === 0) urls = homepageLinks

  // Build the importantPages list (deduped, non-asset, homepage excluded).
  const seen = new Set<string>()
  let homePath = ''
  try {
    homePath = new URL(base).pathname.replace(/\/$/, '')
  } catch {
    /* ignore */
  }
  for (const url of urls) {
    if (result.importantPages.length >= 12) break
    if (/\.(xml|jpg|jpeg|png|gif|webp|svg|css|js|pdf)$/i.test(url)) continue
    let path: string
    try {
      path = new URL(url).pathname.replace(/\/$/, '')
    } catch {
      continue
    }
    if (!path || path === homePath || seen.has(path)) continue
    seen.add(path)
    const title = titleFromPath(url)
    if (!title) continue
    result.importantPages.push({ title, url, description: `${title} page` })
  }

  // ── Deep-crawl a few key pages (FAQ/product/about) for content + FAQs ──────
  const keyPages = result.importantPages
    .filter((p) => KEY_PAGE_HINTS.test(p.url))
    .slice(0, 4)
    // If no obvious key pages, just take the first couple so we still get more
    // than the homepage.
    .concat(result.importantPages.filter((p) => !KEY_PAGE_HINTS.test(p.url)).slice(0, 2))
    .slice(0, 4)

  const crawled = await Promise.allSettled(
    keyPages.map((p) => safeFetchText(p.url, { timeout: 6_000, maxBytes: 1_000_000 })),
  )
  for (const r of crawled) {
    if (r.status !== 'fulfilled') continue
    const html = r.value.text
    result.jsonLdFaqs.push(...extractJsonLdFaqs(html))
    textParts.push(stripTags(html).slice(0, 2500))
  }

  // Dedup JSON-LD FAQs by question.
  const faqSeen = new Set<string>()
  result.jsonLdFaqs = result.jsonLdFaqs.filter((f) => {
    const k = f.question.toLowerCase().trim()
    if (faqSeen.has(k)) return false
    faqSeen.add(k)
    return true
  })

  result.rawText = textParts.join('\n\n').slice(0, 7000) || null
  return result
}

// ─── 2. AEO snippets → FAQs ──────────────────────────────────────────────────

async function getAeoFaqs(
  db: Db,
  brandId: string,
): Promise<Array<{ question: string; answer: string }>> {
  if (!db) return []
  const dbAny = asUntyped(db)
  try {
    const { data } = await dbAny
      .from('aeo_snippets')
      .select('question, answer')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(15)
    return ((data ?? []) as Array<{ question: unknown; answer: unknown }>)
      .filter(
        (r): r is { question: string; answer: string } =>
          typeof r.question === 'string' &&
          typeof r.answer === 'string' &&
          r.question.trim().length > 0 &&
          r.answer.trim().length > 0,
      )
      .map((r) => ({ question: r.question.trim(), answer: r.answer.trim() }))
  } catch (err) {
    logger.warn('llms-enrichment: aeo_snippets read failed', { err: String(err) })
    return []
  }
}

// ─── 3. Keywords → specialties ───────────────────────────────────────────────

async function getKeywordSpecialties(db: Db, brandId: string): Promise<string[]> {
  if (!db) return []
  const dbAny = asUntyped(db)
  try {
    const { data } = await dbAny
      .from('keyword_tracking')
      .select('keyword, mention_count')
      .eq('brand_id', brandId)
      .order('mention_count', { ascending: false })
      .limit(12)
    const seen = new Set<string>()
    const out: string[] = []
    for (const row of (data ?? []) as Array<{ keyword: unknown }>) {
      if (typeof row.keyword !== 'string') continue
      const kw = row.keyword.trim()
      const key = kw.toLowerCase()
      if (!kw || seen.has(key)) continue
      seen.add(key)
      out.push(kw)
      if (out.length >= 8) break
    }
    return out
  } catch (err) {
    logger.warn('llms-enrichment: keyword_tracking read failed', { err: String(err) })
    return []
  }
}

// ─── 4. AI synthesis ─────────────────────────────────────────────────────────

interface SynthesisInput {
  brandName: string
  domain: string
  industry?: string
  market?: string
  language?: string
  aliases?: string[]
  competitors?: string[]
  existingDescription?: string
  /** Disambiguation warning (specific hint or generic no-confusion line). */
  disambiguation?: string | null
  /** Short Brave-grounding summary of what the web says about this brand. */
  braveGrounding?: string | null
  scrapedTitle?: string | null
  scrapedDescription?: string | null
  scrapedText?: string | null
}

interface SynthesisOutput {
  description: string
  products: Array<{ name: string; description: string }>
  faqs: Array<{ question: string; answer: string }>
  /** True when the model judges the scraped content is NOT about this brand. */
  mismatch: boolean
}

function buildSynthesisSystemPrompt(): string {
  return [
    'You are a brand analyst writing the content of an llms.txt file — a curated Markdown brief that helps AI assistants (ChatGPT, Gemini, Perplexity, Claude) understand ONE specific company.',
    'You will be given the canonical IDENTITY of that company (name + exact domain + market + language) and raw text scraped from that domain.',
    'Produce a single JSON object. JSON only, no prose, no markdown fences.',
    'Schema: { "description": string, "products": [ { "name": string, "description": string } ], "faqs": [ { "question": string, "answer": string } ], "mismatch": boolean }',
    'GROUNDING RULES — these override everything else:',
    'A. Describe ONLY the company at the given DOMAIN, using the scraped content from that domain as ground truth. The DOMAIN is the authority on who this brand is.',
    'B. NEVER confuse this brand with a similarly-named company, a foreign trademark, or a better-known look-alike. If a DISAMBIGUATION note is provided, obey it strictly.',
    'C. If the scraped content clearly appears to be about a DIFFERENT company than the named brand/domain (or is empty/irrelevant), set "mismatch": true, put a one-line explanation in "description", and return EMPTY products and faqs. Do NOT describe a different company to fill the gap.',
    'D. Respect the MARKET and LANGUAGE: this brand serves the stated market; do not assume a US/global context if the market is e.g. Sweden.',
    'Content rules:',
    '1. "description": 1-3 factual sentences on what the company does and who it serves, grounded in the scraped content. No fluff, no unsupported superlatives.',
    '2. "products": 0-6 concrete products/services, one sentence each. If the content does not clearly reveal products, return []. Do NOT invent.',
    '3. "faqs": if the scraped text has an FAQ / "Vanliga frågor" / "Domande frequenti" / Q&A section, extract up to 10 question→answer pairs (verbatim meaning). Include a pair ONLY when both question AND a real answer are present. Never invent answers. Else [].',
    '4. Never fabricate facts (prices, founding dates, locations) not present in the input.',
    '5. Write in the brand LANGUAGE when it is non-English; otherwise match the scraped text.',
  ].join('\n')
}

function buildSynthesisUserPrompt(input: SynthesisInput): string {
  return [
    '=== CANONICAL IDENTITY (authoritative) ===',
    `BRAND: ${input.brandName}`,
    `DOMAIN: ${input.domain}`,
    input.industry ? `INDUSTRY: ${input.industry}` : '',
    input.market ? `REFERENCE MARKET: ${input.market}` : '',
    input.language ? `LANGUAGE: ${input.language}` : '',
    input.aliases && input.aliases.length > 0 ? `ALSO KNOWN AS: ${input.aliases.join(', ')}` : '',
    input.competitors && input.competitors.length > 0
      ? `COMPETITORS: ${input.competitors.join(', ')}`
      : '',
    input.disambiguation ? `\nDISAMBIGUATION:\n${input.disambiguation}` : '',
    input.braveGrounding
      ? `\nWEB GROUNDING (Brave search for the brand):\n${input.braveGrounding}`
      : '',
    '',
    '=== SCRAPED CONTENT (from the DOMAIN above — ground truth) ===',
    input.existingDescription ? `EXISTING DESCRIPTION: ${input.existingDescription}` : '',
    input.scrapedTitle ? `PAGE TITLE: ${input.scrapedTitle}` : '',
    input.scrapedDescription ? `META DESCRIPTION: ${input.scrapedDescription}` : '',
    input.scrapedText ? `PAGE TEXT (truncated):\n${input.scrapedText}` : '',
    '',
    'Return the JSON object now.',
  ]
    .filter(Boolean)
    .join('\n')
}

async function synthesize(
  input: SynthesisInput,
): Promise<{ output: SynthesisOutput | null; provider: string | null; note?: string }> {
  try {
    const llm = await callLLM(buildSynthesisSystemPrompt(), buildSynthesisUserPrompt(input))
    const cleaned = llm.text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    const parsed = JSON.parse(cleaned) as {
      description?: unknown
      products?: unknown
      faqs?: unknown
      mismatch?: unknown
    }
    const mismatch = parsed.mismatch === true
    const description = typeof parsed.description === 'string' ? parsed.description.trim() : ''
    const products = Array.isArray(parsed.products)
      ? parsed.products
          .filter((p): p is { name: string; description: string } => {
            if (!p || typeof p !== 'object') return false
            const o = p as Record<string, unknown>
            return typeof o.name === 'string' && typeof o.description === 'string'
          })
          .map((p) => ({ name: p.name.trim(), description: p.description.trim() }))
          .slice(0, 6)
      : []
    const faqs = Array.isArray(parsed.faqs)
      ? parsed.faqs
          .filter((f): f is { question: string; answer: string } => {
            if (!f || typeof f !== 'object') return false
            const o = f as Record<string, unknown>
            return (
              typeof o.question === 'string' &&
              typeof o.answer === 'string' &&
              o.question.trim().length > 0 &&
              o.answer.trim().length > 0
            )
          })
          .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
          .slice(0, 10)
      : []
    // Brand mismatch: the scraped content isn't about this brand. Surface the
    // explanation but do NOT let a wrong description/products/faqs through.
    if (mismatch) {
      return {
        output: { description, products: [], faqs: [], mismatch: true },
        provider: llm.provider,
        note: description || 'scraped content did not match the brand',
      }
    }
    if (!description && products.length === 0 && faqs.length === 0) {
      return { output: null, provider: llm.provider, note: 'AI returned no usable content' }
    }
    return { output: { description, products, faqs, mismatch: false }, provider: llm.provider }
  } catch (err) {
    const note = err instanceof Error ? err.message : String(err)
    logger.warn('llms-enrichment: AI synthesis failed', { note })
    return { output: null, provider: null, note }
  }
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

interface BrandLike {
  name: string
  domain: string
  description?: string | null
  industry?: string | null
  market?: string | null
  language?: string | null
  aliases?: string[] | null
  competitors?: string[] | null
}

export async function enrichLlmsInput(
  db: Db,
  brand: BrandLike,
  brandId: string,
  opts: EnrichOptions,
): Promise<EnrichmentResult> {
  const patch: Partial<LlmsInput> = {}
  const sources: EnrichmentResult['sources'] = {
    scrape: { ok: false, pages: 0, description: false },
    aeo: { ok: false, faqs: 0 },
    keywords: { ok: false, specialties: 0 },
    ai: { ok: false, provider: null, products: 0 },
  }

  const market = deriveMarket(brand.market, brand.language)

  // Run independent retrievals in parallel — including a Brave grounding pass
  // (only when AI synthesis is on, since that's the only consumer) to confirm
  // the brand's identity/category and flag look-alike confusion.
  const [scrape, faqs, specialties, grounding] = await Promise.all([
    opts.scrapeSite ? scrapeSite(brand.domain) : Promise.resolve(null),
    opts.aeoFaqs ? getAeoFaqs(db, brandId) : Promise.resolve([]),
    opts.keywordSpecialties ? getKeywordSpecialties(db, brandId) : Promise.resolve([]),
    opts.aiSynthesis
      ? braveGroundBrand(brand.name, brand.domain, brand.language ?? undefined)
      : Promise.resolve(null),
  ])

  if (scrape) {
    if (scrape.importantPages.length > 0) {
      patch.importantPages = scrape.importantPages
      sources.scrape.pages = scrape.importantPages.length
    }
    // Only fill description from the meta tag if the brand has none — AI
    // synthesis (below) may override with a better one.
    if (!brand.description && scrape.description) {
      patch.description = scrape.description
      sources.scrape.description = true
    }
    sources.scrape.ok = !!(scrape.title || scrape.description || scrape.importantPages.length)
    if (!sources.scrape.ok) sources.scrape.note = 'site unreachable or empty'
  }

  // FAQs come from three sources, in order of trust: JSON-LD FAQPage on the
  // site, the aeo_snippets table, and AI extraction from the crawled page
  // text. They're merged + deduped at the end.
  const collectedFaqs: Array<{ question: string; answer: string }> = [
    ...(scrape?.jsonLdFaqs ?? []),
    ...faqs,
  ]

  if (specialties.length > 0) {
    patch.keyFacts = { ...(patch.keyFacts ?? {}), specialties }
    sources.keywords = { ok: true, specialties: specialties.length }
  } else if (opts.keywordSpecialties) {
    sources.keywords.note = 'no tracked keywords yet'
  }

  // AI synthesis runs last so it can use the scraped raw text (homepage + key
  // pages) — including extracting FAQ Q&A the site didn't expose as schema.
  if (opts.aiSynthesis) {
    // Disambiguation: specific hint (e.g. Acasting/Acast) if known, else a
    // generic canonical-identity line that pins the brand to its own domain.
    const specificHint = disambiguationFor(brand.name)
    const genericHint = `"${brand.name}" is the company at ${brand.domain}${
      brand.industry ? ` (${brand.industry})` : ''
    } serving the ${market} market. Describe ONLY this company from its own site. Do not confuse it with similarly-named brands or foreign trademarks.`
    const lookAlikeNote = grounding?.lookAlikeRisk
      ? ` NOTE: a web search for "${brand.name}" did not surface ${brand.domain} at the top — be extra careful not to describe a different, better-known company.`
      : ''
    const disambiguation = `${specificHint ?? genericHint}${lookAlikeNote}`

    const { output, provider, note } = await synthesize({
      brandName: brand.name,
      domain: brand.domain,
      industry: brand.industry ?? undefined,
      market,
      language: brand.language ?? undefined,
      aliases: brand.aliases ?? undefined,
      competitors: brand.competitors ?? undefined,
      existingDescription: brand.description ?? undefined,
      disambiguation,
      braveGrounding: grounding?.summary ?? null,
      scrapedTitle: scrape?.title ?? null,
      scrapedDescription: scrape?.description ?? null,
      scrapedText: scrape?.rawText ?? null,
    })
    if (output?.mismatch) {
      // The scraped content wasn't about this brand — don't pollute the file
      // with a wrong description. Flag it so the operator can fix the domain.
      sources.ai = {
        ok: false,
        provider,
        products: 0,
        note: `brand mismatch — ${note ?? 'scraped content did not match the brand'}`,
      }
    } else if (output) {
      // AI description wins over the meta-tag one (richer, brand-aware).
      if (output.description) patch.description = output.description
      if (output.products.length > 0) patch.products = output.products
      collectedFaqs.push(...output.faqs)
      sources.ai = { ok: true, provider, products: output.products.length }
    } else {
      sources.ai = { ok: false, provider, products: 0, note: note ?? 'no content' }
    }
  }

  // Dedup FAQs by question (case-insensitive), cap at 12.
  const faqSeen = new Set<string>()
  const mergedFaqs = collectedFaqs.filter((f) => {
    const k = f.question.toLowerCase().trim()
    if (!k || faqSeen.has(k)) return false
    faqSeen.add(k)
    return true
  })
  if (mergedFaqs.length > 0) {
    patch.faqs = mergedFaqs.slice(0, 12)
    sources.aeo = { ok: true, faqs: patch.faqs.length }
  } else if (opts.aeoFaqs || opts.scrapeSite) {
    sources.aeo.note = 'no FAQ found on the site, in AEO snippets, or via AI'
  }

  return { patch, sources }
}
