#!/usr/bin/env tsx
//
// Probe: do this database's real prompts cluster into defensible topics?
//
// docs/enterprise-roadmap/07-topic-metrics-design.md recommends topic-level
// metrics built on clustered PROMPTS, and closes by saying the first thing to
// try is not the table but this: run the clustering over the real prompts and
// see whether six defensible topics come out, or forty microclusters. If it is
// forty, the rest of that document is paper.
//
// Read-only. It embeds the prompts (one batched call per brand,
// text-embedding-3-small, on the order of 0.0001 $ for the whole database) and
// runs the existing greedy-centroid brain from response-clustering.ts at
// several thresholds. It writes nothing — not to the database, not to
// response_embeddings.
//
// Usage:
//   npx tsx scripts/probe-prompt-clustering.ts
//   npx tsx scripts/probe-prompt-clustering.ts --brand <uuid>
//   npx tsx scripts/probe-prompt-clustering.ts --thresholds 0.70,0.75,0.80

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { embedTexts } from '../src/lib/services/semantic'
import { clusterResponses, type ClusterInput } from '../src/lib/services/response-clustering'

interface PromptRow {
  id: string
  brand_id: string
  text: string
  category: string | null
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i === -1 ? undefined : process.argv[i + 1]
}

function loadEnvFiles(): void {
  const NEWLINE = /\r?\n/
  const QUOTES = /^["']|["']$/g
  for (const file of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(file, 'utf8').split(NEWLINE)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m && m[1] && !process.env[m[1]]) {
          process.env[m[1]] = (m[2] ?? '').trim().replace(QUOTES, '')
        }
      }
    } catch {
      /* absent */
    }
  }
}

/** The embeddings endpoint takes an array; keep batches modest anyway. */
const BATCH = 96

async function embedAll(texts: string[]): Promise<Array<number[] | null>> {
  const out: Array<number[] | null> = []
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH)
    const vectors = await embedTexts(slice)
    if (!vectors) {
      out.push(...slice.map(() => null))
      continue
    }
    out.push(...vectors)
  }
  return out
}

async function main() {
  loadEnvFiles()

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is required — the probe embeds the prompts.')
    process.exit(1)
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.')
    process.exit(1)
  }
  const db = createClient(url, key, { auth: { persistSession: false } })

  const onlyBrand = arg('--brand')
  const thresholds = (arg('--thresholds') ?? '0.70,0.75,0.78,0.82')
    .split(',')
    .map((t) => Number(t.trim()))
    .filter((t) => Number.isFinite(t) && t > 0 && t < 1)

  let brandQuery = db.from('brands').select('id, name')
  if (onlyBrand) brandQuery = brandQuery.eq('id', onlyBrand)
  const { data: brands, error: brandErr } = await brandQuery
  if (brandErr) {
    console.error('Failed to read brands:', brandErr.message)
    process.exit(1)
  }

  for (const brand of (brands ?? []) as Array<{ id: string; name: string }>) {
    const { data: prompts, error } = await db
      .from('prompts')
      .select('id, brand_id, text, category')
      .eq('brand_id', brand.id)
      .order('created_at', { ascending: true })

    if (error) {
      console.error(`  ${brand.name}: failed to read prompts — ${error.message}`)
      continue
    }
    const rows = (prompts ?? []) as PromptRow[]
    console.log(`\n${'='.repeat(78)}\n${brand.name} — ${rows.length} prompts\n${'='.repeat(78)}`)
    if (rows.length < 2) {
      console.log('  too few prompts to cluster')
      continue
    }

    const vectors = await embedAll(rows.map((r) => r.text))
    const items: ClusterInput[] = []
    rows.forEach((r, i) => {
      const v = vectors[i]
      if (v) items.push({ id: r.id, text: r.text, embedding: v })
    })
    const embedded = items.length
    if (embedded < rows.length) {
      console.log(`  WARNING: only ${embedded}/${rows.length} prompts embedded`)
    }

    for (const threshold of thresholds) {
      // minSize 1 and no cap on purpose: the question this probe answers is how
      // many clusters there ARE, including the singletons the product defaults
      // would hide.
      const clusters = clusterResponses(items, { threshold, minSize: 1, maxClusters: 10_000 })
      const singletons = clusters.filter((c) => c.size === 1).length
      const inSingletons = clusters.filter((c) => c.size === 1).reduce((s, c) => s + c.size, 0)
      const meaningful = clusters.filter((c) => c.size >= 3)
      const coveredByMeaningful = meaningful.reduce((s, c) => s + c.size, 0)

      console.log(
        `\n  threshold ${threshold.toFixed(2)} → ${clusters.length} clusters · ` +
          `${singletons} singletons (${inSingletons}/${embedded} prompts) · ` +
          `${meaningful.length} clusters of 3+ covering ${coveredByMeaningful}/${embedded} ` +
          `(${Math.round((coveredByMeaningful / embedded) * 100)}%)`,
      )
      for (const c of clusters.slice(0, 12)) {
        if (c.size < 2) continue
        const sample = c.sampleTexts[0] ?? ''
        const short = sample.length > 64 ? sample.slice(0, 61) + '…' : sample
        console.log(`      ${String(c.size).padStart(3)}  ${c.label.padEnd(34)} e.g. ${short}`)
      }
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
