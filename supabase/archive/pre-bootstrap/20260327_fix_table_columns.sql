-- Add missing columns to competitor_analyses
ALTER TABLE competitor_analyses ADD COLUMN IF NOT EXISTS primary_url TEXT;
ALTER TABLE competitor_analyses ADD COLUMN IF NOT EXISTS competitors JSONB DEFAULT '{}';
ALTER TABLE competitor_analyses ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE competitor_analyses ADD COLUMN IF NOT EXISTS raw_response JSONB DEFAULT '{}';

-- Also fix citation_snapshots to use brand_id consistently
-- (project_id is the old name, brand_id is the new name)
ALTER TABLE citation_snapshots ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE CASCADE;

-- Copy project_id to brand_id if brand_id is null
UPDATE citation_snapshots 
SET brand_id = project_id::uuid 
WHERE brand_id IS NULL AND project_id IS NOT NULL;

-- Add missing columns to recommendation_history
ALTER TABLE recommendation_history ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE recommendation_history ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE recommendation_history ADD COLUMN IF NOT EXISTS implementation JSONB DEFAULT '{}';

SELECT '✅ Columns fixed!' as status;
