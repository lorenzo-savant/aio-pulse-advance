#!/usr/bin/env node
/**
 * Applies exact string replacements to a source file, failing loudly if any
 * anchor is missing or ambiguous. Keeps the i18n wiring auditable: every
 * replacement must match exactly once.
 *
 * Usage: node scripts/i18n/apply.mjs <file> <edits.json>
 *   edits.json: [["old", "new"], ...] — add a third element "all" to allow
 *   (and require) multiple occurrences: [["old", "new", "all"], ...]
 */
import fs from 'node:fs'

const [file, editsPath] = process.argv.slice(2)
if (!file || !editsPath) {
  console.error('usage: node scripts/i18n/apply.mjs <file> <edits.json>')
  process.exit(1)
}

const edits = JSON.parse(fs.readFileSync(editsPath, 'utf8'))
const raw = fs.readFileSync(file, 'utf8')

// Part of the tree is checked out with CRLF endings. Match against a normalised
// copy so anchors can always be written with plain LF, then restore the file
// convention on write.
const isCrlf = raw.includes('\r\n')
let src = isCrlf ? raw.replace(/\r\n/g, '\n') : raw
const problems = []

for (const [from, to, mode] of edits) {
  const count = src.split(from).length - 1
  if (count === 0) problems.push(`NON TROVATO: ${JSON.stringify(from.slice(0, 70))}`)
  else if (count > 1 && mode !== 'all')
    problems.push(`AMBIGUO (${count}x): ${JSON.stringify(from.slice(0, 70))}`)
  else src = src.split(from).join(to)
}

if (problems.length) {
  console.error(`✗ ${file}`)
  problems.forEach((p) => console.error('  ' + p))
  process.exit(1)
}

fs.writeFileSync(file, isCrlf ? src.replace(/\n/g, '\r\n') : src, 'utf8')
console.log(`✓ ${file}: ${edits.length} sostituzioni${isCrlf ? ' (CRLF preservato)' : ''}`)
