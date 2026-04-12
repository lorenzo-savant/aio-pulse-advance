-- ============================================================================
-- FIX: RLS Performance — wrap auth.uid() with (select auth.uid())
-- FIX: Multiple permissive policies — merge into single policies
-- FIX: Function search_path — set search_path for get_user_brand_ids
-- ============================================================================

-- ─── Fix function search_path ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_brand_ids(p_user_id text)
RETURNS SETOF text AS $$
  SELECT id FROM public.brands WHERE user_id = p_user_id AND deleted_at IS NULL
$$ LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public;

-- ─── Drop ALL existing policies and recreate with (select auth.uid()) ─────────

-- BRANDS
DROP POLICY IF EXISTS "Users can view own brands" ON brands;
DROP POLICY IF EXISTS "Users can insert own brands" ON brands;
DROP POLICY IF EXISTS "Users can update own brands" ON brands;
DROP POLICY IF EXISTS "Users can delete own brands" ON brands;
DROP POLICY IF EXISTS "Team members can view brands" ON brands;

CREATE POLICY "Users can view own brands or team brands"
  ON brands FOR SELECT
  USING (
    user_id = (select auth.uid())::text
    OR id IN (
      SELECT brand_id FROM team_members
      WHERE user_id = (select auth.uid())::text AND status = 'accepted'
    )
  );

CREATE POLICY "Users can insert own brands"
  ON brands FOR INSERT
  WITH CHECK (user_id = (select auth.uid())::text);

CREATE POLICY "Users can update own brands"
  ON brands FOR UPDATE
  USING (user_id = (select auth.uid())::text);

CREATE POLICY "Users can delete own brands"
  ON brands FOR DELETE
  USING (user_id = (select auth.uid())::text);

-- PROMPTS
DROP POLICY IF EXISTS "Users can manage own prompts" ON prompts;
CREATE POLICY "Users can manage own prompts"
  ON prompts FOR ALL
  USING (user_id = (select auth.uid())::text);

-- MONITORING RESULTS
DROP POLICY IF EXISTS "Users can view own monitoring results" ON monitoring_results;
DROP POLICY IF EXISTS "Users can insert monitoring results" ON monitoring_results;

CREATE POLICY "Users can view own monitoring results"
  ON monitoring_results FOR SELECT
  USING (user_id = (select auth.uid())::text);

CREATE POLICY "Users can insert monitoring results"
  ON monitoring_results FOR INSERT
  WITH CHECK (user_id = (select auth.uid())::text);

-- ALERT RULES
DROP POLICY IF EXISTS "Users can manage own alert rules" ON alert_rules;
CREATE POLICY "Users can manage own alert rules"
  ON alert_rules FOR ALL
  USING (user_id = (select auth.uid())::text);

-- ALERT EVENTS
DROP POLICY IF EXISTS "Users can view own alert events" ON alert_events;
DROP POLICY IF EXISTS "Users can update own alert events" ON alert_events;

CREATE POLICY "Users can view own alert events"
  ON alert_events FOR SELECT
  USING (user_id = (select auth.uid())::text);

CREATE POLICY "Users can update own alert events"
  ON alert_events FOR UPDATE
  USING (user_id = (select auth.uid())::text);

-- BRAND HEALTH SCORES
DROP POLICY IF EXISTS "Users can view own health scores" ON brand_health_scores;
DROP POLICY IF EXISTS "Users can upsert own health scores" ON brand_health_scores;
DROP POLICY IF EXISTS "Users can update own health scores" ON brand_health_scores;

CREATE POLICY "Users can view own health scores"
  ON brand_health_scores FOR SELECT
  USING (user_id = (select auth.uid())::text);

CREATE POLICY "Users can upsert own health scores"
  ON brand_health_scores FOR INSERT
  WITH CHECK (user_id = (select auth.uid())::text);

CREATE POLICY "Users can update own health scores"
  ON brand_health_scores FOR UPDATE
  USING (user_id = (select auth.uid())::text);

-- SUBSCRIPTIONS
DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON subscriptions;

CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (user_id = (select auth.uid())::text);

CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  USING (user_id = (select auth.uid())::text);

-- CREDITS
DROP POLICY IF EXISTS "Users can view own credits" ON credits;
DROP POLICY IF EXISTS "Users can insert credits" ON credits;

CREATE POLICY "Users can view own credits"
  ON credits FOR SELECT
  USING (user_id = (select auth.uid())::text);

CREATE POLICY "Users can insert credits"
  ON credits FOR INSERT
  WITH CHECK (user_id = (select auth.uid())::text);

-- CREDIT USAGE
DROP POLICY IF EXISTS "Users can view own credit usage" ON credit_usage;
DROP POLICY IF EXISTS "Users can insert credit usage" ON credit_usage;

CREATE POLICY "Users can view own credit usage"
  ON credit_usage FOR SELECT
  USING (user_id = (select auth.uid())::text);

CREATE POLICY "Users can insert credit usage"
  ON credit_usage FOR INSERT
  WITH CHECK (user_id = (select auth.uid())::text);

-- TEAM MEMBERS (merge into single SELECT policy)
DROP POLICY IF EXISTS "Users can view team members of own brands" ON team_members;
DROP POLICY IF EXISTS "Brand owners can manage team members" ON team_members;

CREATE POLICY "Users can view team members"
  ON team_members FOR SELECT
  USING (
    user_id = (select auth.uid())::text
    OR brand_id IN (SELECT id FROM brands WHERE user_id = (select auth.uid())::text)
  );

CREATE POLICY "Brand owners can manage team members"
  ON team_members FOR INSERT
  WITH CHECK (
    brand_id IN (SELECT id FROM brands WHERE user_id = (select auth.uid())::text)
  );

CREATE POLICY "Brand owners can update team members"
  ON team_members FOR UPDATE
  USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = (select auth.uid())::text)
  );

CREATE POLICY "Brand owners can delete team members"
  ON team_members FOR DELETE
  USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = (select auth.uid())::text)
  );

-- BRAND INVITATIONS (merge into single SELECT + separate write)
DROP POLICY IF EXISTS "Brand owners can manage invitations" ON brand_invitations;
DROP POLICY IF EXISTS "Anyone can read invitations by token" ON brand_invitations;

CREATE POLICY "Anyone can read invitations by token"
  ON brand_invitations FOR SELECT
  USING (true);

CREATE POLICY "Brand owners can insert invitations"
  ON brand_invitations FOR INSERT
  WITH CHECK (
    brand_id IN (SELECT id FROM brands WHERE user_id = (select auth.uid())::text)
  );

CREATE POLICY "Brand owners can update invitations"
  ON brand_invitations FOR UPDATE
  USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = (select auth.uid())::text)
  );

CREATE POLICY "Brand owners can delete invitations"
  ON brand_invitations FOR DELETE
  USING (
    brand_id IN (SELECT id FROM brands WHERE user_id = (select auth.uid())::text)
  );

-- API KEYS
DROP POLICY IF EXISTS "Users can manage own API keys" ON api_keys;
CREATE POLICY "Users can manage own API keys"
  ON api_keys FOR ALL
  USING (user_id = (select auth.uid())::text);

-- ANALYSIS RESULTS
DROP POLICY IF EXISTS "Users can manage own analysis results" ON analysis_results;
CREATE POLICY "Users can manage own analysis results"
  ON analysis_results FOR ALL
  USING (user_id = (select auth.uid())::text);

-- COMPETITOR ANALYSES
DROP POLICY IF EXISTS "Users can manage own competitor analyses" ON competitor_analyses;
CREATE POLICY "Users can manage own competitor analyses"
  ON competitor_analyses FOR ALL
  USING (user_id = (select auth.uid())::text);

-- RECOMMENDATION HISTORY
DROP POLICY IF EXISTS "Users can view own recommendations" ON recommendation_history;
DROP POLICY IF EXISTS "Users can insert recommendations" ON recommendation_history;

CREATE POLICY "Users can view own recommendations"
  ON recommendation_history FOR SELECT
  USING (user_id = (select auth.uid())::text);

CREATE POLICY "Users can insert recommendations"
  ON recommendation_history FOR INSERT
  WITH CHECK (user_id = (select auth.uid())::text);

-- CITATION SNAPSHOTS
DROP POLICY IF EXISTS "Users can view snapshots of own brands" ON citation_snapshots;
DROP POLICY IF EXISTS "Users can insert snapshots for own brands" ON citation_snapshots;
DROP POLICY IF EXISTS "Users can update snapshots for own brands" ON citation_snapshots;

CREATE POLICY "Users can view snapshots of own brands"
  ON citation_snapshots FOR SELECT
  USING (
    project_id IN (SELECT id FROM brands WHERE user_id = (select auth.uid())::text)
  );

CREATE POLICY "Users can insert snapshots for own brands"
  ON citation_snapshots FOR INSERT
  WITH CHECK (
    project_id IN (SELECT id FROM brands WHERE user_id = (select auth.uid())::text)
  );

CREATE POLICY "Users can update snapshots for own brands"
  ON citation_snapshots FOR UPDATE
  USING (
    project_id IN (SELECT id FROM brands WHERE user_id = (select auth.uid())::text)
  );
