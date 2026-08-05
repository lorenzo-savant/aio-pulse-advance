#!/usr/bin/env node
// Measure the drift between what the app talks to at runtime and what the two
// schema sources describe.
//
// Three descriptions of the same database exist in this repo and none of them
// agrees with the others:
//
//   src/types/database.ts     generated FROM production — the ground truth
//   prisma/schema.prisma      what Prisma will build queries from
//   supabase/migrations/*.sql what a fresh database would be built from
//
// A table present at runtime but absent from the migrations cannot be rebuilt:
// restore from these files and it simply is not there. A table present at
// runtime but absent from Prisma is invisible to any Prisma query. Neither
// failure announces itself — both are silent until the day they are not.
//
// Read-only, no network, no database connection. Prints a report and exits 0;
// this measures, it does not gate. The gate is the ratchet in PR #5, which
// needs SUPABASE_DB_URL to compare against a live schema.

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function runtimeTables() {
  const src = readFileSync(join(root, 'src/types/database.ts'), 'utf8')
  // The file describes TWO schemas — graphql_public first, then public — and
  // each has the same Tables/Views/Functions/Enums shape. Two mistakes are easy
  // here and both were made while writing this: taking the first `Tables: {`
  // picks the empty graphql_public one (0 tables), and reading to end of file
  // sweeps in the RPCs from Functions as if they were tables
  // (deduct_credits, graphql, increment_*). Anchor on `public:`, then stop at
  // its next sibling section.
  const schemaStart = src.search(/^ {2}public: \{$/m)
  if (schemaStart === -1) return []
  const start = src.indexOf('Tables: {', schemaStart)
  if (start === -1) return []
  const rest = src.slice(start)
  const end = rest.search(/^ {4}(Views|Functions|Enums|CompositeTypes): /m)
  const block = end === -1 ? rest : rest.slice(0, end)

  const names = new Set()
  // Table keys sit at a known indentation in the generated output.
  for (const m of block.matchAll(/^ {6}(\w+): \{$/gm)) names.add(m[1])
  return [...names].sort()
}

function prismaTables() {
  const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8')
  const names = new Set()
  // @@map("x") is authoritative; fall back to the model name when absent.
  for (const block of schema.split(/^model /m).slice(1)) {
    const mapped = block.match(/@@map\("([^"]+)"\)/)
    if (mapped) {
      names.add(mapped[1])
      continue
    }
    const modelName = block.match(/^(\w+)/)
    if (modelName) names.add(modelName[1])
  }
  return [...names].sort()
}

function migrationTables() {
  const dir = join(root, 'supabase/migrations')
  const names = new Set()
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql'))) {
    const sql = readFileSync(join(dir, file), 'utf8')
    for (const m of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?["]?(\w+)["]?/gi,
    )) {
      names.add(m[1])
    }
  }
  return [...names].sort()
}

const runtime = runtimeTables()
const prisma = prismaTables()
const migrations = migrationTables()

const missingFromMigrations = runtime.filter((t) => !migrations.includes(t))
const missingFromPrisma = runtime.filter((t) => !prisma.includes(t))

console.log(`runtime tables (src/types/database.ts): ${runtime.length}`)
console.log(`prisma models  (schema.prisma):         ${prisma.length}`)
console.log(`CREATE TABLE   (supabase/migrations):   ${migrations.length}`)

console.log(
  `\n── ${missingFromMigrations.length} runtime table(s) with no CREATE TABLE — a rebuild would not produce these ──`,
)
for (const t of missingFromMigrations) console.log(`   ${t}`)

console.log(`\n── ${missingFromPrisma.length} runtime table(s) with no Prisma model — invisible to Prisma ──`)
for (const t of missingFromPrisma) console.log(`   ${t}`)

console.log(
  '\nMeasurement only — exits 0. The blocking version is the ratchet in PR #5,\n' +
    'which compares against a live schema and needs SUPABASE_DB_URL.',
)
