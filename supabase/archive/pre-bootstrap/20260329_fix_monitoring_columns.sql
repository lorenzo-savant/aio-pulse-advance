-- Add prompt_text column to monitoring_results (the code uses prompt_text, but table has query_text)
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS prompt_text TEXT;

-- Or rename query_text to prompt_text if it exists
-- ALTER TABLE monitoring_results RENAME COLUMN query_text TO prompt_text;

SELECT 'Done!' as status;
