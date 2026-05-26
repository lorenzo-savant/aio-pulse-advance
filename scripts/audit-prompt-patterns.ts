#!/usr/bin/env tsx
/**
 * Performative-prompt pattern auditor.
 *
 * Walks the static prompt sources we ship (PROMPT_TEMPLATES in
 * prompt-library.ts + INDUSTRY_PRESETS in prompt-generator.ts) plus the
 * system-prompt strings in lib/services/**.ts, and reports any phrase
 * that triggers an LLM's role-simulation mode ("Act as", "Pretend",
 * "Imagine you are", and Italian/Swedish equivalents). See
 * src/lib/prompt-quality.ts for the detector + rationale.
 *
 * Exit code: 0 when clean, 1 when any match is found. Wire this into CI
 * to prevent regressions when adding new templates.
 *
 * USAGE:
 *   npx tsx scripts/audit-prompt-patterns.ts
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { findPerformativePatterns } from '../src/lib/prompt-quality'
import { PROMPT_TEMPLATES } from '../src/lib/prompt-library'
import { INDUSTRY_PRESETS } from '../src/lib/services/prompt-generator'

interface Finding {
  source: string
  text: string
  matches: ReturnType<typeof findPerformativePatterns>
}

const findings: Finding[] = []

// ── 1. Generic library templates ──────────────────────────────────────
// PROMPT_TEMPLATES has en/it/sv text. Every locale is sent verbatim to
// AI engines as a user query, so each one needs auditing.
for (const tpl of PROMPT_TEMPLATES) {
  for (const locale of ['en', 'it', 'sv'] as const) {
    const text = tpl.texts[locale]
    if (!text) continue
    const matches = findPerformativePatterns(text)
    if (matches.length > 0) {
      findings.push({
        source: `prompt-library.ts → ${tpl.id} (${locale})`,
        text,
        matches,
      })
    }
  }
}

// ── 2. Industry preset templates ──────────────────────────────────────
// intentPatterns + localizedTemplates both become user queries. Same risk.
for (const preset of INDUSTRY_PRESETS) {
  for (const pattern of preset.intentPatterns) {
    const matches = findPerformativePatterns(pattern.template)
    if (matches.length > 0) {
      findings.push({
        source: `prompt-generator.ts → ${preset.id} → intentPatterns/${pattern.bucket}`,
        text: pattern.template,
        matches,
      })
    }
  }
  if (preset.localizedTemplates) {
    for (const locale of ['en', 'it', 'sv'] as const) {
      const templates = preset.localizedTemplates[locale] ?? []
      for (const t of templates) {
        const matches = findPerformativePatterns(t)
        if (matches.length > 0) {
          findings.push({
            source: `prompt-generator.ts → ${preset.id} → localizedTemplates.${locale}`,
            text: t,
            matches,
          })
        }
      }
    }
  }
}

// ── 3. System-prompt strings in services ──────────────────────────────
// Heuristic: scan every .ts under src/lib/services for string literals
// that the detector flags. Catches AI service prompts (Groq classifier,
// advisor, llms-enrichment) without needing per-file imports.
const servicesDir = join(__dirname, '..', 'src', 'lib', 'services')
function walkTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const s = statSync(full)
    if (s.isDirectory()) out.push(...walkTsFiles(full))
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(full)
  }
  return out
}

const STRING_LITERAL = /(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g

for (const file of walkTsFiles(servicesDir)) {
  const src = readFileSync(file, 'utf8')
  let m: RegExpExecArray | null
  while ((m = STRING_LITERAL.exec(src)) !== null) {
    const literal = m[2]
    // Skip anything too short to plausibly be a system prompt or template.
    if (!literal || literal.length < 20) continue
    const matches = findPerformativePatterns(literal)
    if (matches.length > 0) {
      // Line number from the literal's start offset.
      const before = src.slice(0, m.index)
      const line = before.split(/\r?\n/).length
      const rel = relative(process.cwd(), file).replace(/\\/g, '/')
      findings.push({
        source: `${rel}:${line}`,
        text: literal.slice(0, 160) + (literal.length > 160 ? '…' : ''),
        matches,
      })
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────
if (findings.length === 0) {
  console.log('OK — no performative prompt phrasing found.')
  console.log(
    `Scanned: ${PROMPT_TEMPLATES.length} library templates, ${INDUSTRY_PRESETS.length} industry presets, ${walkTsFiles(servicesDir).length} service files.`,
  )
  process.exit(0)
}

console.log(`Found ${findings.length} performative-phrasing match(es):\n`)
for (const f of findings) {
  console.log(`  ${f.source}`)
  console.log(`    "${f.text}"`)
  for (const m of f.matches) {
    console.log(`    ⚠ [${m.locale}] matched "${m.phrase}" — ${m.reason}`)
    console.log(`      ↳ ${m.suggestion}`)
  }
  console.log('')
}

console.log('See src/lib/prompt-quality.ts for the rules + rationale.')
process.exit(1)
