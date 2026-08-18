// PATH: src/lib/services/aeo-snippets.ts
// AEO Snippet Generator — PAA-driven Q&A pairs with FAQPage JSON-LD and gap
// detection against the brand's own domain.

import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { Json } from '@/types/database'

/* eslint-disable @typescript-eslint/no-explicit-any */
// aeo_* tables are in DB but not in the generated types yet; cast at boundary.
// v2 API strategy split (memory/project_api_strategy.md):
//   - PAA questions  → DataForSEO (narrow scope: real Google PAA box)
//   - Gap detection  → Brave Search (free 2k/mo primary index)
// See dataforseo-paa.ts + brave-search.ts for the underlying providers.
import { fetchPAAQuestions, isDataforseoPaaAvailable, type PAAQuestion } from './dataforseo-paa'
import {
  checkDomainRanksForQuestion,
  fetchPAAQuestions as fetchBravePAAQuestions,
  isBraveSearchAvailable,
} from './brave-search'
import { analyzeResponseForBrand } from './ai-router'
import { calculateProviderCost } from './cost-calculator'

export interface AEOSnippetInput {
  brandId: string
  userId: string
  keyword: string
  language?: 'en' | 'it' | 'sv'
  maxQuestions?: number
  detectGaps?: boolean
}

export interface AEOSnippetItem {
  question: string
  answer: string
  paaSnippet: string | null
  paaSourceUrl: string | null
  gapStatus: 'covered' | 'gap' | 'unknown'
  coveredUrl: string | null
  position: number | null
}

export interface AEOSnippetRunResult {
  runId: string
  items: AEOSnippetItem[]
  schemaJsonLd: Record<string, unknown>
  costCredits: number
  gapCount: number
  errors: string[]
  /**
   * Populated ONLY when Google returned no People-Also-Ask box for the seed
   * (items empty). These are informational-style reformulations the operator
   * can click to retry — Google surfaces PAA for question/topic queries, not
   * for brand names or single words. See suggestSeedVariations.
   */
  suggestions?: string[]
}

/** Normalised host of a URL, or null when the input isn't one. `www.` stripped. */
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`
    return new URL(withScheme).hostname.replace(/^www\./i, '').toLowerCase() || null
  } catch {
    return null
  }
}

/** Same site, or a subdomain of it. */
export function hostsMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)
}

/**
 * A seed that is a URL rather than a question or a topic. Google shows no
 * People-Also-Ask box for a URL, so DataForSEO returns nothing and the run
 * silently falls through to Brave — which answers with the FAQ block of
 * whatever page ranks. That is how a Relovie run came back carrying another
 * organisation's FAQ. Caught before either API is called.
 */
export function isUrlSeed(keyword: string): boolean {
  const k = keyword.trim()
  if (k.length === 0 || /\s/.test(k)) return false
  return /^https?:\/\//i.test(k) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(k)
}

/**
 * Does the question text name the organisation behind `host`? Compares against
 * a truncated label so Swedish/Italian inflections still match:
 * "stadsmissionen.se" → "stadsmission" → matches "Stockholms Stadsmissions".
 * Short labels fall back to a whole-word match, since a 4-letter prefix would
 * fire on ordinary words.
 */
export function questionNamesHost(question: string, host: string): boolean {
  const label = host.split('.')[0] ?? ''
  if (label.length === 0) return false
  const q = question.toLowerCase()
  if (label.length >= 6) return q.includes(label.slice(0, Math.max(6, label.length - 3)))
  return new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(question)
}

export type PaaDropReason = 'foreign-faq-block' | 'foreign-brand-in-question'

/**
 * Drops PAA questions that belong to someone else.
 *
 * NOT a domain whitelist: real People-Also-Ask questions are sourced from third
 * parties by design, and those are exactly the ones worth answering. Two narrow
 * signals instead:
 *
 *   1. foreign-faq-block — every sourced question points at ONE host that isn't
 *      the brand's. That is not a PAA box (Google draws from several domains);
 *      it is one page's FAQ section, scraped whole. The batch is discarded.
 *   2. foreign-brand-in-question — the question text itself names the third
 *      party it came from ("Stöder jag Stockholms Stadsmissions arbete…?").
 *      Unanswerable for this brand, whatever the answer model does with it.
 *
 * With `brandHost` unknown neither signal can be evaluated, so everything is
 * kept and the caller warns instead of silently trusting the batch.
 */
export function filterForeignPaa<T extends { question: string; sourceUrl: string | null }>(
  questions: T[],
  brandHost: string | null,
): { kept: T[]; dropped: Array<{ question: string; reason: PaaDropReason }> } {
  if (!brandHost || questions.length === 0) return { kept: questions, dropped: [] }

  const sourced = questions.filter((q) => hostOf(q.sourceUrl))
  const hosts = new Set(sourced.map((q) => hostOf(q.sourceUrl)!))

  if (sourced.length === questions.length && questions.length > 1 && hosts.size === 1) {
    const only = [...hosts][0]!
    if (!hostsMatch(only, brandHost)) {
      return {
        kept: [],
        dropped: questions.map((q) => ({
          question: q.question,
          reason: 'foreign-faq-block' as const,
        })),
      }
    }
  }

  const kept: T[] = []
  const dropped: Array<{ question: string; reason: PaaDropReason }> = []
  for (const q of questions) {
    const h = hostOf(q.sourceUrl)
    if (h && !hostsMatch(h, brandHost) && questionNamesHost(q.question, h)) {
      dropped.push({ question: q.question, reason: 'foreign-brand-in-question' })
    } else {
      kept.push(q)
    }
  }
  return { kept, dropped }
}

/**
 * Build a few informational-style reformulations of a seed keyword for when
 * Google returns no PAA box. Pure string templating — no API calls, no cost.
 * Strips an existing leading question word so we don't double up
 * ("what is what is X"), then applies per-language question/topic templates.
 * A URL seed is reduced to its host label first, so `https://relovie.com/`
 * suggests "vad är relovie" rather than "vad är https://relovie.com/".
 */
export function suggestSeedVariations(keyword: string, language: 'en' | 'it' | 'sv'): string[] {
  if (isUrlSeed(keyword)) {
    const label = hostOf(keyword)?.split('.')[0] ?? ''
    if (label.length === 0) return []
    keyword = label
  }
  const stripLeading: Record<'en' | 'it' | 'sv', RegExp> = {
    en: /^(what (is|are)|how (do|does|to)|why|best)\s+/i,
    it: /^(cos['’ ]?è|cosa è|come (funziona|scegliere)|perché|migliore)\s+/i,
    sv: /^(vad är|hur (fungerar|väljer man|gör man)|varför|bästa)\s+/i,
  }
  const base = keyword
    .trim()
    .replace(/\?+$/, '')
    .replace(stripLeading[language], '')
    .trim()
    .toLowerCase()
  if (!base) return []

  const templates: Record<'en' | 'it' | 'sv', string[]> = {
    en: [`what is ${base}`, `how does ${base} work`, `${base} benefits`, `best ${base}`],
    it: [`cos'è ${base}`, `come funziona ${base}`, `${base} vantaggi`, `migliore ${base}`],
    sv: [`vad är ${base}`, `hur fungerar ${base}`, `${base} fördelar`, `bästa ${base}`],
  }
  const original = keyword.trim().toLowerCase()
  return Array.from(new Set(templates[language]))
    .filter((v) => v !== original)
    .slice(0, 4)
}

const LANG_INSTRUCTION: Record<'en' | 'it' | 'sv', string> = {
  en: 'Answer in English. Be factual, direct, and suitable for a voice assistant and a Google featured snippet.',
  it: 'Rispondi in italiano. Sii fattuale, diretto, adatto a un assistente vocale e a un featured snippet Google.',
  sv: 'Svara på svenska. Var saklig, direkt och lämplig för en röstassistent och ett Google featured snippet.',
}

export interface AnswerBrandContext {
  name: string
  domain: string | null
  description: string | null
}

/**
 * The answer prompt used to carry the question and nothing else. Two costs:
 * the generated answers never named the client (so they could not earn the
 * client a citation — the entire point of the feature), and a question that
 * arrived carrying a third party's name got a correct answer ABOUT that third
 * party, which the operator could then paste onto the client's own site as
 * FAQPage schema. Grounding the prompt in the brand fixes both, and the
 * "never name another company" rule is the last line of defence for a
 * contaminated question that survived `filterForeignPaa`.
 */
export function buildAnswerPrompt(
  question: string,
  language: 'en' | 'it' | 'sv',
  brand: AnswerBrandContext,
): string {
  return [
    'You are an AEO (Answer Engine Optimization) specialist.',
    `You are writing the FAQ answer that will be published on the website of "${brand.name}".`,
    brand.domain ? `That website is ${brand.domain}.` : null,
    brand.description ? `About the company: ${brand.description}` : null,
    `Question: "${question}"`,
    'Write a single answer of 40-50 words (hard limit 60 words).',
    'The answer must be self-contained, start with the direct answer in the first sentence,',
    'avoid marketing fluff, and be formatted as a single paragraph (no lists, no headers).',
    `Answer from the perspective of ${brand.name} and, where it reads naturally, name it once.`,
    'Never name any other company or organisation.',
    'State no fact you cannot support from the context above — stay general rather than inventing',
    'prices, dates, guarantees, addresses or awards.',
    LANG_INSTRUCTION[language],
    'Return ONLY the answer text, with no prefix, no quotes, no explanation.',
  ]
    .filter((line): line is string => line !== null)
    .join('\n')
}

function trimAnswer(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`\s]+|["'`\s]+$/g, '')
    .replace(/\s+/g, ' ')
}

export function buildFAQPageJsonLd(
  items: Array<{ question: string; answer: string }>,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: { '@type': 'Answer', text: it.answer },
    })),
  }
}

export async function runAEOGeneration(input: AEOSnippetInput): Promise<AEOSnippetRunResult> {
  // aeo_runs, aeo_snippets tables not yet in Database type for this service
  const db = createServerClient() as any
  if (!db) throw new Error('Database not configured')
  if (!isDataforseoPaaAvailable())
    throw new Error('DATAFORSEO_LOGIN / DATAFORSEO_KEY not configured')

  const { data: brand } = await db
    .from('brands')
    .select('id, name, language, domain, domains, description, user_id')
    .eq('id', input.brandId)
    .eq('user_id', input.userId)
    .single()
  if (!brand) throw new Error('Brand not found or access denied')

  // `domains` (array) is the newer column and is empty on most brands; `domain`
  // (string) is the one the brand form actually writes. Reading only the array
  // left brandDomain null, which silently skipped gap detection for the whole
  // run — every snippet came back gap_status 'unknown' and gap_count 0, with
  // the run still reported as completed. Fall back to the populated column.
  const brandDomain =
    (Array.isArray(brand.domains) && brand.domains.length > 0
      ? String(brand.domains[0])
      : brand.domain
        ? String(brand.domain)
        : null) || null
  const brandHost = hostOf(brandDomain)

  const language = (input.language || (brand.language as 'en' | 'it' | 'sv' | null) || 'en') as
    | 'en'
    | 'it'
    | 'sv'
  const maxQuestions = Math.max(1, Math.min(input.maxQuestions ?? 10, 10))
  const detectGaps = input.detectGaps !== false

  // Open the run row
  const { data: runRow, error: runErr } = await db
    .from('aeo_runs')
    .insert({
      brand_id: input.brandId,
      user_id: input.userId,
      keyword: input.keyword,
      language,
      status: 'running',
    })
    .select('id')
    .single()
  if (runErr || !runRow) throw new Error(runErr?.message || 'Failed to create run')
  const runId = runRow.id as string

  const errors: string[] = []
  let costTotal = 0

  /** Close the run without persisting snippets, and hand the operator a way out. */
  const abandonRun = async (message: string): Promise<AEOSnippetRunResult> => {
    await db
      .from('aeo_runs')
      .update({ status: 'completed', questions_count: 0, cost_credits: 0, error: message })
      .eq('id', runId)
    return {
      runId,
      items: [],
      schemaJsonLd: buildFAQPageJsonLd([]),
      costCredits: 0,
      gapCount: 0,
      errors: [message],
      suggestions: suggestSeedVariations(input.keyword, language),
    }
  }

  // 0) A URL is not a seed. Google has no PAA box for one, so the run used to
  // fall through to Brave and come back with a stranger's FAQ. Rejected before
  // either provider is called — no API spend, no credits, no snippets.
  if (isUrlSeed(input.keyword)) {
    return abandonRun(
      'The seed must be a question or a topic, not a URL — search engines return no ' +
        'People-Also-Ask box for an address. Try one of the suggestions below.',
    )
  }

  // 1) Fetch PAA — DataForSEO first (real Google PAA box). If it errors or
  // returns nothing, fall back to Brave's `faq` component (free tier, 8k/mo),
  // which aggregates similar People-Also-Ask signals. This both rescues the
  // "no PAA from Google" case and finally puts the free Brave quota to use.
  let paa: PAAQuestion[] = []
  let paaSource: 'dataforseo' | 'brave' | null = null
  let dfsError: string | null = null
  try {
    paa = await fetchPAAQuestions(input.keyword, language, maxQuestions)
    if (paa.length > 0) paaSource = 'dataforseo'
  } catch (e) {
    // A hard DFS failure (task error, balance, etc.) is NOT fatal anymore —
    // record it and let Brave try. Only throw if Brave also can't help.
    dfsError = e instanceof Error ? e.message : String(e)
    logger.warn('DataForSEO PAA failed, will try Brave fallback', {
      service: 'aeo-snippets',
      keyword: input.keyword,
      error: dfsError,
    })
  }

  if (paa.length === 0 && isBraveSearchAvailable()) {
    try {
      const bravePaa = await fetchBravePAAQuestions(input.keyword, language, maxQuestions)
      if (bravePaa.length > 0) {
        paa = bravePaa
        paaSource = 'brave'
        logger.info('PAA recovered via Brave fallback', {
          service: 'aeo-snippets',
          keyword: input.keyword,
          count: bravePaa.length,
        })
      }
    } catch (e) {
      const braveMsg = e instanceof Error ? e.message : String(e)
      logger.warn('Brave PAA fallback also failed', {
        service: 'aeo-snippets',
        keyword: input.keyword,
        error: braveMsg,
      })
      // If DFS threw AND Brave threw, there's no data path left — fail the run
      // with a combined message so the operator sees both causes.
      if (dfsError) {
        const combined = `PAA unavailable — DataForSEO: ${dfsError}; Brave: ${braveMsg}`
        await db.from('aeo_runs').update({ status: 'failed', error: combined }).eq('id', runId)
        throw new Error(combined)
      }
    }
  } else if (paa.length === 0 && dfsError) {
    // DFS errored and Brave isn't configured — surface the real DFS error
    // rather than a misleading "no questions".
    await db.from('aeo_runs').update({ status: 'failed', error: dfsError }).eq('id', runId)
    throw new Error(dfsError)
  }

  if (paa.length === 0) {
    await db
      .from('aeo_runs')
      .update({ status: 'completed', questions_count: 0, cost_credits: 0 })
      .eq('id', runId)
    const noPaaMsg = isBraveSearchAvailable()
      ? 'No People-Also-Ask questions found for this keyword (tried Google via DataForSEO and Brave).'
      : 'No People-Also-Ask questions returned for this keyword.'
    return {
      runId,
      items: [],
      schemaJsonLd: buildFAQPageJsonLd([]),
      costCredits: 0,
      gapCount: 0,
      errors: [noPaaMsg],
      suggestions: suggestSeedVariations(input.keyword, language),
    }
  }

  // 1b) Discard questions that belong to another organisation before spending a
  // model call on them. See filterForeignPaa for the two signals.
  if (brandHost) {
    const { kept, dropped } = filterForeignPaa(paa, brandHost)
    if (dropped.length > 0) {
      logger.warn('PAA questions dropped as foreign', {
        service: 'aeo-snippets',
        keyword: input.keyword,
        brandHost,
        dropped: dropped.length,
        reasons: [...new Set(dropped.map((d) => d.reason))],
      })
    }
    if (kept.length === 0) {
      const sourceHost = hostOf(paa[0]?.sourceUrl) ?? 'another site'
      return abandonRun(
        `All ${paa.length} questions came from ${sourceHost}, not from ${brandHost}. ` +
          "That is one page's FAQ section rather than a People-Also-Ask box, so nothing was " +
          'saved. Try a question or topic seed instead.',
      )
    }
    if (dropped.length > 0) {
      errors.push(`${dropped.length} question(s) dropped: sourced from another organisation.`)
    }
    paa = kept
  } else {
    errors.push(
      'Brand has no domain set: foreign-source filtering and gap detection were both skipped.',
    )
  }

  // 2) For each PAA: generate answer + optional gap check
  const answerBrand: AnswerBrandContext = {
    name: String(brand.name),
    domain: brandDomain,
    description: brand.description ? String(brand.description) : null,
  }

  const items: AEOSnippetItem[] = []
  let modelUsed: string | null = null

  for (const q of paa) {
    const prompt = buildAnswerPrompt(q.question, language, answerBrand)
    let answer = ''
    let provider = ''
    try {
      const r = await analyzeResponseForBrand(prompt)
      answer = trimAnswer(r.text)
      provider = r.provider
      modelUsed = provider
      const cost = calculateProviderCost(provider, prompt, answer)
      costTotal += cost.totalCost
    } catch (e) {
      errors.push(`${q.question}: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }

    let gapStatus: 'covered' | 'gap' | 'unknown' = 'unknown'
    let coveredUrl: string | null = null
    let position: number | null = null
    if (detectGaps && brandDomain) {
      try {
        const gap = await checkDomainRanksForQuestion(brandDomain, q.question, language)
        gapStatus = gap.covered ? 'covered' : 'gap'
        coveredUrl = gap.coveredUrl
        position = gap.position
      } catch (e) {
        errors.push(`gap(${q.question}): ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    items.push({
      question: q.question,
      answer,
      paaSnippet: q.snippet,
      paaSourceUrl: q.sourceUrl,
      gapStatus,
      coveredUrl,
      position,
    })
  }

  // 3) Build per-item schema (each snippet carries its own FAQPage fragment)
  const schemaJsonLd = buildFAQPageJsonLd(
    items.map((it) => ({ question: it.question, answer: it.answer })),
  )

  // 4) Persist snippets
  if (items.length > 0) {
    const rows = items.map((it) => ({
      run_id: runId,
      brand_id: input.brandId,
      keyword: input.keyword,
      question: it.question,
      answer: it.answer,
      answer_model: modelUsed,
      language,
      paa_snippet: it.paaSnippet,
      paa_source_url: it.paaSourceUrl,
      schema_jsonld: buildFAQPageJsonLd([
        { question: it.question, answer: it.answer },
      ]) as unknown as Json,
      gap_status: it.gapStatus,
      covered_url: it.coveredUrl,
      position: it.position,
    }))
    const { error: insErr } = await db
      .from('aeo_snippets')
      .upsert(rows, { onConflict: 'brand_id,keyword,question' })
    if (insErr) errors.push(`persist: ${insErr.message}`)
  }

  const gapCount = items.filter((it) => it.gapStatus === 'gap').length
  const costCredits = Math.ceil(costTotal * 1000) // 1 credit = $0.001

  // Which provider actually answered was known only to the log, so a run's
  // questions could not be traced back to Google's PAA box or to Brave's `faq`
  // component after the fact — the difference that mattered when a batch turned
  // out to be someone else's FAQ. Retried without the column so the code works
  // whether or not the migration has been applied yet.
  const runUpdate = {
    status: 'completed',
    questions_count: items.length,
    gap_count: gapCount,
    cost_credits: costCredits,
    model: modelUsed,
    error: errors.length > 0 ? errors.slice(0, 5).join(' | ') : null,
  }
  const { error: runUpdateErr } = await db
    .from('aeo_runs')
    .update({ ...runUpdate, paa_source: paaSource })
    .eq('id', runId)
  if (runUpdateErr) {
    await db.from('aeo_runs').update(runUpdate).eq('id', runId)
  }

  logger.info('AEO snippet run completed', {
    service: 'aeo-snippets',
    runId,
    brandId: input.brandId,
    questions: items.length,
    gaps: gapCount,
    errors: errors.length,
    paaSource,
  })

  return { runId, items, schemaJsonLd, costCredits, gapCount, errors }
}
