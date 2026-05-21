// PATH: src/lib/services/sentiment-lexicon.ts
//
// Deterministic, dependency-free valence lexicon (the AFINN/VADER technique
// catalogued in awesome-sentiment-analysis) — adapted to be TRILINGUAL
// (en/it/sv) so it works for this product's Swedish-first, multilingual data.
//
// It is NOT the primary sentiment engine. The LLM (analyzeSentiment) remains
// authoritative — it handles context, sarcasm, and aspects far better. This
// lexicon is a fast, free CROSS-CHECK: a second opinion that flags when the
// LLM's label clearly contradicts the surface wording, so the UI can lower
// confidence on shaky calls instead of presenting every verdict as certain.

export type LexiconLabel = 'positive' | 'negative' | 'neutral'

// AFINN-style term → weight. Small, curated valence set per language. Weights
// roughly: 1 = mild, 2 = moderate, 3 = strong. Stems kept short so simple
// prefix-free whole-word matching catches common inflections.
const POSITIVE: Record<string, number> = {
  // English
  best: 3,
  excellent: 3,
  amazing: 3,
  outstanding: 3,
  love: 3,
  perfect: 3,
  great: 2,
  good: 2,
  recommend: 2,
  recommended: 2,
  reliable: 2,
  trusted: 2,
  helpful: 2,
  impressive: 2,
  popular: 2,
  leading: 2,
  quality: 1,
  solid: 1,
  affordable: 1,
  easy: 1,
  useful: 1,
  fast: 1,
  friendly: 1,
  professional: 1,
  // Italian
  migliore: 3,
  eccellente: 3,
  ottimo: 3,
  perfetto: 3,
  fantastico: 3,
  consigliato: 2,
  affidabile: 2,
  professionale: 2,
  popolare: 2,
  qualità: 1,
  facile: 1,
  veloce: 1,
  utile: 1,
  conveniente: 1,
  efficiente: 1,
  // Swedish
  bäst: 3,
  bästa: 3,
  utmärkt: 3,
  fantastisk: 3,
  perfekt: 3,
  älskar: 3,
  bra: 2,
  rekommenderar: 2,
  rekommenderas: 2,
  pålitlig: 2,
  pålitligt: 2,
  populär: 2,
  ledande: 2,
  professionell: 2,
  kvalitet: 1,
  enkel: 1,
  enkelt: 1,
  snabb: 1,
  snabbt: 1,
  prisvärd: 1,
  hjälpsam: 1,
  smidig: 1,
}

const NEGATIVE: Record<string, number> = {
  // English
  worst: 3,
  terrible: 3,
  awful: 3,
  scam: 3,
  fraud: 3,
  horrible: 3,
  hate: 3,
  bad: 2,
  poor: 2,
  unreliable: 2,
  disappointing: 2,
  expensive: 2,
  slow: 2,
  difficult: 2,
  problem: 1,
  issue: 1,
  complaint: 1,
  lacking: 1,
  limited: 1,
  confusing: 1,
  buggy: 1,
  overpriced: 2,
  // Italian
  peggiore: 3,
  terribile: 3,
  pessimo: 3,
  truffa: 3,
  orribile: 3,
  odio: 3,
  scadente: 2,
  inaffidabile: 2,
  deludente: 2,
  costoso: 2,
  lento: 2,
  difficile: 2,
  problema: 1,
  lamentela: 1,
  limitato: 1,
  caro: 1,
  // Swedish
  sämst: 3,
  värst: 3,
  hemsk: 3,
  hemskt: 3,
  bluff: 3,
  bedrägeri: 3,
  usel: 3,
  dålig: 2,
  dåligt: 2,
  opålitlig: 2,
  besviken: 2,
  dyr: 2,
  dyrt: 2,
  långsam: 2,
  svår: 2,
  svårt: 2,
  klagomål: 1,
  begränsad: 1,
  krånglig: 1,
}

// Negators flip the polarity of the next sentiment term within a short window.
const NEGATORS = new Set([
  'not',
  'no',
  'never',
  "n't",
  'without',
  'cannot',
  "can't",
  'dont',
  "don't",
  'non',
  'mai',
  'senza',
  'né',
  'nessun',
  'nessuno',
  'inte',
  'aldrig',
  'utan',
  'ingen',
  'inget',
  'ej',
])

// Intensifiers scale the magnitude of a following sentiment term.
const INTENSIFIERS: Record<string, number> = {
  very: 1.5,
  extremely: 2,
  really: 1.5,
  so: 1.3,
  too: 1.3,
  highly: 1.5,
  molto: 1.5,
  estremamente: 2,
  davvero: 1.4,
  troppo: 1.3,
  mycket: 1.5,
  väldigt: 1.6,
  extremt: 2,
  riktigt: 1.4,
  jätte: 1.6,
  super: 1.5,
}

const NEGATION_WINDOW = 3

export interface LexicalSentiment {
  /** Normalized polarity in [-1, 1]. 0 when no terms matched. */
  score: number
  label: LexiconLabel
  /** Number of valence terms matched — the strength of the signal. */
  hits: number
}

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'’\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Score text with the trilingual valence lexicon. Handles negation (flips the
 * next term's sign within a small window) and intensifiers (scales magnitude).
 * Returns a normalized score, a label with a small neutral deadzone, and the
 * hit count so callers can weight by signal strength.
 */
export function lexicalSentiment(text: string): LexicalSentiment {
  const tokens = tokenize(text)
  let sum = 0
  let hits = 0

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!
    const pos = POSITIVE[tok]
    const neg = NEGATIVE[tok]
    if (pos === undefined && neg === undefined) continue
    // NEGATIVE stores magnitudes; negate so negative terms pull the score down.
    let weight = pos !== undefined ? pos : -neg!

    // Look back a few tokens for a negator or intensifier.
    let negated = false
    let intensity = 1
    for (let j = Math.max(0, i - NEGATION_WINDOW); j < i; j++) {
      const prev = tokens[j]!
      if (NEGATORS.has(prev)) negated = true
      const inten = INTENSIFIERS[prev]
      if (inten) intensity = Math.max(intensity, inten)
    }

    if (negated) weight = -weight
    sum += weight * intensity
    hits++
  }

  if (hits === 0) return { score: 0, label: 'neutral', hits: 0 }

  // Normalize: average weight per hit, squashed into [-1, 1]. A single strong
  // term (|w|=3) saturates toward ±1; mixed signals average out.
  const score = Math.max(-1, Math.min(1, sum / (hits * 2)))
  const label: LexiconLabel = score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral'
  return { score: Math.round(score * 100) / 100, label, hits }
}

export type ConflictLevel = 'none' | 'soft' | 'strong'

/**
 * Compare an LLM sentiment label against the lexical reading. Only flags a
 * STRONG conflict when the two are polar opposites AND the lexicon has enough
 * signal (≥2 hits) — so a noisy single word never overrides a confident LLM.
 * No lexical signal (0 hits) ⇒ no conflict (don't penalize).
 */
export function sentimentAgreement(
  llmLabel: LexiconLabel,
  lex: LexicalSentiment,
): { conflict: ConflictLevel } {
  if (lex.hits === 0 || llmLabel === lex.label) return { conflict: 'none' }
  const opposite =
    (llmLabel === 'positive' && lex.label === 'negative') ||
    (llmLabel === 'negative' && lex.label === 'positive')
  if (opposite && lex.hits >= 2) return { conflict: 'strong' }
  return { conflict: 'soft' }
}
