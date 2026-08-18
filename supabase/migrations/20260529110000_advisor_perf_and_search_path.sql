-- Supabase advisor remediation — RLS initplan (2026-05-29, rewritten 2026-08-17)
--
-- 0003 auth_rls_initplan (PERFORMANCE): these policies call auth.uid() once per
-- ROW. Wrapping it as (select auth.uid()) makes Postgres evaluate it once per
-- QUERY instead. Semantically identical; drop+recreate from the repo's own
-- definitions, which remain the source of truth.
--
-- ═══ WHAT WAS REMOVED FROM THIS FILE, AND WHY (2026-08-17) ═══════════════════
-- Verified against prod "aio advance" (ncnxsathmuhggliuayjx) before editing.
--
-- Section A — pin search_path on 6 functions. DROPPED: already true in prod
-- (every one of the six carries a pinned search_path) and duplicated verbatim
-- by 20260616000000_apply_pending_advisor_fixes.sql, which is now the single
-- home for it. Keeping two copies meant two places to keep in step.
--
-- Section C — split team_members' FOR ALL policy into per-command writes.
-- DROPPED, and this one mattered: it dropped team_members_select and recreated
-- it with `brand_id in (select brand_id from public.team_members …)` — a policy
-- on team_members that reads team_members. 20260806100000 later replaced that
-- exact predicate with the SECURITY DEFINER function accepted_member_brand_ids()
-- precisely because Postgres rejects the self-reference with "infinite recursion
-- detected in policy for relation team_members". Prod already runs the fixed
-- version. Re-running section C would have dropped the fix and reinstated the
-- recursion — repaired only if the later migration also ran, in the same push,
-- without aborting in between. The multiple-permissive-policy advisor it was
-- meant to silence is the cheaper problem; if it is still worth closing, it
-- needs writing against the post-20260806100000 policy set, not this one.
--
-- What remains below is the only part prod still needs: six tables whose
-- policies were confirmed to be using bare auth.uid() on 2026-08-17.
--
-- ═══ CROSS-PROJECT SAFETY ════════════════════════════════════════════════════
-- This repo's `origin` fans out to more than one database, and these are AEO
-- Pulse tables. Guarded per the pattern in 20260528100000_fix_security_advisors:
-- every statement runs through EXECUTE behind a to_regclass check, so on a
-- database without these tables the block is a clean no-op instead of aborting
-- on "relation does not exist".
--
-- TRANSACTION WRAPPER: each policy is dropped and recreated, so run as ONE
-- transaction — there must be no window in which a table is left with no
-- permissive policy (RLS fails closed = deny-all). supabase db push already
-- wraps in a tx; the explicit pair also protects the manual SQL-editor path.
--
-- NOT TOUCHED HERE:
--   * brand_invitations and team_members — already carry (select auth.uid())
--     via 20260806100000. Leave them to that migration.
--   * public.audit_logs.audit_logs_select_org_admin — flagged by the advisor on
--     prod, but the policy exists ONLY on prod and has no definition anywhere in
--     this repo. Reproducing it from memory risked widening access. Whoever has
--     prod access must read the live definition first:
--       select pg_get_expr(polqual, polrelid) from pg_policy
--         where polname = 'audit_logs_select_org_admin';
--     then recreate it wrapping each auth.uid() as (select auth.uid()),
--     preserving the exact org/role columns.

begin;

do $$
declare
  stmt text;
  stmts text[] := array[
    -- report_schedules (user_id is uuid)
    'drop policy if exists report_schedules_select_own on public.report_schedules',
    'create policy report_schedules_select_own on public.report_schedules
       for select using ((select auth.uid()) = user_id)',
    'drop policy if exists report_schedules_insert_own on public.report_schedules',
    'create policy report_schedules_insert_own on public.report_schedules
       for insert with check ((select auth.uid()) = user_id)',
    'drop policy if exists report_schedules_update_own on public.report_schedules',
    'create policy report_schedules_update_own on public.report_schedules
       for update using ((select auth.uid()) = user_id)',
    'drop policy if exists report_schedules_delete_own on public.report_schedules',
    'create policy report_schedules_delete_own on public.report_schedules
       for delete using ((select auth.uid()) = user_id)'
  ];
begin
  if to_regclass('public.report_schedules') is null then
    raise notice 'advisor-initplan: report_schedules absent — skipping';
  else
    foreach stmt in array stmts loop execute stmt; end loop;
  end if;
end $$;

do $$
declare
  stmt text;
  stmts text[] := array[
    -- ai_cost_logs (user_id is text)
    'drop policy if exists "Users can view their own cost logs" on public.ai_cost_logs',
    'create policy "Users can view their own cost logs" on public.ai_cost_logs
       for select using ((select auth.uid())::text = user_id)',
    'drop policy if exists "Users can insert their own cost logs" on public.ai_cost_logs',
    'create policy "Users can insert their own cost logs" on public.ai_cost_logs
       for insert with check ((select auth.uid())::text = user_id)'
  ];
begin
  if to_regclass('public.ai_cost_logs') is null then
    raise notice 'advisor-initplan: ai_cost_logs absent — skipping';
  else
    foreach stmt in array stmts loop execute stmt; end loop;
  end if;
end $$;

do $$
declare
  stmt text;
  stmts text[] := array[
    -- ai_budgets (user_id is text)
    'drop policy if exists "Users can view their own budgets" on public.ai_budgets',
    'create policy "Users can view their own budgets" on public.ai_budgets
       for select using ((select auth.uid())::text = user_id)',
    'drop policy if exists "Users can insert their own budgets" on public.ai_budgets',
    'create policy "Users can insert their own budgets" on public.ai_budgets
       for insert with check ((select auth.uid())::text = user_id)',
    'drop policy if exists "Users can update their own budgets" on public.ai_budgets',
    'create policy "Users can update their own budgets" on public.ai_budgets
       for update using ((select auth.uid())::text = user_id)'
  ];
begin
  if to_regclass('public.ai_budgets') is null then
    raise notice 'advisor-initplan: ai_budgets absent — skipping';
  else
    foreach stmt in array stmts loop execute stmt; end loop;
  end if;
end $$;

do $$
declare
  stmt text;
  stmts text[] := array[
    -- work_orders (user_id is uuid)
    'drop policy if exists work_orders_owner on public.work_orders',
    'create policy work_orders_owner on public.work_orders
       for all
       using ((select auth.uid()) = user_id)
       with check ((select auth.uid()) = user_id)'
  ];
begin
  if to_regclass('public.work_orders') is null then
    raise notice 'advisor-initplan: work_orders absent — skipping';
  else
    foreach stmt in array stmts loop execute stmt; end loop;
  end if;
end $$;

do $$
declare
  stmt text;
  stmts text[] := array[
    -- prompt_embeddings (user_id is uuid)
    'drop policy if exists prompt_embeddings_owner on public.prompt_embeddings',
    'create policy prompt_embeddings_owner on public.prompt_embeddings
       for all
       using ((select auth.uid()) = user_id)
       with check ((select auth.uid()) = user_id)'
  ];
begin
  if to_regclass('public.prompt_embeddings') is null then
    raise notice 'advisor-initplan: prompt_embeddings absent — skipping';
  else
    foreach stmt in array stmts loop execute stmt; end loop;
  end if;
end $$;

do $$
declare
  stmt text;
  stmts text[] := array[
    -- response_embeddings (user_id is uuid)
    'drop policy if exists response_embeddings_owner on public.response_embeddings',
    'create policy response_embeddings_owner on public.response_embeddings
       for all
       using ((select auth.uid()) = user_id)
       with check ((select auth.uid()) = user_id)'
  ];
begin
  if to_regclass('public.response_embeddings') is null then
    raise notice 'advisor-initplan: response_embeddings absent — skipping';
  else
    foreach stmt in array stmts loop execute stmt; end loop;
  end if;
end $$;

commit;
