// PATH: src/lib/services/topic-finder.ts
//
// Topic Finder — clusters CitationCapture gap-list prompts into content
// opportunities. The input is "prompts where the AI mentioned the brand
// but cited OTHER hosts as authority"; the output is a ranked list of
// topic candidates the operator could write to flip those gaps into
// own-site citations.
//
// Lightweight n-gram clustering (no dependencies). For each gap prompt
// we:
//   1. Normalise (lowercase, drop punctuation, strip stopwords)
//   2. Emit 2-word + 3-word phrases as topic candidates
//   3. Count phrase frequency across the corpus
//   4. Group prompts by their top-frequency phrase
//   5. Rank clusters by frequency × engine diversity × competitor
//      domain count (=  "how many different competitors stole this slot")
//
// Pure + deterministic so it's unit-testable with synthetic gap rows.

export interface TopicInputRow {
  prompt_text: string | null
  engine: string | null
  /** Competitor / authority hosts the AI cited INSTEAD of the brand. */
  citedInstead: string[]
}

export interface TopicCluster {
  /** Surface label for the cluster — the highest-IDF phrase that
   *  represents it. Example: "best castingplattform stockholm". */
  topic: string
  /** Prompt examples that landed in this cluster (capped to 5). */
  examples: string[]
  /** Total gap prompts in this cluster. */
  promptCount: number
  /** Number of distinct AI engines where this gap was observed —
   *  high = the cluster is universal across engines, not engine-quirk. */
  engineCount: number
  /** Distinct competitor / authority hosts that claimed the slot. */
  competitorCount: number
  /** Top 3 hosts most often cited in this cluster, sorted by frequency. */
  topCompetitors: string[]
  /** Suggested content angle: paragraph snippet / FAQ block / table /
   *  comparison / how-to — derived from the cluster's question shape. */
  suggestedFormat: 'paragraph' | 'faq' | 'comparison' | 'how-to' | 'table' | 'list'
  /** 0-100 priority score = promptCount × engineCount × competitorCount,
   *  normalised across the cluster set so highest = 100. */
  priorityScore: number
}

export interface TopicFinderReport {
  totalGapPrompts: number
  clusters: TopicCluster[]
  /** Phrases we extracted but rejected because they were too generic
   *  ("brand x", "what is") — kept for transparency. */
  rejectedPhrases: string[]
}

// English + Italian + Swedish stopwords. Kept short — we only want to
// drop the high-frequency-zero-signal words. The longer this list, the
// more we accidentally suppress real topic keywords.
const STOPWORDS = new Set([
  // EN
  'the',
  'a',
  'an',
  'of',
  'to',
  'in',
  'on',
  'at',
  'for',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'should',
  'can',
  'could',
  'may',
  'might',
  'must',
  'and',
  'or',
  'but',
  'if',
  'then',
  'than',
  'as',
  'so',
  'that',
  'this',
  'these',
  'those',
  'it',
  'its',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
  'me',
  'my',
  'your',
  'his',
  'her',
  'our',
  'their',
  'what',
  'which',
  'who',
  'whom',
  'whose',
  'when',
  'where',
  'why',
  'how',
  'about',
  'from',
  'into',
  // IT
  'il',
  'lo',
  'la',
  'le',
  'gli',
  'i',
  'un',
  'una',
  'uno',
  'di',
  'da',
  'a',
  'in',
  'su',
  'per',
  'tra',
  'fra',
  'con',
  'è',
  'sono',
  'sei',
  'sei',
  'ho',
  'hai',
  'ha',
  'cosa',
  'come',
  'quando',
  'dove',
  'perché',
  'che',
  'chi',
  'quale',
  'quali',
  'questo',
  'quello',
  'questa',
  'quella',
  // SV
  'och',
  'eller',
  'i',
  'på',
  'till',
  'med',
  'av',
  'för',
  'om',
  'är',
  'var',
  'vad',
  'hur',
  'när',
  'vem',
  'varför',
  'vilken',
  'vilka',
  'det',
  'den',
  'en',
  'ett',
  'jag',
  'du',
  'han',
  'hon',
  'vi',
  'de',
])

/** Normalise a prompt into a list of significant tokens. Lowercase,
 *  drop diacritic-free punctuation, split on whitespace, filter
 *  stopwords + very short tokens. */
function tokenize(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .replace(/[?!.,;:()"'`\[\]{}<>]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
}

/** Build n-gram phrases of size 2 + 3 from a token list. */
function phrases(tokens: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < tokens.length - 1; i++) {
    out.push(`${tokens[i]} ${tokens[i + 1]}`)
    if (i < tokens.length - 2) {
      out.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`)
    }
  }
  return out
}

/** Detect the most likely content format for a cluster from the
 *  question shape of its prompts. Order matters — first match wins. */
function detectFormat(prompts: string[]): TopicCluster['suggestedFormat'] {
  const text = prompts.join(' \n ').toLowerCase()
  if (/\b(vs|versus|or|o\s+\w+|eller)\b/.test(text)) return 'comparison'
  if (/\b(how to|come|hur)\b/.test(text)) return 'how-to'
  if (/\b(price|pricing|cost|prezzo|costo|pris|kostnad)\b/.test(text)) return 'table'
  if (/\b(best|migliori?|bäst)\b/.test(text)) return 'list'
  if (/^(what|cosa|vad|chi|who)\b/m.test(text)) return 'faq'
  return 'paragraph'
}

/** Pick the most representative phrase from a cluster's phrase set —
 *  the longest one (3-gram preferred over 2-gram) with the highest
 *  inverse document frequency across the corpus. */
function pickLabel(
  clusterPhrases: Map<string, number>,
  corpusPhrases: Map<string, number>,
): string {
  let bestPhrase = ''
  let bestScore = -Infinity
  for (const [phrase, count] of clusterPhrases) {
    const corpusFreq = corpusPhrases.get(phrase) ?? 1
    // Score: length bonus (3-gram > 2-gram) × cluster-local frequency × IDF.
    const lengthBonus = phrase.split(' ').length
    const idf = Math.log((corpusPhrases.size + 1) / corpusFreq)
    const score = lengthBonus * count * Math.max(0.1, idf)
    if (score > bestScore) {
      bestScore = score
      bestPhrase = phrase
    }
  }
  return bestPhrase
}

export interface FindOptions {
  /** Min number of prompts a cluster needs to qualify (default 2). */
  minClusterSize?: number
  /** Max clusters in the final report (default 10). */
  maxClusters?: number
  /** Min token length per significant word (default 3). */
  minTokenLength?: number
}

/** Cluster gap prompts into content topics. */
export function findTopics(rows: TopicInputRow[], opts: FindOptions = {}): TopicFinderReport {
  const minClusterSize = opts.minClusterSize ?? 2
  const maxClusters = opts.maxClusters ?? 10

  const validRows = rows.filter((r) => r.prompt_text && r.prompt_text.trim().length >= 6)
  const totalGapPrompts = validRows.length

  if (totalGapPrompts === 0) {
    return { totalGapPrompts: 0, clusters: [], rejectedPhrases: [] }
  }

  // 1. Tokenise + emit phrases per prompt.
  const promptPhrases: Array<{ row: TopicInputRow; phrases: string[] }> = []
  const corpusFreq = new Map<string, number>()
  for (const r of validRows) {
    const tokens = tokenize(r.prompt_text!)
    const ps = Array.from(new Set(phrases(tokens))) // dedupe within a single prompt
    promptPhrases.push({ row: r, phrases: ps })
    for (const p of ps) corpusFreq.set(p, (corpusFreq.get(p) ?? 0) + 1)
  }

  // 2. Reject phrases that appear too rarely (1-prompt clusters are noise)
  //    OR too often (would group everything together).
  const tooRareCutoff = minClusterSize
  const tooCommonCutoff = Math.max(minClusterSize, Math.ceil(totalGapPrompts * 0.85))
  const candidatePhrases = new Map<string, number>()
  const rejectedPhrases: string[] = []
  for (const [phrase, count] of corpusFreq) {
    if (count < tooRareCutoff) continue
    if (count > tooCommonCutoff) {
      rejectedPhrases.push(`${phrase} (too generic — appears in ${count}/${totalGapPrompts})`)
      continue
    }
    candidatePhrases.set(phrase, count)
  }

  // 3. Greedy clustering: for each prompt, assign to the phrase with the
  //    highest corpus frequency present in its own phrase set.
  const clusters = new Map<string, Array<{ row: TopicInputRow; phrases: string[] }>>()
  const unclustered: typeof promptPhrases = []
  for (const pp of promptPhrases) {
    // Find the candidate phrases in this prompt, sort by length desc
    // then frequency desc (prefer longer / more specific).
    const matches = pp.phrases
      .filter((p) => candidatePhrases.has(p))
      .sort((a, b) => {
        const lenDiff = b.split(' ').length - a.split(' ').length
        if (lenDiff !== 0) return lenDiff
        return (candidatePhrases.get(b) ?? 0) - (candidatePhrases.get(a) ?? 0)
      })
    if (matches.length === 0) {
      unclustered.push(pp)
      continue
    }
    const key = matches[0]!
    const bucket = clusters.get(key) ?? []
    bucket.push(pp)
    clusters.set(key, bucket)
  }

  // 4. Build the report. For each cluster compute engines, competitors,
  //    examples, format, priority score.
  const rawClusters: TopicCluster[] = []
  for (const [phraseKey, bucket] of clusters) {
    if (bucket.length < minClusterSize) continue

    const engines = new Set<string>()
    const competitorCount = new Map<string, number>()
    const examples: string[] = []
    for (const { row } of bucket) {
      if (row.engine) engines.add(row.engine)
      for (const host of row.citedInstead) {
        competitorCount.set(host, (competitorCount.get(host) ?? 0) + 1)
      }
      if (examples.length < 5 && row.prompt_text) examples.push(row.prompt_text)
    }

    const topCompetitors = Array.from(competitorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([host]) => host)

    // Pick the BEST label for the cluster (longest, most-IDF phrase
    // that actually appears across multiple prompts in the bucket).
    const clusterPhraseFreq = new Map<string, number>()
    for (const { phrases: ps } of bucket) {
      for (const p of ps) {
        if (candidatePhrases.has(p)) {
          clusterPhraseFreq.set(p, (clusterPhraseFreq.get(p) ?? 0) + 1)
        }
      }
    }
    const label = pickLabel(clusterPhraseFreq, candidatePhrases) || phraseKey

    rawClusters.push({
      topic: label,
      examples,
      promptCount: bucket.length,
      engineCount: engines.size,
      competitorCount: competitorCount.size,
      topCompetitors,
      suggestedFormat: detectFormat(examples),
      priorityScore: 0, // filled below after normalisation
    })
  }

  // 5. Normalise priority scores to 0-100. Composite metric: prompts ×
  //    engine diversity × competitor diversity. All three matter:
  //    cluster of 5 prompts on 1 engine with 1 competitor stealing every
  //    slot is less actionable than 3 prompts on 3 engines with 3
  //    different competitors (universal gap, not engine-quirk).
  const rawScores = rawClusters.map(
    (c) => c.promptCount * Math.max(1, c.engineCount) * Math.max(1, c.competitorCount),
  )
  const maxScore = Math.max(1, ...rawScores)
  for (let i = 0; i < rawClusters.length; i++) {
    rawClusters[i]!.priorityScore = Math.round((rawScores[i]! / maxScore) * 100)
  }

  // 6. Sort by priority + cap.
  const finalClusters = rawClusters
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, maxClusters)

  return {
    totalGapPrompts,
    clusters: finalClusters,
    rejectedPhrases: rejectedPhrases.slice(0, 10),
  }
}
