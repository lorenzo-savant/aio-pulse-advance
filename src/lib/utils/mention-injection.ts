// PATH: src/lib/utils/mention-injection.ts
//
// Brand-mention injection-opportunity finder.
//
// Inverts brand-mention.ts: instead of flagging WHERE the brand IS cited,
// this surfaces pages where the brand SHOULD be cited but isn't — owned
// content discussing brand-relevant topics that fails to namedrop the
// brand or product. From the industry research "How We're Driving LLM Visibility"
// playbook, step 3: "audit existing content for injection opportunities…
// content that already discusses the problems your tools solve".
//
// Pure, regex-only, no I/O — pairs with safe-fetch in the API route.
// Reuses detectBrandMention so the absence test stays consistent with
// the deterministic detection pass used everywhere else in the app.

import { detectBrandMention, type BrandMatchInput } from '@/lib/services/brand-mention'

export interface InjectionPageInput {
  url: string
  title?: string | null
  /** Plain text body. If absent, html is stripped to derive it. */
  text?: string
  html?: string
}

export interface InjectionInput {
  pages: InjectionPageInput[]
  brand: BrandMatchInput
  /** Topic phrases that make a page brand-relevant. Whole-word, case-insensitive.
   *  e.g. ["AI visibility", "share of voice", "LLM citations"]. */
  topics: string[]
  /** Hard cap on opportunities returned (sorted by priority desc). Default 50. */
  limit?: number
}

export interface InjectionOpportunity {
  url: string
  title: string | null
  /** Distinct topics that matched, ordered by first appearance in the page. */
  matchedTopics: string[]
  /** Total topic-phrase hits across the page (sum across all topics). */
  topicHitCount: number
  /** Sentence containing the earliest topic hit — the natural anchor for the injection. */
  suggestedAnchor: string
  /** 0–100 priority. More distinct topics + earlier hit + higher frequency rank higher. */
  priority: number
}

export interface InjectionFinderResult {
  opportunities: InjectionOpportunity[]
  scanned: number
  /** Pages skipped because the brand is already mentioned. */
  alreadyCovered: number
  /** Pages skipped because no topic matched. */
  notRelevant: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function pageText(page: InjectionPageInput): string {
  if (typeof page.text === 'string' && page.text.length > 0) return page.text
  if (typeof page.html === 'string') return stripHtml(page.html)
  return ''
}

/** Sentence containing `charIndex`. Walks back to the previous . ! ? or start,
 *  forward to the next . ! ? or end. Clipped to 300 chars. */
function sentenceAround(text: string, charIndex: number): string {
  if (!text || charIndex < 0) return ''
  let start = charIndex
  while (start > 0 && !/[.!?\n]/.test(text[start - 1] ?? '')) start--
  let end = charIndex
  while (end < text.length && !/[.!?\n]/.test(text[end] ?? '')) end++
  if (end < text.length) end++ // include the terminator
  const sentence = text.slice(start, end).trim()
  return sentence.length > 300 ? sentence.slice(0, 299) + '…' : sentence
}

interface TopicHit {
  topic: string
  count: number
  firstIndex: number
}

function findTopicHits(text: string, topics: string[]): TopicHit[] {
  const hits: TopicHit[] = []
  for (const raw of topics) {
    const topic = raw.trim()
    if (!topic) continue
    // Word-boundary match for the whole phrase. Unicode-aware so multi-word
    // topics like "AI visibility" match exactly once per occurrence.
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(topic)}(?![\\p{L}\\p{N}])`, 'giu')
    let count = 0
    let firstIndex = -1
    for (const m of text.matchAll(re)) {
      count++
      if (firstIndex === -1) firstIndex = m.index ?? -1
    }
    if (count > 0 && firstIndex >= 0) {
      hits.push({ topic, count, firstIndex })
    }
  }
  return hits
}

/** 0–100 priority: distinct-topic base + position boost + frequency boost. */
function scorePriority(
  distinctTopics: number,
  totalHits: number,
  firstIndex: number,
  textLength: number,
): number {
  // Base: more unique topics = stronger relevance signal.
  const base = Math.min(distinctTopics * 20, 60)
  // Position boost: earlier first hit = better injection anchor.
  let position = 0
  if (textLength > 0) {
    const ratio = firstIndex / textLength
    if (ratio < 0.25) position = 20
    else if (ratio < 0.5) position = 12
    else if (ratio < 0.75) position = 6
    else position = 0
  }
  // Frequency boost: log-scaled so a single keyword-stuffed page can't dominate.
  const frequency = Math.min(20, Math.round(Math.log2(1 + totalHits) * 4))
  return Math.max(0, Math.min(100, base + position + frequency))
}

// ─── Public entry point ─────────────────────────────────────────────────────

export function findMentionInjectionOpportunities(input: InjectionInput): InjectionFinderResult {
  const limit = Math.max(1, input.limit ?? 50)
  const opportunities: InjectionOpportunity[] = []
  let alreadyCovered = 0
  let notRelevant = 0
  let scanned = 0

  for (const page of input.pages) {
    if (!page?.url) continue
    const text = pageText(page)
    if (!text) {
      notRelevant++
      continue
    }
    scanned++

    const mention = detectBrandMention(text, input.brand)
    if (mention.brandMentioned) {
      alreadyCovered++
      continue
    }

    const hits = findTopicHits(text, input.topics)
    if (hits.length === 0) {
      notRelevant++
      continue
    }

    hits.sort((a, b) => a.firstIndex - b.firstIndex)
    const matchedTopics = hits.map((h) => h.topic)
    const totalHits = hits.reduce((s, h) => s + h.count, 0)
    const firstIndex = hits[0]!.firstIndex
    const anchor = sentenceAround(text, firstIndex)
    const priority = scorePriority(matchedTopics.length, totalHits, firstIndex, text.length)

    opportunities.push({
      url: page.url,
      title: page.title ?? null,
      matchedTopics,
      topicHitCount: totalHits,
      suggestedAnchor: anchor,
      priority,
    })
  }

  opportunities.sort((a, b) => b.priority - a.priority || b.topicHitCount - a.topicHitCount)
  return {
    opportunities: opportunities.slice(0, limit),
    scanned,
    alreadyCovered,
    notRelevant,
  }
}
