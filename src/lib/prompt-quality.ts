// PATH: src/lib/prompt-quality.ts
//
// Detector for "performative" prompt phrasing — the class of cues that
// shifts LLMs into role-simulation mode instead of fact-retrieval mode.
// Background: framing like "Act as X" / "Imagine you are Y" reconfigures
// the model's optimization objective from "what is true?" to "what would
// such a persona say?", producing fluent but unverifiable output.
//
// Used in two places:
//   1. scripts/audit-prompt-patterns.ts — CI-style audit over our static
//      prompt library + system prompts; catches regressions when new
//      templates are added.
//   2. The "Add prompt" textarea on /dashboard/prompts — live warning so
//      operators know when a manual entry will degrade the AI engines'
//      response quality.
//
// Pure + dependency-free so it works in browser, server, AND scripts.

export interface PerformativeMatch {
  /** The exact substring that matched, lowercased. */
  phrase: string
  /** Locale of the rule that fired ("en" | "it" | "sv"). */
  locale: 'en' | 'it' | 'sv'
  /** Why it's risky — one short English sentence for the warning UI. */
  reason: string
  /** Best-effort rewrite hint — directive/validator-framed alternative. */
  suggestion: string
}

// Rules per locale. Each PATTERN is a lowercase substring matcher (cheap
// to run, no false negatives from regex misses). We keep the list short
// and high-signal — adding too many catches normal prompts as false
// positives ("you are looking for X" would match "you are", noisy).
interface Rule {
  pattern: RegExp
  locale: PerformativeMatch['locale']
  reason: string
  suggestion: string
}

const RULES: Rule[] = [
  // ── English ──────────────────────────────────────────────────────────
  {
    pattern: /\bact\s+(?:as|like)\s+(?:a|an|the)\b/i,
    locale: 'en',
    reason:
      'Triggers role simulation — the LLM optimises for persona fluency over factual accuracy.',
    suggestion: 'Replace with a directive form: "What are the leading X according to <source>?"',
  },
  {
    pattern: /\bpretend\s+(?:you\s+(?:are|were)|to\s+be)\b/i,
    locale: 'en',
    reason: 'Explicit fiction frame — the model treats the answer as a creative writing task.',
    suggestion: 'Replace with a factual question: "What does <source> say about Y?"',
  },
  {
    pattern: /\bimagine\s+(?:you\s+(?:are|were)|that\s+you\s+are)\b/i,
    locale: 'en',
    reason: 'Performative framing — opens the door to fabricated details to stay in character.',
    suggestion: 'Drop the imagine framing and ask the question directly.',
  },
  {
    pattern: /\b(?:roleplay|role-play)\s+as\b/i,
    locale: 'en',
    reason: 'Explicit roleplay request — output prioritises tone, not source fidelity.',
    suggestion: 'Ask for the underlying information directly.',
  },
  {
    pattern: /\byou\s+are\s+now\s+(?:a|an|the)\b/i,
    locale: 'en',
    reason: 'Persona assignment without output constraints — invites improvisation.',
    suggestion: 'Either drop the persona or pair it with explicit source/format constraints.',
  },

  // ── Italian ──────────────────────────────────────────────────────────
  {
    pattern: /\b(?:agisci|comportati)\s+come\s+(?:un|una|uno)\b/i,
    locale: 'it',
    reason:
      'Attiva la modalità simulazione — il modello ottimizza per la fluidità del personaggio.',
    suggestion: 'Riformula come domanda diretta: "Quali sono i principali X secondo <fonte>?"',
  },
  {
    pattern: /\bfingi\s+(?:di|che)\b/i,
    locale: 'it',
    reason: 'Frame esplicito di finzione — il modello tratta la risposta come scrittura creativa.',
    suggestion: 'Sostituisci con una domanda fattuale ancorata a una fonte.',
  },
  {
    pattern: /\bfai\s+finta\s+(?:di|che)\b/i,
    locale: 'it',
    reason:
      'Frame di finzione — invita il modello a fabbricare dettagli per restare in personaggio.',
    suggestion: "Chiedi direttamente l'informazione che ti serve.",
  },
  {
    pattern: /\bimmagina\s+(?:di\s+essere|che\s+tu\s+sia)\b/i,
    locale: 'it',
    reason: 'Frame performativo — apre la porta alla fabbricazione di dettagli.',
    suggestion: 'Rimuovi il frame e poni la domanda direttamente.',
  },
  {
    pattern: /\bimpersona\s+(?:un|una|uno)\b/i,
    locale: 'it',
    reason: 'Richiesta di impersonificazione — output ottimizzato per tono, non per veridicità.',
    suggestion: "Chiedi l'informazione di base senza il framing di ruolo.",
  },

  // ── Swedish ──────────────────────────────────────────────────────────
  {
    pattern: /\blåtsas\s+(?:vara|att\s+du\s+är)\b/i,
    locale: 'sv',
    reason: 'Explicit fiktionsram — modellen behandlar svaret som kreativt skrivande.',
    suggestion: 'Ersätt med en faktafråga förankrad i en källa.',
  },
  {
    pattern: /\bföreställ\s+dig\s+att\s+du\s+(?:är|var)\b/i,
    locale: 'sv',
    reason: 'Performativ inramning — uppmanar modellen att hitta på detaljer för att hålla rollen.',
    suggestion: 'Ta bort föreställningsramen och ställ frågan direkt.',
  },
  {
    pattern: /\bagera\s+som\s+(?:en|ett)\b/i,
    locale: 'sv',
    reason: 'Aktiverar simuleringsläge — modellen optimerar för personabeteende, inte fakta.',
    suggestion: 'Formulera om som en direkt fråga: "Vilka är de ledande X enligt <källa>?"',
  },
]

/**
 * Scan a single string for performative-phrasing patterns. Returns ALL
 * matches (one rule can fire multiple times in a long prompt).
 *
 * Empty / whitespace-only input → empty array; no false positives on
 * silent / loading states in the UI.
 */
export function findPerformativePatterns(text: string): PerformativeMatch[] {
  if (!text || !text.trim()) return []
  const matches: PerformativeMatch[] = []
  for (const rule of RULES) {
    const m = text.match(rule.pattern)
    if (m) {
      matches.push({
        phrase: m[0].toLowerCase(),
        locale: rule.locale,
        reason: rule.reason,
        suggestion: rule.suggestion,
      })
    }
  }
  return matches
}

/**
 * Convenience: true when the text contains at least one performative
 * pattern. Cheap inline check for UI gates ("highlight the textarea red").
 */
export function hasPerformativePhrasing(text: string): boolean {
  return findPerformativePatterns(text).length > 0
}
