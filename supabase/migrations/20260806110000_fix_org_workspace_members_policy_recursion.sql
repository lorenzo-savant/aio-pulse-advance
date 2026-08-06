-- Same class of bug as 20260806100000, on the multi-tenancy tables added in
-- 20260805120000_backfill_missing_create_table.sql:
--
--   organization_members_read  reads organization_members  (recursion)
--   workspace_members_read     reads workspace_members     (recursion)
--
-- The other four policies in that migration (organizations_read, workspaces_read,
-- api_keys_owner_only, audit_logs_read) reference organization_members from a
-- DIFFERENT table, so they evaluate fine — it is only the two self-referencing
-- policies that Postgres rejects with:
--
--   infinite recursion detected in policy for relation "organization_members"
--
-- As with team_members, the application never hits this because every route uses
-- the service-role client, so it is defence in depth that is worth fixing the
-- standard way: move the self-lookup into a SECURITY DEFINER function so no
-- policy fires on the inner read.

-- ─── The lookups, outside RLS ────────────────────────────────────────────────
create or replace function public.accepted_organization_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select om.organization_id
  from public.organization_members om
  where om.user_id::uuid = (select auth.uid())
$$;

comment on function public.accepted_organization_ids() is
  'Organizations the current user belongs to. SECURITY DEFINER so the organization_members_read policy can call it without recursing into itself.';

create or replace function public.accepted_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select wm.workspace_id
  from public.workspace_members wm
  where wm.user_id::uuid = (select auth.uid())
$$;

comment on function public.accepted_workspace_ids() is
  'Workspaces the current user belongs to. SECURITY DEFINER so the workspace_members_read policy can call it without recursing into itself.';

-- Same reasoning as accepted_member_brand_ids: these run inside policies, so the
-- querying roles must be able to execute them. Safe to expose — auth.uid() is
-- NULL for anon, so an unauthenticated caller gets an empty set.
grant execute on function public.accepted_organization_ids() to authenticated, anon;
grant execute on function public.accepted_workspace_ids() to authenticated, anon;

-- ─── organization_members ────────────────────────────────────────────────────
drop policy if exists organization_members_read on public.organization_members;

create policy organization_members_read on public.organization_members
  for select using (
    -- Your own membership row, whoever owns the organization.
    user_id = (select auth.uid())
    -- The roster of an organization you are in — via the function, so this no
    -- longer reads organization_members from inside its own policy.
    or organization_id in (select public.accepted_organization_ids())
  );

-- ─── workspace_members ───────────────────────────────────────────────────────
drop policy if exists workspace_members_read on public.workspace_members;

create policy workspace_members_read on public.workspace_members
  for select using (
    -- Your own membership row, whoever owns the workspace.
    user_id = (select auth.uid())
    -- The roster of a workspace you are in — via the function, same reasoning.
    or workspace_id in (select public.accepted_workspace_ids())
  );