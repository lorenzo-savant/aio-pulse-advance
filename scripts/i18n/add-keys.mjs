#!/usr/bin/env node
/**
 * Adds translation keys to en/it/sv message catalogs in one shot.
 *
 * Input: a JSON file shaped { "<namespace>": { "<key>": ["en", "it", "sv"] } }
 * Existing keys are never overwritten — reruns are safe.
 *
 * Usage: node scripts/i18n/add-keys.mjs <batch.json>
 */
import fs from 'node:fs'
import path from 'node:path'

const LOCALES = ['en', 'it', 'sv']
const DIR = 'src/i18n/messages'

const batchPath = process.argv[2]
if (!batchPath) {
  console.error('usage: node scripts/i18n/add-keys.mjs <batch.json>')
  process.exit(1)
}
const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'))

const catalogs = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(path.join(DIR, `${l}.json`), 'utf8'))])
)

let added = 0
let skipped = 0

for (const [ns, keys] of Object.entries(batch)) {
  for (const [key, values] of Object.entries(keys)) {
    if (!Array.isArray(values) || values.length !== LOCALES.length) {
      console.error(`✗ ${ns}.${key}: serve un array di ${LOCALES.length} valori [en, it, sv]`)
      process.exit(1)
    }
    LOCALES.forEach((locale, i) => {
      const cat = catalogs[locale]
      cat[ns] ??= {}
      if (cat[ns][key] !== undefined) {
        if (i === 0) skipped++
        return
      }
      cat[ns][key] = values[i]
      if (i === 0) added++
    })
  }
}

for (const locale of LOCALES) {
  fs.writeFileSync(
    path.join(DIR, `${locale}.json`),
    JSON.stringify(catalogs[locale], null, 2) + '\n',
    'utf8'
  )
}

// Parity check — the catalogs must stay key-identical across locales.
const flat = (o, p = '') =>
  Object.entries(o).reduce((acc, [k, v]) => {
    const key = p ? `${p}.${k}` : k
    return v && typeof v === 'object' && !Array.isArray(v)
      ? Object.assign(acc, flat(v, key))
      : Object.assign(acc, { [key]: v })
  }, {})

const counts = LOCALES.map((l) => Object.keys(flat(catalogs[l])).length)
if (new Set(counts).size !== 1) {
  console.error(`✗ parità rotta: ${LOCALES.map((l, i) => `${l}=${counts[i]}`).join(' ')}`)
  process.exit(1)
}

console.log(`✓ ${added} chiavi aggiunte, ${skipped} già presenti — ${counts[0]} chiavi per lingua`)
