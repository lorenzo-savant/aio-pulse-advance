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
import { logger } from '@/lib/logger'
import { safeFetchText } from '@/lib/utils/safe-fetch'
import { callLLM } from './prompt-generator-ai'
import type { LlmsInput } from './llms-generator'

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
  /** Raw visible-ish text snippet for the AI synthesis step. */
  rawText: string | null
  importantPages: Array<{ title: string; url: string; description: string }>
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
  }

  // Homepage
  try {
    const { text: html } = await safeFetchText(base, { timeout: 10_000, maxBytes: 1_500_000 })
    const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
    result.title = titleMatch?.[1] ? decodeEntities(titleMatch[1]) : null
    result.description =
      extractMeta(html, ['description', 'og:description', 'twitter:description']) ?? null
    result.rawText = stripTags(html).slice(0, 4000)
  } catch (err) {
    logger.warn('llms-enrichment: homepage scrape failed', {
      domain,
      err: err instanceof Error ? err.message : String(err),
    })
  }

  // sitemap.xml → important pages (best-effort, capped)
  try {
    const { text: xml } = await safeFetchText(`${base}/sitemap.xml`, {
      timeout: 8_000,
      maxBytes: 2_000_000,
    })
    const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
      .map((m) => m[1]?.trim())
      .filter((u): u is string => !!u)
    // Skip the bare homepage (already linked separately) and asset-ish URLs.
    const seen = new Set<string>()
    for (const url of urls) {
      if (result.importantPages.length >= 12) break
      if (/\.(xml|jpg|jpeg|png|gif|webp|svg|css|js|pdf)$/i.test(url)) continue
      let path: string
      try {
        path = new URL(url).pathname.replace(/\/$/, '')
      } catch {
        continue
      }
      if (!path || path === '' || seen.has(path)) continue
      seen.add(path)
      // Derive a human title from the last path segment.
      const slug = path.split('/').filter(Boolean).pop() ?? ''
      const title = slug
        .replace(/[-_]+/g, ' ')
        .replace(/\.\w+$/, '')
        .replace(/\b\w/g, (c) => c.toUpperCase())
      if (!title) continue
      result.importantPages.push({ title, url, description: `${title} page` })
    }
  } catch (err) {
    logger.warn('llms-enrichment: sitemap scrape failed', {
      domain,
      err: err instanceof Error ? err.message : String(err),
    })
  }

  return result
}

// ─── 2. AEO snippets → FAQs ──────────────────────────────────────────────────

async function getAeoFaqs(
  db: Db,
  brandId: string,
): Promise<Array<{ question: string; answer: string }>> {
  if (!db) return []
  const dbAny = db as any
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
  const dbAny = db as any
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
  competitors?: string[]
  existingDescription?: string
  scrapedTitle?: string | null
  scrapedDescription?: string | null
  scrapedText?: string | null
}

interface SynthesisOutput {
  description: string
  products: Array<{ name: string; description: string }>
}

function buildSynthesisSystemPrompt(): string {
  return [
    'You are a brand analyst writing the content of an llms.txt file — a curated Markdown brief that helps AI assistants (ChatGPT, Gemini, Perplexity, Claude) understand a company.',
    'You will be given a brand name, its industry, and raw text scraped from its homepage.',
    'Produce a single JSON object. JSON only, no prose, no markdown fences.',
    'Schema: { "description": string, "products": [ { "name": string, "description": string } ] }',
    'Rules:',
    '1. "description" is 1-3 factual sentences describing what the company does and who it serves. No marketing fluff, no superlatives you cannot support from the input.',
    '2. "products" lists 0-6 concrete products/services. Each description is one sentence. If the input does not clearly reveal products, return an empty array — do NOT invent.',
    '3. Never fabricate facts (prices, founding dates, locations) not present in the input.',
    '4. Write in the same language as the scraped homepage text when it is clearly non-English; otherwise English.',
  ].join('\n')
}

function buildSynthesisUserPrompt(input: SynthesisInput): string {
  return [
    `BRAND: ${input.brandName}`,
    `DOMAIN: ${input.domain}`,
    input.industry ? `INDUSTRY: ${input.industry}` : '',
    input.competitors && input.competitors.length > 0
      ? `COMPETITORS: ${input.competitors.join(', ')}`
      : '',
    input.existingDescription ? `EXISTING DESCRIPTION: ${input.existingDescription}` : '',
    input.scrapedTitle ? `HOMEPAGE TITLE: ${input.scrapedTitle}` : '',
    input.scrapedDescription ? `HOMEPAGE META DESCRIPTION: ${input.scrapedDescription}` : '',
    input.scrapedText ? `HOMEPAGE TEXT (truncated):\n${input.scrapedText}` : '',
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
    }
    const description = typeof parsed.description === 'string' ? parsed.description.trim() : ''
    const products = Array.isArray(parsed.products)
      ? parsed.products
          .filter(
            (p): p is { name: string; description: string } =>
              !!p &&
              typeof p === 'object' &&
              typeof (p as any).name === 'string' &&
              typeof (p as any).description === 'string',
          )
          .map((p) => ({ name: p.name.trim(), description: p.description.trim() }))
          .slice(0, 6)
      : []
    if (!description && products.length === 0) {
      return { output: null, provider: llm.provider, note: 'AI returned no usable content' }
    }
    return { output: { description, products }, provider: llm.provider }
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

  // Run independent retrievals in parallel.
  const [scrape, faqs, specialties] = await Promise.all([
    opts.scrapeSite ? scrapeSite(brand.domain) : Promise.resolve(null),
    opts.aeoFaqs ? getAeoFaqs(db, brandId) : Promise.resolve([]),
    opts.keywordSpecialties ? getKeywordSpecialties(db, brandId) : Promise.resolve([]),
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

  if (faqs.length > 0) {
    patch.faqs = faqs
    sources.aeo = { ok: true, faqs: faqs.length }
  } else if (opts.aeoFaqs) {
    sources.aeo.note = 'no AEO snippets for this brand yet'
  }

  if (specialties.length > 0) {
    patch.keyFacts = { ...(patch.keyFacts ?? {}), specialties }
    sources.keywords = { ok: true, specialties: specialties.length }
  } else if (opts.keywordSpecialties) {
    sources.keywords.note = 'no tracked keywords yet'
  }

  // AI synthesis runs last so it can use the scraped raw text.
  if (opts.aiSynthesis) {
    const { output, provider, note } = await synthesize({
      brandName: brand.name,
      domain: brand.domain,
      industry: brand.industry ?? undefined,
      competitors: brand.competitors ?? undefined,
      existingDescription: brand.description ?? undefined,
      scrapedTitle: scrape?.title ?? null,
      scrapedDescription: scrape?.description ?? null,
      scrapedText: scrape?.rawText ?? null,
    })
    if (output) {
      // AI description wins over the meta-tag one (richer, brand-aware).
      if (output.description) patch.description = output.description
      if (output.products.length > 0) patch.products = output.products
      sources.ai = { ok: true, provider, products: output.products.length }
    } else {
      sources.ai = { ok: false, provider, products: 0, note: note ?? 'no content' }
    }
  }

  return { patch, sources }
}
