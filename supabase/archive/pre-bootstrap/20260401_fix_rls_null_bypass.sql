-- Fix RLS null bypass vulnerability
-- Remove OR user_id IS NULL clause from SELECT policies

-- citation_snapshots
DROP POLICY IF EXISTS "citation_snapshots_select" ON citation_snapshots;
CREATE POLICY "citation_snapshots_select" ON citation_snapshots FOR SELECT USING (auth.uid()::text = user_id);

-- brand_health_scores
DROP POLICY IF EXISTS "brand_health_scores_select" ON brand_health_scores;
CREATE POLICY "brand_health_scores_select" ON brand_health_scores FOR SELECT USING (auth.uid() = user_id);

-- alert_rules
DROP POLICY IF EXISTS "alert_rules_select" ON alert_rules;
CREATE POLICY "alert_rules_select" ON alert_rules FOR SELECT USING (auth.uid() = user_id);

-- alert_events
DROP POLICY IF EXISTS "alert_events_select" ON alert_events;
CREATE POLICY "alert_events_select" ON alert_events FOR SELECT USING (auth.uid() = user_id);

-- subscriptions
DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
CREATE POLICY "subscriptions_select" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- keyword_tracking
DROP POLICY IF EXISTS "keyword_tracking_select" ON keyword_tracking;
CREATE POLICY "keyword_tracking_select" ON keyword_tracking FOR SELECT USING (auth.uid() = user_id);

-- competitor_analyses
DROP POLICY IF EXISTS "competitor_analyses_select" ON competitor_analyses;
CREATE POLICY "competitor_analyses_select" ON competitor_analyses FOR SELECT USING (auth.uid() = user_id);

SELECT '✅ RLS policies fixed!' as status;
