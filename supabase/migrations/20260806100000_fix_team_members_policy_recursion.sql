-- team_members' SELECT policy referenced team_members, so evaluating it
-- required evaluating it. Postgres refuses:
--
--   infinite recursion detected in policy for relation "team_members"
--
-- Measured against production 2026-08-06 with the ANON key: every other table
-- answered "0 rows" as it should, and these two answered with that error —
-- team_members directly, brand_invitations because its own policy reads
-- team_members and inherits the recursion.
--
-- The application never hit this: every route uses the service-role client,
-- which bypasses RLS entirely. So the policy has been broken for as long as it
-- has existed and nothing noticed, because nothing depends on it yet. That is
-- precisely why it is worth fixing now — it is defence in depth that does not
-- currently defend, and the day something queries these tables with a user
-- session (a client component, a future RLS-based read) it fails closed with a
-- 500 rather than returning rows.
--
-- The fix is the standard one for self-referencing policies: move the lookup
-- into a SECURITY DEFINER function. It reads team_members as its owner, so no
-- policy fires, so there is no cycle.
--
-- Additive and forward-only. It replaces two policies with equivalents that do
-- the same thing without recursing; the access RULES are unchanged, including
-- keeping `status = 'accepted'` exactly as the current policies have it. Note
-- that the application's own checks denylist ('pending','declined') instead,
-- which is broader — the two agree today because the only writer writes
-- 'accepted', and aligning them is a separate decision, not a bug fix.

-- ─── The lookup, outside RLS ─────────────────────────────────────────────────
create or replace function public.accepted_member_brand_ids()
returns setof uuid
language sql
stable
security definer
-- Locked search_path, per the convention established in
-- 20260529110000_advisor_perf_and_search_path.sql: a definer function with a
-- mutable search_path can be redirected by a caller-controlled schema.
set search_path = public, pg_temp
as $$
  select tm.brand_id
  from public.team_members tm
  where tm.user_id::uuid = (select auth.uid())
    and tm.status = 'accepted'
$$;

comment on function public.accepted_member_brand_ids() is
  'Brands the current user is an accepted member of. SECURITY DEFINER so RLS policies on team_members can call it without recursing into themselves.';

-- Unlike the utility functions in 20260529100000, this one MUST be executable
-- by the querying roles: it is called from inside a policy, and a policy is
-- evaluated as the role running the query. Revoking here would turn the
-- recursion error into a permission error and fix nothing. It is safe to
-- expose: it filters on auth.uid(), which is NULL for anon, so an
-- unauthenticated caller gets an empty set.
grant execute on function public.accepted_member_brand_ids() to authenticated, anon;

-- ─── team_members ────────────────────────────────────────────────────────────
drop policy if exists team_members_select on public.team_members;

create policy team_members_select on public.team_members
  for select using (
    -- Rows of a brand you own.
    brand_id in (select id from public.brands where user_id = (select auth.uid())::text)
    -- Your own membership row, whoever owns the brand.
    or user_id::uuid = (select auth.uid())
    -- The roster of a brand you are an accepted member of — via the function,
    -- so this no longer reads team_members from inside team_members' policy.
    or brand_id in (select public.accepted_member_brand_ids())
  );

-- ─── brand_invitations ───────────────────────────────────────────────────────
-- Same predicate as before, with the inline team_members subquery replaced by
-- the function. Without this it would still recurse through team_members.
drop policy if exists "Brand owners and team can manage invitations" on public.brand_invitations;

create policy "Brand owners and team can manage invitations"
  on public.brand_invitations
  for all
  using (
    brand_id in (select id from public.brands where user_id = (select auth.uid())::text)
    or brand_id in (select public.accepted_member_brand_ids())
  )
  with check (
    brand_id in (select id from public.brands where user_id = (select auth.uid())::text)
    or brand_id in (select public.accepted_member_brand_ids())
  );
