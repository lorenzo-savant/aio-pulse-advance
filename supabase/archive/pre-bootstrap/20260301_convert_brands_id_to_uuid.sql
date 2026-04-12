-- Convert brands.id and brand_id columns from text to uuid
-- The existing values are already UUIDs stored as text

BEGIN;

-- 0. Drop existing foreign key constraints and RLS policies that depend on brands.id
ALTER TABLE analysis_results DROP CONSTRAINT IF EXISTS analysis_results_brand_id_fkey;
ALTER TABLE competitor_analyses DROP CONSTRAINT IF EXISTS competitor_analyses_brand_id_fkey;
ALTER TABLE recommendation_history DROP CONSTRAINT IF EXISTS recommendation_history_brand_id_fkey;
ALTER TABLE prompts DROP CONSTRAINT IF EXISTS prompts_brand_id_fkey;
ALTER TABLE monitoring_results DROP CONSTRAINT IF EXISTS monitoring_results_brand_id_fkey;
ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS alert_rules_brand_id_fkey;
ALTER TABLE alert_events DROP CONSTRAINT IF EXISTS alert_events_brand_id_fkey;
ALTER TABLE brand_health_scores DROP CONSTRAINT IF EXISTS brand_health_scores_brand_id_fkey;

DROP POLICY IF EXISTS users_own_citation_snapshots ON citation_snapshots;
DROP POLICY IF EXISTS users_insert_citation_snapshots ON citation_snapshots;

-- 1. Convert brands.id from text to uuid
ALTER TABLE brands ADD COLUMN id_new uuid;
UPDATE brands SET id_new = id::uuid;
ALTER TABLE brands DROP COLUMN id;
ALTER TABLE brands RENAME COLUMN id_new TO id;
ALTER TABLE brands ADD PRIMARY KEY (id);

-- 1b. Convert brands.user_id from text to uuid
ALTER TABLE brands ADD COLUMN user_id_new uuid;
UPDATE brands SET user_id_new = user_id::uuid WHERE user_id IS NOT NULL;
ALTER TABLE brands DROP COLUMN user_id;
ALTER TABLE brands RENAME COLUMN user_id_new TO user_id;

-- 2. Convert brand_id in analysis_results
ALTER TABLE analysis_results ADD COLUMN brand_id_new uuid;
UPDATE analysis_results SET brand_id_new = brand_id::uuid WHERE brand_id IS NOT NULL;
ALTER TABLE analysis_results DROP COLUMN brand_id;
ALTER TABLE analysis_results RENAME COLUMN brand_id_new TO brand_id;

-- 3. Convert brand_id in competitor_analyses  
ALTER TABLE competitor_analyses ADD COLUMN brand_id_new uuid;
UPDATE competitor_analyses SET brand_id_new = brand_id::uuid WHERE brand_id IS NOT NULL;
ALTER TABLE competitor_analyses DROP COLUMN brand_id;
ALTER TABLE competitor_analyses RENAME COLUMN brand_id_new TO brand_id;

-- 4. Convert brand_id in recommendation_history
ALTER TABLE recommendation_history ADD COLUMN brand_id_new uuid;
UPDATE recommendation_history SET brand_id_new = brand_id::uuid WHERE brand_id IS NOT NULL;
ALTER TABLE recommendation_history DROP COLUMN brand_id;
ALTER TABLE recommendation_history RENAME COLUMN brand_id_new TO brand_id;

-- 5. Convert brand_id in prompts
ALTER TABLE prompts ADD COLUMN brand_id_new uuid;
UPDATE prompts SET brand_id_new = brand_id::uuid WHERE brand_id IS NOT NULL;
ALTER TABLE prompts DROP COLUMN brand_id;
ALTER TABLE prompts RENAME COLUMN brand_id_new TO brand_id;

-- 6. Convert brand_id in monitoring_results
ALTER TABLE monitoring_results ADD COLUMN brand_id_new uuid;
UPDATE monitoring_results SET brand_id_new = brand_id::uuid WHERE brand_id IS NOT NULL;
ALTER TABLE monitoring_results DROP COLUMN brand_id;
ALTER TABLE monitoring_results RENAME COLUMN brand_id_new TO brand_id;

-- 7. Convert brand_id in alert_rules
ALTER TABLE alert_rules ADD COLUMN brand_id_new uuid;
UPDATE alert_rules SET brand_id_new = brand_id::uuid WHERE brand_id IS NOT NULL;
ALTER TABLE alert_rules DROP COLUMN brand_id;
ALTER TABLE alert_rules RENAME COLUMN brand_id_new TO brand_id;

-- 8. Convert brand_id in alert_events
ALTER TABLE alert_events ADD COLUMN brand_id_new uuid;
UPDATE alert_events SET brand_id_new = brand_id::uuid WHERE brand_id IS NOT NULL;
ALTER TABLE alert_events DROP COLUMN brand_id;
ALTER TABLE alert_events RENAME COLUMN brand_id_new TO brand_id;

-- 9. Convert brand_id in brand_health_scores
ALTER TABLE brand_health_scores ADD COLUMN brand_id_new uuid;
UPDATE brand_health_scores SET brand_id_new = brand_id::uuid WHERE brand_id IS NOT NULL;
ALTER TABLE brand_health_scores DROP COLUMN brand_id;
ALTER TABLE brand_health_scores RENAME COLUMN brand_id_new TO brand_id;

-- 10. Recreate foreign key constraints
ALTER TABLE analysis_results ADD CONSTRAINT analysis_results_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE competitor_analyses ADD CONSTRAINT competitor_analyses_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE recommendation_history ADD CONSTRAINT recommendation_history_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE prompts ADD CONSTRAINT prompts_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE monitoring_results ADD CONSTRAINT monitoring_results_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE alert_rules ADD CONSTRAINT alert_rules_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE alert_events ADD CONSTRAINT alert_events_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;
ALTER TABLE brand_health_scores ADD CONSTRAINT brand_health_scores_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES brands(id) ON DELETE CASCADE;

-- 11. Recreate RLS policies for citation_snapshots
-- First convert project_id in citation_snapshots
ALTER TABLE citation_snapshots ADD COLUMN project_id_new uuid;
UPDATE citation_snapshots SET project_id_new = project_id::uuid WHERE project_id IS NOT NULL;
ALTER TABLE citation_snapshots DROP COLUMN project_id;
ALTER TABLE citation_snapshots RENAME COLUMN project_id_new TO project_id;

CREATE POLICY users_own_citation_snapshots ON citation_snapshots FOR SELECT USING (project_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));
CREATE POLICY users_insert_citation_snapshots ON citation_snapshots FOR INSERT WITH CHECK (project_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

COMMIT;
