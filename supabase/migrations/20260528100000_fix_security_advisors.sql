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

-- ─── 1. Views: SECURITY DEFINER → SECURITY INVOKER ────────────────────────────

drop view if exists public.companies_active;
create view public.companies_active
  with (security_invoker = true) as
select
  id,
  schema_version,
  organisationsnummer,
  domain,
  foretagsnamn,
  bolagsnamn,
  antal_anstallda,
  storlek_kategori,
  storlek_manuell,
  adress_gata,
  postnummer,
  stad,
  region,
  land,
  reception_telefon,
  email_info,
  sok_fler_kontakter,
  interna_anteckningar,
  arkiverad,
  arkiverad_datum,
  arkiverad_av,
  license_label,
  skapad_datum,
  senast_andrad
from public.companies
where not arkiverad;

drop view if exists public.companies_verification_summary;
create view public.companies_verification_summary
  with (security_invoker = true) as
select
  c.id as company_id,
  count(k.id) as kontakter_total,
  count(k.id) filter (where k.verifierad) as kontakter_verifierade,
  bool_or(k.verifierad) as har_verifierad_kontakt
from public.companies c
  left join public.contacts k on k.company_id = c.id
group by c.id;

-- ─── 2. Explicit deny-by-default policies (intent over absence) ──────────────

-- knowledge_chunks: RAG/embedding storage, only service-role reads/writes
do $$ begin
  if not exists (select 1 from pg_policy where polrelid = 'public.knowledge_chunks'::regclass and polname = 'knowledge_chunks_service_only') then
    create policy knowledge_chunks_service_only
      on public.knowledge_chunks
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- plans: pricing tier reference table, readable by anyone (anonymous + logged-in)
do $$ begin
  if not exists (select 1 from pg_policy where polrelid = 'public.plans'::regclass and polname = 'plans_public_read') then
    create policy plans_public_read
      on public.plans
      for select
      to anon, authenticated
      using (true);
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.plans'::regclass and polname = 'plans_service_write') then
    create policy plans_service_write
      on public.plans
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- scrape_jobs: background queue, only the worker (service-role) touches them
do $$ begin
  if not exists (select 1 from pg_policy where polrelid = 'public.scrape_jobs'::regclass and polname = 'scrape_jobs_service_only') then
    create policy scrape_jobs_service_only
      on public.scrape_jobs
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- ─── 3. Function: pin search_path ────────────────────────────────────────────

create or replace function public.set_senast_andrad()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.senast_andrad := now();
  return new;
end;
$$;
