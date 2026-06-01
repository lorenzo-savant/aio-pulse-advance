-- Security advisor fixes (Supabase database-linter findings, May 2026)
--
-- 1) Two SECURITY DEFINER views bypass RLS — they enforce the *creator's*
--    permissions instead of the querying user's. Both are safe to switch to
--    INVOKER because they don't read anything the underlying table RLS
--    wouldn't already let the caller see; switching makes them honour RLS.
--
-- 2) Three tables (knowledge_chunks, plans, scrape_jobs) have RLS enabled
--    but ZERO policies — net effect "deny everything to non-service-role".
--    That's the intended behaviour, but the advisor (rightly) flags it
--    because silent deny-all is indistinguishable from "we forgot to add
--    policies". We add explicit "service_role only" policies so the intent
--    is in the schema, not the absence of code.
--
-- 3) Trigger function set_senast_andrad() has a mutable search_path —
--    fixable by binding search_path with `SET` so a malicious user can't
--    shadow `now()` via a temp schema search trick.
--
-- CROSS-PROJECT SAFETY (2026-06-01): the objects below originate from the
-- savantdatabas CRM project (companies/contacts/knowledge_chunks/plans/
-- scrape_jobs/set_senast_andrad). This repo's `origin` fans out to multiple
-- Supabase DBs (incl. AEO Pulse "aio advance", which has NONE of these
-- tables). Every statement is now guarded by to_regclass so the migration is
-- a clean no-op where a target object is absent, instead of aborting the whole
-- `supabase db push` on `relation "public.companies" does not exist` and
-- blocking later migrations (e.g. geo_score_snapshots).

-- ─── 1. Views: SECURITY DEFINER → SECURITY INVOKER ────────────────────────────
-- Only (re)create where the base tables exist.

do $$ begin
  if to_regclass('public.companies') is not null then
    execute 'drop view if exists public.companies_active';
    execute $v$
      create view public.companies_active
        with (security_invoker = true) as
      select
        id, schema_version, organisationsnummer, domain, foretagsnamn,
        bolagsnamn, antal_anstallda, storlek_kategori, storlek_manuell,
        adress_gata, postnummer, stad, region, land, reception_telefon,
        email_info, sok_fler_kontakter, interna_anteckningar, arkiverad,
        arkiverad_datum, arkiverad_av, license_label, skapad_datum, senast_andrad
      from public.companies
      where not arkiverad
    $v$;
  else
    raise notice 'skip companies_active: public.companies not present';
  end if;

  if to_regclass('public.companies') is not null
     and to_regclass('public.contacts') is not null then
    execute 'drop view if exists public.companies_verification_summary';
    execute $v$
      create view public.companies_verification_summary
        with (security_invoker = true) as
      select
        c.id as company_id,
        count(k.id) as kontakter_total,
        count(k.id) filter (where k.verifierad) as kontakter_verifierade,
        bool_or(k.verifierad) as har_verifierad_kontakt
      from public.companies c
        left join public.contacts k on k.company_id = c.id
      group by c.id
    $v$;
  else
    raise notice 'skip companies_verification_summary: companies/contacts not present';
  end if;
end $$;

-- ─── 2. Explicit deny-by-default policies (intent over absence) ──────────────
-- IMPORTANT: use to_regclass() for the policy-existence lookup too, NOT a
-- 'public.X'::regclass literal cast. A literal ::regclass is constant-folded
-- at PLAN time (before the enclosing IF can short-circuit), so it throws
-- "relation does not exist" on a DB lacking the table even when the guard is
-- false. to_regclass() returns NULL instead. (These CRM tables —
-- knowledge_chunks/plans/scrape_jobs — live in savantdatabas, not AEO Pulse.)

-- knowledge_chunks: RAG/embedding storage, only service-role reads/writes
do $$
declare rel oid := to_regclass('public.knowledge_chunks');
begin
  if rel is not null
     and not exists (
       select 1 from pg_policy
       where polrelid = rel and polname = 'knowledge_chunks_service_only'
     ) then
    create policy knowledge_chunks_service_only
      on public.knowledge_chunks
      for all to service_role using (true) with check (true);
  end if;
end $$;

-- plans: pricing tier reference table, readable by anyone (anonymous + logged-in)
do $$
declare rel oid := to_regclass('public.plans');
begin
  if rel is not null then
    if not exists (
      select 1 from pg_policy where polrelid = rel and polname = 'plans_public_read'
    ) then
      create policy plans_public_read
        on public.plans for select to anon, authenticated using (true);
    end if;
    if not exists (
      select 1 from pg_policy where polrelid = rel and polname = 'plans_service_write'
    ) then
      create policy plans_service_write
        on public.plans for all to service_role using (true) with check (true);
    end if;
  end if;
end $$;

-- scrape_jobs: background queue, only the worker (service-role) touches them
do $$
declare rel oid := to_regclass('public.scrape_jobs');
begin
  if rel is not null
     and not exists (
       select 1 from pg_policy
       where polrelid = rel and polname = 'scrape_jobs_service_only'
     ) then
    create policy scrape_jobs_service_only
      on public.scrape_jobs
      for all to service_role using (true) with check (true);
  end if;
end $$;

-- ─── 3. Function: pin search_path ────────────────────────────────────────────
-- Only relevant to the CRM project that owns the companies tables. Guard on
-- companies so we don't create an orphan CRM trigger function on AEO Pulse.

do $$ begin
  if to_regclass('public.companies') is not null then
    execute $fn$
      create or replace function public.set_senast_andrad()
      returns trigger
      language plpgsql
      security invoker
      set search_path = public, pg_temp
      as $body$
      begin
        new.senast_andrad := now();
        return new;
      end;
      $body$
    $fn$;
  else
    raise notice 'skip set_senast_andrad: public.companies not present';
  end if;
end $$;
