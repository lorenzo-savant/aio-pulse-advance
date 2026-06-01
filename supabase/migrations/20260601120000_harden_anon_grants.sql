-- Harden the over-broad grants from 20260528000000_postgrest_explicit_grants.
--
-- WHY
-- That catch-up migration ran:
--     grant all on all tables in schema public to postgres, anon, authenticated;
--     alter default privileges ... grant all on tables to ... anon, authenticated;
-- `grant all to anon` gives the PUBLIC (unauthenticated) role full SQL CRUD on
-- every public table. With the anon key shipped to every browser, the ONLY thing
-- standing between the internet and table writes is RLS — one missing/loose
-- policy = open write. Defense-in-depth wants narrow grants too, not RLS alone.
-- Also, `grant ... TRUNCATE` to anon/authenticated is especially dangerous:
-- TRUNCATE is NOT subject to RLS, so any caller could wipe a table regardless
-- of policies.
--
-- WHAT THIS DOES (and why it's safe for an auth-gated SaaS)
--   - anon: revoke INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER, keep SELECT.
--     RLS still gates which rows anon can read. This app performs no anon writes
--     (e.g. invitation acceptance uses the service-role client).
--   - authenticated: revoke TRUNCATE/REFERENCES/TRIGGER (RLS-exempt / DDL-ish),
--     keep SELECT/INSERT/UPDATE/DELETE (the standard Supabase model, RLS-gated).
--   - Reset ALTER DEFAULT PRIVILEGES so FUTURE tables created by `postgres`
--     don't re-inherit the wide grant.
--   - Sequences: drop anon's write (anon can't INSERT anymore, so it needs none).
--
-- Idempotent: REVOKE of a privilege not held is a no-op; safe to re-run and safe
-- on a DB where 20260528000000 was never applied.
--
-- NOTE on functions: the broad `grant all on functions ... to anon` from the
-- same catch-up migration is intentionally NOT blanket-revoked here, because
-- some SECURITY INVOKER RPCs may be legitimately called pre-login. The
-- dangerous SECURITY DEFINER ones (advisors 0028/0029) are revoked explicitly
-- in 20260529100000_advisor_revoke_definer_execute.sql.

-- ─── Tables ──────────────────────────────────────────────────────────────────
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon;

revoke truncate, references, trigger
  on all tables in schema public from authenticated;

-- ─── Sequences ───────────────────────────────────────────────────────────────
-- anon no longer inserts, so it needs no sequence privileges. Keep usage for
-- authenticated (needed for inserts that draw from serial/identity columns).
revoke all on all sequences in schema public from anon;
grant usage, select on all sequences in schema public to authenticated;

-- ─── Default privileges for FUTURE objects created by postgres ────────────────
-- Reset anon to read-only; strip TRUNCATE/etc from authenticated defaults.
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  grant select on tables to anon;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
