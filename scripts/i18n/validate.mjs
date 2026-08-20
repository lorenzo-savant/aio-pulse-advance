#!/usr/bin/env node
/**
 * Fails if any t('...') call in the tree resolves to a key that is missing from
 * any of the three catalogs — i.e. if a page could throw a next-intl
 * missing-message at runtime.
 *
 * Catches the split-brain case where a page is wired to keys that only exist in
 * one working tree: page and catalog must always ship together.
 *
 * Usage: node scripts/i18n/validate.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const LOCALES = ['en', 'it', 'sv']

const flat = (o, p = '') =>
  Object.entries(o).reduce((acc, [k, v]) => {
    const key = p ? `${p}.${k}` : k
    return v && typeof v === 'object' && !Array.isArray(v)
      ? Object.assign(acc, flat(v, key))
      : Object.assign(acc, { [key]: v })
  }, {})

const catalogs = Object.fromEntries(
  LOCALES.map((l) => [
    l,
    new Set(Object.keys(flat(JSON.parse(fs.readFileSync(`src/i18n/messages/${l}.json`, 'utf8'))))),
  ])
)

const walk = (d, acc = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.tsx?$/.test(e.name)) acc.push(p)
  }
  return acc
}

/**
 * One file often binds the same alias to several namespaces, one per component
 * (`const t = useTranslations('settings.profile')` then, further down,
 * `const t = useTranslations('settings')`). Resolve each call against the
 * nearest preceding binding of that alias rather than a single per-file map.
 */
function namespaceAt(bindings, alias, index) {
  let ns = null
  for (const b of bindings) {
    if (b.alias === alias && b.index < index) ns = b.ns
    else if (b.index >= index) break
  }
  return ns
}

const problems = []
let checked = 0

for (const file of [...walk('src/app'), ...walk('src/components'), ...walk('src/hooks')]) {
  const src = fs.readFileSync(file, 'utf8')
  if (!/useTranslations|getTranslations/.test(src)) continue

  const bindings = []
  for (const m of src.matchAll(
    /const\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*'([^']+)'\s*\)/g
  ))
    bindings.push({ alias: m[1], ns: m[2], index: m.index })

  const aliases = [...new Set(bindings.map((b) => b.alias))]

  for (const alias of aliases) {
    // Literal lookups: t('key') and t.rich('key').
    const literal = new RegExp(String.raw`\b${alias}(?:\.rich)?\(\s*'([^']+)'`, 'g')
    for (const m of src.matchAll(literal)) {
      const ns = namespaceAt(bindings, alias, m.index)
      if (!ns) continue // the call sits above any binding — not a lookup we can resolve
      const full = `${ns}.${m[1]}`
      checked++
      const missing = LOCALES.filter((l) => !catalogs[l].has(full))
      if (missing.length) problems.push(`${file}: ${full} — assente in ${missing.join(', ')}`)
    }

    // Template lookups: t(`prefix_${x}`). The suffix is only known at runtime,
    // so assert that at least one key carries the literal prefix — enough to
    // catch a renamed or dropped namespace.
    const template = new RegExp(String.raw`\b${alias}(?:\.rich)?\(\s*\x60([^\x60$]+)\$\{`, 'g')
    for (const m of src.matchAll(template)) {
      const ns = namespaceAt(bindings, alias, m.index)
      if (!ns) continue
      const prefix = `${ns}.${m[1]}`
      checked++
      const missing = LOCALES.filter((l) => ![...catalogs[l]].some((k) => k.startsWith(prefix)))
      if (missing.length)
        problems.push(
          `${file}: ${prefix}* — nessuna chiave con questo prefisso in ${missing.join(', ')}`
        )
    }
  }
}

if (problems.length) {
  console.error(`✗ ${problems.length} riferimenti rotti su ${checked} controllati:\n`)
  problems.forEach((p) => console.error('  ' + p))
  process.exit(1)
}
console.log(`✓ ${checked} riferimenti t() risolti in tutte e ${LOCALES.length} le lingue`)
