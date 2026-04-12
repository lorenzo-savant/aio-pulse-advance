-- Add AVI (AI Visibility Index) component columns to brand_health_scores
ALTER TABLE brand_health_scores
  ADD COLUMN IF NOT EXISTS avi_score DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS citation_rate DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mention_rate DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recommendation_rate DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS position_avg DOUBLE PRECISION DEFAULT 0;

-- Add unique constraint for daily upserts
ALTER TABLE brand_health_scores
  ADD CONSTRAINT brand_health_scores_brand_date_unique UNIQUE (brand_id, date);

CREATE INDEX IF NOT EXISTS idx_brand_health_scores_avi ON brand_health_scores(avi_score);
