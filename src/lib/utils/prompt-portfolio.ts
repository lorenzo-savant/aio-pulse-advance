// PATH: src/lib/utils/prompt-portfolio.ts
//
// Classifies a tracked prompt into the 4-bucket business-impact taxonomy
// from the industry research "Prompt Tracking" piece:
//
//   - revenue:    user-intent prompts about your brand or category
//                 where AI's answer can directly drive a purchase
//                 ("best X for problem", "your brand vs competitor",
//                 "is your brand worth it").
//   - reputation: prompts that probe the AI narrative about your brand
//                 ("reviews", "what do people think", "controversy").
//   - competitor: prompts where AI compares your brand to a competitor
//                 ("competitor vs your brand", "alternatives to
//                 competitor", "switch from competitor").
//   - gap:        prompts that mention a competitor but NOT your brand —
//                 the AI conversation that's happening without you.
//   - other:      doesn't fit any of the above.
//
// "Tracking 25 well-chosen prompts beats tracking 500 random ones" —
// this classifier gives the operator a way to prioritise their portfolio
// by business impact (track revenue daily, reputation weekly, gaps
// monthly) instead of vanity coverage.
//
// Pure, no network, no LLM. Multilingual (EN/IT/SV) so the Swedish
// test brands work out of the box.

export type PortfolioType = 'revenue' | 'reputation' | 'competitor' | 'gap' | 'other'

export interface PortfolioInput {
  /** The prompt text the AI engine receives. */
  prompt: string
  /** Brand name as displayed. Required — empty disables brand detection. */
  brandName: string
  /** Brand aliases / domain stems / product names. */
  brandAliases?: string[]
  /** Competitor names — used for both competitor and gap detection. */
  competitorNames?: string[]
}

export interface PortfolioClassification {
  type: PortfolioType
  /** Human-readable reasons the classifier picked this bucket — surfaced
   *  in the UI so the operator can sanity-check. */
  reasons: string[]
}

// Diacritic-folded lowercase keyword sets per type, EN+IT+SV.
const REVENUE_KEYWORDS = [
  // buying-intent
  'best ',
  'top ',
  'recommended',
  'worth it',
  'worth the',
  'worth buying',
  'pricing',
  'price ',
  'buy ',
  'demo',
  'try ',
  'sign up',
  'subscribe',
  'features',
  'integrations',
  ' vs ',
  ' vs.',
  // it
  'migliori',
  'consigliato',
  'vale la pena',
  'prezzo',
  'acquista',
  'prova',
  'iscriviti',
  'funzionalita',
  // sv
  'bästa',
  'rekommenderad',
  'värt det',
  'pris',
  'köp ',
  'prova ',
  'registrera',
]

const REPUTATION_KEYWORDS = [
  'reviews',
  'review of',
  'what do people think',
  'what are people saying',
  'overpriced',
  'controversy',
  'complaints',
  'scam',
  'trustworthy',
  'safe to use',
  'legitimate',
  'good or bad',
  // it
  'recensioni',
  'cosa pensano',
  'truffa',
  'affidabile',
  // sv
  'recensioner',
  'vad tycker',
  'pålitlig',
  'bedrägeri',
]

function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

function hasTerm(haystack: string, needle: string): boolean {
  const n = fold(needle)
  return n.length > 0 && haystack.includes(n)
}

function mentionsAny(haystack: string, candidates: string[]): string | null {
  for (const c of candidates) {
    if (typeof c !== 'string') continue
    const n = fold(c)
    // ≥3 chars guard — "ai" / "se" can match accidentally inside other words.
    if (n.length < 3) continue
    if (hasTerm(haystack, n)) return c
  }
  return null
}

/**
 * Classify a single prompt into one of the 5 portfolio buckets.
 */
export function classifyPromptPortfolio(input: PortfolioInput): PortfolioClassification {
  const haystack = fold(input.prompt || '')
  if (haystack.length === 0) return { type: 'other', reasons: ['empty prompt'] }

  const brandHit = mentionsAny(haystack, [input.brandName, ...(input.brandAliases ?? [])])
  const competitorHit = mentionsAny(haystack, input.competitorNames ?? [])

  const reasons: string[] = []
  if (brandHit) reasons.push(`mentions brand "${brandHit}"`)
  if (competitorHit) reasons.push(`mentions competitor "${competitorHit}"`)

  // Competitor: BOTH brand AND a competitor present.
  if (brandHit && competitorHit) {
    reasons.push('compares brand vs competitor')
    return { type: 'competitor', reasons }
  }

  // Gap: competitor present but brand absent.
  if (competitorHit && !brandHit) {
    reasons.push('competitor mentioned without brand — AI conversation you’re absent from')
    return { type: 'gap', reasons }
  }

  // Reputation: brand present + reputation keyword.
  if (brandHit) {
    for (const kw of REPUTATION_KEYWORDS) {
      if (hasTerm(haystack, kw)) {
        reasons.push(`reputation keyword "${kw.trim()}"`)
        return { type: 'reputation', reasons }
      }
    }
    // Revenue: brand present + buying-intent keyword.
    for (const kw of REVENUE_KEYWORDS) {
      if (hasTerm(haystack, kw)) {
        reasons.push(`buying-intent keyword "${kw.trim()}"`)
        return { type: 'revenue', reasons }
      }
    }
    // Generic brand mention with no specific intent — still revenue-leaning.
    return { type: 'revenue', reasons: [...reasons, 'brand-named prompt (default revenue)'] }
  }

  // Brand absent + no competitor — check for category/buying-intent keywords
  // to label category-level revenue prompts (e.g. "best CRM for SaaS").
  for (const kw of REVENUE_KEYWORDS) {
    if (hasTerm(haystack, kw)) {
      reasons.push(`category buying-intent keyword "${kw.trim()}"`)
      return { type: 'revenue', reasons }
    }
  }

  return { type: 'other', reasons: ['no brand/competitor/intent keyword detected'] }
}

export interface PortfolioRowInput {
  promptId: string
  prompt: string
  /** Optional brand-visibility signal for this prompt (e.g. % of
   *  monitoring responses where brand was mentioned in this prompt).
   *  Used to weight aggregate visibility per portfolio type. */
  brandVisibility?: number | null
}

export interface PortfolioBucketSummary {
  type: PortfolioType
  count: number
  /** Average brand visibility across prompts in this bucket. null when
   *  no prompt in the bucket has a brandVisibility signal. */
  averageBrandVisibility: number | null
}

/** Branded-vs-category mix verdict — competitor SaaS-AI pitfall #1: testing
 *  only branded prompts ("what is X?") gives an inflated SoV read because
 *  the brand is already in the question. A healthy portfolio leans on
 *  category-level prompts that reflect how unaware buyers actually search. */
export type BrandedMixVerdict = 'over_indexed' | 'balanced' | 'category_led'

export interface BrandedMix {
  /** Number of prompts whose text mentions the brand. */
  brandedCount: number
  /** Number of prompts whose text does NOT mention the brand. */
  categoryCount: number
  /** Branded prompts as % of the (branded + category) total. 0 when total=0. */
  brandedRatio: number
  verdict: BrandedMixVerdict
  /** Human-readable explanation for the panel tooltip. */
  message: string
}

export interface PortfolioReport {
  /** Per-prompt classification, in input order. */
  rows: Array<{
    promptId: string
    prompt: string
    type: PortfolioType
    reasons: string[]
  }>
  /** Aggregate counts + visibility per bucket (always all 5 types). */
  buckets: PortfolioBucketSummary[]
  /** Branded-vs-category prompt mix across the whole portfolio. */
  brandedMix: BrandedMix
}

function computeBrandedMix(
  prompts: PortfolioRowInput[],
  ctx: Omit<PortfolioInput, 'prompt'>,
): BrandedMix {
  const brandAliases = [ctx.brandName, ...(ctx.brandAliases ?? [])]
  let brandedCount = 0
  let categoryCount = 0
  for (const p of prompts) {
    const haystack = fold(p.prompt || '')
    if (haystack.length === 0) continue
    if (mentionsAny(haystack, brandAliases)) brandedCount++
    else categoryCount++
  }
  const total = brandedCount + categoryCount
  const brandedRatio = total === 0 ? 0 : Math.round((brandedCount / total) * 1000) / 10
  let verdict: BrandedMixVerdict
  let message: string
  if (total < 3) {
    verdict = 'balanced'
    message = 'Not enough prompts to judge branded vs category mix (need ≥3).'
  } else if (brandedRatio >= 70) {
    verdict = 'over_indexed'
    message = `${brandedRatio}% of prompts name your brand — AI will mention you because you’re in the question. Add category prompts to see real visibility.`
  } else if (brandedRatio <= 40) {
    verdict = 'category_led'
    message = `${brandedRatio}% branded — portfolio leans on category prompts that reflect how unaware buyers search.`
  } else {
    verdict = 'balanced'
    message = `${brandedRatio}% branded — healthy mix of branded checks and category-level discovery.`
  }
  return { brandedCount, categoryCount, brandedRatio, verdict, message }
}

/**
 * Classify a list of prompts and produce both the per-row classification
 * + per-bucket aggregate (count + average brand visibility) + the
 * branded-vs-category mix verdict.
 */
export function classifyPromptList(
  prompts: PortfolioRowInput[],
  ctx: Omit<PortfolioInput, 'prompt'>,
): PortfolioReport {
  const rows = prompts.map((p) => {
    const classification = classifyPromptPortfolio({ prompt: p.prompt, ...ctx })
    return {
      promptId: p.promptId,
      prompt: p.prompt,
      type: classification.type,
      reasons: classification.reasons,
    }
  })

  const types: PortfolioType[] = ['revenue', 'reputation', 'competitor', 'gap', 'other']
  const buckets: PortfolioBucketSummary[] = types.map((t) => {
    const matching = rows.filter((r) => r.type === t)
    const visibilities = matching
      .map((r) => prompts.find((p) => p.promptId === r.promptId)?.brandVisibility)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    const avg =
      visibilities.length > 0
        ? Math.round((visibilities.reduce((s, v) => s + v, 0) / visibilities.length) * 10) / 10
        : null
    return { type: t, count: matching.length, averageBrandVisibility: avg }
  })

  const brandedMix = computeBrandedMix(prompts, ctx)

  return { rows, buckets, brandedMix }
}
