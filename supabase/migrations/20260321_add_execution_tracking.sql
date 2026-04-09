-- Add execution tracking columns to monitoring_results
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS execution_time_ms INTEGER;
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS cost_credits DOUBLE PRECISION;
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS primary_provider TEXT;
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS all_providers TEXT[] DEFAULT '{}';
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS failed_providers TEXT[] DEFAULT '{}';
ALTER TABLE monitoring_results ADD COLUMN IF NOT EXISTS response_comparison JSONB;

-- Create index for primary provider queries
CREATE INDEX IF NOT EXISTS idx_monitoring_results_primary_provider ON monitoring_results (primary_provider);
