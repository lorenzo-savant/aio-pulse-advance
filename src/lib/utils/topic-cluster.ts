// PATH: src/lib/utils/topic-cluster.ts
//
// Pillar + cluster planner. Given a core topic and a flat list of
// AI-generated sub-questions (e.g. from query-fanout.ts), groups them
// into a pillar page + N cluster pages, where each cluster is anchored
// on the most-frequent content term shared by its questions.
//
// Closes the gap from the Semrush "Query Fan-Out" piece:
//   "Topic clusters are groups of interlinked webpages [...]. Topic
//    clustering helps you to address multiple queries that may be
//    generated through relevant query fan-outs."
//
// The util reuses the same fold + stop-word logic as query-fanout so a
// question that the fan-out scorer treats as "kicks off term X" is also
// the question that lands in cluster X.
//
// Pure — no network, no LLM, no dependency. If the caller passes the
// page HTML, we additionally score each cluster's coverage by deferring
// to scoreFanoutCoverage; otherwise coverage is null.

import { scoreFanoutCoverage, extractContentSections } from './query-fanout'

const STOP_WORDS = new Set([
  // en
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
  'best',
  'good',
  'better',
  'top',
  // it
  'come',
  'perche',
  'quale',
  'quali',
  'quando',
  'dove',
  'cosa',
  'sono',
  'molto',
  'piu',
  // sv
  'vad',
  'hur',
  'varför',
  'när',
  'vilken',
  'vilka',
  'finns',
  'mest',
])

function fold(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
}

function termsForQuestion(question: string): string[] {
  return fold(question)
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

export interface ClusterNode {
  /** Canonical anchor term (lower-case, folded) used to identify the cluster. */
  subtopic: string
  /** Display form — first letter capitalized, original diacritics best-effort. */
  label: string
  /** Sub-questions assigned to this cluster, original casing. */
  questions: string[]
  /** Fan-out coverage % for this cluster's questions when html is provided, else null. */
  coverage: number | null
  verdict: 'strong' | 'partial' | 'weak' | 'unknown'
}

export interface TopicClusterPlan {
  pillar: {
    topic: string
    /** Total sub-questions handed in (cluster + uncategorized). */
    totalQuestions: number
    /** Overall fan-out coverage % across ALL questions when html provided, else null. */
    coverage: number | null
    verdict: 'strong' | 'partial' | 'weak' | 'unknown'
    /** H2/H3 headings discovered on the pillar page when html provided. */
    headings: string[]
  }
  clusters: ClusterNode[]
  /** Questions that didn't share an anchor with any cluster. */
  uncategorized: string[]
}

interface PlanOptions {
  /** Raw HTML of the pillar page — enables coverage scoring. */
  html?: string
  /** Cap on cluster count. Default 5. */
  maxClusters?: number
  /** Minimum questions a cluster must hold to be kept. Default 2. */
  minClusterSize?: number
}

/**
 * Build a pillar + cluster plan from a core topic and a flat list of
 * fan-out sub-questions.
 *
 * Algorithm:
 *   1. Count the frequency of every meaningful content term across all
 *      sub-questions, excluding terms that already appear in the core
 *      topic (they're the pillar's responsibility, not a cluster's).
 *   2. Take the top `maxClusters` most-frequent terms as cluster anchors.
 *   3. Assign each question to the first anchor term it contains, ranked
 *      by anchor frequency (the strongest cluster wins ties).
 *   4. Drop clusters smaller than `minClusterSize` and surface their
 *      questions in `uncategorized`.
 *   5. When `html` is provided, score per-cluster + overall coverage by
 *      delegating to scoreFanoutCoverage.
 */
export function planTopicCluster(
  coreTopic: string,
  subQuestions: string[],
  options: PlanOptions = {},
): TopicClusterPlan {
  const { html, maxClusters = 5, minClusterSize = 2 } = options
  const coreTerms = new Set(termsForQuestion(coreTopic))

  // 1) Frequency map across all sub-questions, ignoring core-topic terms.
  const freq = new Map<string, number>()
  const questionTerms: Array<{ q: string; terms: string[] }> = subQuestions.map((q) => {
    const terms = termsForQuestion(q).filter((t) => !coreTerms.has(t))
    for (const t of terms) freq.set(t, (freq.get(t) ?? 0) + 1)
    return { q, terms }
  })

  // 2) Pick anchor terms — only those that appear in ≥ minClusterSize
  // questions are eligible, then trim to maxClusters by descending freq.
  // Tie-break alphabetically for deterministic output.
  const anchors = Array.from(freq.entries())
    .filter(([, n]) => n >= minClusterSize)
    .sort((a, b) => (b[1] - a[1] !== 0 ? b[1] - a[1] : a[0].localeCompare(b[0])))
    .slice(0, maxClusters)
    .map(([term]) => term)

  // 3) Assign each question to its best anchor (= first anchor in the
  // priority order that the question contains).
  const buckets = new Map<string, string[]>()
  for (const a of anchors) buckets.set(a, [])
  const uncategorized: string[] = []
  for (const { q, terms } of questionTerms) {
    const set = new Set(terms)
    const hit = anchors.find((a) => set.has(a))
    if (hit) buckets.get(hit)!.push(q)
    else uncategorized.push(q)
  }

  // 4) Drop clusters that ended up below the minimum; their questions
  // fall back to uncategorized so the operator can see them.
  const clusters: ClusterNode[] = []
  for (const anchor of anchors) {
    const qs = buckets.get(anchor)!
    if (qs.length < minClusterSize) {
      uncategorized.push(...qs)
      continue
    }
    let coverage: number | null = null
    let verdict: ClusterNode['verdict'] = 'unknown'
    if (html) {
      const r = scoreFanoutCoverage(html, qs)
      coverage = r.coverage
      verdict = r.verdict
    }
    clusters.push({
      subtopic: anchor,
      label: anchor.charAt(0).toUpperCase() + anchor.slice(1),
      questions: qs,
      coverage,
      verdict,
    })
  }

  // 5) Pillar-level coverage = ALL questions (incl. uncategorized) against
  // the pillar HTML when provided. This is the headline metric.
  let pillarCoverage: number | null = null
  let pillarVerdict: TopicClusterPlan['pillar']['verdict'] = 'unknown'
  let headings: string[] = []
  if (html) {
    const r = scoreFanoutCoverage(html, subQuestions)
    pillarCoverage = r.coverage
    pillarVerdict = r.verdict
    headings = extractContentSections(html)
      .map((s) => s.heading)
      .filter((h) => h && h !== '(no headings)')
  }

  return {
    pillar: {
      topic: coreTopic,
      totalQuestions: subQuestions.length,
      coverage: pillarCoverage,
      verdict: pillarVerdict,
      headings,
    },
    clusters,
    uncategorized,
  }
}
