-- Provenance for an AEO snippet run: which provider supplied the questions.
--
-- Additive and forward-only. The column is nullable with no default, so every
-- existing run keeps reading as "unknown" rather than being retroactively
-- claimed to have come from Google's People-Also-Ask box. Nothing is rewritten.
--
-- WHY
-- runAEOGeneration asks DataForSEO for the real Google PAA box and, when that
-- returns nothing, falls back to Brave's `faq` component. The two are not
-- equivalent: Google's box draws questions from several domains, while Brave's
-- component can return one page's FAQ section whole. A run seeded with a URL
-- took exactly that path and came back carrying another organisation's FAQ —
-- questions, answer snippets and source URLs all pointing at a site unrelated
-- to the brand, ready to be exported as that brand's own FAQPage schema.
--
-- The provider that answered was written to the application log and nowhere
-- else, so after the fact there was no way to tell from the database which runs
-- had taken the fallback path and therefore needed review. Recording it makes
-- the affected runs queryable:
--
--   select id, brand_id, keyword, questions_count
--   from aeo_runs
--   where paa_source = 'brave';
--
-- The guards added alongside this migration (URL-seed rejection and
-- filterForeignPaa) stop the contamination at the source; this column is what
-- lets anyone audit the runs that predate them.

alter table public.aeo_runs
  add column if not exists paa_source text;

comment on column public.aeo_runs.paa_source is
  'Which provider supplied the PAA questions: ''dataforseo'' (Google People-Also-Ask box) or ''brave'' (Brave faq component fallback). Null for runs that predate this column, or that returned no questions.';
