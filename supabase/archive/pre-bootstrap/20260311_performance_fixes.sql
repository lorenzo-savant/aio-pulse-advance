-- Performance fixes migration
-- Generated from Supabase database linter recommendations

-- Drop unused indexes
DROP INDEX IF EXISTS citation_snapshots_project_idx;
DROP INDEX IF EXISTS citation_snapshots_date_idx;
DROP INDEX IF EXISTS citation_snapshots_engine_idx;
DROP INDEX IF EXISTS analysis_results_brand_idx;
DROP INDEX IF EXISTS monitoring_results_engine_idx;
DROP INDEX IF EXISTS alert_events_created_at_idx;
DROP INDEX IF EXISTS alert_events_is_read_idx;
DROP INDEX IF EXISTS brand_health_scores_brand_id_idx;
DROP INDEX IF EXISTS brand_health_scores_date_idx;
DROP INDEX IF EXISTS analysis_results_user_idx;
DROP INDEX IF EXISTS analysis_results_created_idx;
DROP INDEX IF EXISTS api_keys_user_id_idx;
DROP INDEX IF EXISTS api_keys_key_idx;
DROP INDEX IF EXISTS recommendation_history_brand_idx;
DROP INDEX IF EXISTS competitor_analyses_brand_idx;
DROP INDEX IF EXISTS competitor_analyses_user_idx;
DROP INDEX IF EXISTS recommendation_history_user_idx;
DROP INDEX IF EXISTS competitor_analyses_created_idx;
DROP INDEX IF EXISTS recommendation_history_created_idx;

-- Enable RLS on tables missing it in Supabase
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_health_scores ENABLE ROW LEVEL SECURITY;

-- Enable leaked password protection (handled via Supabase dashboard or API)
-- ALTER AUTH.config SET enable_signup = true;
-- ALTER AUTH.config SET security.enable_leaked_passwords_check = true;

-- Fix RLS policy performance: replace auth.uid() with (select auth.uid())
-- citation_snapoths
DROP POLICY IF EXISTS "users_own_citation_snapshots" ON citation_snapshots;
CREATE POLICY "users_own_citation_snapshots" ON citation_snapshots
  FOR SELECT USING (project_id IN (SELECT id FROM brands WHERE user_id = (select auth.uid())::text));

DROP POLICY IF EXISTS "users_insert_citation_snapshots" ON citation_snapshots;
CREATE POLICY "users_insert_citation_snapshots" ON citation_snapshots
  FOR INSERT WITH CHECK (project_id IN (SELECT id FROM brands WHERE user_id = (select auth.uid())::text));

-- analysis_results
DROP POLICY IF EXISTS "users_own_analysis" ON analysis_results;
CREATE POLICY "users_own_analysis" ON analysis_results
  FOR SELECT USING (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "users_insert_analysis" ON analysis_results;
CREATE POLICY "users_insert_analysis" ON analysis_results
  FOR INSERT WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "users_delete_analysis" ON analysis_results;
CREATE POLICY "users_delete_analysis" ON analysis_results
  FOR DELETE USING (user_id = (select auth.uid())::text);

-- competitor_analyses
DROP POLICY IF EXISTS "users_own_competitor" ON competitor_analyses;
CREATE POLICY "users_own_competitor" ON competitor_analyses
  FOR SELECT USING (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "users_insert_competitor" ON competitor_analyses;
CREATE POLICY "users_insert_competitor" ON competitor_analyses
  FOR INSERT WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "users_delete_competitor" ON competitor_analyses;
CREATE POLICY "users_delete_competitor" ON competitor_analyses
  FOR DELETE USING (user_id = (select auth.uid())::text);

-- recommendation_history
DROP POLICY IF EXISTS "users_own_recommendations" ON recommendation_history;
CREATE POLICY "users_own_recommendations" ON recommendation_history
  FOR SELECT USING (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "users_insert_recommendations" ON recommendation_history;
CREATE POLICY "users_insert_recommendations" ON recommendation_history
  FOR INSERT WITH CHECK (user_id = (select auth.uid())::text);

DROP POLICY IF EXISTS "users_delete_recommendations" ON recommendation_history;
CREATE POLICY "users_delete_recommendations" ON recommendation_history
  FOR DELETE USING (user_id = (select auth.uid())::text);
