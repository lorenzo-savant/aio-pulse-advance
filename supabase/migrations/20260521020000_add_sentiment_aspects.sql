-- Aspect-based sentiment (ABSA): per-result breakdown of how the AI response
-- felt about specific facets of the brand (pricing, support, quality, …).
-- Stored as a small JSON array: [{ "aspect": "pricing", "sentiment": "negative" }, …].
-- Powers the "what drives sentiment" aggregation in /api/sentiment.
--
-- NOTE: apply this BEFORE deploying the monitoring code that writes the column,
-- otherwise inserts that include sentiment_aspects will fail.

alter table public.monitoring_results
  add column if not exists sentiment_aspects jsonb not null default '[]'::jsonb;

comment on column public.monitoring_results.sentiment_aspects is
  'Aspect-based sentiment array: [{aspect, sentiment}] over a fixed taxonomy (pricing, quality, support, reliability, usability, features, reputation, value).';
