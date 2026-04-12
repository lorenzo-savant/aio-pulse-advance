-- Add soft delete columns
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
ALTER TABLE "prompts" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;
ALTER TABLE "analysis_results" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP;

-- Create indexes
CREATE INDEX IF NOT EXISTS "brands_deleted_at_idx" ON "brands" ("deleted_at");
CREATE INDEX IF NOT EXISTS "prompts_deleted_at_idx" ON "prompts" ("deleted_at");
CREATE INDEX IF NOT EXISTS "alert_rules_deleted_at_idx" ON "alert_rules" ("deleted_at");
CREATE INDEX IF NOT EXISTS "analysis_results_deleted_at_idx" ON "analysis_results" ("deleted_at");
