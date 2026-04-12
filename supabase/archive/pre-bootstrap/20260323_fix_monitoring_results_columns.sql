-- Add missing columns to monitoring_results
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS cited_urls TEXT[] DEFAULT '{}';
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS hallucination_flags JSONB DEFAULT '[]';
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS sentiment TEXT;
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS mention_type TEXT;
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS prompt_text TEXT;

-- Also fix user_id type if needed (should be UUID not TEXT)
-- This may fail if there are existing TEXT values, so we'll skip for now
