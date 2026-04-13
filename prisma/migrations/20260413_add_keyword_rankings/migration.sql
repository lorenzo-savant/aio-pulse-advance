-- Migration: add_keyword_rankings
-- Created for aio-task-17-serp-tracker

CREATE TABLE IF NOT EXISTS "keyword_rankings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
    "brand_id" TEXT NOT NULL REFERENCES "brands"("id") ON DELETE CASCADE,
    "keyword" TEXT NOT NULL,
    "url" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "ai_overview_present" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "keyword_rankings_brand_keyword_date_unique" 
    ON "keyword_rankings" ("brand_id", "keyword", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "keyword_rankings_brand_id_idx" ON "keyword_rankings" ("brand_id");
CREATE INDEX IF NOT EXISTS "keyword_rankings_keyword_idx" ON "keyword_rankings" ("keyword");
CREATE INDEX IF NOT EXISTS "keyword_rankings_created_at_idx" ON "keyword_rankings" ("created_at" DESC);