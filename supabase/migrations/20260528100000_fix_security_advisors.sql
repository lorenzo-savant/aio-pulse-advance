-- Security advisor fixes (Supabase database-linter findings, May 2026)
--
-- 1) Two SECURITY DEFINER views (companies_active, companies_verification_summary)
--    bypass RLS — switch them to SECURITY INVOKER so they honour the caller's RLS.
-- 2) Three tables (knowledge_chunks, plans, scrape_jobs) have RLS enabled but
--    ZERO policies — add explicit service-role / public-read policies so the
--    intent is in the schema, not the absence of code.
-- 3) Trigger function set_senast_andrad() has a mutable search_path — pin it.
--
-- ═══ CROSS-PROJECT SAFETY (rewritten 2026-06-01) ═══════════════════════════════
-- EVERY object here belongs to the savantdatabas CRM project — NONE exist on
-- AEO Pulse ("aio advance"). This repo's `origin` fans out to both DBs, so this
-- migration must be a clean NO-OP on AEO Pulse.
--
-- Two earlier attempts tripped on subtle PL/pgSQL parse-time relation resolution
-- ('X'::regclass literals are constant-folded before the guarding IF can
-- short-circuit; CREATE VIEW's inner SELECT resolves its FROM relation when the
-- statement is processed). The bulletproof fix: ONE guard on public.companies
-- (the anchor CRM table — if it's absent, all the others are too, same DB), an
-- early RETURN when absent, and EVERY DDL wrapped in EXECUTE so nothing is even
-- parsed for relation resolution until it actually runs. On AEO Pulse the block
-- returns before any DDL string is reached → guaranteed no-op.

do $$
begin
  -- Anchor guard: all targets live in the same CRM DB as public.companies.
  if to_regclass('public.companies') is null then
    raise notice 'fix_security_advisors: CRM tables absent (not the savantdatabas project) — skipping entire migration as a no-op';
    return;
  end if;

  -- ─── 1. Views: SECURITY DEFINER → SECURITY INVOKER ──────────────────────────
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

  if to_regclass('public.contacts') is not null then
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
  end if;

  -- ─── 2. Explicit deny-by-default / read policies ────────────────────────────
  if to_regclass('public.knowledge_chunks') is not null
     and not exists (select 1 from pg_policy
                     where polrelid = to_regclass('public.knowledge_chunks')
                       and polname = 'knowledge_chunks_service_only') then
    execute 'create policy knowledge_chunks_service_only on public.knowledge_chunks
             for all to service_role using (true) with check (true)';
  end if;

  if to_regclass('public.plans') is not null then
    if not exists (select 1 from pg_policy
                   where polrelid = to_regclass('public.plans')
                     and polname = 'plans_public_read') then
      execute 'create policy plans_public_read on public.plans
               for select to anon, authenticated using (true)';
    end if;
    if not exists (select 1 from pg_policy
                   where polrelid = to_regclass('public.plans')
                     and polname = 'plans_service_write') then
      execute 'create policy plans_service_write on public.plans
               for all to service_role using (true) with check (true)';
    end if;
  end if;

  if to_regclass('public.scrape_jobs') is not null
     and not exists (select 1 from pg_policy
                     where polrelid = to_regclass('public.scrape_jobs')
                       and polname = 'scrape_jobs_service_only') then
    execute 'create policy scrape_jobs_service_only on public.scrape_jobs
             for all to service_role using (true) with check (true)';
  end if;

  -- ─── 3. Function: pin search_path ───────────────────────────────────────────
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
end $$;
