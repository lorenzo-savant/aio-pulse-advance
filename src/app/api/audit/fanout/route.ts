// PATH: src/app/api/audit/fanout/route.ts
//
// POST /api/audit/fanout
// Body: { url: string, topic?: string, maxQuestions?: number }
//
// Generates 6–8 sub-questions for the topic via Perplexity's
// related_questions (already wired in ai-router) and scores how many of
// them the page's H2/H3 sections cover. Returns the coverage report.
//
// Why Perplexity: free related_questions endpoint, already integrated.
// No new API key needed.

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/api-auth'
import { firstZodMessage } from '@/lib/validations'
import { isPerplexityAvailable } from '@/lib/services/perplexity'
import { simulateEngineResponse } from '@/lib/services/ai-router'
import { safeFetch } from '@/lib/utils/safe-fetch'
import { scoreFanoutCoverage, exportFanoutAsFAQ } from '@/lib/utils/query-fanout'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const fanoutBodySchema = z.object({
  url: z.string().max(2048),
  topic: z.string().max(500).optional(),
  maxQuestions: z.coerce.number().optional(),
})

function err(message: string, status = 500) {
  return NextResponse.json({ success: false, message }, { status })
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return err('Invalid JSON body', 400)
  }
  const parsed = fanoutBodySchema.safeParse(rawBody)
  if (!parsed.success) return err(firstZodMessage(parsed.error), 400)
  const body = parsed.data
  const url = (body.url || '').trim()
  if (!url) return err('url is required', 400)
  const maxQuestions = Math.min(10, Math.max(3, Number(body.maxQuestions) || 8))

  if (!isPerplexityAvailable()) {
    return NextResponse.json({
      success: true,
      data: {
        url,
        report: null,
        reason: 'Perplexity is not configured — sub-question generation is unavailable.',
      },
      timestamp: Date.now(),
    })
  }

  // 1) Fetch the page HTML.
  let html = ''
  try {
    const res = await safeFetch(url, {
      timeout: 10_000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; aio-pulse-fanout/1.0; +https://aio-pulse.com/bot)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return err(`Could not fetch ${url} (HTTP ${res.status})`, 502)
    html = await res.text().catch(() => '')
  } catch (e) {
    logger.warn('/api/audit/fanout fetch failed', { url, err: String(e) })
    return err(`Could not fetch ${url}`, 502)
  }
  if (html.length < 200) return err('Fetched page is empty or too small to analyse', 422)

  // 2) Derive a topic seed. If the caller passes one, use it; otherwise
  // pick the page's <title> or first H1.
  const topic =
    body.topic?.trim() ||
    html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() ||
    html
      .match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?.replace(/<[^>]+>/g, '')
      .trim() ||
    null
  if (!topic) return err('Could not infer a topic — pass one explicitly', 422)

  // 3) Ask Perplexity for related_questions on the topic. We deliberately
  // ask a broad seed query to maximise the fan-out — the related_questions
  // are what we score against.
  let subQuestions: string[] = []
  try {
    const sim = await simulateEngineResponse(
      `Comprehensive sub-questions a curious reader would ask about: "${topic}". List 8 distinct angles.`,
      'perplexity',
      'en',
      null,
    )
    subQuestions = (sim.relatedQuestions ?? []).slice(0, maxQuestions)
  } catch (e) {
    logger.warn('/api/audit/fanout perplexity failed', { topic, err: String(e) })
    return err('Perplexity sub-question generation failed')
  }
  if (subQuestions.length === 0) {
    return NextResponse.json({
      success: true,
      data: {
        url,
        topic,
        report: null,
        reason: 'Perplexity returned 0 related questions for this topic — try a broader phrasing.',
      },
      timestamp: Date.now(),
    })
  }

  // 4) Score coverage against the page's H2/H3 sections.
  const report = scoreFanoutCoverage(html, subQuestions)

  // 5) Turn the missed sub-questions into a ready-to-paste FAQ block
  //    (markdown + FAQPage JSON-LD). The query fan-out experiment
  //    more-than-doubled AI citations by editing articles to address
  //    the gaps — this is the actionable artifact for that workflow.
  const faqExport = exportFanoutAsFAQ(report)

  return NextResponse.json({
    success: true,
    data: { url, topic, report, faqExport },
    timestamp: Date.now(),
  })
}
