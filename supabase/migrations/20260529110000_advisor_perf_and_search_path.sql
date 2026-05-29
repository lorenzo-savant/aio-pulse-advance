-- Supabase advisor remediation — performance + remaining search_path (2026-05-29)
--
-- Closes the advisor batch surfaced on prod "aio advance" that the repo had
-- NOT yet addressed (newer migrations used bare auth.uid() / unpinned
-- search_path). Three classes:
--
--   A) 0011 function_search_path_mutable (SECURITY): 6 trigger/utility
--      functions run with a role-mutable search_path. Pin it so a caller
--      can't shadow now()/etc via a temp schema. Done generically by oid
--      so we don't depend on exact arg signatures.
--
--   B) 0003 auth_rls_initplan (PERFORMANCE): policies call auth.uid()
--      per-row. Wrap as (select auth.uid()) so Postgres evaluates it once
--      per query. Semantically identical, drop+recreate from the repo's
--      own definitions (repo = source of truth).
--
--   C) 0006 multiple_permissive_policies (PERFORMANCE): team_members has a
--      FOR ALL policy overlapping a FOR SELECT policy on SELECT. Split the
--      FOR ALL into per-command write policies so SELECT has a single
--      permissive policy.
--
-- All idempotent. Safe to run on a DB where some objects already match.
--
-- TRANSACTION WRAPPER (important): Section C drops BOTH team_members policies
-- before recreating them. Run as ONE transaction so there is never a window
-- where team_members has no permissive policy (RLS fails closed = deny-all,
-- which would transiently break team/invitation reads for everyone). The
-- explicit begin/commit below guarantees this even if pasted statement-by-
-- statement into the Supabase SQL Editor. (supabase db push / apply_migration
-- already wrap in a tx; the explicit pair is harmless there and protects the
-- manual-paste path.)

begin;

-- ─── A. Pin search_path on flagged functions (by oid, all overloads) ─────────
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

-- ─── B. RLS initplan: wrap auth.uid() in (select auth.uid()) ─────────────────

-- report_schedules (user_id is uuid)
drop policy if exists report_schedules_select_own on public.report_schedules;
create policy report_schedules_select_own on public.report_schedules
  for select using ((select auth.uid()) = user_id);
drop policy if exists report_schedules_insert_own on public.report_schedules;
create policy report_schedules_insert_own on public.report_schedules
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists report_schedules_update_own on public.report_schedules;
create policy report_schedules_update_own on public.report_schedules
  for update using ((select auth.uid()) = user_id);
drop policy if exists report_schedules_delete_own on public.report_schedules;
create policy report_schedules_delete_own on public.report_schedules
  for delete using ((select auth.uid()) = user_id);

-- ai_cost_logs (user_id is text)
drop policy if exists "Users can view their own cost logs" on public.ai_cost_logs;
create policy "Users can view their own cost logs" on public.ai_cost_logs
  for select using ((select auth.uid())::text = user_id);
drop policy if exists "Users can insert their own cost logs" on public.ai_cost_logs;
create policy "Users can insert their own cost logs" on public.ai_cost_logs
  for insert with check ((select auth.uid())::text = user_id);

-- ai_budgets (user_id is text)
drop policy if exists "Users can view their own budgets" on public.ai_budgets;
create policy "Users can view their own budgets" on public.ai_budgets
  for select using ((select auth.uid())::text = user_id);
drop policy if exists "Users can insert their own budgets" on public.ai_budgets;
create policy "Users can insert their own budgets" on public.ai_budgets
  for insert with check ((select auth.uid())::text = user_id);
drop policy if exists "Users can update their own budgets" on public.ai_budgets;
create policy "Users can update their own budgets" on public.ai_budgets
  for update using ((select auth.uid())::text = user_id);

-- work_orders (user_id is uuid)
drop policy if exists work_orders_owner on public.work_orders;
create policy work_orders_owner on public.work_orders
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- prompt_embeddings (user_id is uuid)
drop policy if exists prompt_embeddings_owner on public.prompt_embeddings;
create policy prompt_embeddings_owner on public.prompt_embeddings
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- response_embeddings (user_id is uuid)
drop policy if exists response_embeddings_owner on public.response_embeddings;
create policy response_embeddings_owner on public.response_embeddings
  for all
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- audit_logs: INTENTIONALLY NOT TOUCHED HERE.
-- The advisor flags public.audit_logs.audit_logs_select_org_admin on prod,
-- but that table + policy exist ONLY on the prod DB — there is NO definition
-- in this repo (grep of supabase/migrations + src/types/database.ts = zero
-- hits). Reproducing the policy from memory risked widening access, so it is
-- deliberately left out. Whoever has prod access must fix it in place by
-- reading the live definition first:
--   select pg_get_expr(polqual, polrelid) from pg_policy
--     where polname = 'audit_logs_select_org_admin';
-- then re-create it wrapping each auth.uid() as (select auth.uid()),
-- preserving the exact org/role columns.

-- brand_invitations (brand owner OR any accepted team member).
-- Byte-for-byte faithful to 20260412000200_fix_invitations_rls.sql: same
-- predicates, same `user_id = auth.uid()::text` text casts, same
-- `status = 'accepted'` (NO role restriction — there is none in source).
-- The ONLY change is wrapping auth.uid() as (select auth.uid()) for the
-- initplan perf fix. Behaviourally identical to what is on prod today.
drop policy if exists "Brand owners and team can manage invitations" on public.brand_invitations;
create policy "Brand owners and team can manage invitations"
  on public.brand_invitations
  for all
  using (
    brand_id in (
      select id from public.brands where user_id = (select auth.uid())::text
    )
    or brand_id in (
      select brand_id from public.team_members
      where user_id = (select auth.uid())::text and status = 'accepted'
    )
  );

-- ─── C. team_members: remove SELECT overlap (FOR ALL → per-command writes) ───
-- Was: team_owner_manage FOR ALL + team_members_select FOR SELECT (overlap on
-- SELECT for every role). Split the FOR ALL into insert/update/delete so the
-- only SELECT-permissive policy is team_members_select.
drop policy if exists team_owner_manage on public.team_members;
drop policy if exists team_members_select on public.team_members;

create policy team_members_select on public.team_members
  for select using (
    brand_id in (select id from public.brands where user_id = (select auth.uid())::text)
    or brand_id in (
      select brand_id from public.team_members
      where user_id::uuid = (select auth.uid()) and status = 'accepted'
    )
  );

create policy team_owner_insert on public.team_members
  for insert with check (
    brand_id in (select id from public.brands where user_id = (select auth.uid())::text)
  );
create policy team_owner_update on public.team_members
  for update using (
    brand_id in (select id from public.brands where user_id = (select auth.uid())::text)
  );
create policy team_owner_delete on public.team_members
  for delete using (
    brand_id in (select id from public.brands where user_id = (select auth.uid())::text)
  );

commit;
