-- Query fan-out capture: the search strings an engine actually ran.
--
-- Additive and forward-only. The column is nullable with no default, so every
-- existing row keeps reading as "not captured" rather than being retroactively
-- claimed to have had an empty fan-out. Nothing is rewritten, nothing is
-- dropped, and no historical value changes.
--
-- WHY
-- When a question depends on what is true right now, an engine does not answer
-- from memory: it expands the question into one to three real web searches and
-- synthesises what it finds. Those search strings are the highest-value signal
-- in the whole pipeline, because they are what the brand is actually competing
-- for — and they are NOT the prompt we sent.
--
-- Measured live on 2026-08-19, prompt:
--   "Vilka sajter är bäst för att köpa begagnad elektronik i Sverige 2026?"
-- Gemini searched:
--   "basta sajter begagnad elektronik sverige"
--   "kop begagnad elektronik garanti sverige"
-- Diacritics stripped, the year dropped, one question split into two searches,
-- and a concept ("garanti") introduced that the prompt never contained.
-- Optimising a page for the prompt wording therefore optimises for a string
-- nobody searched.
--
-- Until now the APIs handed us this data on every grounded call and the parser
-- threw it away: ai-router declared groundingMetadata.webSearchQueries in its
-- response type and never read the field. It is not recoverable retroactively
-- (raw_response exists as a column but no writer ever populated it), so the
-- fan-out of every run before this migration is permanently lost. That is the
-- cost of the delay, and the reason to capture from now on.
--
-- SHAPE
-- text[] rather than jsonb: the payload is a short list of plain strings from
-- every provider that exposes it, and text[] gives us `unnest` aggregation and
-- GIN containment without JSON extraction at read time.
--
-- NULL vs '{}' — the distinction is load-bearing and must be preserved by
-- every writer:
--   NULL  = fan-out not captured (pre-migration row, or a provider that does
--           not expose its searches — Perplexity's sonar API returns
--           search_results and related_questions but never the queries).
--   '{}'  = the engine answered from model memory without searching at all.
-- Collapsing the two would turn "we cannot see it" into "it did not happen".

alter table public.monitoring_results
  add column if not exists search_queries text[];

comment on column public.monitoring_results.search_queries is
  'Query fan-out: the search strings the engine actually ran for this prompt. NULL = not captured (legacy row, or provider does not expose it); empty array = the engine did not search. Never overwrite a populated value with NULL.';

-- Aggregation reads unnest(search_queries) per brand over a date window; the
-- GIN index serves containment lookups ("which runs searched this string").
create index if not exists monitoring_results_search_queries_idx
  on public.monitoring_results using gin (search_queries);
