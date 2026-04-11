-- ============================================================================
-- AIO Pulse Advance — RLS Policies & Auth Configuration
-- Run against: xivmecvzfbnojozgsgxv.supabase.co
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE citation_snapshots ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- BRANDS
-- ============================================================================
CREATE POLICY "Users can view own brands"
  ON brands FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert own brands"
  ON brands FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own brands"
  ON brands FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete own brands"
  ON brands FOR DELETE
  USING (user_id = auth.uid()::text);

-- Team members can view brands they belong to
CREATE POLICY "Team members can view brands"
  ON brands FOR SELECT
  USING (
    id IN (
      SELECT brand_id FROM team_members
      WHERE user_id = auth.uid()::text AND status = 'accepted'
    )
  );

-- ============================================================================
-- PROMPTS
-- ============================================================================
CREATE POLICY "Users can manage own prompts"
  ON prompts FOR ALL
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- MONITORING RESULTS
-- ============================================================================
CREATE POLICY "Users can view own monitoring results"
  ON monitoring_results FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert monitoring results"
  ON monitoring_results FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- ============================================================================
-- ALERT RULES
-- ============================================================================
CREATE POLICY "Users can manage own alert rules"
  ON alert_rules FOR ALL
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- ALERT EVENTS
-- ============================================================================
CREATE POLICY "Users can view own alert events"
  ON alert_events FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can update own alert events"
  ON alert_events FOR UPDATE
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- BRAND HEALTH SCORES
-- ============================================================================
CREATE POLICY "Users can view own health scores"
  ON brand_health_scores FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can upsert own health scores"
  ON brand_health_scores FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update own health scores"
  ON brand_health_scores FOR UPDATE
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- SUBSCRIPTIONS
-- ============================================================================
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- CREDITS
-- ============================================================================
CREATE POLICY "Users can view own credits"
  ON credits FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert credits"
  ON credits FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- ============================================================================
-- CREDIT USAGE
-- ============================================================================
CREATE POLICY "Users can view own credit usage"
  ON credit_usage FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert credit usage"
  ON credit_usage FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- ============================================================================
-- TEAM MEMBERS
-- ============================================================================
CREATE POLICY "Users can view team members of own brands"
  ON team_members FOR SELECT
  USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()::text)
    OR user_id = auth.uid()::text
  );

CREATE POLICY "Brand owners can manage team members"
  ON team_members FOR ALL
  USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()::text)
  );

-- ============================================================================
-- BRAND INVITATIONS
-- ============================================================================
CREATE POLICY "Brand owners can manage invitations"
  ON brand_invitations FOR ALL
  USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()::text)
  );

-- Public access for accepting invitations by token
CREATE POLICY "Anyone can read invitations by token"
  ON brand_invitations FOR SELECT
  USING (true);

-- ============================================================================
-- API KEYS
-- ============================================================================
CREATE POLICY "Users can manage own API keys"
  ON api_keys FOR ALL
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- ANALYSIS RESULTS
-- ============================================================================
CREATE POLICY "Users can manage own analysis results"
  ON analysis_results FOR ALL
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- COMPETITOR ANALYSES
-- ============================================================================
CREATE POLICY "Users can manage own competitor analyses"
  ON competitor_analyses FOR ALL
  USING (user_id = auth.uid()::text);

-- ============================================================================
-- RECOMMENDATION HISTORY
-- ============================================================================
CREATE POLICY "Users can view own recommendations"
  ON recommendation_history FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert recommendations"
  ON recommendation_history FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- ============================================================================
-- CITATION SNAPSHOTS
-- ============================================================================
CREATE POLICY "Users can view snapshots of own brands"
  ON citation_snapshots FOR SELECT
  USING (
    project_id IN (SELECT id FROM brands WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "Users can insert snapshots for own brands"
  ON citation_snapshots FOR INSERT
  WITH CHECK (
    project_id IN (SELECT id FROM brands WHERE user_id = auth.uid()::text)
  );

CREATE POLICY "Users can update snapshots for own brands"
  ON citation_snapshots FOR UPDATE
  USING (
    project_id IN (SELECT id FROM brands WHERE user_id = auth.uid()::text)
  );

-- ============================================================================
-- SERVICE ROLE BYPASS (for cron jobs, server-side operations)
-- The service_role key bypasses RLS automatically in Supabase.
-- No additional policies needed for server-side operations.
-- ============================================================================

-- ============================================================================
-- HELPER: Create a function to get user's brand IDs (for complex queries)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_user_brand_ids(p_user_id text)
RETURNS SETOF text AS $$
  SELECT id FROM brands WHERE user_id = p_user_id AND deleted_at IS NULL
$$ LANGUAGE sql STABLE SECURITY DEFINER;
