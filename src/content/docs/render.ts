// PATH: src/content/docs/render.ts
//
// Shared parsing helpers for the doc renderer, so /docs and /dashboard/docs
// agree on what a step block is.
//
// This exists because the renderer used to detect step blocks with /^Step \d/,
// which only matched English. Once the content was translated, the Italian
// "Passo 1 —" and Swedish "Steg 1 —" lines fell through to the plain-paragraph
// branch and silently lost their numbered styling. Any new locale must add its
// word here, or its quick-start section renders as prose.

/** Step-word per locale. Extend when adding a locale. */
const STEP_WORDS = ['Step', 'Passo', 'Steg'] as const

/** Matches a whole paragraph that opens a step block. */
export const STEP_BLOCK_RE = new RegExp(`^(?:${STEP_WORDS.join('|')})\\s+\\d`)

/** Matches one step line, capturing the number and the title after the dash. */
const STEP_LINE_RE = new RegExp(`^(?:${STEP_WORDS.join('|')})\\s+(\\d+)\\s*[—–-]\\s*(.+)`)

export interface StepLine {
  /** The step number, without the localised word. */
  number: string
  /** Everything after the dash. */
  title: string
}

/** Parses a single step line, or returns null if the line is not one. */
export function matchStepLine(line: string): StepLine | null {
  const m = line.match(STEP_LINE_RE)
  if (!m?.[1] || !m[2]) return null
  return { number: m[1], title: m[2] }
}

/** True when a paragraph should render as a numbered step block. */
export function isStepBlock(paragraph: string): boolean {
  return STEP_BLOCK_RE.test(paragraph.trim())
}
