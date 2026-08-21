#!/usr/bin/env node
/**
 * Lists the user-facing strings still hardcoded in a file, and for each one
 * reports whether the en catalog already holds that exact text (so the string
 * only needs wiring, not a new translation).
 *
 * Runs over the whole file rather than line by line, so JSX text that wraps
 * across several lines is caught too.
 *
 * Usage: node scripts/i18n/scan.mjs <file> [namespace]
 */
import fs from 'node:fs'

const [file, ns] = process.argv.slice(2)
const en = JSON.parse(fs.readFileSync('src/i18n/messages/en.json', 'utf8'))

const flat = (o, p = '') =>
  Object.entries(o).reduce((acc, [k, v]) => {
    const key = p ? `${p}.${k}` : k
    return v && typeof v === 'object' && !Array.isArray(v)
      ? Object.assign(acc, flat(v, key))
      : Object.assign(acc, { [key]: v })
  }, {})

const byVal = new Map()
for (const [k, v] of Object.entries(flat(en))) {
  if (typeof v === 'string') {
    const norm = v.toLowerCase().trim().replace(/\s+/g, ' ')
    if (!byVal.has(norm) || (ns && k.startsWith(ns + '.'))) byVal.set(norm, k)
  }
}

const src = fs.readFileSync(file, 'utf8')
const lineAt = (idx) => src.slice(0, idx).split('\n').length

const found = []
const push = (idx, raw) => {
  const s = raw.trim().replace(/\s+/g, ' ')
  if (!/[a-zA-Z]{3,}/.test(s)) return
  if (/^[A-Z0-9_]+$/.test(s)) return // SCREAMING_CASE constants
  if (/^(https?:\/\/|\/|#|\.|[a-z-]+\/)/.test(s) && !/ /.test(s)) return // paths & urls
  found.push([lineAt(idx), s])
}

// JSX text nodes, including ones that wrap across lines.
for (const m of src.matchAll(/>([^<>{}]*[A-Za-z]{3,}[^<>{}]*)</g)) {
  const txt = m[1]
  if (!/[A-Za-z]/.test(txt)) continue
  if (!/^[\s]*[A-Z]/.test(txt)) continue // user-facing copy starts capitalised
  push(m.index, txt)
}

// String attributes that render as copy.
for (const m of src.matchAll(
  /(?:placeholder|title|label|aria-label|alt|name|description)=["']([^"']{3,120})["']/g
))
  push(m.index, m[1])

// Toast / Error message literals.
for (const m of src.matchAll(
  /(?:toast\.(?:error|success|loading)|new Error|setError)\(\s*['"]([^'"]{4,120})['"]/g
))
  push(m.index, m[1])

const seen = new Set()
let neu = 0
for (const [line, s] of found) {
  if (seen.has(s)) continue
  seen.add(s)
  const key = byVal.get(s.toLowerCase())
  if (!key) neu++
  console.log(`${String(line).padStart(4)}  ${key ? '[' + key + ']' : '[NEW]'}  ${s.slice(0, 100)}`)
}
console.error(`   → ${seen.size} stringhe (${neu} nuove, ${seen.size - neu} già in catalogo)`)
