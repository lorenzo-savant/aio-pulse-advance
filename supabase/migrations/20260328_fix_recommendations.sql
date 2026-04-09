-- Add missing columns to recommendation_history
ALTER TABLE recommendation_history ADD COLUMN IF NOT EXISTS recommendations JSONB DEFAULT '[]';
ALTER TABLE recommendation_history ADD COLUMN IF NOT EXISTS based_on_count INTEGER DEFAULT 0;
ALTER TABLE recommendation_history ADD COLUMN IF NOT EXISTS based_on_data JSONB DEFAULT '{}';

-- Also add missing columns to brand_health_scores
ALTER TABLE brand_health_scores ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

SELECT '✅ Done!' as status;
