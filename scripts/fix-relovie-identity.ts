#!/usr/bin/env tsx
//
// One-off correction: the Relovie brand was recreated on 2026-08-20 with its
// organisationsnummer typed into the `domain` field and `legal_id` left empty.
//
// Two consequences, both structural rather than cosmetic:
//   · own-domain citation rate is permanently 0 — ownDomainCited compares
//     hostnames, and "559444-5685" is never the host of any URL;
//   · the identity anchor reads `legal_id`, which is empty, so the schema
//     output and the homonym audit have nothing to anchor on.
//
// relovie.se 301-redirects to relovie.com (verified live 2026-08-20), so the
// canonical host is relovie.com.
//
// UPDATE on three columns of one row. No deletes, no schema changes.
//
// Usage:
//   npx tsx scripts/fix-relovie-identity.ts            → dry run
//   npx tsx scripts/fix-relovie-identity.ts --apply    → writes

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

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

const FIX = {
  domain: 'relovie.com',
  legal_id: '559444-5685',
  legal_id_type: 'orgnr',
} as const

async function main() {
  loadEnvFiles()
  const apply = process.argv.includes('--apply')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.')
    process.exit(1)
  }
  const db = createClient(url, key, { auth: { persistSession: false } })

  const { data, error } = await db
    .from('brands')
    .select('id, name, domain, legal_id, legal_id_type')
    .ilike('name', '%relovie%')
    .maybeSingle()

  if (error) {
    console.error('read failed:', error.message)
    process.exit(1)
  }
  if (!data) {
    console.error('no brand matching "relovie" — nothing to fix.')
    process.exit(1)
  }

  const brand = data as {
    id: string
    name: string
    domain: string | null
    legal_id: string | null
    legal_id_type: string | null
  }

  console.log(`brand: ${brand.name} (${brand.id})`)
  console.log(`  domain         ${brand.domain}  →  ${FIX.domain}`)
  console.log(`  legal_id       ${brand.legal_id}  →  ${FIX.legal_id}`)
  console.log(`  legal_id_type  ${brand.legal_id_type}  →  ${FIX.legal_id_type}`)

  if (!apply) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply.')
    return
  }

  const { error: updateErr } = await db.from('brands').update(FIX).eq('id', brand.id)
  if (updateErr) {
    console.error('update failed:', updateErr.message)
    process.exit(1)
  }

  const { data: after } = await db
    .from('brands')
    .select('domain, legal_id, legal_id_type')
    .eq('id', brand.id)
    .maybeSingle()
  console.log('\nwritten. now:', JSON.stringify(after))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
