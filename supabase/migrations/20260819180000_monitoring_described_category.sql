-- Category drift: how the engine described the brand, and how far that is from
-- the brand's real category.
--
-- Additive only. Both columns are nullable with no default and no backfill, so
-- this touches zero existing rows and cannot lose data: pre-existing rows read
-- NULL (= "not captured"), exactly like search_queries did when fan-out shipped.
--
-- described_category : one short phrase, the category the engine's answer put
--                      the brand in (e.g. "second-hand clothing shop").
-- category_drift     : 0-100 lexical distance from the brand's stated category
--                      (see src/lib/services/category-drift.ts). NULL = unknown,
--                      never read as 0.
--
-- Why not reuse hallucination_flags: a category mismatch states nothing false —
-- it is a positioning signal, not a hallucination, and folding it into that
-- column would inflate hallucination counts.

alter table public.monitoring_results
  add column if not exists described_category text;

alter table public.monitoring_results
  add column if not exists category_drift smallint;

comment on column public.monitoring_results.described_category is
  'One short phrase: the category the engine''s answer placed the brand in. NULL = not captured.';
comment on column public.monitoring_results.category_drift is
  '0-100 lexical distance between described_category and the brand''s stated category. NULL = unknown, not 0.';
