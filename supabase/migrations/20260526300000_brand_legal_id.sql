-- Migration: add `legal_id` + `legal_id_type` to brands.
--
-- Universally-unique identifier for the legal entity behind the brand —
-- VAT number (EU), organisationsnummer (Sweden), codice fiscale (Italy),
-- EIN (US), etc. This is the single strongest LLMO signal for entity
-- resolution because:
--
--   1. It's globally unique — no two companies share an orgnr.
--   2. It links to authoritative registries (allabolag.se for Sweden,
--      registro imprese for Italy, VIES for EU VAT) which AI engines
--      have crawled.
--   3. Schema.org maps it directly to `vatID` (VAT) or `taxID` (other),
--      both of which feed Google Knowledge Graph + AI engine grounding.
--
-- legal_id_type drives the Schema.org mapping. We accept five values
-- so the operator can pick what they actually have without us inferring:
--   - 'vat'         → Schema.org vatID (any EU VAT, US sales tax)
--   - 'orgnr'       → Schema.org taxID (Swedish organisationsnummer)
--   - 'fiscal_code' → Schema.org taxID (codice fiscale Italian)
--   - 'ein'         → Schema.org taxID (US Employer Identification Number)
--   - 'other'       → Schema.org taxID (generic fallback)
--
-- Idempotent: ADD COLUMN IF NOT EXISTS handles partial prior runs.

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS legal_id text;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS legal_id_type text
  CHECK (legal_id_type IS NULL OR legal_id_type IN ('vat', 'orgnr', 'fiscal_code', 'ein', 'other'));

-- Index to support lookup by legal_id (useful for dedup checks across
-- workspaces — "is this org already in our system?").
CREATE INDEX IF NOT EXISTS idx_brands_legal_id ON public.brands(legal_id) WHERE legal_id IS NOT NULL;
