#!/usr/bin/env tsx
//
// Backfill for C4 — prompts whose category never said anything.
//
// The anomaly report found 51 of 61 Relovie prompts sitting in 'awareness' and
// 10 with no category at all, which makes every per-category reading noise.
// /api/prompts now requires a category, so new prompts are fine; this is the
// history.
//
// It reads each prompt's TEXT and applies classifyPromptCategory — the same
// function the form-less create flows use, so the backfill and the live app
// cannot drift apart. Conservative by construction: a prompt with no signal
// lands in 'custom' (the uncategorised bucket) rather than being guessed into
// 'awareness', which is how the column became meaningless in the first place.
//
// Usage:
//   npx tsx scripts/reclassify-prompt-categories.ts                 → dry run
//   npx tsx scripts/reclassify-prompt-categories.ts --brand <uuid>  → one brand
//   npx tsx scripts/reclassify-prompt-categories.ts --apply         → writes
//
// Writes nothing without --apply, and even then only UPDATEs prompts.category.
// No deletes, no schema changes — the repo's additive-only rule holds.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  classifyPromptCategory,
  type PromptCategory,
} from '../src/lib/services/prompt-classification'

interface PromptRow {
  id: string
  brand_id: string
  text: string
  category: string | null
}

interface BrandRow {
  id: string
  name: string
  aliases: string[] | null
  domain: string | null
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i === -1 ? undefined : process.argv[i + 1]
}

// Same env loading as the other scripts in this directory: .env.local wins,
// .env fills the gaps, and anything already exported wins over both.
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
      /* file absent — fine */
    }
  }
}

async function main() {
  loadEnvFiles()

  const apply = process.argv.includes('--apply')
  const onlyBrand = arg('--brand')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // The repo's scripts use SUPABASE_SERVICE_KEY; SUPABASE_SERVICE_ROLE_KEY is
  // accepted too so a differently-named environment still works.
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.')
    process.exit(1)
  }
  const db = createClient(url, key, { auth: { persistSession: false } })

  let brandQuery = db.from('brands').select('id, name, aliases, domain')
  if (onlyBrand) brandQuery = brandQuery.eq('id', onlyBrand)
  const { data: brands, error: brandErr } = await brandQuery
  if (brandErr) {
    console.error('Failed to read brands:', brandErr.message)
    process.exit(1)
  }

  const byId = new Map<string, BrandRow>()
  for (const b of (brands ?? []) as BrandRow[]) byId.set(b.id, b)

  let promptQuery = db.from('prompts').select('id, brand_id, text, category')
  if (onlyBrand) promptQuery = promptQuery.eq('brand_id', onlyBrand)
  const { data: prompts, error: promptErr } = await promptQuery
  if (promptErr) {
    console.error('Failed to read prompts:', promptErr.message)
    process.exit(1)
  }

  const rows = (prompts ?? []) as PromptRow[]
  const before = new Map<string, number>()
  const after = new Map<string, number>()
  const changes: Array<{ row: PromptRow; next: PromptCategory }> = []

  for (const row of rows) {
    const brand = byId.get(row.brand_id)
    // A prompt whose brand was not returned (filtered out, or deleted) is left
    // exactly as it is: reclassifying without the brand's own names would call
    // every branded question 'custom'.
    if (!brand) continue

    const next = classifyPromptCategory(row.text, {
      name: brand.name,
      aliases: brand.aliases ?? [],
      domain: brand.domain,
    })

    const current = row.category ?? '(none)'
    before.set(current, (before.get(current) ?? 0) + 1)
    after.set(next, (after.get(next) ?? 0) + 1)
    if (row.category !== next) changes.push({ row, next })
  }

  const dist = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}=${v}`)
      .join('  ')

  console.log(`\nPrompts examined: ${rows.length}${onlyBrand ? ` (brand ${onlyBrand})` : ''}`)
  console.log(`Before: ${dist(before)}`)
  console.log(`After:  ${dist(after)}`)
  console.log(`Would change: ${changes.length}\n`)

  for (const { row, next } of changes) {
    const from = row.category ?? '(none)'
    const text = row.text.length > 72 ? row.text.slice(0, 69) + '…' : row.text
    console.log(`  ${from.padEnd(12)} → ${next.padEnd(12)} ${text}`)
  }

  if (!apply) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to write these categories.')
    return
  }

  let updated = 0
  for (const { row, next } of changes) {
    const { error } = await db.from('prompts').update({ category: next }).eq('id', row.id)
    if (error) {
      console.error(`  FAILED ${row.id}: ${error.message}`)
      continue
    }
    updated++
  }
  console.log(`\nApplied: ${updated}/${changes.length} prompts updated.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
