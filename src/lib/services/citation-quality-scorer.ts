// PATH: src/lib/services/citation-quality-scorer.ts
//
// Citation Quality Scorer — measures how likely a page is to be cited
// by AI search engines (ChatGPT, Google AI Mode, Perplexity, etc.).
// Operationalises the five positive-correlation signals from Semrush's
// "What makes content get cited by AI" study (study period Jul–Aug 2025,
// 304k cited URLs vs 921k Google-ranking-only URLs):
//
//   • Clarity & summarization (+33% citation lift)
//   • E-E-A-T signals          (+30%)
//   • Q&A format               (+25%)
//   • Section structure        (+23%)
//   • Structured data          (+22%)
//
// Pure, deterministic, dependency-free. Heuristics over HTML + text —
// no LLM calls. Same scorer feeds the /dashboard/optimizer "Citation
// Quality" card AND can run inside Citation Worthiness Score's quality
// pillar later (currently weight 15 — see citation-worthiness-score.ts).

export type QualityBand = 'strong' | 'medium' | 'weak'

export interface PillarScore {
  /** 0–100 normalized for the pillar. */
  score: number
  /** Concrete observations from the heuristic ("found 3 H2 headings", etc.).
   *  Useful for the recommendations panel — operators can see WHAT the
   *  scorer measured, not just the final number. */
  signals: string[]
  /** One short actionable sentence on how to lift this pillar. */
  recommendation: string
}

export interface CitationQualityReport {
  /** Weighted 0–100 across the five pillars. */
  overall: number
  band: QualityBand
  pillars: {
    clarity: PillarScore
    eeat: PillarScore
    qa: PillarScore
    structure: PillarScore
    structuredData: PillarScore
  }
  /** Top 3 recommendations sorted by widest gap-to-100. */
  topRecommendations: string[]
}

export interface CitationQualityInput {
  /** Raw HTML when scoring a fetched URL. Optional — when omitted the
   *  scorer falls back to text-only checks (the structured-data and
   *  some EEAT signals can't fire without HTML). */
  html?: string
  /** Plain-text content (extracted from HTML or pasted directly). Required. */
  text: string
}

// Pillar weights — anchored to Semrush's measured correlations, then
// normalised to sum to 100 for a clean overall percentage. Higher weight
// = more leverage when this pillar moves.
const WEIGHTS = {
  clarity: 25,
  eeat: 22,
  qa: 19,
  structure: 17,
  structuredData: 17,
} as const

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function bandFor(score: number): QualityBand {
  if (score >= 75) return 'strong'
  if (score >= 50) return 'medium'
  return 'weak'
}

// ─── Pillar 1: Clarity / lead summary ──────────────────────────────────
// AI engines preferentially cite pages that "lead with the answer". The
// canonical signals: a TL;DR-style opener, a tight first paragraph, or
// a definitional sentence ("X is …").
function scoreClarity(input: CitationQualityInput): PillarScore {
  const { text, html } = input
  const signals: string[] = []
  let score = 0

  // Lead paragraph length — operates on the first ~1500 chars to dodge
  // long-form intros. The Semrush study correlated short, dense leads.
  const trimmed = text.trim()
  const firstParagraph = trimmed.split(/\n{2,}|\.{1}\s+/)[0] ?? ''
  const leadWords = firstParagraph.split(/\s+/).filter(Boolean).length
  if (leadWords > 0 && leadWords <= 60) {
    score += 40
    signals.push(`Lead paragraph is ${leadWords} words — tight enough to read as an answer.`)
  } else if (leadWords > 0 && leadWords <= 100) {
    score += 20
    signals.push(
      `Lead paragraph is ${leadWords} words — borderline; trim to <60 for a sharper TL;DR.`,
    )
  } else {
    signals.push(`Lead paragraph is ${leadWords} words — too long; AI engines tend to skip it.`)
  }

  // Explicit summary marker
  const summaryMarker =
    /\b(?:tl;?dr|in\s+summary|key\s+takeaway|in\s+short|bottom\s+line|riassunto|in\s+breve|sammanfattning)\b/i.test(
      trimmed.slice(0, 2000),
    )
  if (summaryMarker) {
    score += 30
    signals.push('Explicit summary marker (TL;DR / "Key takeaway" / "In summary") detected.')
  } else {
    signals.push(
      'No explicit summary marker found in the opening — AI engines reward "Key takeaway" / TL;DR blocks.',
    )
  }

  // Definitional opener — "X is …" / "X è …" / "X är …". Schema.org-like
  // definitional sentences correlate strongly with knowledge-graph reuse.
  const definitional = /^[A-Z][\w\s'’&-]{2,40}\s+(?:is|are|è|sono|är)\s+/m.test(
    trimmed.slice(0, 400),
  )
  if (definitional) {
    score += 30
    signals.push('Opens with a definitional sentence ("X is …") — strong AI-citation pattern.')
  } else {
    signals.push(
      'Opening sentence is not definitional. Try restructuring as "<Brand> is <one-line description>".',
    )
  }

  // Slight bonus when an HTML lead container is present and labeled.
  if (
    html &&
    /<(?:p|div|aside)[^>]*class=["'][^"']*(?:summary|tldr|lead|abstract)[^"']*/i.test(html)
  ) {
    score += 10
    signals.push('A dedicated lead/summary container is present in the markup.')
  }

  const final = clamp(score)
  return {
    score: final,
    signals,
    recommendation:
      final >= 75
        ? 'Already strong — keep leads under 60 words with an explicit TL;DR marker.'
        : 'Open the page with a 1-paragraph TL;DR (<60 words) that starts "<Brand> is …" and contains the words "Key takeaway".',
  }
}

// ─── Pillar 2: E-E-A-T signals ─────────────────────────────────────────
// Experience-Expertise-Authoritativeness-Trustworthiness markers. Strongest
// concrete signal: a named author with credentials AND outbound links to
// authoritative sources.
function scoreEeat(input: CitationQualityInput): PillarScore {
  const { text, html } = input
  const signals: string[] = []
  let score = 0

  // Named author byline — language-agnostic patterns.
  const byline =
    /\b(?:by|di|av|written\s+by|reviewed\s+by|scritto\s+da|skriven\s+av)\s+[A-Z][\w'’.-]{1,40}(?:\s+[A-Z][\w'’.-]{1,40}){0,3}/i.test(
      text,
    )
  if (byline) {
    score += 25
    signals.push('Named author byline detected — strong authorship signal.')
  } else {
    signals.push(
      'No "By <Author Name>" byline found. Add an attributed author at the top of the page.',
    )
  }

  // Credentials marker
  const credentials =
    /\b(?:ph\.?d|m\.?d|cfa|mba|dott(?:\.|ore|oressa)|prof(?:\.|essor)|cpa|esq\.?|attorney|certified|certificat[oa])\b/i.test(
      text,
    )
  if (credentials) {
    score += 20
    signals.push('Author credentials mentioned (PhD / MD / Dott. / Prof. / CFA / certified).')
  } else {
    signals.push(
      'No credentials called out near the author. Adding "<Name>, <Credential>" lifts EEAT.',
    )
  }

  // Outbound authoritative links — .gov / .edu / wikipedia.org / standards bodies.
  if (html) {
    const authoritativeLinks = (
      html.match(
        /href=["'][^"']*(?:\.gov|\.edu|wikipedia\.org|iso\.org|ietf\.org|w3\.org|nih\.gov)[^"']*["']/gi,
      ) ?? []
    ).length
    if (authoritativeLinks >= 2) {
      score += 25
      signals.push(
        `${authoritativeLinks} outbound links to .gov / .edu / wikipedia / standards bodies.`,
      )
    } else if (authoritativeLinks === 1) {
      score += 15
      signals.push('1 outbound authoritative link — add at least 1 more for citation reliability.')
    } else {
      signals.push(
        'Zero outbound links to authoritative sources (.gov / .edu / wikipedia / standards bodies).',
      )
    }
  }

  // Schema.org Person + jobTitle — visible only in HTML.
  if (html && /"@type"\s*:\s*"Person"/.test(html) && /"jobTitle"\s*:/i.test(html)) {
    score += 15
    signals.push(
      'Schema.org Person with jobTitle present — explicit author identity in structured data.',
    )
  } else if (html) {
    signals.push('No Person schema with jobTitle. Emit a Person JSON-LD block for the author.')
  }

  // Sourcing / footnote markers — "[1]", "(source: …)", "Fonte: …".
  if (/\[\d+\]|\(source[:\s]|fonte\s*:|källa\s*:/i.test(text)) {
    score += 15
    signals.push('Inline citations / footnotes detected ([1], "source:", "fonte:").')
  } else {
    signals.push('No inline citations/footnotes. Cite the sources behind your claims.')
  }

  const final = clamp(score)
  return {
    score: final,
    signals,
    recommendation:
      final >= 75
        ? 'EEAT looks solid — keep maintaining author bios and outbound sourcing.'
        : 'Add a named author with visible credentials + at least 2 outbound links to .gov / .edu / Wikipedia sources.',
  }
}

// ─── Pillar 3: Q&A format ──────────────────────────────────────────────
function scoreQa(input: CitationQualityInput): PillarScore {
  const { text, html } = input
  const signals: string[] = []
  let score = 0

  // FAQPage schema is the highest-value signal — guarantees Q&A intent.
  if (html && /"@type"\s*:\s*"(?:FAQPage|Question)"/.test(html)) {
    score += 50
    signals.push('FAQPage / Question schema detected — direct AI-citation pathway.')
  } else if (html) {
    signals.push('No FAQPage schema. Wrap your FAQs in JSON-LD with @type: FAQPage.')
  }

  // HTML accordion-y patterns
  if (html && /<details[\s>]/.test(html)) {
    score += 15
    signals.push(
      'Native <details> accordion blocks present — render as Q&A in AI training corpora.',
    )
  }

  // dt/dd description lists
  if (html && /<dt[\s>][\s\S]*?<dd[\s>]/.test(html)) {
    score += 15
    signals.push('Definition-list (<dt>/<dd>) Q&A pattern detected.')
  }

  // Text-level Q&A heuristics — count interrogative headings.
  const questionHeadings = (text.match(/(?:^|\n)[#*]{0,3}\s*[^.\n]{6,120}\?(?:\n|$)/g) ?? []).length
  if (questionHeadings >= 3) {
    score += 25
    signals.push(
      `${questionHeadings} question-style headings — AI engines parse these as Q&A pairs.`,
    )
  } else if (questionHeadings >= 1) {
    score += 10
    signals.push(`Only ${questionHeadings} question-style heading(s). Aim for ≥3 per article.`)
  } else {
    signals.push('No question-style headings ("How does X work?" / "What is Y?"). Add 3+.')
  }

  // Explicit Q:/A: prefixes
  if (/\bQ\s*:\s*\S/.test(text) && /\bA\s*:\s*\S/.test(text)) {
    score += 10
    signals.push('Explicit "Q: / A:" prefixes detected.')
  }

  const final = clamp(score)
  return {
    score: final,
    signals,
    recommendation:
      final >= 75
        ? 'Q&A coverage is good — make sure each Q&A pair is also in FAQPage JSON-LD.'
        : 'Add 3+ question-style H2s with direct answers, and wrap them in FAQPage JSON-LD schema.',
  }
}

// ─── Pillar 4: Section structure ───────────────────────────────────────
function scoreStructure(input: CitationQualityInput): PillarScore {
  const { text, html } = input
  const signals: string[] = []
  let score = 0
  const wordCount = text.split(/\s+/).filter(Boolean).length

  // Heading count — prefer H2 + H3 (H1 should be unique to the page).
  let h2 = 0
  let h3 = 0
  if (html) {
    h2 = (html.match(/<h2[\s>]/gi) ?? []).length
    h3 = (html.match(/<h3[\s>]/gi) ?? []).length
  } else {
    h2 = (text.match(/(?:^|\n)##\s+\S/g) ?? []).length
    h3 = (text.match(/(?:^|\n)###\s+\S/g) ?? []).length
  }

  if (h2 >= 3 || h2 + h3 >= 5) {
    score += 40
    signals.push(`${h2} H2 + ${h3} H3 headings — strong sectioning.`)
  } else if (h2 + h3 >= 2) {
    score += 20
    signals.push(`Only ${h2} H2 + ${h3} H3. Aim for ≥3 H2 sections per article.`)
  } else {
    signals.push('Few or no H2/H3 sections — AI engines struggle to chunk the page.')
  }

  // Lists / bulleted enumeration
  let lists = 0
  if (html) {
    lists = (html.match(/<(?:ul|ol)[\s>]/gi) ?? []).length
  } else {
    lists = (text.match(/(?:^|\n)\s*(?:[-*]|\d+\.)\s+\S/g) ?? []).length
    // Heuristic: count 3+ consecutive list lines as a single list.
    lists = Math.ceil(lists / 3)
  }
  if (lists >= 2) {
    score += 25
    signals.push(`${lists} list block(s) detected — AI engines cite enumerated content readily.`)
  } else if (lists === 1) {
    score += 12
    signals.push('Only 1 list. Add at least one more enumerated list (steps, criteria, options).')
  } else {
    signals.push('No bulleted/numbered lists. Add at least 2.')
  }

  // Tables
  const tables = html ? (html.match(/<table[\s>]/gi) ?? []).length : 0
  if (tables >= 1) {
    score += 20
    signals.push(`${tables} table(s) — comparison tables are heavily cited by AI summarisers.`)
  } else if (html) {
    signals.push('No tables. A single comparison table can lift citation rate noticeably.')
  }

  // Heading density vs word count
  if (wordCount > 0) {
    const wordsPerHeading = wordCount / Math.max(1, h2 + h3)
    if (wordsPerHeading < 180) {
      score += 15
      signals.push(`Heading every ~${Math.round(wordsPerHeading)} words — good chunking density.`)
    }
  }

  const final = clamp(score)
  return {
    score: final,
    signals,
    recommendation:
      final >= 75
        ? 'Structure is well chunked — keep ≥3 H2 sections + 2 lists + 1 table on long-form pages.'
        : 'Restructure with ≥3 H2 sections, 2 bulleted/numbered lists, and at least 1 comparison table.',
  }
}

// ─── Pillar 5: Structured data ─────────────────────────────────────────
function scoreStructuredData(input: CitationQualityInput): PillarScore {
  const { html } = input
  const signals: string[] = []

  if (!html) {
    return {
      score: 0,
      signals: ['Structured data not detectable from pasted text — analyse the URL instead.'],
      recommendation: 'Switch to URL mode to score Schema.org JSON-LD coverage.',
    }
  }

  let score = 0
  const blocks =
    html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) ?? []
  if (blocks.length === 0) {
    signals.push('No JSON-LD <script> blocks found. Emit at least Organization + Article schema.')
    return {
      score: 0,
      signals,
      recommendation:
        'Add Schema.org JSON-LD: at minimum Organization on the homepage and Article on each blog post.',
    }
  }

  // Types per-block, scored individually so a single @graph block can
  // count for multiple types simultaneously.
  const TYPE_VALUES: Array<{ rx: RegExp; pts: number; name: string }> = [
    { rx: /"@type"\s*:\s*"Article"/, pts: 25, name: 'Article' },
    { rx: /"@type"\s*:\s*"FAQPage"/, pts: 20, name: 'FAQPage' },
    { rx: /"@type"\s*:\s*"Organization"/, pts: 20, name: 'Organization' },
    { rx: /"@type"\s*:\s*"Person"/, pts: 15, name: 'Person' },
    { rx: /"@type"\s*:\s*"BreadcrumbList"/, pts: 10, name: 'BreadcrumbList' },
    { rx: /"@type"\s*:\s*"HowTo"/, pts: 15, name: 'HowTo' },
    { rx: /"@type"\s*:\s*"WebSite"/, pts: 10, name: 'WebSite' },
  ]
  const allHtml = blocks.join('\n')
  const found: string[] = []
  for (const { rx, pts, name } of TYPE_VALUES) {
    if (rx.test(allHtml)) {
      score += pts
      found.push(name)
    }
  }
  if (found.length > 0) {
    signals.push(`Schema types found: ${found.join(', ')}.`)
  }
  const missing = TYPE_VALUES.filter((t) => !found.includes(t.name)).map((t) => t.name)
  if (missing.length > 0) {
    signals.push(`Missing high-value types: ${missing.slice(0, 3).join(', ')}.`)
  }

  const final = clamp(score)
  return {
    score: final,
    signals,
    recommendation:
      final >= 75
        ? 'Structured-data coverage is strong — keep Article + Organization + FAQPage in sync with content updates.'
        : 'Add the missing high-value Schema.org types. Article + Organization + FAQPage cover 65% of citation lift on their own.',
  }
}

// ─── Top-level scorer ──────────────────────────────────────────────────
export function scoreCitationQuality(input: CitationQualityInput): CitationQualityReport {
  const pillars = {
    clarity: scoreClarity(input),
    eeat: scoreEeat(input),
    qa: scoreQa(input),
    structure: scoreStructure(input),
    structuredData: scoreStructuredData(input),
  }

  const overall = clamp(
    (pillars.clarity.score * WEIGHTS.clarity +
      pillars.eeat.score * WEIGHTS.eeat +
      pillars.qa.score * WEIGHTS.qa +
      pillars.structure.score * WEIGHTS.structure +
      pillars.structuredData.score * WEIGHTS.structuredData) /
      100,
  )

  // Top-3 recommendations — sort by weight × (100 − score) so the highest-
  // leverage low-scoring pillar surfaces first.
  const ranked = (Object.keys(pillars) as Array<keyof typeof pillars>)
    .map((key) => ({
      key,
      gap: WEIGHTS[key] * (100 - pillars[key].score),
      recommendation: pillars[key].recommendation,
    }))
    .sort((a, b) => b.gap - a.gap)

  return {
    overall,
    band: bandFor(overall),
    pillars,
    topRecommendations: ranked.slice(0, 3).map((r) => r.recommendation),
  }
}

// Re-exported for tests and the worthiness-score integration.
export const CITATION_QUALITY_WEIGHTS = WEIGHTS
