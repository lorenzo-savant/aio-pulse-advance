-- ═══════════════════════════════════════════════════════════════════════════════
-- RECOMMENDATION TRACKING TABLE
-- Tracks AI-generated recommendations with implementation status
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS recommendation_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  category TEXT,
  priority TEXT DEFAULT 'medium',
  recommendation_text TEXT NOT NULL,
  source TEXT,
  first_seen_date TIMESTAMPTZ,
  last_seen_date TIMESTAMPTZ,
  occurrence_count INT DEFAULT 1,
  implementation_status TEXT DEFAULT 'pending',
  implementation_completion_date TIMESTAMPTZ,
  notes TEXT,
  status TEXT DEFAULT 'active',
  user_last_updated_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE recommendation_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view recommendation_tracking for their brands"
  ON recommendation_tracking FOR SELECT
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE POLICY "Users can update recommendation_tracking for their brands"
  ON recommendation_tracking FOR UPDATE
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE INDEX idx_recommendation_tracking_brand_id ON recommendation_tracking(brand_id);
CREATE INDEX idx_recommendation_tracking_status ON recommendation_tracking(status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- RESEARCH ARCHIVES TABLE
-- Stores archived research queries and responses
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS research_archives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query_type TEXT NOT NULL,
  tool_section TEXT,
  query_text TEXT,
  query_date TIMESTAMPTZ,
  ai_model_used TEXT,
  response_text TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE research_archives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own research_archives"
  ON research_archives FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own research_archives"
  ON research_archives FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_research_archives_brand_id ON research_archives(brand_id);
CREATE INDEX idx_research_archives_user_id ON research_archives(user_id);
CREATE INDEX idx_research_archives_status ON research_archives(status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SENTIMENT HISTORY TABLE
-- Stores periodic sentiment snapshots per brand
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sentiment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  sentiment_score NUMERIC DEFAULT 0,
  positive_count INT DEFAULT 0,
  neutral_count INT DEFAULT 0,
  negative_count INT DEFAULT 0,
  total_mentions INT DEFAULT 0,
  top_positive_topics JSONB,
  top_negative_topics JSONB,
  metadata JSONB DEFAULT '{}',
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sentiment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sentiment_history for their brands"
  ON sentiment_history FOR SELECT
  USING (brand_id IN (SELECT id FROM brands WHERE user_id = auth.uid()));

CREATE INDEX idx_sentiment_history_brand_id ON sentiment_history(brand_id);
CREATE INDEX idx_sentiment_history_snapshot_date ON sentiment_history(snapshot_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- WORKFLOW EXECUTIONS TABLE (if not already created)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_type TEXT NOT NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  steps JSONB DEFAULT '[]',
  error TEXT,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own workflow_executions"
  ON workflow_executions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own workflow_executions"
  ON workflow_executions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_workflow_executions_user_id ON workflow_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_brand_id ON workflow_executions(brand_id);
