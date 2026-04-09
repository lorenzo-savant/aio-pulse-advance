-- Migration: add_soft_delete_columns
-- Run: npx prisma migrate dev --name add_soft_delete_columns
-- Or apply manually if migration fails

-- Add deletedAt column to brands
ALTER TABLE "brands" ADD COLUMN "deleted_at" TIMESTAMP;
CREATE INDEX IF NOT EXISTS "brands_deleted_at_idx" ON "brands" ("deleted_at");

-- Add deletedAt column to prompts
ALTER TABLE "prompts" ADD COLUMN "deleted_at" TIMESTAMP;
CREATE INDEX IF NOT EXISTS "prompts_deleted_at_idx" ON "prompts" ("deleted_at");

-- Add deletedAt column to alert_rules
ALTER TABLE "alert_rules" ADD COLUMN "deleted_at" TIMESTAMP;
CREATE INDEX IF NOT EXISTS "alert_rules_deleted_at_idx" ON "alert_rules" ("deleted_at");

-- Add deletedAt column to analysis_results
ALTER TABLE "analysis_results" ADD COLUMN "deleted_at" TIMESTAMP;
CREATE INDEX IF NOT EXISTS "analysis_results_deleted_at_idx" ON "analysis_results" ("deleted_at");
