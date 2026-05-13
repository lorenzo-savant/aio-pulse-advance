// PATH: src/lib/services/aeo-snippets.ts
// AEO Snippet Generator — PAA-driven Q&A pairs with FAQPage JSON-LD and gap
// detection against the brand's own domain.

import { createServerClient } from '@/lib/supabase'
import { logger } from '@/lib/logger'
import type { Json } from '@/types/database'

/* eslint-disable @typescript-eslint/no-explicit-any */
// aeo_* tables are in DB but not in the generated types yet; cast at boundary.
import {
  fetchPAAQuestions,
  checkDomainRanksForQuestion,
  isSerpApiAvailable,
  type PAAQuestion,
} from './serpapi'
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
  return raw.trim().replace(/^["'`\s]+|["'`\s]+$/g, '').replace(/\s+/g, ' ')
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

export async function runAEOGeneration(
  input: AEOSnippetInput,
): Promise<AEOSnippetRunResult> {
  // aeo_runs, aeo_snippets tables not yet in Database type for this service
  const db = createServerClient() as any
  if (!db) throw new Error('Database not configured')
  if (!isSerpApiAvailable()) throw new Error('SERPAPI_KEYS not configured')

  const { data: brand } = await db
    .from('brands')
    .select('id, name, language, domains, user_id')
    .eq('id', input.brandId)
    .eq('user_id', input.userId)
    .single()
  if (!brand) throw new Error('Brand not found or access denied')

  const language = (input.language
    || (brand.language as 'en' | 'it' | 'sv' | null)
    || 'en') as 'en' | 'it' | 'sv'
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

  // 1) Fetch PAA
  let paa: PAAQuestion[] = []
  try {
    paa = await fetchPAAQuestions(input.keyword, language, maxQuestions)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await db.from('aeo_runs').update({ status: 'failed', error: msg }).eq('id', runId)
    throw e
  }

  if (paa.length === 0) {
    await db
      .from('aeo_runs')
      .update({ status: 'completed', questions_count: 0, cost_credits: 0 })
      .eq('id', runId)
    return {
      runId,
      items: [],
      schemaJsonLd: buildFAQPageJsonLd([]),
      costCredits: 0,
      gapCount: 0,
      errors: ['No PAA questions returned for this keyword'],
    }
  }

  // 2) For each PAA: generate answer + optional gap check
  const brandDomain = Array.isArray(brand.domains) && brand.domains.length > 0
    ? String(brand.domains[0])
    : null

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
      schema_jsonld: buildFAQPageJsonLd([{ question: it.question, answer: it.answer }]) as unknown as Json,
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
  })

  return { runId, items, schemaJsonLd, costCredits, gapCount, errors }
}
