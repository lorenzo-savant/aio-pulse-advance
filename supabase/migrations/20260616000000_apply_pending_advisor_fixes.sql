-- Catch-up: re-assert the Supabase security-advisor fixes on prod (2026-06-16)
--
-- WHY THIS EXISTS:
-- The prod database ("aio advance", ncnxsathmuhggliuayjx) still reports the
-- advisor warnings that 20260529100000_advisor_revoke_definer_execute.sql and
-- 20260529110000_advisor_perf_and_search_path.sql were written to fix — i.e.
-- those migrations were never applied to prod (migration drift; the prod
-- project lives under a different account than this repo's CLI/MCP can reach).
-- A fresh-timestamp migration is picked up by `supabase db push` even if the
-- older ones are recorded as applied in prod's migration table, so this
-- guarantees the fix lands.
--
-- SCOPE: only the two SECURITY advisor classes flagged on prod —
--   * 0011 function_search_path_mutable        (6 functions)
--   * 0028 / 0029 *_security_definer_function_executable (5 functions)
-- The RLS-initplan / multiple-permissive PERFORMANCE fixes from 20260529110000
-- (sections B/C) are deliberately NOT duplicated here: they recreate policies
-- on ~8 tables and would abort on any table missing from a drifted prod. They
-- remain available via that migration / `db push` when convenient.
--
-- Idempotent and resilient: each statement skips gracefully if its target is
-- absent, and re-running is a no-op. NOT addressed here (handled elsewhere):
--   * extension_in_public (pg_trgm) — risky to move (trigram indexes); left as-is.
--   * auth_leaked_password_protection — Supabase Dashboard toggle, not SQL.

begin;

-- ── 1. Revoke public EXECUTE on SECURITY DEFINER utility functions ───────────
-- These internal usage-tracking + SERP-cache functions were callable by the
-- anon/authenticated roles via PostgREST RPC. The app only ever calls them
-- through createServerClient() (service_role), so revoking public/anon/
-- authenticated closes the public RPC surface while keeping server calls working.
do $$
declare
  fn text;
  sigs text[] := array[
    'public.cleanup_expired_serp_cache()',
    'public.increment_brave_api_usage(text, integer)',
    'public.increment_dataforseo_usage(text, integer, integer)',
    'public.increment_serpapi_usage(text, integer)',
    'public.serp_cache_register_hit(text, text, text)'
  ];
begin
  foreach fn in array sigs loop
    begin
      execute format('revoke execute on function %s from public, anon, authenticated;', fn);
      execute format('grant execute on function %s to service_role;', fn);
    exception
      when undefined_function then
        raise notice 'advisor catch-up: function not found, skipping: %', fn;
    end;
  end loop;
end $$;

-- ── 2. Pin search_path on the flagged functions (by oid, all overloads) ──────
-- A role-mutable search_path lets a caller shadow unqualified names (now(),
-- table refs) via a temp schema. Pinning removes that. Trigger functions only
-- call now(); the credit functions reference public tables, so `public,
-- pg_temp` keeps both working while fixing the advisor.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'consume_free_query',
        'update_updated_at',
        'deduct_credits',
        'set_keyword_tracking_updated_at',
        'set_recommendation_tracking_updated_at',
        'tg_report_schedules_set_updated_at'
      )
  loop
    execute format('alter function %s set search_path = public, pg_temp;', r.sig);
  end loop;
end $$;

commit;
