-- Migration: add brands.market (reference market)
--
-- Adds an optional free-text "reference market" to each brand (e.g. "Sweden",
-- "Italy B2B casting"). It complements brands.language: language drives the
-- prompt/output locale, while market describes WHO the brand sells to so the
-- generator + llms.txt synthesis don't default to a US/global context.
--
-- Nullable, no default: when empty, generation derives a market from the
-- brand language (sv→Sweden, it→Italy, else the configured geo market) — see
-- deriveMarket() in src/lib/services/llms-enrichment.ts. Idempotent so it is
-- safe to re-run.

ALTER TABLE brands ADD COLUMN IF NOT EXISTS market text;

COMMENT ON COLUMN brands.market IS 'Reference market the brand targets (free text). Optional; generation falls back to a language-derived market when null.';
