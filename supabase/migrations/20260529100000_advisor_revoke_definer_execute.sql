-- Fix Supabase security advisors (2026-05-29)
-- Revoke public EXECUTE on SECURITY DEFINER utility functions.
--
-- Advisors 0028 / 0029
-- (anon_security_definer_function_executable /
--  authenticated_security_definer_function_executable):
-- these internal usage-tracking + SERP-cache functions run as SECURITY
-- DEFINER and were callable by the `anon` / `authenticated` roles via
-- PostgREST RPC (`/rest/v1/rpc/<fn>`). The app DOES call some of them
-- (serp-cache.ts, brave-search.ts, dataforseo-quota.ts) — but ONLY
-- through `createServerClient()`, which uses SUPABASE_SERVICE_KEY, i.e.
-- the service_role. So revoking EXECUTE from PUBLIC / anon / authenticated
-- closes the public RPC surface while keeping it for service_role, which
-- the server calls retain. (Local dev without a service key falls back to
-- the anon key; usage-tracking RPCs are best-effort there anyway.)
--
-- NOTE ON PROD DRIFT: the matching `search_path` and RLS-initplan advisors
-- are ALREADY fixed in the repo (20260528100000_fix_security_advisors.sql
-- sets search_path on every function; report_schedules / ai_cost_monitor
-- policies already use `(select auth.uid())`). If those advisors are still
-- firing in prod, it means the prod DB "aio advance" is BEHIND the repo —
-- apply the pending migrations (20260528000000, 20260528100000,
-- 20260529000000, then this one) to clear them.
--
-- This block is resilient: a function missing in prod is skipped, not fatal.

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
        raise notice 'advisor-revoke: function not found, skipping: %', fn;
    end;
  end loop;
end $$;
