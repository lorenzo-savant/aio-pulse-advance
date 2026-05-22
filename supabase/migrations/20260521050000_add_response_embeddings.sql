-- Response embeddings — cache for thematic clustering of monitoring responses
-- ("what themes do AI engines associate with this brand?"). Stored as jsonb;
-- clustering loads them into memory (greedy centroid) — see response-clustering.ts.
-- (pgvector is the upgrade only at large scale, where an ANN index avoids the
-- O(N²) all-pairs work. At per-brand volumes, jsonb + in-memory is exact + simple.)
--
-- NOTE: apply before deploying /api/themes. The endpoint soft-fails without it.

create table if not exists public.response_embeddings (
  monitoring_result_id uuid primary key references public.monitoring_results(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null,
  text text not null,
  embedding jsonb not null,
  sentiment_score numeric,
  created_at timestamptz not null default now()
);

create index if not exists response_embeddings_brand_idx on public.response_embeddings (brand_id);

alter table public.response_embeddings enable row level security;

drop policy if exists response_embeddings_owner on public.response_embeddings;
create policy response_embeddings_owner on public.response_embeddings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.response_embeddings is
  'Cached text-embedding-3-small vectors (jsonb) of monitoring responses, for thematic clustering.';
