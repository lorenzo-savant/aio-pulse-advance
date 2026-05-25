// PATH: src/lib/utils/query-fanout.ts
//
// "Query fan-out" coverage analyser — given a target topic and the HTML
// of a page, asks "of the sub-questions an AI would explode this topic
// into, how many does your page actually address?".
//
// Closes the gap from the Semrush "AI search optimization" piece:
//   "Optimize for query fan-out: AI systems split user prompts into
//    related sub-queries. Run your target topic through an AI tool and
//    note the sub-topics, entities, and follow-up angles. Check whether
//    your content addresses each of these angles."
//
// The actual sub-question generation requires a live LLM call (we use
// Perplexity's related_questions field — same provider already wired
// through ai-router.ts). The COVERAGE math is pure, so it can be tested
// without network. This util exports both parts so callers can:
//   - generate sub-questions independently (route handler)
//   - score coverage independently (audit + tests)

export interface FanoutCoverageResult {
  subQuestions: string[]
  /** Per-sub-question hit/miss + the heading it matched (when hit). */
  matches: Array<{ question: string; covered: boolean; matchedHeading: string | null }>
  /** Overall coverage % (1 decimal), 0-100. */
  coverage: number
  verdict: 'strong' | 'partial' | 'weak'
}

/** Lowercase + fold diacritics + collapse whitespace. */
function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'about',
  'what',
  'how',
  'why',
  'where',
  'when',
  'are',
  'can',
  'should',
  'will',
  'does',
  'have',
  'has',
  'this',
  'that',
  'from',
  'into',
  'your',
  'you',
  'our',
  'their',
  // it
  'come',
  'perche',
  'quale',
  'quali',
  'quando',
  'dove',
  // sv
  'vad',
  'hur',
  'varför',
  'när',
  'vilken',
  'vilka',
])

/**
 * Convert a sub-question into a small set of content terms (≥3 chars,
 * stop-words removed). Used as the match key against the page's headings.
 */
function termsForQuestion(question: string): string[] {
  return fold(question)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract H2/H3 + the first paragraph that follows each as the "sections"
 * we'll search for sub-question hits in. Falls back to the whole page text
 * when no H2/H3 exist.
 */
export function extractContentSections(html: string): Array<{
  heading: string
  body: string
}> {
  const sections: Array<{ heading: string; body: string }> = []
  for (const m of html.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>([\s\S]*?)(?=<h[1-6]\b|$)/gi)) {
    sections.push({
      heading: stripHtml(m[1] ?? ''),
      body: stripHtml(m[2] ?? '').slice(0, 600),
    })
  }
  if (sections.length === 0) {
    const body = stripHtml(html).slice(0, 2000)
    if (body) sections.push({ heading: '(no headings)', body })
  }
  return sections
}

/**
 * Score how well a page (raw HTML) covers a list of sub-questions.
 *
 * Match rule: a sub-question is considered "covered" when ALL of its
 * meaningful terms (after stop-word filter) appear within a single
 * H2/H3 section (heading + first 600 chars of body). The strict-all
 * rule keeps the metric honest — partial overlap with a long page is
 * easy to hit and not very informative.
 *
 * Verdict bands: ≥70% strong, ≥40% partial, <40% weak.
 */
/**
 * Emit the UNCOVERED sub-questions as a ready-to-paste FAQ block.
 *
 * The Semrush "We Tested Query Fan-Out Optimization" experiment more than
 * doubled AI citations (2 → 5, briefly peaking at 9) by editing each
 * article to address the missed fan-out queries — and explicitly used a
 * dedicated FAQ section when integration into the prose was awkward.
 * This helper turns the coverage report into that exact artifact:
 *
 *   - `markdown`: an H2 FAQ block with one H3 + answer per uncovered query
 *   - `jsonLd`: a schema.org FAQPage object the operator can drop in
 *
 * If the caller passes an `answers` map, those become the FAQ bodies.
 * Otherwise each item gets a `TODO` placeholder — the experiment proved
 * that even semantic matches count, so the operator can rewrite freely.
 */
export interface FanoutFAQExport {
  /** How many uncovered questions ended up in the FAQ block. */
  itemCount: number
  /** H2 FAQ + H3-per-question markdown, empty string when nothing to add. */
  markdown: string
  /** schema.org FAQPage JSON-LD (null when itemCount === 0). */
  jsonLd: {
    '@context': 'https://schema.org'
    '@type': 'FAQPage'
    mainEntity: Array<{
      '@type': 'Question'
      name: string
      acceptedAnswer: { '@type': 'Answer'; text: string }
    }>
  } | null
}

export function exportFanoutAsFAQ(
  report: FanoutCoverageResult,
  options: {
    /** Optional question→answer map. Unmapped questions get TODO bodies. */
    answers?: Record<string, string>
    /** Heading text for the markdown FAQ section. Default: "FAQ". */
    heading?: string
    /** Placeholder text when no answer is supplied. Default: TODO line. */
    placeholder?: string
  } = {},
): FanoutFAQExport {
  const uncovered = report.matches.filter((m) => !m.covered).map((m) => m.question)
  if (uncovered.length === 0) {
    return { itemCount: 0, markdown: '', jsonLd: null }
  }
  const heading = (options.heading ?? 'FAQ').trim() || 'FAQ'
  const placeholder = options.placeholder ?? 'TODO: write a 2-3 sentence answer.'
  const items = uncovered.map((q) => {
    const supplied = options.answers?.[q]?.trim()
    return { question: q, answer: supplied && supplied.length > 0 ? supplied : placeholder }
  })
  const markdown = [
    `## ${heading}`,
    '',
    ...items.flatMap((it) => [`### ${it.question}`, '', it.answer, '']),
  ]
    .join('\n')
    .trimEnd()
  const jsonLd: FanoutFAQExport['jsonLd'] = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.question,
      acceptedAnswer: { '@type': 'Answer', text: it.answer },
    })),
  }
  return { itemCount: items.length, markdown, jsonLd }
}

export function scoreFanoutCoverage(html: string, subQuestions: string[]): FanoutCoverageResult {
  const sections = extractContentSections(html).map((s) => ({
    heading: s.heading,
    foldedBody: fold(`${s.heading} ${s.body}`),
  }))
  const matches = subQuestions.map((q) => {
    const terms = termsForQuestion(q)
    if (terms.length === 0)
      return { question: q, covered: false, matchedHeading: null as string | null }
    for (const sec of sections) {
      const hitsAll = terms.every((t) => sec.foldedBody.includes(t))
      if (hitsAll) {
        return { question: q, covered: true, matchedHeading: sec.heading || '(unnamed)' }
      }
    }
    return { question: q, covered: false, matchedHeading: null }
  })
  const covered = matches.filter((m) => m.covered).length
  const coverage =
    subQuestions.length > 0 ? Math.round((covered / subQuestions.length) * 1000) / 10 : 0
  const verdict: FanoutCoverageResult['verdict'] =
    coverage >= 70 ? 'strong' : coverage >= 40 ? 'partial' : 'weak'
  return { subQuestions, matches, coverage, verdict }
}
