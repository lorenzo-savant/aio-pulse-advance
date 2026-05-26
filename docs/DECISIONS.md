# Architectural Decisions

Living log of engineering decisions worth remembering. New decisions
go on top with a date and a short rationale. Don't litigate the
decision here — link to the PR/discussion if you want to argue.

---

## 2026-05-26 — Schema changes only via migration files (never via dashboard SQL)

**Context.** Multiple incidents in May 2026 traced back to schema drift
between the repo's `supabase/migrations/*.sql` and the production DB:
tables existed at runtime without a corresponding migration (so
`supabase db push` saw nothing to do, then on a re-run hit
`SQLSTATE 42710 — policy already exists`), or worse, code shipped that
referenced tables/columns that had never been created at all (the
entire `/dashboard/archive` subsystem — see commit `9ef4d41`).

**Decision.**

1. **Never** run schema-changing SQL in the Supabase dashboard, even for
   "quick fixes". Open a migration file in `supabase/migrations/` with
   the standard `YYYYMMDDHHMMSS_description.sql` naming and `db push`.
2. Migrations must be **idempotent**: `CREATE TABLE IF NOT EXISTS`,
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and the
   `DROP POLICY IF EXISTS / CREATE POLICY` pattern for RLS. Postgres
   does not provide `CREATE POLICY IF NOT EXISTS`, so the drop-then-
   create idiom is the only safe form.
3. After applying a migration, **regenerate types** with
   `npm run db:gen-types` and commit the resulting `database.ts`. The
   commit that adds the migration and the commit that adds the
   generated types should be the same commit.
4. If you find yourself reaching for `(db as any)` because a table
   isn't in the generated schema, ask: is the migration missing? Add
   it. If the table really shouldn't be in the schema (one-off RPC,
   external table), use `asUntyped()` from `src/lib/supabase-untyped.ts`
   with a comment explaining why.

**Why.** Drift is corrosive. Each incident costs ~30-60min of
investigation that returns zero product value, and the bugs surface
as "Failed to load X" alerts to users who can't reproduce the steps
that broke the schema in the first place.

---

## 2026-05-25 — Soft-fail on optional DB tables, fatal on primary

**Context.** Route patterns like "GSC data + monitoring_results" were
returning a generic 500 when GSC sync wasn't configured, even though
the citation/monitoring side could still produce a useful report.

**Decision.** Distinguish *primary signal* errors (kill the request,
return 500) from *augmentation* errors (log a warning, return
`signalAvailable: false`, build the partial result). Pattern lives in
the `/api/citations/cited-vs-ranking`, `/api/gsc/branded-search`, and
`/api/gsc/striking-distance` routes; copy it when adding new
multi-source aggregators.

**Why.** Users without every integration enabled outnumber users with
all of them. A panel showing "connect GSC to unlock SEO/AEO gap" is
strictly better than a red error.

---

## 2026-05-25 — `eslint-plugin-unused-imports` for autofixed dead imports

**Context.** `@typescript-eslint/no-unused-vars` flags unused imports
but doesn't autofix them. The codebase had accumulated ~80 unused
imports across ~60 files.

**Decision.** Added `eslint-plugin-unused-imports` (devDep) with
`'unused-imports/no-unused-imports': 'warn'` so `eslint --fix`
removes them. The standard `_`-prefix convention is also enabled for
intentional placeholders.

**Why.** Manual cleanup of 80 imports across 60 files is not a good
use of human or AI time. The plugin is widely adopted, well-maintained,
and zero runtime cost.
