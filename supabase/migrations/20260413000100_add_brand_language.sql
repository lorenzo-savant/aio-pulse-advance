-- Add primary market language to brands (for localized prompt generation)
-- Target markets: Sweden (sv), Italy (it), English (en fallback)
BEGIN;
ALTER TABLE brands
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en'
  CHECK (language IN ('en', 'it', 'sv'));
COMMIT;
