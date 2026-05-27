// PATH: src/lib/utils/aeo-content-lint.ts
//
// AEO content lint — flags the anti-patterns industry research calls out in the
// "How We're Driving LLM Visibility at industry research" playbook on EXISTING
// content. The sibling at services/aeo-snippets.ts enforces the same
// rules at GENERATION time; this one audits content you already have.
//
// Rules:
//   • heading-not-answered  — section's first sentence doesn't restate the
//                              heading subject. "What Is AI Visibility?"
//                              should be answered with "AI visibility is …",
//                              not "When thinking about modern search …".
//   • unclear-antecedent    — section opens with a bare pronoun + auxiliary,
//                              e.g. "It updates daily." (What's "it"?)
//   • analogy-or-metaphor   — phrases like "north star", "guiding ships
//                              through digital fog" — LLMs strip these as
//                              noise; literal claims survive.
//   • vague-claim           — qualitative qualifier ("significantly",
//                              "dramatically") with no number anywhere in
//                              the same sentence.
//
// Pure, regex-only, zero dependencies. Pairs with citation-worthiness.ts
// (what the page IS) — this scores HOW the page reads to an extractor.

export type AeoLintRule =
  | 'heading-not-answered'
  | 'unclear-antecedent'
  | 'analogy-or-metaphor'
  | 'vague-claim'

export type AeoLintSeverity = 'low' | 'medium' | 'high'

export interface AeoLintIssue {
  rule: AeoLintRule
  severity: AeoLintSeverity
  message: string
  /** Heading of the section the issue falls in (null = before any heading). */
  section: string | null
  /** Verbatim snippet of the offending text (clipped to ~140 chars). */
  excerpt: string
}

export interface AeoLintResult {
  /** 0–100, higher = cleaner. Penalties subtracted from 100, floored at 0. */
  score: number
  issues: AeoLintIssue[]
  byRule: Record<AeoLintRule, number>
  /** Number of section blocks the linter walked (excluding empty ones). */
  sectionsScanned: number
}

export interface AeoLintInput {
  /** Raw HTML. Either html or markdown must be provided (markdown wins if both). */
  html?: string
  /** Raw Markdown. */
  markdown?: string
}

// ─── Normalisation ──────────────────────────────────────────────────────────

interface Block {
  /** Section heading text, or null for content before the first heading. */
  heading: string | null
  /** Heading level — 0 means "preamble before any heading". */
  level: 0 | 2 | 3
  /** Flattened plain-text body of the section (post tag-strip). */
  body: string
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function htmlToBlocks(html: string): Block[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')

  const headings: { level: 2 | 3; text: string; start: number; end: number }[] = []
  const re = /<(h[23])\b[^>]*>([\s\S]*?)<\/\1>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(cleaned)) !== null) {
    headings.push({
      level: m[1]!.toLowerCase() === 'h2' ? 2 : 3,
      text: stripTags(m[2] ?? ''),
      start: m.index,
      end: m.index + m[0].length,
    })
  }

  if (headings.length === 0) {
    return [{ heading: null, level: 0, body: stripTags(cleaned) }]
  }
  const blocks: Block[] = []
  if (headings[0]!.start > 0) {
    blocks.push({ heading: null, level: 0, body: stripTags(cleaned.slice(0, headings[0]!.start)) })
  }
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]!
    const nextStart = i + 1 < headings.length ? headings[i + 1]!.start : cleaned.length
    blocks.push({
      heading: h.text,
      level: h.level,
      body: stripTags(cleaned.slice(h.end, nextStart)),
    })
  }
  return blocks
}

function markdownToBlocks(md: string): Block[] {
  const blocks: Block[] = []
  let current: Block = { heading: null, level: 0, body: '' }
  const flush = () => {
    current.body = current.body.replace(/\s+/g, ' ').trim()
    blocks.push(current)
  }
  for (const raw of md.split(/\r?\n/)) {
    const h = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(raw)
    if (h) {
      flush()
      current = {
        heading: h[2]!.trim(),
        level: h[1]!.length === 2 ? 2 : 3,
        body: '',
      }
    } else {
      current.body += ' ' + raw
    }
  }
  flush()
  return blocks
}

// ─── Rule helpers ───────────────────────────────────────────────────────────

const QUESTION_PREFIX_RE =
  /^(what|why|how|when|where|who|which|is|are|does|do|can|should|will)\s+(.+?)\??\s*$/i

const HEADING_STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'do',
  'does',
  'can',
  'should',
  'will',
  'of',
  'and',
  'or',
  'to',
  'for',
  'in',
  'on',
  'with',
  'you',
  'your',
  'our',
  'my',
  'we',
  'i',
  'it',
  'they',
  'this',
  'that',
  'these',
  'those',
  'he',
  'she',
  'him',
  'her',
  'them',
])

/** Strip the leading question word so "What Is AI Visibility?" → "AI Visibility". */
function extractHeadingSubject(heading: string): string | null {
  const trimmed = heading.replace(/[?!:.]+$/, '').trim()
  const q = QUESTION_PREFIX_RE.exec(trimmed)
  if (q) {
    return q[2]!.replace(/^(is|are|does|do|can|should|will)\s+/i, '').trim() || null
  }
  return trimmed || null
}

/** Tokenise to a set of word-boundary lowercased terms, ≥2 chars, non-stopword. */
function keywordSet(subject: string): Set<string> {
  const out = new Set<string>()
  for (const tok of subject.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (tok.length >= 2 && !HEADING_STOPWORDS.has(tok)) out.add(tok)
  }
  return out
}

function firstSentence(text: string): string {
  if (!text) return ''
  const m = /^([^.!?]{1,400}[.!?])/.exec(text)
  return (m ? m[1]! : text).trim()
}

function sentenceTokens(text: string): Set<string> {
  const out = new Set<string>()
  for (const tok of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
    if (tok) out.add(tok)
  }
  return out
}

// ─── Rules ──────────────────────────────────────────────────────────────────

/** Bare pronoun + auxiliary/common verb at section start. Doesn't fire on
 *  "this guide" / "these tools" (pronoun followed by a noun). */
const ANTECEDENT_OPENER_RE =
  /^\s*(it|they|this|that|these|those)\s+(?:is|are|was|were|has|have|had|will|would|can|could|should|may|might|must|do|does|did|seems|appears|works|matters|means|enables|provides|tracks|shows|updates|builds|generates|surfaces|reveals)\b/i

const ANALOGY_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /\bnorth star\b/i, reason: '"north star" metaphor' },
  { re: /\bcompass\b/i, reason: '"compass" metaphor' },
  { re: /\blighthouse\b/i, reason: '"lighthouse" metaphor' },
  { re: /\bguiding (?:ships|the way)\b/i, reason: '"guiding ships" metaphor' },
  { re: /\bdigital fog\b/i, reason: '"digital fog" metaphor' },
  { re: /\bthe heart of\b/i, reason: '"the heart of" metaphor' },
  { re: /\bthe engine of\b/i, reason: '"the engine of" metaphor' },
  { re: /\b(?:is|are)\s+like\s+a\b/i, reason: 'simile "is/are like a"' },
  { re: /\bas if it (?:were|was)\b/i, reason: 'simile "as if it were"' },
  { re: /\bthink of (?:it|this) as\b/i, reason: 'simile "think of it/this as"' },
  { re: /\bswiss army knife\b/i, reason: '"Swiss army knife" cliché' },
]

const VAGUE_QUALIFIERS = [
  'significantly',
  'dramatically',
  'substantially',
  'considerably',
  'extensively',
  'tremendously',
  'enormously',
  'remarkably',
  'meaningfully',
  'massively',
  'drastically',
]

const HAS_NUMBER_RE = /\d/

function clip(s: string, n = 140): string {
  const flat = s.replace(/\s+/g, ' ').trim()
  return flat.length > n ? flat.slice(0, n - 1) + '…' : flat
}

function checkHeadingAnswered(block: Block, push: (i: AeoLintIssue) => void) {
  if (!block.heading) return
  const subject = extractHeadingSubject(block.heading)
  if (!subject) return
  const kws = keywordSet(subject)
  if (kws.size === 0) return
  const first = firstSentence(block.body)
  if (!first) return
  const firstTokens = sentenceTokens(first)
  for (const kw of kws) {
    if (firstTokens.has(kw)) return // at least one subject term restated — OK
  }
  push({
    rule: 'heading-not-answered',
    severity: 'high',
    message: `Section "${clip(block.heading, 80)}" — first sentence doesn't restate the subject ("${subject}").`,
    section: block.heading,
    excerpt: clip(first),
  })
}

function checkAntecedent(block: Block, push: (i: AeoLintIssue) => void) {
  // Only fire inside a real section — a preamble starting with "This article…"
  // is fine because the antecedent is the article itself.
  if (!block.heading) return
  const first = firstSentence(block.body)
  if (!first) return
  if (ANTECEDENT_OPENER_RE.test(first)) {
    push({
      rule: 'unclear-antecedent',
      severity: 'medium',
      message:
        'Section opens with a bare pronoun + verb — the referent sits in the previous section, which LLMs may not carry over.',
      section: block.heading,
      excerpt: clip(first),
    })
  }
}

function checkAnalogies(block: Block, push: (i: AeoLintIssue) => void) {
  for (const { re, reason } of ANALOGY_PATTERNS) {
    const m = re.exec(block.body)
    if (m) {
      const around = block.body.slice(Math.max(0, m.index - 40), m.index + 100)
      push({
        rule: 'analogy-or-metaphor',
        severity: 'low',
        message: `Analogy/metaphor (${reason}) — LLMs prefer literal claims.`,
        section: block.heading,
        excerpt: clip(around),
      })
    }
  }
}

function checkVagueClaims(block: Block, push: (i: AeoLintIssue) => void) {
  const sentences = block.body.match(/[^.!?]{4,300}[.!?]/g) ?? (block.body ? [block.body] : [])
  for (const s of sentences) {
    const lower = s.toLowerCase()
    const hit = VAGUE_QUALIFIERS.find((w) => new RegExp(`\\b${w}\\b`).test(lower))
    if (hit && !HAS_NUMBER_RE.test(s)) {
      push({
        rule: 'vague-claim',
        severity: 'medium',
        message: `Vague qualifier "${hit}" without numeric proof in the same sentence.`,
        section: block.heading,
        excerpt: clip(s),
      })
    }
  }
}

// ─── Public entry point ─────────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<AeoLintSeverity, number> = {
  low: 2,
  medium: 4,
  high: 8,
}

export function lintAeoContent(input: AeoLintInput): AeoLintResult {
  const blocks =
    typeof input.markdown === 'string'
      ? markdownToBlocks(input.markdown)
      : typeof input.html === 'string'
        ? htmlToBlocks(input.html)
        : []

  const issues: AeoLintIssue[] = []
  const push = (i: AeoLintIssue) => issues.push(i)

  let scanned = 0
  for (const block of blocks) {
    if (!block.body && !block.heading) continue
    scanned++
    checkHeadingAnswered(block, push)
    checkAntecedent(block, push)
    checkAnalogies(block, push)
    checkVagueClaims(block, push)
  }

  const byRule: Record<AeoLintRule, number> = {
    'heading-not-answered': 0,
    'unclear-antecedent': 0,
    'analogy-or-metaphor': 0,
    'vague-claim': 0,
  }
  let penalty = 0
  for (const issue of issues) {
    byRule[issue.rule]++
    penalty += SEVERITY_WEIGHT[issue.severity]
  }

  return {
    score: Math.max(0, 100 - penalty),
    issues,
    byRule,
    sectionsScanned: scanned,
  }
}
