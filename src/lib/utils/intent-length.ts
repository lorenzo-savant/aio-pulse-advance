// PATH: src/lib/utils/intent-length.ts
//
// "Does the depth of this page match what AI expects for the query
// intent?"
//
// Closes the gap from the Semrush AI Mode study (Nov 2025):
//   "Across all platforms, commercial and transactional queries
//    triggered the longest and most detailed responses — often double
//    the length of informational responses. For SEOs, this means
//    aligning content depth with query intent is essential:
//      Informational? Go for clarity and conciseness.
//      Commercial/Transactional? Expand, compare, explain."
//
// We classify the page's intent from its title/H1 keywords, then check
// whether the visible word count falls in the expected band for that
// intent. Pages way short of the band lose because AI summarises them
// in one paragraph; pages way over the band lose because they bury the
// answer.
//
// Pure, no network. Same posture as the other audit utilities.

export type Intent = 'informational' | 'commercial' | 'transactional' | 'navigational'

export interface IntentBand {
  intent: Intent
  /** Lower bound — pages under this are flagged as "too short". */
  min: number
  /** Target — the centre of the expected band. */
  target: number
  /** Upper bound — pages above this are flagged as "too long". */
  max: number
}

// Calibrated against the Semrush AI Mode study averages:
//   - AI Overviews ~150-220 words for informational
//   - AI Mode ~300 words baseline, commercial ~600
//   - Transactional pages tend to be product-page-like + comparison
//   - Navigational pages can be very short (landing/category indexes)
export const INTENT_BANDS: Record<Intent, IntentBand> = {
  informational: { intent: 'informational', min: 400, target: 900, max: 2000 },
  commercial: { intent: 'commercial', min: 800, target: 1500, max: 3500 },
  transactional: { intent: 'transactional', min: 500, target: 900, max: 2500 },
  navigational: { intent: 'navigational', min: 100, target: 300, max: 1000 },
}

// Keyword sets for intent classification — short, recall-first, EN+IT+SV
// so the Swedish test brands work without an LLM call.
const INTENT_KEYWORDS: Record<Intent, string[]> = {
  informational: [
    'what is',
    'what are',
    'how to',
    'how do',
    'why',
    'guide',
    'tutorial',
    'introduction',
    'explained',
    'meaning',
    'definition',
    // it
    "cos'è",
    'che cosa',
    'come ',
    'guida',
    'introduzione',
    // sv
    'vad är',
    'hur ',
    'guide ',
    'introduktion',
  ],
  commercial: [
    'best ',
    'top ',
    'vs',
    'vs.',
    'comparison',
    'compare',
    'review',
    'reviews',
    'alternatives',
    'pros and cons',
    'pricing',
    'price',
    // it
    'migliori',
    'recensioni',
    'confronto',
    'prezzo',
    'alternative',
    // sv
    'bästa',
    'jämförelse',
    'recensioner',
    'pris',
    'alternativ',
  ],
  transactional: [
    'buy ',
    'order ',
    'shop ',
    'purchase',
    'discount',
    'coupon',
    'deal',
    'cart',
    'checkout',
    'pricing plans',
    // it
    'acquista',
    'comprare',
    'sconto',
    'offerta',
    // sv
    'köp ',
    'beställ',
    'rea ',
    'erbjudande',
  ],
  navigational: [
    'login',
    'sign in',
    'log in',
    'contact',
    'about us',
    'careers',
    'help center',
    'support center',
    'dashboard',
    'account',
    // it
    'accedi',
    'contatti',
    'chi siamo',
    // sv
    'logga in',
    'kontakt',
    'om oss',
  ],
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

/**
 * Classify the page intent from <title> + first <h1>. Falls back to
 * 'informational' when no strong signal is found (the most common
 * default — better than guessing transactional and over-expanding
 * an explainer page).
 */
export function classifyPageIntent(html: string): Intent {
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? ''
  const h1 = stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')
  const haystack = fold(`${title} ${h1}`)
  if (haystack.length === 0) return 'informational'

  // Score each intent by how many of its keywords match. Highest score wins;
  // ties are broken by the documented priority order
  // (transactional > commercial > navigational > informational) so a page
  // that mentions both "best" AND "buy" lands as transactional.
  const order: Intent[] = ['transactional', 'commercial', 'navigational', 'informational']
  let best: Intent = 'informational'
  let bestScore = 0
  for (const intent of order) {
    let score = 0
    for (const kw of INTENT_KEYWORDS[intent]) {
      const norm = fold(kw)
      if (norm.length === 0) continue
      if (haystack.includes(norm)) score++
    }
    if (score > bestScore) {
      bestScore = score
      best = intent
    }
  }
  return best
}

export type LengthFit = 'too_short' | 'right_size' | 'too_long'

export interface IntentLengthReport {
  intent: Intent
  band: IntentBand
  wordCount: number
  fit: LengthFit
  /** Imperative recommendation for the operator. */
  recommendation: string
}

function countWords(html: string): number {
  const visible = stripTags(html)
  if (visible.length === 0) return 0
  return visible.split(/\s+/).filter(Boolean).length
}

/**
 * Compare the page's word count against the expected band for its
 * classified intent and produce a fit + recommendation.
 */
export function analyseIntentLength(html: string): IntentLengthReport {
  const intent = classifyPageIntent(html)
  const band = INTENT_BANDS[intent]
  const wordCount = countWords(html)
  let fit: LengthFit
  let recommendation: string
  if (wordCount < band.min) {
    fit = 'too_short'
    const gap = band.target - wordCount
    recommendation = `${intent} pages need ~${band.target} words to feed AI responses for their intent. Add ~${gap} words of depth (examples, subtopics, FAQs).`
  } else if (wordCount > band.max) {
    fit = 'too_long'
    const over = wordCount - band.max
    recommendation = `${wordCount} words is ${over} over the AI-friendly ceiling for ${intent} pages. Tighten copy or split into linked sub-pages — AI tends to bury the answer in long pages.`
  } else {
    fit = 'right_size'
    recommendation = `${wordCount} words is within the AI-friendly band for ${intent} pages (${band.min}–${band.max}, target ${band.target}).`
  }
  return { intent, band, wordCount, fit, recommendation }
}
