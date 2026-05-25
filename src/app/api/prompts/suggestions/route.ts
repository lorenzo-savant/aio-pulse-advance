// PATH: src/app/api/prompts/suggestions/route.ts
//
// POST /api/prompts/suggestions  { brandId }
// → AI-engine-suggested prompts for a brand. Runs one Perplexity query (which
//   returns `related_questions` — the queries real users ask next about the
//   topic) and converts them into deduped prompt suggestions. No new API key:
//   reuses the existing Perplexity integration via the router.

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, getCurrentUserId, AuthError } from '@/lib/supabase'
import { simulateEngineResponse } from '@/lib/services/ai-router'
import { isPerplexityAvailable } from '@/lib/services/perplexity'
import { relatedQuestionsToPromptSuggestions } from '@/lib/services/prompt-suggestions'
import { logger } from '@/lib/logger'
import type { Brand, BrandLanguage } from '@/types'

export const dynamic = 'force-dynamic'

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function POST(req: NextRequest) {
  let userId: string
  try {
    userId = await getCurrentUserId(req.headers.get('authorization'), req.headers.get('cookie'))
  } catch (e) {
    if (e instanceof AuthError) return err(e.message, 401)
    return err('Authentication failed', 401)
  }

  let body: { brandId?: string }
  try {
    body = (await req.json()) as { brandId?: string }
  } catch {
    return err('Invalid JSON body', 400)
  }
  const brandId = body.brandId
  if (!brandId) return err('brandId is required', 400)

  if (!isPerplexityAvailable()) {
    // No PERPLEXITY_API_KEY → related_questions are unavailable. Return an empty
    // set with a clear reason rather than silently degrading to another engine.
    return NextResponse.json({
      success: true,
      suggestions: [],
      reason: 'Perplexity is not configured — related-question suggestions are unavailable.',
      timestamp: Date.now(),
    })
  }

  const db = createServerClient()
  if (!db) return err('Database not configured', 503)

  // Load the brand (ownership-checked) + its existing prompts for dedupe.
  const [{ data: brand }, { data: existing }] = await Promise.all([
    db.from('brands').select('*').eq('id', brandId).eq('user_id', userId).single(),
    db.from('prompts').select('text').eq('brand_id', brandId).eq('user_id', userId).limit(500),
  ])
  if (!brand) return err('Brand not found or access denied', 404)

  const b = brand as Brand
  const existingTexts = ((existing ?? []) as Array<{ text: string }>).map((r) => r.text)

  // ─── Build brand-anchored seed + relevance filter ─────────────────────────
  // Perplexity's `related_questions` reflect the SEED query, not the brand
  // context we attach downstream. Using `existingTexts[0]` blindly (the old
  // behavior) leaks topics from off-target prompts: e.g. a casting brand
  // with a stray "best marketing agency Stockholm" prompt would receive
  // marketing-agency follow-ups. To prevent this we (1) prefer an existing
  // prompt that mentions the brand name/alias and (2) fall back to a brand-
  // descriptor seed.
  const brandTerms = [b.name, ...(b.aliases ?? [])]
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .map((s) => s.trim())

  const brandTermsLc = brandTerms.map((s) => s.toLowerCase())
  const onTopicExisting = existingTexts.find((t) => {
    const lc = t.toLowerCase()
    return brandTermsLc.some((term) => term.length >= 3 && lc.includes(term))
  })

  const seed =
    onTopicExisting ||
    [b.name, b.industry, b.market].filter((p) => p && String(p).trim().length > 0).join(' — ') ||
    b.name

  // Relevance anchors: brand name + aliases + meaningful words from
  // industry/description (≥4 chars, no stop-words). These are the terms a
  // related question SHOULD mention to count as on-topic for this brand.
  const STOP_WORDS = new Set([
    'and',
    'the',
    'for',
    'with',
    'from',
    'this',
    'that',
    'over',
    'platform',
    'service',
    'company',
    'brand',
  ])
  function extractKeywords(text: string | null | undefined): string[] {
    if (!text) return []
    return text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
  }
  const relevanceAnchors = Array.from(
    new Set<string>([
      ...brandTerms,
      ...extractKeywords(b.industry),
      ...extractKeywords(b.description),
    ]),
  )

  let suggestions: ReturnType<typeof relatedQuestionsToPromptSuggestions> = []
  try {
    const sim = await simulateEngineResponse(
      seed,
      'perplexity',
      (b.language as BrandLanguage) || 'en',
      b,
    )
    suggestions = relatedQuestionsToPromptSuggestions(sim.relatedQuestions ?? [], existingTexts, {
      source: 'perplexity',
      max: 8,
      relevanceAnchors,
    })
  } catch (e) {
    logger.warn('/api/prompts/suggestions failed', { err: String(e) })
    return err('Failed to fetch suggestions')
  }

  return NextResponse.json({
    success: true,
    suggestions,
    reason:
      suggestions.length === 0 ? 'No new related questions surfaced for this brand yet.' : null,
    timestamp: Date.now(),
  })
}
