-- Prompt embeddings — lightweight semantic layer for prompt de-duplication.
-- Embeddings are stored as jsonb (a float array) and compared in-memory with
-- cosine similarity; a brand's prompt set is small, so this avoids the pgvector
-- extension + ANN index entirely. (pgvector would be the upgrade for
-- large-scale RESPONSE clustering, not per-brand prompt dedup.)
--
-- NOTE: apply this BEFORE deploying. The prompts API soft-fails if it's missing
-- (dedup just won't run), so it's non-breaking, but the feature needs the table.

create table if not exists public.prompt_embeddings (
  prompt_id uuid primary key references public.prompts(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null,
  text text not null,
  embedding jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists prompt_embeddings_brand_idx on public.prompt_embeddings (brand_id);

alter table public.prompt_embeddings enable row level security;

drop policy if exists prompt_embeddings_owner on public.prompt_embeddings;
create policy prompt_embeddings_owner on public.prompt_embeddings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.prompt_embeddings is
  'Per-prompt text-embedding-3-small vectors (jsonb) for in-memory semantic prompt de-duplication.';
