-- Fix RLS policies - handle UUID vs TEXT types properly
-- citation_snapshots
ALTER TABLE citation_snapshots ADD COLUMN IF NOT EXISTS user_id TEXT;
DROP POLICY IF EXISTS "citation_snapshots_select" ON citation_snapshots;
CREATE POLICY "citation_snapshots_select" ON citation_snapshots FOR SELECT USING (auth.uid()::text = user_id OR user_id IS NULL);

-- brand_health_scores - user_id is already UUID
DROP POLICY IF EXISTS "brand_health_scores_select" ON brand_health_scores;
CREATE POLICY "brand_health_scores_select" ON brand_health_scores FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- alert_rules - user_id is already UUID
DROP POLICY IF EXISTS "alert_rules_select" ON alert_rules;
CREATE POLICY "alert_rules_select" ON alert_rules FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- alert_events - user_id is already UUID  
DROP POLICY IF EXISTS "alert_events_select" ON alert_events;
CREATE POLICY "alert_events_select" ON alert_events FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- subscriptions - user_id is already UUID
DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
CREATE POLICY "subscriptions_select" ON subscriptions FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- Create keyword_tracking if not exists
CREATE TABLE IF NOT EXISTS keyword_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  market TEXT DEFAULT 'global',
  category TEXT,
  engines TEXT[] DEFAULT '{}',
  correlation_score FLOAT DEFAULT 0,
  mention_count INTEGER DEFAULT 0,
  avg_position FLOAT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE keyword_tracking ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "keyword_tracking_select" ON keyword_tracking;
CREATE POLICY "keyword_tracking_select" ON keyword_tracking FOR SELECT USING (auth.uid() = user_id);

-- Create competitor_analyses if not exists
CREATE TABLE IF NOT EXISTS competitor_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  analysis_date DATE NOT NULL,
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE competitor_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "competitor_analyses_select" ON competitor_analyses;
CREATE POLICY "competitor_analyses_select" ON competitor_analyses FOR SELECT USING (auth.uid() = user_id);

-- Create recommendation_history if not exists
CREATE TABLE IF NOT EXISTS recommendation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL,
  content TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE recommendation_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recommendation_history_select" ON recommendation_history;
CREATE POLICY "recommendation_history_select" ON recommendation_history FOR SELECT USING (auth.uid() = user_id);

-- Create profiles if not exists
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(id)
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);

-- Create user_api_keys if not exists
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  label TEXT,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_api_keys_select" ON user_api_keys;
CREATE POLICY "user_api_keys_select" ON user_api_keys FOR SELECT USING (auth.uid() = user_id);

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated;

SELECT '✅ Done!' as status;
