// PATH: src/lib/services/deep-research.ts
//
// Deep Research service — a native-TS realization of the gpt-researcher
// pattern (planner → execution → publisher) evaluated in
// docs/research/tooling-repos-2026-08.md. gpt-researcher itself is a Python
// microservice; this is the same shape reusing the providers already in the
// app (callLLM chain + Brave web search + SSRF-safe page fetch), so there is
// no new runtime to deploy and nothing to break in the monitoring pipeline.
//
// Flow:
//   1. planner    — callLLM breaks the topic into 3-5 focused sub-questions.
//   2. execution  — for each sub-question, Brave top results are fetched and
//                   the top pages are scraped (SSRF-guarded, size-capped).
//   3. publisher  — callLLM synthesizes a Markdown report with numbered
//                   citations `[n]` mapped to the source URLs.
//
// Soft-fail by design: every stage is optional/defensive — if Brave fails we
// still publish a report from what the planner/scraper gathered; if the LLM
// chain is unconfigured the whole call rejects loudly (the route guards it).
//
// Pure-ish: the LLM boundary accepts an injected `llmCaller` and the search
// boundary an injected `searchFn`, so unit tests never touch the network.

import { callLLM, type LLMCall } from '@/lib/services/prompt-generator-ai'
import { fetchWebResults, type BraveOrganicResult } from '@/lib/services/brave-search'
import { fetchUrlContent } from '@/lib/services/gemini'
import { cleanCitations, normalizeCitation } from '@/lib/services/citation-grounding'
import { logger } from '@/lib/logger'

export interface DeepResearchSource {
  url: string
  title: string
  /** First ~1200 chars of readable page text, or null if the page couldn't be read. */
  excerpt: string | null
  /** Sub-question this source was retrieved for. */
  forSubQuestion: string
}

export interface DeepResearchResult {
  /** Final synthesized Markdown report. */
  report: string
  /** Sources, deduped by normalized URL, in the order they are cited. */
  sources: DeepResearchSource[]
  /** The sub-questions the planner generated. */
  subQuestions: string[]
  provider: string
  model: string
}

export interface DeepResearchDeps {
  /** Defaults to the shared callLLM chain (Groq → Cerebras → … → OpenAI). */
  llmCaller?: (systemPrompt: string, userPrompt: string) => Promise<LLMCall>
  /** Defaults to Brave web search. Returns top results for a query. */
  searchFn?: (query: string, language?: string, count?: number) => Promise<BraveOrganicResult[]>
  /** Defaults to the SSRF-guarded page fetcher (8k chars cap). */
  pageFetcher?: (url: string) => Promise<string>
  /** Cap on sources kept after dedup. Default 12. */
  maxSources?: number
}

const DEFAULT_SUB_QUESTIONS = 4
const MAX_SUB_QUESTIONS = 6
const MAX_PAGES_PER_SUB_QUESTION = 3
const MAX_CITED_SOURCES = 12

// ─── Planner ────────────────────────────────────────────────────────────────

/**
 * Ask the planner to decompose a research topic into sub-questions. Returns an
 * array of question strings (≤ 6). Soft-fails to `[topic]` so a planner hiccup
 * still lets the pipeline run on the single broad question.
 */
export async function planResearch(
  topic: string,
  llmCaller: NonNullable<DeepResearchDeps['llmCaller']> = callLLM,
  maxQuestions = DEFAULT_SUB_QUESTIONS,
): Promise<string[]> {
  const systemPrompt = [
    'You are a research director. Given a broad research topic, produce a focused set of sub-questions whose answers, combined, fully cover the topic.',
    'Rules:',
    `- Output exactly ${maxQuestions} questions, each on its own line.`,
    '- Questions must be answerable from public web sources.',
    '- No numbering, no bullets, no prose — just the questions, one per line.',
    '- Keep each question under 40 words.',
  ].join('\n')

  const raw = (await llmCaller(systemPrompt, `Research topic: ${topic}`)).text
  const questions = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*])\s*/, ''))
    .filter((l) => l.length > 3 && l.length <= 160)

  if (questions.length === 0) return [topic]
  return questions.slice(0, MAX_SUB_QUESTIONS)
}

// ─── Execution ──────────────────────────────────────────────────────────────

async function gatherForSubQuestion(
  subQuestion: string,
  searchFn: NonNullable<DeepResearchDeps['searchFn']>,
  pageFetcher: NonNullable<DeepResearchDeps['pageFetcher']>,
  language?: string,
): Promise<DeepResearchSource[]> {
  const results = await searchFn(subQuestion, language, 6)
  if (results.length === 0) return []

  const sources: DeepResearchSource[] = []
  for (const r of results.slice(0, MAX_PAGES_PER_SUB_QUESTION)) {
    if (!r.url) continue
    let excerpt: string | null = null
    try {
      const text = await pageFetcher(r.url)
      excerpt = text.slice(0, 1200)
    } catch (err) {
      logger.debug('Deep research: page fetch skipped', {
        service: 'deep-research',
        url: r.url.slice(0, 100),
        err: err instanceof Error ? err.message : String(err),
      })
    }
    sources.push({
      url: r.url,
      title: r.title || r.url,
      excerpt,
      forSubQuestion: subQuestion,
    })
  }
  return sources
}

// ─── Publisher ──────────────────────────────────────────────────────────────

function buildPublisherPrompt(topic: string, sources: DeepResearchSource[]): string {
  const numbered = sources
    .map((s, i) => `[${i + 1}] ${s.title} — ${s.url}\n${s.excerpt ? `    > ${s.excerpt}` : ''}`)
    .join('\n\n')

  return [
    `Topic: ${topic}`,
    '',
    'Write a well-structured Markdown research report that answers the topic using ONLY the sources below.',
    'Requirements:',
    '- Start with an H1 title and a 2-3 sentence executive summary.',
    '- Use H2 sections; keep each section concise and factual.',
    '- Cite sources inline as [n] where [n] matches the numbered list below.',
    '- Do NOT invent facts that are not supported by the sources.',
    '- If a source was unreadable (no excerpt), do not rely on it for specific claims.',
    '',
    'Sources:',
    numbered,
  ].join('\n')
}

function dedupeSources(flat: DeepResearchSource[], max: number): DeepResearchSource[] {
  const cleaned = cleanCitations(
    flat.map((s) => s.url),
    { max },
  )
  // cleanCitations normalizes URLs (host lowercase, www dropped, tracking
  // params stripped); the surviving strings are the canonical forms. Keep the
  // FIRST source row whose raw URL normalizes into a surviving canonical URL.
  const canonical = new Set(cleaned)
  const seen = new Set<string>()
  const out: DeepResearchSource[] = []
  for (const s of flat) {
    const norm = normalizeCitation(s.url)
    if (!norm || !canonical.has(norm) || seen.has(norm)) continue
    seen.add(norm)
    out.push(s)
    if (out.length >= max) break
  }
  return out
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

/**
 * Run the full deep-research pipeline for a topic. Throws only when NO LLM
 * provider is configured (the API route surfaces that as a 503). All other
 * stages soft-fail into a best-effort report.
 */
export async function runDeepResearch(
  topic: string,
  opts: { language?: string } & DeepResearchDeps = {},
): Promise<DeepResearchResult> {
  const llmCaller = opts.llmCaller ?? callLLM
  const searchFn = opts.searchFn ?? fetchWebResults
  const pageFetcher = opts.pageFetcher ?? fetchUrlContent
  const maxSources = opts.maxSources ?? MAX_CITED_SOURCES

  const subQuestions = await planResearch(topic, llmCaller)

  const gathered = await Promise.all(
    subQuestions.map((q) => gatherForSubQuestion(q, searchFn, pageFetcher, opts.language)),
  )
  const sources = dedupeSources(gathered.flat(), maxSources)

  // If Brave yielded nothing, still produce a synthesis from model knowledge —
  // but without sources the report should say so explicitly.
  const publisherPrompt = buildPublisherPrompt(topic, sources)
  const published = await llmCaller(publisherPrompt, topic)

  return {
    report: published.text,
    sources,
    subQuestions,
    provider: published.provider,
    model: published.model,
  }
}

// ─── Forward-compat label (used by the API route / provider surface) ────────

export function deepResearchLabel(): string {
  return 'deep-research:ts'
}
