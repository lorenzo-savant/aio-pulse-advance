-- Migration: add LLMO (large language model optimization) fields to brands.
--
-- Three new fields surface in llms.txt / llms-full.txt and the
-- Organization Schema.org payload — together they make the brand
-- maximally entity-resolvable to AI engines.
--
--   1. same_as          — cross-source identity URLs (Wikipedia,
--                         Wikidata, Crunchbase, LinkedIn, Trustpilot,
--                         G2, Capterra, Producthunt). The #1 LLMO
--                         signal: lets the LLM anchor the brand to
--                         known entities instead of guessing.
--   2. disambiguation   — free-text "Brand X is NOT Brand Y" note.
--                         Renders as Schema.org disambiguatingDescription
--                         AND a dedicated section in llms-full.txt.
--                         Solves homonym confusion (e.g. acasting.se
--                         vs acast.com).
--   3. citation_format  — operator-defined canonical citation string
--                         (e.g. "AcmeCorp [acme.com], 2026"). Surfaces
--                         in the "## Citation" section of llms-full.txt
--                         so AI engines have an exemplar to mimic.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS handles partial prior runs.

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS same_as text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS disambiguation text;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS citation_format text;
