# Security Advisors — known accepted findings

> Run `mcp__supabase__get_advisors` (security) regularly. Every finding
> should either be fixed by a migration or documented here as
> accepted with justification. **An advisory not in this file or
> resolved is a debt that needs paying.**

Last audit: 2026-05-28 (8 findings → 2 accepted).

## Accepted (not fixing now)

### `extension_in_public` — pg_trgm

Postgres trigram extension is installed in the `public` schema. The
advisor recommends moving it to a dedicated `extensions` schema.

**Why we accept**: moving an extension that's already in use requires
`DROP EXTENSION ... CASCADE`, which drops every dependent index. The
`pg_trgm` GIN indexes on our search columns would have to be recreated
in a maintenance window, and the index rebuild on a multi-million-row
table is operationally expensive for a no-functionality-change.

**Risk**: low. The advisor is about hygiene, not exploitation. No
known CVE depends on schema placement.

**Revisit when**: doing the next major Postgres upgrade (15 → 17 was
done already; next one is 17 → 18). Run the extension move as part of
that maintenance window so the cost is amortised.

### `extension_in_public` — vector (pgvector)

Same as pg_trgm — pgvector is installed in `public`.

**Why we accept**: the `prompt_embeddings` and `response_embeddings`
tables both use the `vector` type. A CASCADE drop would lose every
embedding we've computed (millions of rows × 1536 floats). Re-embedding
costs both AI provider credits and elapsed time.

**Risk**: low. Same reasoning as pg_trgm.

**Revisit when**: next major Postgres upgrade, batched with pg_trgm.

## Resolved (history)

### 2026-05-28 — Migration `20260528100000_fix_security_advisors.sql`

- ✅ `security_definer_view` — `companies_active`: changed to
  `SECURITY INVOKER`. The view aggregates a single-tenant table; the
  prior DEFINER privilege escalated all callers to the owner.
- ✅ `security_definer_view` — `companies_verification_summary`: same
  fix.
- ✅ `rls_enabled_no_policy` — `knowledge_chunks`: added explicit
  `service_role` policy. RLS deny-by-default is preserved.
- ✅ `rls_enabled_no_policy` — `plans`: added `anon + authenticated`
  read policy + `service_role` write policy. `plans` is a pricing
  reference table, intentionally world-readable.
- ✅ `rls_enabled_no_policy` — `scrape_jobs`: added explicit
  `service_role` policy.
- ✅ `function_search_path_mutable` — `set_senast_andrad`: pinned
  `search_path = public, pg_temp` so a malicious user cannot shadow
  `now()` via a temp schema.

## Procedure for new findings

1. Open `mcp__supabase__get_advisors(type='security')`.
2. For each finding, decide:
   - **Fix**: write a migration that resolves it. Apply via
     `apply_migration` and commit the SQL to `supabase/migrations/`.
   - **Accept**: add a new section under "Accepted" with the
     justification, risk assessment, and "revisit when" trigger.
3. Re-run advisors. The remaining count should be the size of
   "Accepted" — no surprises.
