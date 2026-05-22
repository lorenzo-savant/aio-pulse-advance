// PATH: src/lib/services/response-clustering.ts
//
// Thematic clustering of AI monitoring responses — "what themes do the answer
// engines associate with this brand?". Embeddings come from semantic.ts; this
// module is the pure, deterministic BRAIN: group response embeddings into
// themes and label each one. Unit-tested without network/DB.
//
// Scale note: clustering needs every vector in memory regardless of storage, so
// this v1 uses greedy centroid clustering in JS (fine for hundreds of
// responses). pgvector becomes the right tool only at LARGE scale, where an ANN
// index lets you avoid the O(N²) all-pairs work — documented as the upgrade.

import { cosineSimilarity } from './semantic'

export interface ClusterInput {
  id: string
  text: string
  embedding: number[]
  sentimentScore?: number | null
}

export interface ThemeCluster {
  label: string
  size: number
  /** % of clustered responses in this theme. */
  share: number
  /** Average sentiment (−1..1) of the theme's responses, or null. */
  avgSentiment: number | null
  /** Up to 3 representative response snippets. */
  sampleTexts: string[]
  memberIds: string[]
}

export interface ClusterOptions {
  /** Cosine similarity to a theme centroid required to join it. Default 0.78. */
  threshold?: number
  /** Drop themes smaller than this. Default 2. */
  minSize?: number
  /** Keep at most this many themes (largest first). Default 8. */
  maxClusters?: number
}

interface WorkingCluster {
  sum: number[]
  count: number
  items: ClusterInput[]
}

function centroid(c: WorkingCluster): number[] {
  return c.sum.map((v) => v / c.count)
}

// Minimal trilingual stopword set (en/it/sv) + generic filler for labeling.
const STOP = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'for',
  'on',
  'is',
  'are',
  'it',
  'its',
  'as',
  'at',
  'by',
  'with',
  'that',
  'this',
  'from',
  'be',
  'your',
  'you',
  'their',
  'they',
  'we',
  'our',
  'can',
  'will',
  'has',
  'have',
  'was',
  'were',
  'not',
  'but',
  'if',
  'so',
  'than',
  'then',
  'more',
  'most',
  'best',
  'top',
  'il',
  'lo',
  'la',
  'i',
  'gli',
  'le',
  'di',
  'a',
  'da',
  'in',
  'con',
  'su',
  'per',
  'tra',
  'fra',
  'e',
  'o',
  'che',
  'un',
  'una',
  'è',
  'sono',
  'come',
  'del',
  'della',
  'dei',
  'delle',
  'al',
  'allo',
  'alla',
  'più',
  'och',
  'att',
  'det',
  'som',
  'en',
  'ett',
  'på',
  'är',
  'för',
  'med',
  'av',
  'till',
  'den',
  'de',
  'har',
  'inte',
  'om',
  'vi',
  'du',
  'din',
  'deras',
  'bäst',
  'bästa',
])

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
}

/** Top frequent content words across the cluster's texts → a short label. */
export function labelCluster(texts: string[]): string {
  const freq = new Map<string, number>()
  for (const t of texts) {
    for (const w of tokenize(t)) freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  const top = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w)
  return top.length > 0 ? top.join(' · ') : 'misc'
}

const round = (v: number, d = 2) => {
  const f = 10 ** d
  return Math.round(v * f) / f
}

/**
 * Greedy centroid clustering: each response joins the most-similar existing
 * theme if it's within `threshold`, else seeds a new one. Deterministic in the
 * input order. Returns labeled themes (largest first), filtered + capped.
 */
export function clusterResponses(items: ClusterInput[], opts: ClusterOptions = {}): ThemeCluster[] {
  const threshold = opts.threshold ?? 0.78
  const minSize = opts.minSize ?? 2
  const maxClusters = opts.maxClusters ?? 8

  const clusters: WorkingCluster[] = []
  for (const item of items) {
    if (!item.embedding?.length) continue
    let best: WorkingCluster | null = null
    let bestSim = -1
    for (const c of clusters) {
      const sim = cosineSimilarity(item.embedding, centroid(c))
      if (sim > bestSim) {
        bestSim = sim
        best = c
      }
    }
    if (best && bestSim >= threshold) {
      best.items.push(item)
      best.count++
      for (let i = 0; i < best.sum.length; i++) best.sum[i]! += item.embedding[i]!
    } else {
      clusters.push({ sum: [...item.embedding], count: 1, items: [item] })
    }
  }

  const kept = clusters.filter((c) => c.count >= minSize)
  const totalClustered = kept.reduce((s, c) => s + c.count, 0)

  return kept
    .sort((a, b) => b.count - a.count)
    .slice(0, maxClusters)
    .map((c) => {
      const sentiments = c.items
        .map((i) => i.sentimentScore)
        .filter((s): s is number => typeof s === 'number')
      const avgSentiment =
        sentiments.length > 0
          ? round(sentiments.reduce((s, n) => s + n, 0) / sentiments.length)
          : null
      return {
        label: labelCluster(c.items.map((i) => i.text)),
        size: c.count,
        share: totalClustered > 0 ? round((c.count / totalClustered) * 100, 1) : 0,
        avgSentiment,
        sampleTexts: c.items.slice(0, 3).map((i) => i.text),
        memberIds: c.items.map((i) => i.id),
      }
    })
}
