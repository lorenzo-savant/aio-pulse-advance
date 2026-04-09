-- Make query_text nullable temporarily to debug
ALTER TABLE monitoring_results ALTER COLUMN query_text DROP NOT NULL;

SELECT 'Done!' as status;
