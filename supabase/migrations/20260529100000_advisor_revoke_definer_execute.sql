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
-- COMPANION: the remaining search_path advisors (6 functions) and the
-- RLS-initplan + multiple-permissive PERFORMANCE advisors are fixed in the
-- sibling migration 20260529110000_advisor_perf_and_search_path.sql. Apply
-- both together. Pending prod-apply order for "aio advance":
-- 20260528000000, 20260528100000, 20260529000000 (geo snapshots),
-- 20260529100000 (this), 20260529110000 (perf/search_path).
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
