-- ═══════════════════════════════════════════════════════════════════════════════
-- AIO PULSE - CORE TABLES MIGRATION
-- Run this entire file in Supabase SQL Editor to fix the 500 errors
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ═══════════════════════════════════════════════════════════════════════════════
-- BRANDS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS brands CASCADE;

CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  domain TEXT,
  aliases TEXT[] DEFAULT '{}',
  domains TEXT[] DEFAULT '{}',
  competitors TEXT[] DEFAULT '{}',
  industry TEXT,
  color TEXT DEFAULT '#6366f1',
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brands_select" ON brands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "brands_insert" ON brands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brands_update" ON brands FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "brands_delete" ON brands FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PROMPTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS prompts CASCADE;

CREATE TABLE prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  market TEXT DEFAULT 'global',
  category TEXT,
  engines TEXT[] DEFAULT ARRAY['chatgpt', 'gemini', 'perplexity'],
  run_frequency TEXT DEFAULT 'daily',
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompts_select" ON prompts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "prompts_insert" ON prompts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prompts_update" ON prompts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "prompts_delete" ON prompts FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SCAN HISTORY TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS scan_history CASCADE;

CREATE TABLE scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  source TEXT DEFAULT '',
  type TEXT DEFAULT 'text',
  summary TEXT DEFAULT '',
  visibility_score FLOAT DEFAULT 0,
  engine TEXT DEFAULT 'all',
  model TEXT DEFAULT 'default',
  intent TEXT DEFAULT 'Informational',
  intent_confidence FLOAT DEFAULT 0,
  content_type TEXT DEFAULT 'Article',
  tone TEXT DEFAULT 'Professional',
  reading_level TEXT DEFAULT 'Undergraduate',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_history_select" ON scan_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "scan_history_insert" ON scan_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "scan_history_delete" ON scan_history FOR DELETE USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEAM MEMBERS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS team_members CASCADE;

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- BRAND INVITATIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS brand_invitations CASCADE;

CREATE TABLE brand_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token UUID DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, email)
);

ALTER TABLE brand_invitations ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- MONITORING RESULTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS monitoring_results CASCADE;

CREATE TABLE monitoring_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE NOT NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  engine TEXT NOT NULL,
  query_text TEXT NOT NULL,
  response_text TEXT,
  url TEXT,
  brand_mentioned BOOLEAN DEFAULT false,
  sentiment_score FLOAT,
  visibility_score FLOAT DEFAULT 0,
  has_hallucination BOOLEAN DEFAULT false,
  competitor_mentions JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE monitoring_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monitoring_results_select" ON monitoring_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "monitoring_results_insert" ON monitoring_results FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECURITY LOGS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS security_logs CASCADE;

CREATE TABLE security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  event_data JSONB,
  severity TEXT DEFAULT 'info',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- WORKFLOW EXECUTIONS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS workflow_executions CASCADE;

CREATE TABLE workflow_executions (
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

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX idx_brands_user_id ON brands(user_id);
CREATE INDEX idx_prompts_user_id ON prompts(user_id);
CREATE INDEX idx_prompts_brand_id ON prompts(brand_id);
CREATE INDEX idx_scan_history_user_id ON scan_history(user_id);
CREATE INDEX idx_monitoring_results_user_id ON monitoring_results(user_id);
CREATE INDEX idx_monitoring_results_brand_id ON monitoring_results(brand_id);
CREATE INDEX idx_workflow_executions_user_id ON workflow_executions(user_id);

-- Done!
SELECT '✅ All tables created successfully!' as status;
