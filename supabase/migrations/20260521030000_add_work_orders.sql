-- Work Orders — closes the advisor loop (idea from searchops-ai's
-- crawl→analyze→workorder→recheck). A recommendation becomes a TRACKABLE unit
-- of work with a status, and we snapshot the GEO score at creation (baseline)
-- and at completion (recheck) so we can attribute movement: "since you did X,
-- GEO score moved +Y".
--
-- NOTE: apply this BEFORE deploying the work-orders API.

create table if not exists public.work_orders (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null,
  title text not null,
  category text,
  impact text,
  effort text,
  rationale text,
  actions jsonb not null default '[]'::jsonb,
  -- open | in_progress | done | dismissed
  status text not null default 'open',
  -- advisor | audit | manual
  source text not null default 'advisor',
  baseline_geo_score numeric,
  recheck_geo_score numeric,
  recheck_delta numeric,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists work_orders_brand_idx on public.work_orders (brand_id);
create index if not exists work_orders_status_idx on public.work_orders (brand_id, status);

alter table public.work_orders enable row level security;

drop policy if exists work_orders_owner on public.work_orders;
create policy work_orders_owner on public.work_orders
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.work_orders is
  'Trackable advisor/audit recommendations with status + GEO baseline/recheck deltas (closed-loop).';
