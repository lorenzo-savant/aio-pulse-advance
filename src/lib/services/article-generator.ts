// PATH: src/lib/services/article-generator.ts
//
// AI Article Generator — produces draft Markdown articles optimised
// against the same 5 Semrush AI-citation signals that citation-quality-
// scorer measures (clarity, EEAT, Q&A, structure, structured-data).
// Closes the loop: AIO Pulse is the only tool that both MEASURES AI
// citations AND GENERATES content scored against the measured signals.
//
// Stack:
//   1. Build a constraint-rich system prompt encoding the 5 signals
//   2. callLLM (Groq → Cerebras → Mistral → Gemini → OpenAI fallback chain)
//   3. Auto-score the output with scoreCitationQuality
//   4. Return { markdown, score, recommendations }
//
// Pure-ish: prompt building + post-processing are unit-testable; the
// LLM call boundary accepts an injected `llmCaller` for mocking.

import { callLLM } from '@/lib/services/prompt-generator-ai'
import {
  scoreCitationQuality,
  type CitationQualityReport,
} from '@/lib/services/citation-quality-scorer'

export type ArticleIntent = 'B1' | 'B2' | 'B3' | 'B4' | 'B5'

export type ArticleLength = 'short' | 'medium' | 'long'

export interface ArticleBrandContext {
  name: string
  domain?: string | null
  description?: string | null
  industry?: string | null
  aliases?: string[] | null
  competitors?: string[] | null
  sameAs?: string[] | null
  disambiguation?: string | null
  citationFormat?: string | null
  legalId?: string | null
  legalIdType?: 'vat' | 'orgnr' | 'fiscal_code' | 'ein' | 'other' | null
  locale?: 'en' | 'it' | 'sv' | null
}

export interface GenerateArticleInput {
  brand: ArticleBrandContext
  topic: string
  intent: ArticleIntent
  length: ArticleLength
  /** Optional format hint from Topic Finder ("comparison", "how-to", …)
   *  — when set, the system prompt biases the generator toward that
   *  format. */
  formatHint?: 'paragraph' | 'faq' | 'comparison' | 'how-to' | 'table' | 'list'
}

export interface GenerateArticleOutput {
  /** Generated Markdown body. */
  markdown: string
  /** Auto-graded against the 5 Semrush AI-citation pillars. */
  qualityScore: CitationQualityReport
  /** LLM provider + model that fulfilled the request. */
  provider: string
  model: string
  /** The system prompt we sent — useful for debugging / transparency. */
  systemPromptDigest: string
}

// Length → target word count band. Calibrated to Semrush's featured-
// snippet hub finding (top performers ~2.5k words for long-form) but
// scaled down for typical brand-content use.
const LENGTH_TARGET: Record<ArticleLength, { words: number; sections: number; faqs: number }> = {
  short: { words: 400, sections: 3, faqs: 3 },
  medium: { words: 800, sections: 4, faqs: 4 },
  long: { words: 1500, sections: 6, faqs: 5 },
}

const INTENT_LABEL: Record<ArticleIntent, string> = {
  B1: 'Brand & Competitor (comparative content focusing on the brand vs alternatives)',
  B2: 'Category Creation (educational content defining the category the brand operates in)',
  B3: 'Problem / JTBD (problem-solving content for the audience the brand serves)',
  B4: 'Buyer Intent / B2B (decision-stage content for buyers evaluating the brand)',
  B5: 'Compliance & Risk (trust-building content around legal / security / data handling)',
}

const FORMAT_HINT_INSTRUCTION: Record<NonNullable<GenerateArticleInput['formatHint']>, string> = {
  paragraph: 'Lead with a 40-60 word direct-answer paragraph after the first H2 question.',
  faq: 'Build the body around 4-6 FAQ pairs (H2 = question, paragraph = direct answer ≤60 words each). Schema.org FAQPage JSON-LD will wrap these downstream.',
  comparison:
    'Include a Markdown comparison table early in the body (≥5 rows OR ≥7 columns) comparing the brand against 2-3 named competitors on concrete attributes.',
  'how-to':
    'Build the body as a numbered list of ≥8 steps. Each step is one sentence (action verb first) + one sentence of detail.',
  table:
    'Include a Markdown data table early in the body (≥5 rows) with clear column headers and numeric values where possible.',
  list: 'Build the body as a bulleted list of ≥8 items, each with a short label and one sentence of detail. Order from most to least important.',
}

/** Build the system prompt that encodes the 5 Semrush AI-citation
 *  signals as hard constraints. Exported for unit tests. */
export function buildArticleSystemPrompt(input: GenerateArticleInput): string {
  const { brand, intent, length, formatHint } = input
  const target = LENGTH_TARGET[length]
  const lines: string[] = []

  lines.push(
    'You write Markdown articles optimised for AI search citation by ChatGPT, Google AI Mode, Perplexity, and Claude.',
  )
  lines.push('')
  lines.push('## Hard Constraints (every article must satisfy ALL)')
  lines.push('')
  lines.push(
    `1. **Lead with the answer.** Open with a 40-60 word TL;DR paragraph that includes the literal phrase "Key takeaway:" and starts with a definitional sentence ("X is …").`,
  )
  lines.push(
    `2. **Section structure.** Use at least ${target.sections} H2 question-style headings (e.g. "How does X work?", "What does X cost?"). Each H2 is followed by a paragraph of 40-60 words that directly answers the question.`,
  )
  lines.push(
    `3. **Q&A format.** End with an H2 "## Frequently Asked Questions" containing exactly ${target.faqs} Q/A pairs as H3 questions followed by 1-paragraph answers.`,
  )
  lines.push(
    `4. **Authoritative sourcing.** Include at least 2 outbound Markdown links to authoritative sources (Wikipedia, government / academic / standards bodies). Cite them inline like "[1]" or "(source: …)" near the claim.`,
  )
  lines.push(
    `5. **Readability.** Target ~7th-8th grade reading level. Short sentences. Plain English (or the target locale equivalent).`,
  )
  lines.push(
    `6. **Lists / tables.** Include at least one bulleted list (≥5 items) OR one Markdown table (≥5 rows) within the body — beyond the FAQ block.`,
  )
  lines.push(`7. **Target length:** approximately ${target.words} words ±20%.`)
  lines.push('')

  if (formatHint) {
    lines.push('## Primary format')
    lines.push(FORMAT_HINT_INSTRUCTION[formatHint])
    lines.push('')
  }

  lines.push('## Brand profile')
  lines.push(`- Name: ${brand.name}`)
  if (brand.domain) lines.push(`- Domain: ${brand.domain}`)
  if (brand.industry) lines.push(`- Industry: ${brand.industry}`)
  if (brand.description) lines.push(`- Description: ${brand.description.slice(0, 400)}`)
  if (brand.aliases && brand.aliases.length > 0) {
    lines.push(`- Aliases: ${brand.aliases.join(', ')}`)
  }
  if (brand.competitors && brand.competitors.length > 0) {
    lines.push(`- Competitors (cite by name only when relevant): ${brand.competitors.join(', ')}`)
  }
  if (brand.sameAs && brand.sameAs.length > 0) {
    lines.push(`- Verified identities (sameAs): ${brand.sameAs.slice(0, 5).join(', ')}`)
  }
  if (brand.disambiguation) {
    lines.push(`- Disambiguation: ${brand.disambiguation.slice(0, 300)}`)
  }
  if (brand.citationFormat) {
    lines.push(`- Preferred citation format: ${brand.citationFormat}`)
  }
  if (brand.legalId) {
    lines.push(`- Legal identifier (${brand.legalIdType ?? 'other'}): ${brand.legalId}`)
  }
  lines.push('')

  lines.push(`## Article intent`)
  lines.push(`Intent bucket: **${intent}** — ${INTENT_LABEL[intent]}`)
  lines.push('')

  lines.push('## Output')
  lines.push('Return Markdown only. No prose before or after, no code fences.')
  lines.push('Start with an H1 title; end with the FAQ block.')

  return lines.join('\n')
}

/** Strip incidental wrappers (code fences, leading prose) the LLM might
 *  add despite instructions. Exported for unit tests. */
export function sanitiseMarkdown(raw: string): string {
  let text = raw.trim()
  // Strip leading "```markdown" / "```md" / "```" fences.
  text = text.replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n```\s*$/i, '')
  // Some models prepend "Here's the article:\n\n" — drop a leading
  // paragraph if it's plain prose without a heading marker.
  if (!text.startsWith('#') && text.includes('\n#')) {
    text = text.slice(text.indexOf('\n#') + 1)
  }
  return text.trim()
}

/** Minimal HTML rendering of headings + lists for the citation-quality
 *  scorer. The scorer's HTML pillar (structured-data) needs JSON-LD
 *  blocks to score — we don't emit them from the LLM, so that pillar
 *  stays low until the operator paste-publishes with a JSON-LD wrapper.
 *  Headings + lists score against the markdown side just fine. */
function markdownToScannableHtml(md: string): string {
  // Convert ## headings → <h2>, lists → <ul><li>. Crude but enough for
  // the scorer's regex-based heuristics to recognise structure.
  return md
    .replace(/^#### (.*)$/gm, '<h4>$1</h4>')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/((?:^[-*]\s+.+\n?)+)/gm, (block) => {
      const items = block
        .trim()
        .split('\n')
        .map((l) => `<li>${l.replace(/^[-*]\s+/, '').trim()}</li>`)
        .join('')
      return `<ul>${items}</ul>`
    })
    .replace(/((?:^\d+\.\s+.+\n?)+)/gm, (block) => {
      const items = block
        .trim()
        .split('\n')
        .map((l) => `<li>${l.replace(/^\d+\.\s+/, '').trim()}</li>`)
        .join('')
      return `<ol>${items}</ol>`
    })
}

/** Generate one article. Accepts an injected `llmCaller` so unit tests
 *  can mock the LLM boundary cheaply. The default uses the resilient
 *  provider-chain from prompt-generator-ai. */
export async function generateArticle(
  input: GenerateArticleInput,
  llmCaller: (
    system: string,
    user: string,
  ) => Promise<{ text: string; provider: string; model: string }> = callLLM,
): Promise<GenerateArticleOutput> {
  const systemPrompt = buildArticleSystemPrompt(input)
  const userPrompt = `Topic: ${input.topic}\n\nWrite the article in ${input.brand.locale ?? 'en'} locale.`

  const result = await llmCaller(systemPrompt, userPrompt)
  const markdown = sanitiseMarkdown(result.text)

  // Auto-score against the 5 Semrush AI-citation pillars. We pass both
  // the markdown (for text-mode signals: clarity, EEAT, Q&A patterns)
  // AND a derived scannable HTML (for structure pillar to see headings
  // + lists). Structured-data pillar stays low — operators wrap the
  // article in JSON-LD at publish time.
  const qualityScore = scoreCitationQuality({
    text: markdown,
    html: markdownToScannableHtml(markdown),
  })

  return {
    markdown,
    qualityScore,
    provider: result.provider,
    model: result.model,
    systemPromptDigest: systemPrompt.slice(0, 280) + (systemPrompt.length > 280 ? '…' : ''),
  }
}
