-- GEO Score snapshots — persistent history for the GEO Score per brand.
--
-- Why this table exists
-- ─────────────────────
-- /api/geo-score currently recomputes the GEO Score on every request from
-- brand_health_scores + site_audit_summary. That's fine for one-off reads
-- but produces three problems at scale:
--
--   1) History granularity. The "trend" line in the GEO dashboard is rebuilt
--      from health-score rows, so a request for "last 90 days" runs the
--      composite formula 90+ times per page load. Snapshotting daily costs
--      one INSERT per brand per day and turns history reads into a flat
--      `SELECT ... ORDER BY date`.
--
--   2) Alerting. To page on "GEO Score dropped below 60" or "delta <= −10
--      vs yesterday", a writer must persist the value at a known cadence
--      that the alert evaluator can read. Live recomputation can't fire
--      alerts.
--
--   3) Bulk re-scoring. When the GEO formula changes (weights, new pillar,
--      etc.) we need to backfill history with the new math. This table is
--      the target of that backfill — the source-of-truth is still
--      brand_health_scores.
--
-- Population
-- ──────────
-- Written by /api/cron/geo-analysis (daily 05:00 UTC on Mondays per
-- vercel.json, plus on-demand backfill via ?backfill=true&days=N).

create table if not exists public.geo_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  snapshot_date date not null,
  score numeric(5, 2) not null check (score >= 0 and score <= 100),
  grade text not null check (grade in ('A', 'B', 'C', 'D', 'F')),
  pillars jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  engine_breakdown jsonb,
  sample_size integer not null default 0,
  confidence text,
  previous_score numeric(5, 2),
  delta numeric(5, 2),
  triggered_alerts text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (brand_id, snapshot_date)
);

create index if not exists idx_geo_score_snapshots_brand_date
  on public.geo_score_snapshots (brand_id, snapshot_date desc);

create index if not exists idx_geo_score_snapshots_date
  on public.geo_score_snapshots (snapshot_date desc);

-- RLS — owner reads snapshots for their own brands; service_role full access
-- (the cron uses the service-role key to write).
alter table public.geo_score_snapshots enable row level security;

drop policy if exists geo_score_snapshots_owner_read on public.geo_score_snapshots;
create policy geo_score_snapshots_owner_read
  on public.geo_score_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.brands b
      -- brands.user_id is TEXT, auth.uid() is uuid — cast to text to match
      -- (every brand-scoped policy in the repo does this, e.g.
      -- citation_snapshots in 20260412000100). Without ::text Postgres
      -- raises "operator does not exist: text = uuid" and the policy fails.
      where b.id = geo_score_snapshots.brand_id
        and b.user_id = (select auth.uid())::text
    )
  );

drop policy if exists geo_score_snapshots_service_all on public.geo_score_snapshots;
create policy geo_score_snapshots_service_all
  on public.geo_score_snapshots
  for all
  to service_role
  using (true)
  with check (true);

-- Reference table grants — Supabase Oct 2026 enforcement (matches the pattern
-- from 20260528000000_postgrest_explicit_grants.sql).
grant all on public.geo_score_snapshots to postgres, authenticated, service_role;
