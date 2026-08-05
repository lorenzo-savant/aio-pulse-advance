-- Provenance for a monitoring result: which provider actually answered, and
-- where its citations came from.
--
-- Additive and forward-only. Both columns are nullable with no default, so
-- every existing row keeps reading as "unknown" rather than being retroactively
-- claimed to have been produced by the requested engine, or to have carried
-- real citations. Nothing is rewritten.
--
-- WHY response_provider
-- `engine` records the engine the caller ASKED for. ai-router.ts falls back to
-- Gemini when a provider is unconfigured or errors, and returns the provider
-- that actually served the request — which the pipeline destructured and then
-- discarded. So an OpenAI→Gemini fallback was stored as engine='chatgpt',
-- billed at ChatGPT rates, and compared per-engine in reports against results
-- that really did come from ChatGPT. The per-engine comparison is the product's
-- core claim; it cannot rest on the label of the request.
--
-- WHY citation_source
-- When a response contains no URLs, the pipeline substitutes Brave results for
-- the QUERY — not for the response — and stores them in cited_urls unmarked.
-- citationRate is 20% of the AVI, so for those rows the AVI has been measuring
-- Brave's coverage of the query rather than whether the engine cited anyone.
-- Marking the substitution lets the score count only real citations while the
-- URLs stay available to the report.
--
--   'engine'         — URLs the engine returned, or that appeared in its answer
--   'brave_fallback' — substituted from a Brave search on the query
--   NULL             — pre-migration row, provenance unknown

alter table public.monitoring_results
  add column if not exists response_provider text;

alter table public.monitoring_results
  add column if not exists citation_source text;

alter table public.monitoring_results
  drop constraint if exists monitoring_results_citation_source_check;

alter table public.monitoring_results
  add constraint monitoring_results_citation_source_check
  check (citation_source is null or citation_source in ('engine', 'brave_fallback'));

comment on column public.monitoring_results.response_provider is
  'Provider that actually served the response (e.g. gemini:flash-2.5) after any router fallback. NULL for rows written before this column existed. Compare per-engine on this, not on `engine`, which is only what was requested.';

comment on column public.monitoring_results.citation_source is
  'Provenance of cited_urls: engine | brave_fallback | NULL (unknown). brave_fallback URLs answer the query, not the response, and must not count towards citationRate.';

-- Reporting reads these per brand over a date window.
create index if not exists monitoring_results_response_provider_idx
  on public.monitoring_results (response_provider);
