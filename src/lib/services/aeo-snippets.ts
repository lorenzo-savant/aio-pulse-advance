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

/**
 * Build a few informational-style reformulations of a seed keyword for when
 * Google returns no PAA box. Pure string templating — no API calls, no cost.
 * Strips an existing leading question word so we don't double up
 * ("what is what is X"), then applies per-language question/topic templates.
 */
export function suggestSeedVariations(keyword: string, language: 'en' | 'it' | 'sv'): string[] {
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

function buildAnswerPrompt(question: string, language: 'en' | 'it' | 'sv'): string {
  return [
    'You are an AEO (Answer Engine Optimization) specialist.',
    `Question: "${question}"`,
    'Write a single answer of 40-50 words (hard limit 60 words).',
    'The answer must be self-contained, start with the direct answer in the first sentence,',
    'avoid marketing fluff, and be formatted as a single paragraph (no lists, no headers).',
    LANG_INSTRUCTION[language],
    'Return ONLY the answer text, with no prefix, no quotes, no explanation.',
  ].join('\n')
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
    .select('id, name, language, domains, user_id')
    .eq('id', input.brandId)
    .eq('user_id', input.userId)
    .single()
  if (!brand) throw new Error('Brand not found or access denied')

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

  // 2) For each PAA: generate answer + optional gap check
  const brandDomain =
    Array.isArray(brand.domains) && brand.domains.length > 0 ? String(brand.domains[0]) : null

  const items: AEOSnippetItem[] = []
  let modelUsed: string | null = null

  for (const q of paa) {
    const prompt = buildAnswerPrompt(q.question, language)
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

  await db
    .from('aeo_runs')
    .update({
      status: 'completed',
      questions_count: items.length,
      gap_count: gapCount,
      cost_credits: costCredits,
      model: modelUsed,
      error: errors.length > 0 ? errors.slice(0, 5).join(' | ') : null,
    })
    .eq('id', runId)

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
