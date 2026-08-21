/**
 * Grounded answers about a brand's own numbers.
 *
 * Deliberately not a chat endpoint. The product's claim is that it measures how
 * accurately AI engines describe a brand, so an advisor that invents an
 * explanation would undermine the claim it exists to support. Two rules keep
 * that from happening:
 *
 *  1. evidence is gathered from rows *before* any model is involved, and when
 *     the rows are not there the caller gets a refusal and the model is never
 *     called at all;
 *  2. the model only ever phrases facts it was handed, and the response carries
 *     the tables those facts came from — the same provenance discipline the
 *     Brand Report already applies to every section.
 *
 * It answers the two questions the dashboard genuinely cannot: why a pillar
 * scores what it does, and what moved since the last snapshot.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  collectAttributionEvidence,
  collectDeltaEvidence,
  collectDeliveredRecommendations,
  isPillar,
  type Evidence,
} from '@/lib/agents/grounding'
import { callLLM } from '@/lib/services/prompt-generator-ai'
import { getCostTracker, BudgetManager, estimateBlendedCost } from '@/lib/cost-monitor'
import { requireUser, rateLimitGate } from '@/lib/api-auth'
import { requireBrandRole } from '@/lib/authorize'
import { logger } from '@/lib/logger'
import { groundedAnswerSchema, firstZodMessage } from '@/lib/validations'

export const dynamic = 'force-dynamic'

/** Default window when the caller does not pick one. */
const DEFAULT_DAYS = 30

/** Output tokens assumed when sizing an answer before it exists. Errs high. */
const ESTIMATED_ANSWER_TOKENS = 800

/**
 * The model is a writer, not an analyst. Everything it may state is in the
 * evidence block; anything absent from it is off limits, including numbers that
 * look like safe arithmetic on the ones provided.
 */
const SYSTEM_PROMPT = [
  'You explain a brand visibility metric to the person who owns it.',
  '',
  'Rules, in order of importance:',
  '1. Use ONLY the facts listed under EVIDENCE. Never introduce a number, date,',
  '   engine, competitor or page that does not appear there.',
  '2. Never compute a new figure from the ones given. If a total or percentage',
  '   is not in the evidence, it is not available.',
  '3. Use the DEFINITIONS to explain what a metric means. They describe how this',
  '   product actually computes it; do not substitute a general definition.',
  '4. If the evidence does not answer the question, say plainly that the data',
  '   does not show it. That is a correct answer, not a failure.',
  '5. Do not recommend anything listed under ALREADY ADVISED — the client has',
  '   already been told.',
  '',
  'Write 3-5 sentences of plain prose. No headings, no bullet points, no',
  'preamble. Lead with the answer.',
].join('\n')

function renderEvidence(evidence: Evidence, alreadyAdvised: string[], question: string): string {
  const blocks = [
    'EVIDENCE',
    ...evidence.facts.map((f) => `- ${f}`),
    '',
    'DEFINITIONS',
    ...evidence.definitions.map((d) => `- ${d}`),
  ]

  if (alreadyAdvised.length) {
    blocks.push('', 'ALREADY ADVISED', ...alreadyAdvised.map((t) => `- ${t}`))
  }

  blocks.push('', `QUESTION: ${question}`)
  return blocks.join('\n')
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const { userId } = auth

  const limited = await rateLimitGate(req, `answers:${userId}`, 30)
  if (limited) return limited

  try {
    const parsed = groundedAnswerSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstZodMessage(parsed.error, 'Invalid request') },
        { status: 400 },
      )
    }
    const { brandId, kind, pillar, locale = 'en' } = parsed.data
    const days = parsed.data.days ?? DEFAULT_DAYS

    // An answer costs an LLM call against the brand owner's budget, so it takes
    // the same editor right the agent chat takes rather than mere read access.
    const gate = await requireBrandRole(brandId, userId, 'editor')
    if ('response' in gate) return gate.response

    const verdict = await new BudgetManager().wouldExceedBudget(
      userId,
      brandId,
      estimateBlendedCost('default', ESTIMATED_ANSWER_TOKENS * 2),
    )
    if (!verdict.allowed) {
      return NextResponse.json(
        { error: 'AI budget exhausted', reason: verdict.reason, limitUsd: verdict.limitUsd },
        { status: 402 },
      )
    }

    // Gather evidence first. A refusal here costs nothing and reaches the caller
    // without a model ever seeing the question.
    const grounded =
      kind === 'attribution' && pillar && isPillar(pillar)
        ? await collectAttributionEvidence(brandId, pillar, days, locale)
        : await collectDeltaEvidence(brandId, days, locale)

    if (!grounded.grounded) {
      // 200, not an error: "the data does not show this" is a real answer, and
      // the caller renders it from the reason code in the user's language.
      return NextResponse.json({ grounded: false, reason: grounded.reason })
    }

    const advised = await collectDeliveredRecommendations(brandId, days)
    const question =
      kind === 'attribution'
        ? `Why is the ${pillar} pillar at its current level?`
        : `What changed in the GEO score, and what moved it?`

    const userPrompt = renderEvidence(grounded.evidence, advised.titles, question)
    const result = await callLLM(SYSTEM_PROMPT, userPrompt)

    // callLLM reports no token counts, so approximate from the text on both
    // sides rather than leaving the call unaccounted for in the cost dashboards.
    const inputTokens = Math.ceil((SYSTEM_PROMPT.length + userPrompt.length) / 4)
    const outputTokens = Math.ceil(result.text.length / 4)
    await getCostTracker().logCost({
      userId,
      brandId,
      provider: result.provider,
      model: result.model,
      agentType: `grounded_answer:${kind}`,
      inputTokens,
      outputTokens,
      costUsd: estimateBlendedCost(result.model, inputTokens + outputTokens),
      costCredits: 0,
      success: true,
    })

    return NextResponse.json({
      grounded: true,
      answer: result.text,
      // Every claim above is traceable to these rows. Shown in the UI so an
      // answer can be checked rather than trusted.
      provenance: [...grounded.evidence.provenance, advised.provenance].filter(
        (p) => p.rowCount > 0,
      ),
      facts: grounded.evidence.facts,
    })
  } catch (error) {
    logger.error('Grounded answer API error', { err: error })
    return NextResponse.json({ error: 'Could not build an answer' }, { status: 500 })
  }
}
