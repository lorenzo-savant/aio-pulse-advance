-- FIX: Schema type mismatch - Drop and recreate tables with correct UUID types
-- Run this to fix the foreign key constraint error

-- Drop tables in correct order (if exists)
DROP TABLE IF EXISTS scan_history CASCADE;
DROP TABLE IF EXISTS monitoring_results CASCADE;
DROP TABLE IF EXISTS prompts CASCADE;
DROP TABLE IF EXISTS alert_events CASCADE;
DROP TABLE IF EXISTS alert_rules CASCADE;
DROP TABLE IF EXISTS brand_health_scores CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS brand_invitations CASCADE;
DROP TABLE IF EXISTS brands CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS user_api_keys CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS credits CASCADE;
DROP TABLE IF EXISTS credit_usage CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TABLE IF EXISTS analysis_results CASCADE;
DROP TABLE IF EXISTS competitor_analyses CASCADE;
DROP TABLE IF EXISTS recommendation_history CASCADE;
DROP TABLE IF EXISTS seo_audit_results CASCADE;
DROP TABLE IF EXISTS llms_txt_versions CASCADE;
DROP TABLE IF EXISTS weekly_reviews CASCADE;
DROP TABLE IF EXISTS citation_snapshots CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS brand_invitations CASCADE;
DROP TABLE IF EXISTS workflow_executions CASCADE;
DROP TABLE IF EXISTS recommendation_tracking CASCADE;
DROP TABLE IF EXISTS research_archives CASCADE;
DROP TABLE IF EXISTS sentiment_history CASCADE;
DROP TABLE IF EXISTS webhook_delivery_logs CASCADE;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── PROFILES ───────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ─── USER API KEYS ───────────────────────────────────────────────────────────────
CREATE TABLE user_api_keys (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('openai', 'gemini', 'perplexity', 'anthropic')),
  encrypted_key text NOT NULL,
  label text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, provider));

CREATE INDEX user_api_keys_user_id_idx ON user_api_keys(user_id);

-- ─── BRANDS ───────────────────────────────────────────────────────────────────
CREATE TABLE brands (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  domain text,
  aliases text[] DEFAULT '{}',
  domains text[] DEFAULT '{}',
  competitors text[] DEFAULT '{}',
  industry text,
  color text DEFAULT '#636f6f1',
  logo_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  report_logo_url text,
  report_brand_name text,
  report_primary_color text,
  UNIQUE(user_id, slug));

CREATE INDEX brands_user_id_idx ON brands(user_id);
CREATE INDEX brands_slug_idx ON brands(slug);

-- ─── PROMPTS ──────────────────────────────────────────────────────────────────
CREATE TABLE prompts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  text text NOT NULL,
  language text DEFAULT 'en',
  market text DEFAULT 'global',
  category text,
  engines text[] DEFAULT '{chatgpt,gemini,perplexity}',
  is_active boolean DEFAULT true,
  run_frequency text DEFAULT 'daily',
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now());

CREATE INDEX prompts_brand_id_idx ON prompts(brand_id);
CREATE INDEX prompts_user_id_idx ON prompts(user_id);

-- ─── MONITORING RESULTS ───────────────────────────────────────────────────────
CREATE TABLE monitoring_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id uuid NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  engine text NOT NULL,
  prompt_text text NOT NULL,
  response_text text NOT NULL,
  brand_mentioned boolean DEFAULT false,
  mention_position int,
  mention_count int DEFAULT 0,
  mention_type text,
  visibility_score int DEFAULT 0,
  sentiment text,
  sentiment_score float,
  cited_urls text[] DEFAULT '{}',
  competitor_mentions jsonb DEFAULT '[]',
  has_hallucination boolean DEFAULT false,
  hallucination_flags jsonb DEFAULT '[]',
  raw_response jsonb,
  execution_time_ms int,
  cost_credits float,
  primary_provider text,
  all_providers text[] DEFAULT '{}',
  failed_providers text[] DEFAULT '{}',
  response_comparison jsonb,
  created_at timestamptz DEFAULT now());

CREATE INDEX monitoring_results_brand_id_idx ON monitoring_results(brand_id);
CREATE INDEX monitoring_results_prompt_id_idx ON monitoring_results(prompt_id);
CREATE INDEX monitoring_results_engine_idx ON monitoring_results(engine);
CREATE INDEX monitoring_results_created_at_idx ON monitoring_results(created_at DESC);
CREATE INDEX monitoring_results_user_id_idx ON monitoring_results(user_id);

-- ─── SCAN HISTORY ────────────────────────────────────────────────────────────────
CREATE TABLE scan_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  source text NOT NULL,
  type text NOT NULL,
  summary text,
  visibility_score int DEFAULT 0,
  engine text NOT NULL,
  model text,
  intent text,
  intent_confidence int,
  content_type text,
  tone text,
  reading_level text,
  created_at timestamptz DEFAULT now());

CREATE INDEX scan_history_user_id_idx ON scan_history(user_id);
CREATE INDEX scan_history_brand_id_idx ON scan_history(brand_id);
CREATE INDEX scan_history_created_at_idx ON scan_history(created_at DESC);

-- ─── ALERT RULES ──────────────────────────────────────────────────────────────
CREATE TABLE alert_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  condition jsonb NOT NULL,
  channels text[] DEFAULT '{email}',
  email text,
  webhook_url text,
  is_active boolean DEFAULT true,
  last_fired_at timestamptz,
  created_at timestamptz DEFAULT now());

CREATE INDEX alert_rules_brand_id_idx ON alert_rules(brand_id);
CREATE INDEX alert_rules_user_id_idx ON alert_rules(user_id);

-- ─── ALERT EVENTS ─────────────────────────────────────────────────────────────
CREATE TABLE alert_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_rule_id uuid REFERENCES alert_rules(id) ON DELETE SET NULL,
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}',
  channels_sent text[] DEFAULT '{}',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now());

CREATE INDEX alert_events_brand_id_idx ON alert_events(brand_id);
CREATE INDEX alert_events_user_id_idx ON alert_events(user_id);
CREATE INDEX alert_events_is_read_idx ON alert_events(is_read);
CREATE INDEX alert_events_created_at_idx ON alert_events(created_at DESC);

-- ─── BRAND HEALTH SCORES ──────────────────────────────────────────────────────
CREATE TABLE brand_health_scores (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  date date NOT NULL,
  visibility_score float DEFAULT 0,
  sentiment_score float DEFAULT 0,
  hallucination_rate float DEFAULT 0,
  mention_count int DEFAULT 0,
  citation_count int DEFAULT 0,
  avi_score float DEFAULT 0,
  citation_rate float DEFAULT 0,
  mention_rate float DEFAULT 0,
  recommendation_rate float DEFAULT 0,
  position_avg float DEFAULT 0,
  health_score float DEFAULT 0,
  engine_breakdown jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, date));

CREATE INDEX brand_health_scores_brand_id_idx ON brand_health_scores(brand_id);
CREATE INDEX brand_health_scores_date_idx ON brand_health_scores(date DESC);

-- ─── TEAM MEMBERS ─────────────────────────────────────────────────────────────
CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id text,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, email));

CREATE INDEX team_members_brand_id_idx ON team_members(brand_id);
CREATE INDEX team_members_user_id_idx ON team_members(user_id);

-- ─── INVITATIONS ─────────────────────────────────────────────────────────────
CREATE TABLE brand_invitations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_by text NOT NULL,
  token text NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  expires_at timestamptz NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, email));

CREATE INDEX invitations_token_idx ON brand_invitations(token);
CREATE INDEX invitations_email_idx ON brand_invitations(email);

-- ─── SUBSCRIPTIONS ─────────────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id text NOT NULL UNIQUE,
  stripe_customer_id text,
  stripe_sub_id text,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now());

CREATE INDEX subscriptions_user_idx ON subscriptions(user_id);
CREATE INDEX subscriptions_stripe_idx ON subscriptions(stripe_customer_id);

-- ─── CREDITS ───────────────────────────────────────────────────────────────
CREATE TABLE credits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  amount int NOT NULL,
  source text NOT NULL,
  stripe_payment_id text,
  description text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now());

CREATE INDEX credits_user_id_idx ON credits(user_id);
CREATE INDEX credits_created_idx ON credits(created_at DESC);

CREATE TABLE credit_usage (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id text NOT NULL,
  query_id text,
  credits_used int NOT NULL,
  provider text,
  engine text,
  brand_id uuid,
  description text,
  cost_credits float,
  created_at timestamptz DEFAULT now());

CREATE INDEX credit_usage_user_idx ON credit_usage(user_id);
CREATE INDEX credit_usage_created_idx ON credit_usage(created_at DESC);
CREATE INDEX credit_usage_brand_idx ON credit_usage(brand_id);

-- ─── CITATION SNAPSHOTS ─────────────────────────────────────────────────────────
CREATE TABLE citation_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  scan_date date NOT NULL,
  engine text NOT NULL DEFAULT 'all',
  category text NOT NULL DEFAULT 'all',
  language text NOT NULL DEFAULT 'all',
  total_prompts int DEFAULT 0,
  brand_citations int DEFAULT 0,
  citation_rate float DEFAULT 0,
  avg_position float,
  avg_visibility float DEFAULT 0,
  avg_sentiment float DEFAULT 0,
  competitor_rates jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, scan_date, engine, category, language));

CREATE INDEX citation_snapshots_brand_idx ON citation_snapshots(brand_id);
CREATE INDEX citation_snapshots_date_idx ON citation_snapshots(scan_date DESC);

-- ─── ANALYSIS RESULTS ─────────────────────────────────────────────────────────
CREATE TABLE analysis_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  input text NOT NULL,
  input_mode text NOT NULL,
  engine text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  visibility_score int,
  sentiment text,
  sentiment_score float,
  summary text,
  recommendations jsonb DEFAULT '[]',
  raw_response jsonb,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz);

CREATE INDEX analysis_results_brand_id_idx ON analysis_results(brand_id);
CREATE INDEX analysis_results_user_id_idx ON analysis_results(user_id);
CREATE INDEX analysis_results_created_idx ON analysis_results(created_at DESC);

-- ─── COMPETITOR ANALYSES ─────────────────────────────────────────────────────────
CREATE TABLE competitor_analyses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  primary_url text NOT NULL,
  competitors jsonb DEFAULT '[]',
  summary text,
  raw_response jsonb,
  created_at timestamptz DEFAULT now());

CREATE INDEX competitor_analyses_brand_id_idx ON competitor_analyses(brand_id);
CREATE INDEX competitor_analyses_user_id_idx ON competitor_analyses(user_id);
CREATE INDEX competitor_analyses_created_idx ON competitor_analyses(created_at DESC);

-- ─── RECOMMENDATION HISTORY ─────────────────────────────────────────────────────────
CREATE TABLE recommendation_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  recommendations jsonb DEFAULT '[]',
  summary text,
  based_on_count int DEFAULT 0,
  created_at timestamptz DEFAULT now());

CREATE INDEX recommendation_history_brand_id_idx ON recommendation_history(brand_id);
CREATE INDEX recommendation_history_user_id_idx ON recommendation_history(user_id);
CREATE INDEX recommendation_history_created_idx ON recommendation_history(created_at DESC);

-- ─── SEO AUDIT RESULTS ─────────────────────────────────────────────────────────
CREATE TABLE seo_audit_results (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  url text NOT NULL,
  overall_score float NOT NULL,
  results jsonb DEFAULT '{}',
  cached_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now());

CREATE INDEX seo_audit_results_user_id_idx ON seo_audit_results(user_id);
CREATE INDEX seo_audit_results_brand_id_idx ON seo_audit_results(brand_id);
CREATE INDEX seo_audit_results_url_idx ON seo_audit_results(url);

-- ─── LLMS.TXT VERSIONS ────────────────────────────────────────────────────��─��──
CREATE TABLE llms_txt_versions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  llms_txt text NOT NULL,
  llms_full_txt text NOT NULL,
  input_data jsonb DEFAULT '{}',
  version int DEFAULT 1,
  created_at timestamptz DEFAULT now());

CREATE INDEX llms_txt_versions_brand_id_idx ON llms_txt_versions(brand_id);
CREATE INDEX llms_txt_versions_user_id_idx ON llms_txt_versions(user_id);
CREATE INDEX llms_txt_versions_created_idx ON llms_txt_versions(created_at DESC);

-- ─── WEEKLY REVIEWS ─────────────────────────────────────────────────────────
CREATE TABLE weekly_reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  week_number int NOT NULL,
  year int NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  metrics jsonb DEFAULT '{}',
  markdown text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(brand_id, year, week_number));

CREATE INDEX weekly_reviews_brand_id_idx ON weekly_reviews(brand_id);
CREATE INDEX weekly_reviews_user_id_idx ON weekly_reviews(user_id);

-- ─── WORKFLOW EXECUTIONS ─────────────────────────────────────────────────────────
CREATE TABLE workflow_executions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id uuid REFERENCES brands(id) ON DELETE SET NULL,
  user_id text NOT NULL,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'retrying')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error text,
  steps jsonb DEFAULT '[]',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now());

CREATE INDEX workflow_executions_brand_id_idx ON workflow_executions(brand_id);
CREATE INDEX workflow_executions_user_id_idx ON workflow_executions(user_id);
CREATE INDEX workflow_executions_status_idx ON workflow_executions(status);
CREATE INDEX workflow_executions_created_idx ON workflow_executions(created_at DESC);

-- ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brands_updated_at BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER prompts_updated_at BEFORE UPDATE ON prompts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER team_members_updated_at BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE citation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_audit_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE llms_txt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (simplified)
CREATE POLICY "users_own_profile" ON profiles FOR SELECT USING (id::text = (SELECT auth.uid())::text);
CREATE POLICY "users_update_profile" ON profiles FOR UPDATE USING (id::text = (SELECT auth.uid())::text);
CREATE POLICY "users_insert_profile" ON profiles FOR INSERT WITH CHECK (id::text = (SELECT auth.uid())::text);

CREATE POLICY "users_own_api_keys" ON user_api_keys FOR ALL USING (user_id = (SELECT auth.uid())::text);

CREATE POLICY "users_own_brands" ON brands FOR SELECT USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_insert_brands" ON brands FOR INSERT WITH CHECK (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_update_brands" ON brands FOR UPDATE USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_delete_brands" ON brands FOR DELETE USING (user_id = (SELECT auth.uid())::text);

CREATE POLICY "users_own_prompts" ON prompts FOR SELECT USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_insert_prompts" ON prompts FOR INSERT WITH CHECK (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_update_prompts" ON prompts FOR UPDATE USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_delete_prompts" ON prompts FOR DELETE USING (user_id = (SELECT auth.uid())::text);

CREATE POLICY "users_own_monitoring" ON monitoring_results FOR SELECT USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_insert_monitoring" ON monitoring_results FOR INSERT WITH CHECK (user_id = (SELECT auth.uid())::text);

CREATE POLICY "users_own_scan_history" ON scan_history FOR ALL USING (user_id = (SELECT auth.uid())::text);

CREATE POLICY "users_own_alerts" ON alert_rules FOR SELECT USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_insert_alerts" ON alert_rules FOR INSERT WITH CHECK (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_update_alerts" ON alert_rules FOR UPDATE USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_delete_alerts" ON alert_rules FOR DELETE USING (user_id = (SELECT auth.uid())::text);

CREATE POLICY "users_own_alert_events" ON alert_events FOR SELECT USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_update_alert_events" ON alert_events FOR UPDATE USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_delete_alert_events" ON alert_events FOR DELETE USING (user_id = (SELECT auth.uid())::text);

CREATE POLICY "users_own_health_scores" ON brand_health_scores FOR SELECT USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_insert_health_scores" ON brand_health_scores FOR INSERT WITH CHECK (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_update_health_scores" ON brand_health_scores FOR UPDATE USING (user_id = (SELECT auth.uid())::text);

CREATE POLICY "team_owner_manage" ON team_members FOR ALL USING (
  brand_id IN (SELECT id FROM brands WHERE user_id = (SELECT auth.uid())::text));

CREATE POLICY "team_members_select" ON team_members FOR SELECT USING (
  brand_id IN (SELECT id FROM brands WHERE user_id = (SELECT auth.uid())::text)
  OR brand_id IN (SELECT brand_id FROM team_members WHERE user_id::uuid = (SELECT auth.uid()) AND status = 'accepted'));

CREATE POLICY "users_own_subscription" ON subscriptions FOR ALL USING (user_id = (SELECT auth.uid())::text);

CREATE POLICY "users_own_credit_usage" ON credits FOR ALL USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_own_credit_usage_log" ON credit_usage FOR ALL USING (user_id = (SELECT auth.uid())::text);

CREATE POLICY "users_own_citation_snapshots" ON citation_snapshots FOR SELECT USING (
  brand_id IN (SELECT id FROM brands WHERE user_id = (SELECT auth.uid())::text));
CREATE POLICY "users_insert_citation_snapshots" ON citation_snapshots FOR INSERT WITH CHECK (
  brand_id IN (SELECT id FROM brands WHERE user_id = (SELECT auth.uid())::text));

CREATE POLICY "users_own_analysis" ON analysis_results FOR ALL USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_own_competitor" ON competitor_analyses FOR ALL USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_own_recommendations" ON recommendation_history FOR ALL USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_own_seo_audit" ON seo_audit_results FOR ALL USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_own_llms_txt" ON llms_txt_versions FOR ALL USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_own_weekly_reviews" ON weekly_reviews FOR ALL USING (user_id = (SELECT auth.uid())::text);
CREATE POLICY "users_own_workflows" ON workflow_executions FOR ALL USING (user_id = (SELECT auth.uid())::text);